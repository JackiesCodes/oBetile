/**
 * Derived team, player and match metrics.
 *
 * The app already pulls the raw material for these — standings rows, a team's
 * season record, top-scorer lists, head-to-head fixtures — but never turned any
 * of it into the rates and ratios a reader actually compares teams on. This is
 * that layer, kept pure so every figure can be tested against a worked example
 * rather than eyeballed in the UI.
 *
 * Every function returns null rather than a plausible-looking zero when the
 * input cannot support the metric. A side that has played no matches has no win
 * rate; printing 0% would read as "never wins", which is a different and false
 * claim. That distinction is the reason most of these signatures are nullable.
 */

/** A team's season record, as /teams/statistics reports it. */
export interface TeamRecord {
  played: { home: number; away: number; total: number };
  wins: { home: number; away: number; total: number };
  draws: { home: number; away: number; total: number };
  losses: { home: number; away: number; total: number };
  goalsFor: { home: number; away: number; total: number };
  goalsAgainst: { home: number; away: number; total: number };
  cleanSheets: { home: number; away: number; total: number };
  failedToScore: { home: number; away: number; total: number };
  /** Most recent results first is NOT assumed — see formIndex. */
  form: string | null;
}

export type Split = "home" | "away" | "total";

const rate = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

const per = (total: number, matches: number): number | null =>
  matches > 0 ? total / matches : null;

/** Share of matches won, as a percentage. Null when nothing has been played. */
export function winRate(r: TeamRecord, split: Split = "total"): number | null {
  return rate(r.wins[split], r.played[split]);
}

export function drawRate(r: TeamRecord, split: Split = "total"): number | null {
  return rate(r.draws[split], r.played[split]);
}

export function lossRate(r: TeamRecord, split: Split = "total"): number | null {
  return rate(r.losses[split], r.played[split]);
}

export function goalsPerMatch(r: TeamRecord, split: Split = "total"): number | null {
  return per(r.goalsFor[split], r.played[split]);
}

export function goalsConcededPerMatch(r: TeamRecord, split: Split = "total"): number | null {
  return per(r.goalsAgainst[split], r.played[split]);
}

export function cleanSheetPercentage(r: TeamRecord, split: Split = "total"): number | null {
  return rate(r.cleanSheets[split], r.played[split]);
}

export function failedToScorePercentage(r: TeamRecord, split: Split = "total"): number | null {
  return rate(r.failedToScore[split], r.played[split]);
}

/**
 * Points per match — the single most comparable summary of a season.
 *
 * Three for a win, one for a draw, matching how every league table is built.
 * Preferred over win rate alone because a side that draws half its matches and
 * one that loses them have the same win rate and very different seasons.
 */
export function pointsPerMatch(r: TeamRecord, split: Split = "total"): number | null {
  const played = r.played[split];
  if (played <= 0) return null;
  return (r.wins[split] * 3 + r.draws[split]) / played;
}

export interface SplitPerformance {
  played: number;
  winRate: number | null;
  pointsPerMatch: number | null;
  goalsPerMatch: number | null;
  goalsConcededPerMatch: number | null;
  cleanSheetPercentage: number | null;
}

function performance(r: TeamRecord, split: Split): SplitPerformance {
  return {
    played: r.played[split],
    winRate: winRate(r, split),
    pointsPerMatch: pointsPerMatch(r, split),
    goalsPerMatch: goalsPerMatch(r, split),
    goalsConcededPerMatch: goalsConcededPerMatch(r, split),
    cleanSheetPercentage: cleanSheetPercentage(r, split),
  };
}

export const homePerformance = (r: TeamRecord) => performance(r, "home");
export const awayPerformance = (r: TeamRecord) => performance(r, "away");

/**
 * Recent form as a 0–100 index.
 *
 * The upstream form string is a run of W/D/L. Recent matches are weighted more
 * heavily than old ones — linearly, so the newest match counts as much as the
 * oldest few combined without any single result dominating.
 *
 * API-Football writes the string oldest-first, so the last character is the
 * most recent result. Getting that backwards would invert the whole metric,
 * which is why the direction is stated here rather than left to be inferred.
 */
export function formIndex(form: string | null, window = 6): number | null {
  if (!form) return null;
  const results = form.toUpperCase().replace(/[^WDL]/g, "").split("");
  if (results.length === 0) return null;

  const recent = results.slice(-window);
  let earned = 0;
  let possible = 0;
  recent.forEach((result, i) => {
    const weight = i + 1; // oldest-first, so later index = more recent = heavier
    possible += 3 * weight;
    if (result === "W") earned += 3 * weight;
    else if (result === "D") earned += 1 * weight;
  });

  return possible > 0 ? (earned / possible) * 100 : null;
}

/** The longest run of a single result at the end of a form string. */
export interface Streak {
  type: "W" | "D" | "L" | null;
  length: number;
}

export function currentStreak(form: string | null): Streak {
  const results = (form ?? "").toUpperCase().replace(/[^WDL]/g, "");
  if (results.length === 0) return { type: null, length: 0 };

  // Newest is last, so the run is measured backwards from the end.
  const type = results[results.length - 1] as "W" | "D" | "L";
  let length = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === type; i--) length++;
  return { type, length };
}

/** Unbeaten counts draws as well as wins; a separate question from a win run. */
export function unbeatenRun(form: string | null): number {
  const results = (form ?? "").toUpperCase().replace(/[^WDL]/g, "");
  let run = 0;
  for (let i = results.length - 1; i >= 0 && results[i] !== "L"; i--) run++;
  return run;
}

export interface TeamMetrics {
  played: number;
  winRate: number | null;
  drawRate: number | null;
  lossRate: number | null;
  pointsPerMatch: number | null;
  goalsPerMatch: number | null;
  goalsConcededPerMatch: number | null;
  cleanSheetPercentage: number | null;
  failedToScorePercentage: number | null;
  formIndex: number | null;
  currentStreak: Streak;
  unbeatenRun: number;
  home: SplitPerformance;
  away: SplitPerformance;
}

export function teamMetrics(r: TeamRecord): TeamMetrics {
  return {
    played: r.played.total,
    winRate: winRate(r),
    drawRate: drawRate(r),
    lossRate: lossRate(r),
    pointsPerMatch: pointsPerMatch(r),
    goalsPerMatch: goalsPerMatch(r),
    goalsConcededPerMatch: goalsConcededPerMatch(r),
    cleanSheetPercentage: cleanSheetPercentage(r),
    failedToScorePercentage: failedToScorePercentage(r),
    formIndex: formIndex(r.form),
    currentStreak: currentStreak(r.form),
    unbeatenRun: unbeatenRun(r.form),
    home: homePerformance(r),
    away: awayPerformance(r),
  };
}

/* ------------------------------------------------------------------ players */

/** A player's season totals, as /players/topscorers reports them. */
export interface PlayerRecord {
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
}

export interface PlayerMetrics {
  goalsPerMatch: number | null;
  assistsPerMatch: number | null;
  /** Null when they have not scored — "infinity minutes per goal" is not a number. */
  minutesPerGoal: number | null;
  minutesPerAssist: number | null;
  /** Goals plus assists per match, the headline attacking contribution. */
  contributionRate: number | null;
  contributionsPer90: number | null;
}

export function playerMetrics(p: PlayerRecord): PlayerMetrics {
  const contributions = p.goals + p.assists;
  return {
    goalsPerMatch: per(p.goals, p.appearances),
    assistsPerMatch: per(p.assists, p.appearances),
    // Guarded on the numerator, not the denominator: a player with minutes but
    // no goals has no minutes-per-goal, and dividing would report Infinity.
    minutesPerGoal: p.goals > 0 ? p.minutes / p.goals : null,
    minutesPerAssist: p.assists > 0 ? p.minutes / p.assists : null,
    contributionRate: per(contributions, p.appearances),
    contributionsPer90: p.minutes > 0 ? (contributions / p.minutes) * 90 : null,
  };
}

/* ------------------------------------------------------------------- matches */

export interface FormComparison {
  home: TeamMetrics;
  away: TeamMetrics;
  /**
   * Home form index minus away form index, in percentage points. Positive
   * favours the home side. Null when either side has no form to compare.
   */
  formEdge: number | null;
  /** Difference in points per match, same sign convention. */
  pointsEdge: number | null;
}

export function compareForm(home: TeamRecord, away: TeamRecord): FormComparison {
  const h = teamMetrics(home);
  const a = teamMetrics(away);
  const diff = (x: number | null, y: number | null) =>
    x === null || y === null ? null : x - y;
  return {
    home: h,
    away: a,
    // Compared home-split against away-split would be the fairer contest, but
    // both sides' overall form is what the upstream string describes, so the
    // edge is stated on the same basis for both rather than mixing them.
    formEdge: diff(h.formIndex, a.formIndex),
    pointsEdge: diff(h.pointsPerMatch, a.pointsPerMatch),
  };
}

export interface H2HFixture {
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface H2HSummary {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
  homeWinRate: number | null;
  averageGoals: number | null;
}

/**
 * Head-to-head record, stated from the perspective of the upcoming fixture.
 *
 * Counted by which side is at home in the match being previewed, not whoever
 * happened to be at home in each old meeting — otherwise "home wins" would mix
 * two different teams together and mean nothing.
 */
export function summariseH2H(fixtures: H2HFixture[], homeTeamId: number): H2HSummary {
  let played = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let homeGoals = 0;
  let awayGoals = 0;

  for (const f of fixtures) {
    if (f.homeGoals === null || f.awayGoals === null) continue;
    played++;

    const thisTeamWasHome = f.homeTeamId === homeTeamId;
    const scoredByHome = thisTeamWasHome ? f.homeGoals : f.awayGoals;
    const scoredByAway = thisTeamWasHome ? f.awayGoals : f.homeGoals;

    homeGoals += scoredByHome;
    awayGoals += scoredByAway;

    if (scoredByHome > scoredByAway) homeWins++;
    else if (scoredByHome < scoredByAway) awayWins++;
    else draws++;
  }

  return {
    played,
    homeWins,
    draws,
    awayWins,
    homeGoals,
    awayGoals,
    homeWinRate: rate(homeWins, played),
    averageGoals: per(homeGoals + awayGoals, played),
  };
}

/** Round a metric for display without pretending to precision it lacks. */
export function round(value: number | null, places = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
