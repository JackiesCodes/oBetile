import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import type { APIFixture } from "@/types";
import { outcomeOf, FINISHED_STATUSES, LIVE_STATUSES, type Outcome } from "@/lib/fixture-outcome";
import { createPublicClient, hasSupabaseConfig } from "@/lib/supabase/server";

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
  /**
   * The score at ninety minutes, which is what goal markets settle on.
   *
   * Identical to `goals` unless a tie went to extra time, where `goals` carries
   * the winner and this carries the number of goals the market was about. Null
   * when the provider gave no split and no final score to fall back on, or when
   * the row predates the columns — settlement waits rather than guessing.
   */
  goals90: { home: number | null; away: number | null };
  /** The score at half time, for the half-based markets. */
  goalsHt: { home: number | null; away: number | null };
  /** Who won, once finished. Null while the match is still to be decided. */
  outcome: Outcome;
  kickoff: string;
}

/**
 * Settled fixtures already stored locally.
 *
 * Reads with no session — these rows are public sporting record — and treats
 * any failure as simply having nothing stored, so a database problem degrades
 * to the behaviour that existed before this table did rather than breaking
 * settlement outright.
 */
async function readStoredResults(ids: number[]): Promise<Record<string, FixtureResult>> {
  if (!hasSupabaseConfig()) return {};
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("fixture_results")
      // One string literal, not a concatenation: the client infers the row type
      // by parsing this at compile time, and an expression defeats that.
      // eslint-disable-next-line max-len
      .select("fixture_id,status,home_team,away_team,home_goals,away_goals,home_goals_90,away_goals_90,home_goals_ht,away_goals_ht,outcome,kickoff")
      .in("fixture_id", ids)
      .eq("finished", true);

    if (error || !data) return {};

    const out: Record<string, FixtureResult> = {};
    for (const row of data) {
      out[String(row.fixture_id)] = {
        status: row.status,
        finished: true,
        live: false,
        home: row.home_team,
        away: row.away_team,
        goals: { home: row.home_goals, away: row.away_goals },
        // Rows written before the ninety-minute columns existed have nulls
        // here. Left null rather than defaulted to the final score: for the
        // fixtures where the two differ, defaulting would settle a goal market
        // on extra time and look entirely correct doing it.
        goals90: { home: row.home_goals_90, away: row.away_goals_90 },
        goalsHt: { home: row.home_goals_ht, away: row.away_goals_ht },
        outcome: row.outcome as Outcome,
        kickoff: row.kickoff,
      };
    }
    return out;
  } catch {
    return {};
  }
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

    /*
     * The local copy answers first.
     *
     * A finished match never changes, so once it is stored there is nothing to
     * re-ask. That saves requests, but the reason it matters is durability: a
     * saved prediction is scored against a result, so the day the subscription
     * lapses every slip would become unsettleable if this were the only source.
     * Reading stored results first is what keeps the record intact.
     *
     * Only settled fixtures are served this way — anything still to play, or in
     * play, falls through to the live call below.
     */
    const stored = await readStoredResults(ids);
    for (const [id, row] of Object.entries(stored)) result[id] = row;

    const missing = ids.filter((id) => !(String(id) in result));
    if (missing.length === 0) {
      return NextResponse.json(result, {
        headers: {
          "Cache-Control": `s-maxage=${RESULTS_TTL}, stale-while-revalidate=60`,
          "x-results-source": "database",
        },
      });
    }

    // Sequential batches — twenty ids per call, and never several calls at once,
    // for the same burst reasons the odds route fetches its pages one at a time.
    for (let i = 0; i < missing.length; i += IDS_PER_REQUEST) {
      const batch = missing.slice(i, i + IDS_PER_REQUEST);
      const fixtures = await apiFetch<APIFixture[]>(
        "/fixtures",
        { ids: batch.join("-") },
        RESULTS_TTL
      );

      for (const f of fixtures ?? []) {
        const short = f.fixture?.status?.short ?? "";
        result[String(f.fixture.id)] = {
          status: short,
          finished: FINISHED_STATUSES.has(short),
          live: LIVE_STATUSES.has(short),
          home: f.teams.home.name,
          away: f.teams.away.name,
          goals: { home: f.goals.home, away: f.goals.away },
          goals90: {
            home: f.score?.fulltime?.home ?? f.goals.home,
            away: f.score?.fulltime?.away ?? f.goals.away,
          },
          goalsHt: {
            home: f.score?.halftime?.home ?? null,
            away: f.score?.halftime?.away ?? null,
          },
          outcome: outcomeOf(f),
          kickoff: f.fixture.date,
        };
      }
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `s-maxage=${RESULTS_TTL}, stale-while-revalidate=60`,
        // Which source answered, so a run that is quietly bypassing the local
        // copy is visible without guessing.
        "x-results-source": Object.keys(stored).length > 0 ? "mixed" : "upstream",
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
