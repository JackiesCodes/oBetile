import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import type { APIFixture } from "@/types";

/**
 * Outcomes for a specific set of fixtures.
 *
 * GET /api/football/results?ids=111,222,333
 *   -> { "111": { finished: true, outcome: "home", goals: {home:2,away:1}, ... } }
 *
 * Saved picks record only a fixture id, so there is no way to tell a pick on
 * tonight's game from one on a match that finished last week without asking.
 * This answers that for a batch of ids at once rather than per pick.
 */

const FINISHED = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const LIVE = new Set(["1H", "2H", "ET", "P", "HT", "BT", "SUSP", "INT"]);

/** API-Football accepts at most 20 ids per request, dash separated. */
const IDS_PER_REQUEST = 20;

/** Fixtures settle permanently, so this can be cached hard. */
const RESULTS_TTL = 300;

export interface FixtureResult {
  status: string;
  finished: boolean;
  live: boolean;
  home: string;
  away: string;
  goals: { home: number | null; away: number | null };
  /** Who won, once finished. Null while the match is still to be decided. */
  outcome: "home" | "draw" | "away" | null;
  kickoff: string;
}

function outcomeOf(f: APIFixture): FixtureResult["outcome"] {
  if (!FINISHED.has(f.fixture.status.short)) return null;

  // Prefer the API's own winner flags: a tie decided on penalties has level
  // goals but a real winner, which comparing the score would get wrong.
  if (f.teams.home.winner === true) return "home";
  if (f.teams.away.winner === true) return "away";
  if (f.teams.home.winner === false || f.teams.away.winner === false) {
    return f.teams.home.winner === false ? "away" : "home";
  }

  const { home, away } = f.goals;
  if (home === null || away === null) return null;
  return home > away ? "home" : home < away ? "away" : "draw";
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
  ).slice(0, 100);

  if (ids.length === 0) return NextResponse.json({});

  try {
    const result: Record<string, FixtureResult> = {};

    // Sequential batches — twenty ids per call, and never several calls at once,
    // for the same burst reasons the odds route fetches its pages one at a time.
    for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
      const batch = ids.slice(i, i + IDS_PER_REQUEST);
      const fixtures = await apiFetch<APIFixture[]>(
        "/fixtures",
        { ids: batch.join("-") },
        RESULTS_TTL
      );

      for (const f of fixtures ?? []) {
        const short = f.fixture?.status?.short ?? "";
        result[String(f.fixture.id)] = {
          status: short,
          finished: FINISHED.has(short),
          live: LIVE.has(short),
          home: f.teams.home.name,
          away: f.teams.away.name,
          goals: { home: f.goals.home, away: f.goals.away },
          outcome: outcomeOf(f),
          kickoff: f.fixture.date,
        };
      }
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": `s-maxage=${RESULTS_TTL}, stale-while-revalidate=60` },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
