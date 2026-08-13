import { NextRequest, NextResponse } from "next/server";
import { apiFetchRaw, resolveSeason } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import { countUnavailable, type APIInjuryRow } from "@/lib/availability";

/**
 * Who is unavailable across a whole competition, grouped by fixture.
 *
 * GET /api/football/injuries?league=39&season=2025
 *
 * The per-fixture route next door answers one match at a time, which is right
 * for the match page and wrong for anything else: pricing a day of fixtures
 * that way costs one upstream request per match. This costs one per
 * competition, which is what makes the signal affordable in the feed at all,
 * and what makes a season-long backtest possible without exhausting the quota.
 */

const INJURIES_TTL = 1800;
const MAX_PAGES = 20;

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

    const rows: APIInjuryRow[] = [];
    let page = 1;
    let pagesAvailable = 1;

    // Sequential, not parallel: a burst of concurrent calls is what got this
    // API to return 429 earlier in the project's life.
    while (page <= Math.min(pagesAvailable, MAX_PAGES)) {
      const { response, paging } = await apiFetchRaw<APIInjuryRow[]>(
        "/injuries",
        { league: String(leagueId), season, page: String(page) },
        INJURIES_TTL
      );
      rows.push(...(response ?? []));
      pagesAvailable = paging?.total ?? 1;
      page++;
    }

    const byFixture = countUnavailable(rows);

    return NextResponse.json(byFixture, {
      headers: {
        "Cache-Control": `s-maxage=${INJURIES_TTL}, stale-while-revalidate=300`,
        "x-injuries-rows": String(rows.length),
        "x-injuries-fixtures": String(Object.keys(byFixture).length),
        "x-injuries-pages": String(page - 1),
        "x-injuries-pages-available": String(pagesAvailable),
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
