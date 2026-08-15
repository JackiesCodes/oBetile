import { NextRequest, NextResponse } from "next/server";
import { apiFetchRaw } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import { deVig, parseOdd, type OneXTwo } from "@/lib/odds";
import { inBatches, settle } from "@/lib/batch";

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

/**
 * A cold sweep of a whole day is dozens of upstream pages, which comfortably
 * outlives the default function timeout even batched. Cached sweeps return
 * immediately; this ceiling only applies the first time after the cache turns
 * over.
 */
export const maxDuration = 60;

/** API-Football's bet id for the 1X2 / Match Winner market. */
const MATCH_WINNER_BET = "1";

/**
 * Pre-match 1X2 prices drift rather than jump, and every page costs a request,
 * so a full sweep is worth keeping for a while.
 *
 * An hour, because the arithmetic decides it rather than taste. A whole day is
 * around 72 pages; against the live account's 7,500 a day that is 23% of the
 * allowance at this cadence, or 38% if a day ever reached the ceiling below.
 * Fifteen minutes — the old value, when only three pages were fetched — would
 * be 92% and 154%, which is why widening the sweep without slowing it down
 * would have swapped missing percentages for an exhausted quota.
 *
 * stale-while-revalidate keeps the response instant across the turnover.
 */
const ODDS_TTL = 3600;

/**
 * A ceiling, not a target: the loop stops at whatever the upstream reports.
 *
 * This was 25 while a day genuinely ran to about twenty-two pages. It does not
 * any more — production reported 72 pages available against 25 fetched, so two
 * thirds of the fixtures that had a published price were being shown a dash.
 * 120 clears that with room for a busier Saturday while still bounding what a
 * pathological day could cost; x-odds-pages-available reports if it is ever
 * reached.
 */
const MAX_PAGES = 120;

/**
 * How many pages are in flight at once.
 *
 * Fetching seventy-odd pages strictly one after another is what the old cap
 * really protected against: not quota, but the wall clock — the request would
 * run past the function's time limit long before it ran out of allowance. A
 * handful at a time finishes in seconds while staying far below the 300 a
 * minute the account permits.
 */
const PAGE_CONCURRENCY = 6;

/**
 * The retry pass goes slower and narrower than the first.
 *
 * If six at a time is what the upstream objected to, repeating it at the same
 * rate would fail the same way. A pause first, then half the width.
 */
const RETRY_CONCURRENCY = 3;
const RETRY_PAUSE_MS = 400;

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

    const collect = (entries: APIOddsEntry[] | undefined) => {
      for (const entry of entries ?? []) {
        const fixtureId = entry.fixture?.id;
        if (!fixtureId) continue;

        const raw = readOneXTwo(entry);
        if (!raw) continue;

        // Stored as fair odds so oddsToPercent() downstream yields percentages
        // that sum to 100 rather than the bookmaker's ~105.
        const fair = deVig(raw);
        if (fair) result[String(fixtureId)] = fair;
      }
    };

    const fetchPage = (page: number) =>
      apiFetchRaw<APIOddsEntry[]>(
        "/odds",
        { date, bet: MATCH_WINNER_BET, page: String(page) },
        ODDS_TTL
      );

    // The first page is also how many there are, so it has to land before the
    // rest can be scheduled.
    const first = await fetchPage(1);
    collect(first.response);

    const totalPages = Math.min(first.paging.total, MAX_PAGES);
    let fetched = 1;
    const failures: string[] = [];

    /**
     * Fetch a set of pages, collect what lands, and hand back what did not.
     *
     * The reason a page failed is recorded rather than discarded. The first
     * version swallowed it, so when a live sweep came back with 43 of 72 pages
     * there was nothing in the logs to say why — the diagnosis had to be
     * guessed at, which is exactly what these headers exist to prevent.
     */
    const sweep = async (pages: number[], concurrency: number) => {
      const settled = await inBatches(
        pages.map((page) => settle(() => fetchPage(page))),
        concurrency
      );
      const missed: number[] = [];
      const reasons = new Set<string>();
      settled.forEach((entry, i) => {
        if (!entry.ok) {
          missed.push(pages[i]);
          reasons.add(entry.reason);
          return;
        }
        fetched += 1;
        collect(entry.value.response);
      });
      return { missed, reasons: [...reasons] };
    };

    if (totalPages > 1) {
      const rest = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      let pass = await sweep(rest, PAGE_CONCURRENCY);

      /*
       * One retry, slower and narrower.
       *
       * Measured live: a cold sweep returned 43 of 72 pages, and simply asking
       * again returned 53 — the successes are cached by then, so the misses get
       * the whole budget. That says the failures are transient rather than
       * pages that do not exist, and that a second pass inside the same request
       * is worth far more than leaving a third of the day unpriced until
       * somebody happens to reload.
       */
      if (pass.missed.length > 0) {
        failures.push(
          `${pass.missed.length}/${totalPages} missed: ${pass.reasons.join(" | ")}`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
        pass = await sweep(pass.missed, RETRY_CONCURRENCY);
        if (pass.missed.length > 0) {
          failures.push(
            `${pass.missed.length} still missing after retry: ${pass.reasons.join(" | ")}`
          );
        }
      }

      if (failures.length > 0) {
        console.warn("odds sweep incomplete", { date, totalPages, fetched, failures });
      }
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `s-maxage=${ODDS_TTL}, stale-while-revalidate=120`,
        // Coverage diagnostics. pages-available is what the upstream reports
        // before any cap, and pages-fetched counts what actually came back, so
        // a gap between them means the day was truncated and those rows will
        // show no percentage. Reporting the capped figure as "available" would
        // have hidden exactly the shortfall these headers exist to reveal.
        "x-odds-pages-available": String(first.paging.total),
        "x-odds-pages-fetched": String(fetched),
        "x-odds-fixtures": String(Object.keys(result).length),
        // Empty when the sweep was clean. Says how far short it fell and
        // whether the retry closed the gap, so a shortfall is visible from the
        // response rather than only in the logs.
        "x-odds-incomplete": failures.join("; "),
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
