import { NextRequest, NextResponse } from "next/server";
import {
  fetchCurrentLeagues,
  inProgressSeason,
  MAJOR_LEAGUES,
} from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

export interface ActiveLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  season: number;
}

// A league is "active" when today falls within the start/end dates of its
// current season — this is what keeps preseason competitions (e.g. EPL in
// July) out of the news/standings/scorers panels until they actually kick off.
// The check itself lives in lib/api-football as inProgressSeason, shared with
// resolveSeason.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").map((s) => Number(s.trim())).filter(Boolean)
    : MAJOR_LEAGUES.map((l) => l.id);

  try {
    // One upstream request for every league, then filter locally. Asking per
    // league put thirteen requests inside the same minute, which the account's
    // burst allowance rejected outright — a single visitor was enough to return
    // 429 and blank the panels this feeds.
    const leagues = await fetchCurrentLeagues();
    const byId = new Map(leagues.map((l) => [l.league?.id, l]));

    const active = ids.flatMap((id) => {
      const info = byId.get(id);
      if (!info) return [];
      const activeSeason = inProgressSeason(info.seasons ?? []);
      if (!activeSeason) return [];
      const entry: ActiveLeague = {
        id: info.league.id,
        name: info.league.name,
        country: info.country.name,
        logo: info.league.logo,
        season: activeSeason.year,
      };
      return [entry];
    });
    return NextResponse.json(active, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=300" },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
