import { apiFetch, MAJOR_LEAGUES, resolveSeason } from "@/lib/api-football";
import { createAdminClient } from "@/lib/supabase/admin";
import { FINISHED_STATUSES, outcomeOf } from "@/lib/fixture-outcome";
import { inBatches, rateLimiter, settle } from "@/lib/batch";
import {
  currentStreak,
  formIndex,
  round,
  teamMetrics,
  unbeatenRun,
  type TeamRecord,
} from "@/lib/statistics";
import type { APIFixture } from "@/types";

/**
 * Copying API-Football into the local database.
 *
 * Shaped by where this actually runs rather than by what the provider offers.
 * Vercel's hobby plan schedules a cron job once a day, so anything needing
 * minute-level freshness — live scores above all — stays on the request cache
 * where it already works. What the daily job is for is the opposite case: the
 * data that must outlive the subscription.
 *
 * Results are the priority. A saved prediction is scored against a finished
 * fixture, so the day the provider lapses every slip becomes unsettleable and
 * the record of who was right goes with it. Persisting results locally is what
 * stops that, and it is why this job is worth running even while the API works.
 *
 * The request budget is the other shaping force: 7,500 a day and 300 a minute,
 * shared with everything the site does. A full pass over the tracked leagues is
 * a few dozen calls, so it is scheduled once and kept narrow rather than
 * sweeping the world.
 */

/** How many upstream calls may be in flight. */
const SYNC_CONCURRENCY = 3;

/**
 * Calls per second, against a documented ceiling of 300 a minute (5/s).
 *
 * Deliberately under the ceiling: the allowance is shared with every page the
 * site serves, so a sweep that spends all five would reject a visitor's request
 * rather than its own.
 */
const SYNC_RATE_PER_SECOND = 4;

/**
 * One limiter for the whole module, so the two sweeps in a single invocation
 * queue behind each other instead of each pacing itself to the full rate.
 */
const limiter = rateLimiter(SYNC_RATE_PER_SECOND);

export interface SyncOutcome {
  job: string;
  ok: boolean;
  records: number;
  detail: string;
}

const isoDay = (d: Date) => d.toISOString().split("T")[0];

/**
 * Store finished fixtures for a day.
 *
 * Upserted on the fixture id, so re-running is safe and a match that was live
 * at the last pass is corrected once it finishes.
 */
export async function syncFixtureResults(days = 2): Promise<SyncOutcome> {
  const supabase = createAdminClient();
  const dates = Array.from({ length: Math.max(1, days) }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return isoDay(d);
  });

  const rows: Record<string, unknown>[] = [];
  const problems: string[] = [];

  const results = await inBatches(
    dates.map((date) =>
      settle(async () => ({
        date,
        fixtures: await apiFetch<APIFixture[]>("/fixtures", { date }, 300),
      }))
    ),
    SYNC_CONCURRENCY,
    limiter
  );

  for (const r of results) {
    if (!r.ok) {
      problems.push(r.reason);
      continue;
    }
    for (const f of r.value.fixtures ?? []) {
      const short = f.fixture?.status?.short ?? "";
      const finished = FINISHED_STATUSES.has(short);
      // Unfinished fixtures are skipped rather than stored as blanks: a row
      // that exists but says nothing is worse than no row, because the read
      // path would treat it as an answer.
      if (!finished) continue;

      rows.push({
        fixture_id: f.fixture.id,
        league_id: f.league?.id ?? null,
        league_name: f.league?.name ?? null,
        season: f.league?.season ? String(f.league.season) : null,
        kickoff: f.fixture.date,
        home_team_id: f.teams?.home?.id ?? null,
        away_team_id: f.teams?.away?.id ?? null,
        home_team: f.teams.home.name,
        away_team: f.teams.away.name,
        // The final score, extra time included — what 1X2 settles on.
        home_goals: f.goals?.home ?? null,
        away_goals: f.goals?.away ?? null,
        // The ninety-minute and half-time scores, which goal markets settle on
        // instead. Only a tie taken to extra time makes the first pair differ
        // from the last, but the tracked set includes the Champions League, so
        // that case is reachable. Falls back to the final score when the
        // provider gives no split — true of every match that never went past
        // ninety minutes, and the closest thing to right for the rest.
        home_goals_90: f.score?.fulltime?.home ?? f.goals?.home ?? null,
        away_goals_90: f.score?.fulltime?.away ?? f.goals?.away ?? null,
        home_goals_ht: f.score?.halftime?.home ?? null,
        away_goals_ht: f.score?.halftime?.away ?? null,
        status: short,
        outcome: outcomeOf(f),
        finished: true,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length > 0) {
    // Chunked: a single statement carrying a whole day of fixtures is a large
    // payload and one rejected row would lose the rest.
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from("fixture_results")
        .upsert(rows.slice(i, i + 500), { onConflict: "fixture_id" });
      if (error) problems.push(`upsert failed: ${error.message}`);
    }
  }

  return {
    job: "fixture_results",
    ok: problems.length === 0,
    records: rows.length,
    detail: problems.length ? problems.join(" | ") : `${dates.length} day(s) swept`,
  };
}

interface APITeamStatistics {
  team?: { id?: number; name?: string; logo?: string };
  form?: string | null;
  fixtures?: {
    played?: { home?: number; away?: number; total?: number };
    wins?: { home?: number; away?: number; total?: number };
    draws?: { home?: number; away?: number; total?: number };
    loses?: { home?: number; away?: number; total?: number };
  };
  goals?: {
    for?: { total?: { home?: number; away?: number; total?: number } };
    against?: { total?: { home?: number; away?: number; total?: number } };
  };
  clean_sheet?: { home?: number; away?: number; total?: number };
  failed_to_score?: { home?: number; away?: number; total?: number };
}

interface APIStandingRow {
  team?: { id?: number; name?: string; logo?: string };
}
interface APIStandingsEntry {
  league?: { standings?: APIStandingRow[][] };
}

const split = (v: { home?: number; away?: number; total?: number } | undefined) => ({
  home: v?.home ?? 0,
  away: v?.away ?? 0,
  total: v?.total ?? 0,
});

function toRecord(s: APITeamStatistics): TeamRecord {
  return {
    played: split(s.fixtures?.played),
    wins: split(s.fixtures?.wins),
    draws: split(s.fixtures?.draws),
    losses: split(s.fixtures?.loses),
    goalsFor: split(s.goals?.for?.total),
    goalsAgainst: split(s.goals?.against?.total),
    cleanSheets: split(s.clean_sheet),
    failedToScore: split(s.failed_to_score),
    form: s.form ?? null,
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * League order for a full sweep: whatever was refreshed longest ago goes first.
 *
 * The deadline cuts the end of the list, so the order decides what goes stale.
 * A fixed order starves the same competitions every night. Rotating the start
 * daily was the first attempt and it moves one place a day while the cut is
 * three or four deep — so a league near the end waits days: Brasileirão and
 * Liga MX both sat on 17 August data through two later runs, still holding the
 * partial tables a rate limit had left behind.
 *
 * Ordering by staleness puts exactly those at the front, and needs no state
 * beyond the rows already stored. Leagues with no rows sort first — never swept,
 * or a competition whose table has not been published yet, and both are worth
 * looking at again.
 *
 * Returns null if the freshness read fails, so the caller can fall back rather
 * than sweep in an order built from nothing.
 */
async function staleFirst(supabase: AdminClient, leagues: number[]): Promise<number[] | null> {
  const freshest = new Map<number, number>();
  try {
    const { data, error } = await supabase
      .from("team_season_stats")
      .select("league_id,updated_at");
    if (error || !data) return null;

    for (const row of data as { league_id: number; updated_at: string }[]) {
      const at = Date.parse(row.updated_at);
      if (!Number.isFinite(at)) continue;
      const seen = freshest.get(row.league_id);
      if (seen === undefined || at > seen) freshest.set(row.league_id, at);
    }
  } catch {
    // Ordering is an optimisation; never let it be what fails the sync.
    return null;
  }

  // Ties keep the configured order, so the sweep is deterministic on a fresh
  // database where every league is equally unswept.
  return leagues
    .map((id, position) => ({ id, position, at: freshest.get(id) ?? -Infinity }))
    .sort((a, b) => a.at - b.at || a.position - b.position)
    .map((l) => l.id);
}

/**
 * Fallback order when staleness cannot be read.
 *
 * Rotating daily is worse than ordering by staleness but better than a fixed
 * list: if the read is broken for a stretch, the cut tail at least moves.
 */
function rotated(leagues: number[]): number[] {
  if (leagues.length === 0) return leagues;
  const offset = Math.floor(Date.now() / 86_400_000) % leagues.length;
  return offset ? [...leagues.slice(offset), ...leagues.slice(0, offset)] : leagues;
}

/**
 * Store each tracked league's team records, with the derived metrics alongside.
 *
 * The metrics are computed here rather than at read time so every reader sees
 * the same numbers and a page does not recompute them per request. They are
 * stored nullable throughout, because a side that has played nothing has no
 * win rate and zero would read as "never wins".
 *
 * Cost is one standings call per league to learn who is in it, then one
 * statistics call per team — roughly twenty per competition, so about 235 calls
 * for all thirteen. Paced to the subscription's rate that is close to a minute
 * of wall clock, against a function limit of the same order, which is why this
 * takes a deadline and stops cleanly instead of being killed mid-league — and
 * why the order it sweeps in (see staleFirst) decides what goes stale.
 */
export async function syncTeamStatistics(
  leagueIds?: number[],
  deadline?: number
): Promise<SyncOutcome> {
  const supabase = createAdminClient();
  const asked = leagueIds?.length ? leagueIds : null;
  const all = asked ?? MAJOR_LEAGUES.map((l) => l.id);

  // An explicit ?league= list is a request for those, in that order. Only a full
  // sweep is reordered, because only a full sweep can run out of time.
  const leagues = asked ?? (await staleFirst(supabase, all)) ?? rotated(all);

  let written = 0;
  const problems: string[] = [];
  const skipped: number[] = [];

  for (const [index, leagueId] of leagues.entries()) {
    // Checked per league rather than per call: abandoning a competition halfway
    // leaves it counted as swept while holding a partial table.
    if (deadline !== undefined && Date.now() >= deadline) {
      skipped.push(...leagues.slice(index));
      break;
    }
    try {
      const season = await resolveSeason(leagueId);

      // Gated like the team calls below it: thirteen standings requests issued
      // back to back is a small burst, but the limiter is only a limit if every
      // call in the sweep goes through it.
      await limiter();
      const standings = await apiFetch<APIStandingsEntry[]>(
        "/standings",
        { league: String(leagueId), season },
        3600
      );
      const teamIds = (standings?.[0]?.league?.standings ?? [])
        .flat()
        .map((row) => row.team?.id)
        .filter((id): id is number => typeof id === "number");

      if (teamIds.length === 0) {
        // A competition with no published table yields nothing to store. Not an
        // error — cup ties and pre-season leagues look exactly like this.
        continue;
      }

      const stats = await inBatches(
        teamIds.map((teamId) =>
          settle(() =>
            apiFetch<APITeamStatistics>(
              "/teams/statistics",
              { league: String(leagueId), team: String(teamId), season },
              3600
            )
          )
        ),
        SYNC_CONCURRENCY,
        limiter
      );

      const rows = stats
        .filter((s) => s.ok)
        .map((s) => {
          const raw = s.value;
          const record = toRecord(raw ?? {});
          const m = teamMetrics(record);
          const streak = currentStreak(record.form);
          return {
            league_id: leagueId,
            season,
            team_id: raw?.team?.id,
            team_name: raw?.team?.name ?? null,
            team_logo: raw?.team?.logo ?? null,

            played_home: record.played.home, played_away: record.played.away, played_total: record.played.total,
            wins_home: record.wins.home, wins_away: record.wins.away, wins_total: record.wins.total,
            draws_home: record.draws.home, draws_away: record.draws.away, draws_total: record.draws.total,
            losses_home: record.losses.home, losses_away: record.losses.away, losses_total: record.losses.total,
            goals_for_home: record.goalsFor.home, goals_for_away: record.goalsFor.away, goals_for_total: record.goalsFor.total,
            goals_against_home: record.goalsAgainst.home, goals_against_away: record.goalsAgainst.away, goals_against_total: record.goalsAgainst.total,
            clean_sheets_home: record.cleanSheets.home, clean_sheets_away: record.cleanSheets.away, clean_sheets_total: record.cleanSheets.total,
            failed_to_score_home: record.failedToScore.home, failed_to_score_away: record.failedToScore.away, failed_to_score_total: record.failedToScore.total,
            form: record.form,

            win_rate: round(m.winRate),
            draw_rate: round(m.drawRate),
            loss_rate: round(m.lossRate),
            points_per_match: round(m.pointsPerMatch, 2),
            goals_per_match: round(m.goalsPerMatch, 2),
            goals_conceded_per_match: round(m.goalsConcededPerMatch, 2),
            clean_sheet_percentage: round(m.cleanSheetPercentage),
            failed_to_score_percentage: round(m.failedToScorePercentage),
            form_index: round(formIndex(record.form)),
            streak_type: streak.type,
            streak_length: streak.length,
            unbeaten_run: unbeatenRun(record.form),

            updated_at: new Date().toISOString(),
          };
        })
        .filter((r) => typeof r.team_id === "number");

      // settle() carries why each team failed; counting them threw that away,
      // which is precisely the hole settle() was written to close. A first live
      // run returned "3 team(s) failed" and left nothing to act on. Reasons are
      // grouped rather than listed per team, because twenty teams hitting one
      // rate limit is one fact, not twenty.
      const failures = stats.flatMap((s, i) => (s.ok ? [] : [{ teamId: teamIds[i], reason: s.reason }]));
      if (failures.length > 0) {
        const byReason = new Map<string, number[]>();
        for (const f of failures) {
          byReason.set(f.reason, [...(byReason.get(f.reason) ?? []), f.teamId]);
        }
        const detail = [...byReason]
          .map(([reason, ids]) => `${reason} [teams ${ids.join(",")}]`)
          .join("; ");
        problems.push(`league ${leagueId}: ${failures.length} of ${teamIds.length} team(s) failed — ${detail}`);
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from("team_season_stats")
          .upsert(rows, { onConflict: "league_id,season,team_id" });
        if (error) problems.push(`league ${leagueId} upsert: ${error.message}`);
        else written += rows.length;
      }
    } catch (e) {
      // One competition failing must not abandon the other twelve.
      problems.push(`league ${leagueId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const swept = leagues.length - skipped.length;
  if (skipped.length > 0) {
    problems.push(
      `out of time after ${swept} of ${leagues.length} league(s) — not reached: ${skipped.join(",")}`
    );
  }

  return {
    job: "team_season_stats",
    // Running out of time is a real shortfall, not a clean run: the row has to
    // say so or the next morning's check reads a partial sweep as a whole one.
    ok: problems.length === 0,
    records: written,
    detail: problems.length ? problems.join(" | ") : `${swept} league(s) swept`,
  };
}

/**
 * Ceiling on the stored detail string.
 *
 * The column is unbounded text; the old 2,000 was arbitrary and cost real
 * information — the first full cron run wrote exactly 2,000 characters and the
 * cut fell mid-sentence inside the eleventh league, hiding what became of the
 * twelfth and thirteenth. Generous enough that a whole run's failures fit, and
 * when it does bite it now says so rather than trailing off.
 */
const DETAIL_LIMIT = 20_000;

/** Record a run so a failure is visible without reading platform logs. */
export async function recordRun(outcome: SyncOutcome, startedAt: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("sync_runs").insert({
      job: outcome.job,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: outcome.ok,
      records: outcome.records,
      detail:
        outcome.detail.length > DETAIL_LIMIT
          ? `${outcome.detail.slice(0, DETAIL_LIMIT)} […truncated, ${outcome.detail.length} chars]`
          : outcome.detail,
    });
  } catch {
    // Bookkeeping must never be the thing that fails a sync.
  }
}
