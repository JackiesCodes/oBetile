import { apiFetch, MAJOR_LEAGUES, resolveSeason } from "@/lib/api-football";
import { createAdminClient } from "@/lib/supabase/admin";
import { FINISHED_STATUSES, outcomeOf } from "@/lib/fixture-outcome";
import { inBatches, settle } from "@/lib/batch";
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

/** How many upstream calls may be in flight. Far below the burst allowance. */
const SYNC_CONCURRENCY = 3;

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
    SYNC_CONCURRENCY
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
        home_goals: f.goals?.home ?? null,
        away_goals: f.goals?.away ?? null,
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

/**
 * Store each tracked league's team records, with the derived metrics alongside.
 *
 * The metrics are computed here rather than at read time so every reader sees
 * the same numbers and a page does not recompute them per request. They are
 * stored nullable throughout, because a side that has played nothing has no
 * win rate and zero would read as "never wins".
 *
 * Cost is one standings call per league to learn who is in it, then one
 * statistics call per team — roughly twenty per competition. Leagues are
 * therefore swept a few at a time rather than all thirteen at once.
 */
export async function syncTeamStatistics(leagueIds?: number[]): Promise<SyncOutcome> {
  const supabase = createAdminClient();
  const leagues = leagueIds?.length ? leagueIds : MAJOR_LEAGUES.map((l) => l.id);

  let written = 0;
  const problems: string[] = [];

  for (const leagueId of leagues) {
    try {
      const season = await resolveSeason(leagueId);

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
        SYNC_CONCURRENCY
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

  return {
    job: "team_season_stats",
    ok: problems.length === 0,
    records: written,
    detail: problems.length ? problems.join(" | ") : `${leagues.length} league(s) swept`,
  };
}

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
      detail: outcome.detail.slice(0, 2000),
    });
  } catch {
    // Bookkeeping must never be the thing that fails a sync.
  }
}
