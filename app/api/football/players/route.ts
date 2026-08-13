import { NextRequest, NextResponse } from "next/server";
import { apiFetchRaw, resolveSeason } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import type { MinutesByPlayer } from "@/lib/availability";

/**
 * Minutes played per player across a competition.
 *
 * GET /api/football/players?league=39&season=2025  ->  { "<playerId>": minutes }
 *
 * Exists to weight absences: an injury list is only meaningful if you know
 * which of the missing players actually play. Unlike /injuries this endpoint is
 * paginated, roughly twenty players a page, so a league season is a few dozen
 * requests — worth it once per competition, never per fixture.
 */

interface APIPlayerRow {
  player?: { id?: number };
  statistics?: Array<{
    league?: { id?: number };
    games?: { minutes?: number | null };
  }>;
}

const PLAYERS_TTL = 86400;
/** A league season is ~35 pages; the cap is a guard, not an expectation. */
const MAX_PAGES = 60;

/**
 * Each page is its own upstream call, so a whole season is tens of them in
 * sequence. That is comfortably longer than the default function budget, hence
 * the raised ceiling and the page window below.
 */
export const maxDuration = 60;

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

    // A page window keeps any single request bounded, so a slow upstream cannot
    // run the whole season past the function timeout. Callers that want the lot
    // ask for it in a couple of slices.
    const from = Math.max(1, parseInt(searchParams.get("from") ?? "1", 10) || 1);
    const to = Math.min(MAX_PAGES, parseInt(searchParams.get("to") ?? String(MAX_PAGES), 10) || MAX_PAGES);

    const minutes: MinutesByPlayer = {};
    let page = from;
    let pagesAvailable = to;
    let rows = 0;

    // Sequential, not parallel: a burst of concurrent calls is what got this
    // API to return 429 earlier in the project's life.
    while (page <= Math.min(pagesAvailable, to)) {
      const { response, paging } = await apiFetchRaw<APIPlayerRow[]>(
        "/players",
        { league: String(leagueId), season, page: String(page) },
        PLAYERS_TTL
      );

      for (const row of response ?? []) {
        rows++;
        const id = row?.player?.id;
        if (!id) continue;
        // A player can appear under several teams in one season; only minutes
        // in this competition count toward how much he plays in it.
        let played = 0;
        for (const s of row.statistics ?? []) {
          if (s?.league?.id !== leagueId) continue;
          played += s?.games?.minutes ?? 0;
        }
        if (played > 0) minutes[String(id)] = (minutes[String(id)] ?? 0) + played;
      }

      pagesAvailable = Math.min(paging?.total ?? 1, MAX_PAGES);
      page++;
    }

    return NextResponse.json(minutes, {
      headers: {
        "Cache-Control": `s-maxage=${PLAYERS_TTL}, stale-while-revalidate=3600`,
        "x-players-rows": String(rows),
        "x-players-with-minutes": String(Object.keys(minutes).length),
        "x-players-page-from": String(from),
        "x-players-page-last": String(page - 1),
        "x-players-pages-available": String(pagesAvailable),
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
