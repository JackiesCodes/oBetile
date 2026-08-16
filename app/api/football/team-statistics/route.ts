import { NextRequest, NextResponse } from "next/server";
import { apiFetch, resolveSeason } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import { round, teamMetrics, type TeamMetrics, type TeamRecord } from "@/lib/statistics";

/**
 * A team's season record, and the metrics derived from it.
 *
 * GET /api/football/team-statistics?league=39&team=33[&season=2026]
 *   -> { team, league, season, record, metrics }
 *
 * Wraps /teams/statistics, which the app had never called. Everything Phase 4
 * asks of a team — clean sheets, home and away splits, failed-to-score, form —
 * is in that one response, so computing it from a fixture-by-fixture scan would
 * have been dozens of requests to rebuild something the upstream already
 * answers in one.
 *
 * The derived figures are computed here rather than in the browser so the
 * numbers are identical wherever they appear, and so the raw upstream shape
 * stays behind this boundary: the UI reads `metrics`, never API-Football's
 * field names.
 */

interface APITeamStatistics {
  team?: { id?: number; name?: string; logo?: string };
  league?: { id?: number; name?: string; country?: string; season?: number };
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

/** Season records only move as matches finish, so this can be cached hard. */
const TEAM_STATS_TTL = 3600;

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
    // The upstream spells it "loses"; the local shape uses the English word.
    losses: split(s.fixtures?.loses),
    goalsFor: split(s.goals?.for?.total),
    goalsAgainst: split(s.goals?.against?.total),
    cleanSheets: split(s.clean_sheet),
    failedToScore: split(s.failed_to_score),
    form: s.form ?? null,
  };
}

/** Percentages and rates to one decimal; anything more implies false precision. */
function present(m: TeamMetrics) {
  return {
    ...m,
    winRate: round(m.winRate),
    drawRate: round(m.drawRate),
    lossRate: round(m.lossRate),
    pointsPerMatch: round(m.pointsPerMatch, 2),
    goalsPerMatch: round(m.goalsPerMatch, 2),
    goalsConcededPerMatch: round(m.goalsConcededPerMatch, 2),
    cleanSheetPercentage: round(m.cleanSheetPercentage),
    failedToScorePercentage: round(m.failedToScorePercentage),
    formIndex: round(m.formIndex),
    home: {
      ...m.home,
      winRate: round(m.home.winRate),
      pointsPerMatch: round(m.home.pointsPerMatch, 2),
      goalsPerMatch: round(m.home.goalsPerMatch, 2),
      goalsConcededPerMatch: round(m.home.goalsConcededPerMatch, 2),
      cleanSheetPercentage: round(m.home.cleanSheetPercentage),
    },
    away: {
      ...m.away,
      winRate: round(m.away.winRate),
      pointsPerMatch: round(m.away.pointsPerMatch, 2),
      goalsPerMatch: round(m.away.goalsPerMatch, 2),
      goalsConcededPerMatch: round(m.away.goalsConcededPerMatch, 2),
      cleanSheetPercentage: round(m.away.cleanSheetPercentage),
    },
  };
}

const positiveInt = (raw: string | null): number | null => {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = positiveInt(searchParams.get("league"));
  const team = positiveInt(searchParams.get("team"));

  if (league === null || team === null) {
    return NextResponse.json(
      { error: "league and team query params are required, as positive integers" },
      { status: 400 }
    );
  }

  try {
    // Seasons are labelled differently per competition, so this is resolved
    // rather than assumed — see resolveSeason for why one global constant
    // cannot be right for both European and calendar-year leagues.
    const season = searchParams.get("season") ?? (await resolveSeason(league));

    const stats = await apiFetch<APITeamStatistics>(
      "/teams/statistics",
      { league: String(league), team: String(team), season },
      TEAM_STATS_TTL
    );

    // A team with no record in this competition is a valid answer, not an
    // error — it is what a newly promoted side looks like before a ball is
    // kicked. The metrics come back null rather than zero.
    const record = toRecord(stats ?? {});

    return NextResponse.json(
      {
        team: stats?.team ?? { id: team },
        league: stats?.league ?? { id: league },
        season,
        record,
        metrics: present(teamMetrics(record)),
      },
      {
        headers: {
          "Cache-Control": `s-maxage=${TEAM_STATS_TTL}, stale-while-revalidate=300`,
        },
      }
    );
  } catch (e) {
    return apiErrorResponse(e);
  }
}
