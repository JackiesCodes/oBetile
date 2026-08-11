import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import { normaliseToFairOdds } from "@/lib/odds";

/**
 * Model forecasts for fixtures that carry no bookmaker price.
 *
 * GET /api/football/forecasts?ids=111,222
 *   -> { "111": { home: 2.22, draw: 3.57, away: 3.70 } }
 *
 * Bookmakers only price a minority of fixtures — 47 of a day's matches in a
 * recent sample — so most smaller competitions showed a dash. API-Football
 * generates its own forecast for nearly any fixture, which fills those gaps.
 *
 * The catch is that /predictions takes a single fixture, with no bulk form, so
 * this costs one upstream request per fixture. That is why callers send a
 * bounded, ordered list rather than a whole day: the alternative is a hundred
 * requests per page load.
 */

interface APIPredictionEntry {
  predictions?: {
    percent?: { home?: string; draw?: string; away?: string };
  };
}

/** Ceiling per request. Each id is its own upstream call. */
const MAX_IDS = 20;

/** Pre-match forecasts barely move, so this can be cached hard. */
const FORECAST_TTL = 1800;

/** "45%" -> 45. Returns null for anything unusable. */
function parsePercent(raw: unknown): number | null {
  const n = parseFloat(String(raw ?? "").replace("%", ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("ids");
  if (!raw) return NextResponse.json({});

  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  ).slice(0, MAX_IDS);

  if (ids.length === 0) return NextResponse.json({});

  try {
    const result: Record<string, { home: number; draw: number; away: number }> = {};

    // Sequential: a burst of twenty simultaneous requests is exactly what the
    // active-leagues route was rejected for.
    for (const id of ids) {
      let entries: APIPredictionEntry[] = [];
      try {
        entries = await apiFetch<APIPredictionEntry[]>(
          "/predictions",
          { fixture: String(id) },
          FORECAST_TTL
        );
      } catch {
        // One fixture without a forecast must not lose the rest of the batch.
        continue;
      }

      const percent = entries?.[0]?.predictions?.percent;
      const home = parsePercent(percent?.home);
      const draw = parsePercent(percent?.draw);
      const away = parsePercent(percent?.away);
      if (home === null || draw === null || away === null) continue;

      const fair = normaliseToFairOdds({ home, draw, away });
      if (fair) result[String(id)] = fair;
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `s-maxage=${FORECAST_TTL}, stale-while-revalidate=300`,
        "x-forecasts-requested": String(ids.length),
        "x-forecasts-returned": String(Object.keys(result).length),
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
