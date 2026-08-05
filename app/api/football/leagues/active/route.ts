import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiFootballError, MAJOR_LEAGUES } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

interface APILeagueSeason {
  year: number;
  start: string;
  end: string;
  current: boolean;
}

interface APILeagueInfo {
  league: { id: number; name: string; logo: string };
  country: { name: string; flag: string | null };
  seasons: APILeagueSeason[];
}

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
function isInSeason(seasons: APILeagueSeason[]): APILeagueSeason | undefined {
  const today = new Date();
  return seasons.find((s) => {
    if (!s.current) return false;
    return today >= new Date(s.start) && today <= new Date(s.end);
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").map((s) => Number(s.trim())).filter(Boolean)
    : MAJOR_LEAGUES.map((l) => l.id);

  try {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const data = await apiFetch<APILeagueInfo[]>("/leagues", { id: String(id) }, 3600);
          const info = data[0];
          if (!info) return null;
          const activeSeason = isInSeason(info.seasons ?? []);
          if (!activeSeason) return null;
          const active: ActiveLeague = {
            id: info.league.id,
            name: info.league.name,
            country: info.country.name,
            logo: info.league.logo,
            season: activeSeason.year,
          };
          return active;
        } catch (e) {
          // Per-league failures are tolerated so one bad league doesn't blank
          // the panel — but a credential or quota failure affects every league,
          // so let it bubble up instead of masking it as "no active leagues".
          if (e instanceof ApiFootballError && e.kind !== "api" && e.kind !== "http") {
            throw e;
          }
          return null;
        }
      })
    );

    const active = results.filter((r): r is ActiveLeague => r !== null);
    return NextResponse.json(active, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=300" },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
