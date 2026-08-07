import { NextRequest, NextResponse } from "next/server";
import { apiFetchRaw } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import { deVig, parseOdd, type OneXTwo } from "@/lib/odds";

/**
 * Win probabilities for a whole day's fixtures, expressed as fair decimal odds.
 *
 * GET /api/football/odds?date=YYYY-MM-DD
 *   -> { "1387342": { home: 2.22, draw: 3.57, away: 3.70 }, ... }
 *
 * Queried by date rather than per fixture. The alternative, /predictions per
 * match, would be one upstream request per row — fifty on a normal homepage,
 * which this account's burst allowance rejects outright.
 */

interface APIOddsValue {
  value: string;
  odd: string;
}

interface APIOddsEntry {
  fixture?: { id?: number };
  bookmakers?: {
    id?: number;
    name?: string;
    bets?: { id?: number; name?: string; values?: APIOddsValue[] }[];
  }[];
}

/** API-Football's bet id for the 1X2 / Match Winner market. */
const MATCH_WINNER_BET = "1";

/**
 * Odds move, but not minute to minute for our purposes, and every page costs a
 * request. Ten minutes keeps a busy homepage to a handful of calls an hour.
 */
const ODDS_TTL = 600;

/** Guards against a pathological day consuming the burst allowance. */
const MAX_PAGES = 3;

function readOneXTwo(entry: APIOddsEntry): OneXTwo | null {
  // Any bookmaker will do — they are taken only as a probability estimate, and
  // the first present is the one most likely to have a full set of prices.
  for (const bookmaker of entry.bookmakers ?? []) {
    for (const bet of bookmaker.bets ?? []) {
      const values = bet.values ?? [];
      const pick = (name: string) =>
        parseOdd(values.find((v) => v.value?.toLowerCase() === name)?.odd);

      const home = pick("home");
      const draw = pick("draw");
      const away = pick("away");

      if (home !== null && draw !== null && away !== null) {
        return { home, draw, away };
      }
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  // Date-scoped only. A from/to range would be one request per day, so callers
  // showing a week are expected to omit odds rather than fan out.
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  }

  try {
    const result: Record<string, OneXTwo> = {};
    let page = 1;
    let totalPages = 1;

    // Sequential, not parallel: pages are fetched one after another so a busy
    // day cannot produce a burst of simultaneous upstream requests.
    while (page <= Math.min(totalPages, MAX_PAGES)) {
      const { response, paging } = await apiFetchRaw<APIOddsEntry[]>(
        "/odds",
        { date, bet: MATCH_WINNER_BET, page: String(page) },
        ODDS_TTL
      );

      totalPages = paging.total;

      for (const entry of response ?? []) {
        const fixtureId = entry.fixture?.id;
        if (!fixtureId) continue;

        const raw = readOneXTwo(entry);
        if (!raw) continue;

        // Stored as fair odds so oddsToPercent() downstream yields percentages
        // that sum to 100 rather than the bookmaker's ~105.
        const fair = deVig(raw);
        if (fair) result[String(fixtureId)] = fair;
      }

      page += 1;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": `s-maxage=${ODDS_TTL}, stale-while-revalidate=120` },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
