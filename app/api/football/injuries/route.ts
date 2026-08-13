import { NextRequest, NextResponse } from "next/server";
import { apiFetchRaw, resolveSeason } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import { missingPlayers, type APIInjuryRow } from "@/lib/availability";

/**
 * Who is unavailable across a whole competition, as player ids per fixture.
 *
 * GET /api/football/injuries?league=39&season=2025
 *
 * The per-fixture route next door answers one match at a time, which is right
 * for the match page and wrong for anything else: a day of fixtures would cost
 * one upstream request each. This costs one per competition.
 *
 * Note this endpoint takes no page parameter — passing one is rejected with
 * "The Page field do not exist", which is how the first version of this route
 * failed. A league-season returns in a single response.
 */

const INJURIES_TTL = 1800;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");
  if (!league) {
    return NextResponse.json({ error: "league is required" }, { status: 400 });
  }
  const leagueId = parseInt(league, 10);
  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return NextResponse.json({ error: "league must be a positive integer" }, { status: 400 });
  }

  try {
    const season = searchParams.get("season") ?? (await resolveSeason(leagueId));
    const { response } = await apiFetchRaw<APIInjuryRow[]>(
      "/injuries",
      { league: String(leagueId), season },
      INJURIES_TTL
    );

    const rows = response ?? [];
    const byFixture = missingPlayers(rows);

    return NextResponse.json(byFixture, {
      headers: {
        "Cache-Control": `s-maxage=${INJURIES_TTL}, stale-while-revalidate=300`,
        "x-injuries-rows": String(rows.length),
        "x-injuries-fixtures": String(Object.keys(byFixture).length),
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
