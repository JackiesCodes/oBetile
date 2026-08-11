/**
 * A win-probability model built from league standings, recent form and head to
 * head record.
 *
 * Why this exists: bookmakers price only a minority of fixtures, and
 * API-Football's own forecast returns a flat 33/33/33 for anything it lacks
 * history on. Both were measured against production. This produces a real
 * estimate from data the app already fetches.
 *
 * Method — a Poisson goals model, the standard approach for 1X2:
 *
 *  1. Derive each team's attacking and defensive strength relative to its
 *     league, using the home and away splits in the standings rather than
 *     overall totals. Home advantage then falls out of the data instead of
 *     being a constant someone guessed.
 *  2. Turn those into expected goals for each side.
 *  3. Adjust for recent form and, when supplied, head to head.
 *  4. Treat each side's goals as Poisson distributed and sum the scoreline
 *     grid into home win, draw and away win.
 *
 * It refuses to answer rather than guess: too few matches played, or missing
 * standings, returns null and the UI keeps its dash.
 */

export interface TeamRecord {
  teamId: number;
  /** Matches at home, and the goals scored and conceded in them. */
  home: { played: number; goalsFor: number; goalsAgainst: number };
  away: { played: number; goalsFor: number; goalsAgainst: number };
  /** Most recent results, newest last, e.g. "WWDLW". */
  form: string | null;
}

export interface Probabilities {
  home: number;
  draw: number;
  away: number;
}

/** Past meetings between the two sides, from the perspective of the home team. */
export interface HeadToHead {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
}

/**
 * Below this, a league table says more about the fixture list than about the
 * teams. Early in a season every side has played promoted or relegated
 * opposition in a different mix, and a 2-game sample swings wildly.
 */
export const MIN_MATCHES_PLAYED = 4;

/** Scorelines beyond this contribute almost nothing to the totals. */
const MAX_GOALS = 8;

/**
 * How far form can pull expected goals. Deliberately small: form is a noisy,
 * partly circular signal — a strong team's form is mostly just its strength
 * again — so it nudges rather than decides.
 */
const FORM_WEIGHT = 0.25;

/** Head to head is a smaller sample still, so it moves the result less. */
const H2H_WEIGHT = 0.15;

/** Expected goals are clamped to a plausible range before the Poisson step. */
const MIN_LAMBDA = 0.15;
const MAX_LAMBDA = 5;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

/** Probability of exactly k goals when the expected number is lambda. */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0 || k < 0) return 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * How strongly low scorelines depart from independence.
 *
 * Two independent Poissons under-count 0-0 and 1-1 and over-count 1-0 and 0-1,
 * which systematically under-prices the draw. This is the Dixon-Coles
 * correction at roughly the magnitude their paper fitted.
 */
const LOW_SCORE_CORRELATION = 0.13;

/**
 * Dixon-Coles weight for a scoreline. Only the four lowest scores depart from
 * independence; everything above 1-1 is left alone.
 */
export function lowScoreAdjustment(
  i: number,
  j: number,
  lambdaHome: number,
  lambdaAway: number
): number {
  const rho = LOW_SCORE_CORRELATION;
  let tau = 1;
  if (i === 0 && j === 0) tau = 1 + rho * lambdaHome * lambdaAway;
  else if (i === 1 && j === 1) tau = 1 + rho;
  else if (i === 0 && j === 1) tau = 1 - rho * lambdaHome;
  else if (i === 1 && j === 0) tau = 1 - rho * lambdaAway;
  // A large lambda could otherwise drive the 1-0 and 0-1 weights negative.
  return Math.max(0, tau);
}

/**
 * Sum the scoreline grid into the three match outcomes.
 *
 * Goals for each side are treated as independent apart from the lowest
 * scorelines, where the correction above applies.
 */
export function outcomeProbabilities(lambdaHome: number, lambdaAway: number): Probabilities {
  let home = 0;
  let draw = 0;
  let away = 0;

  for (let i = 0; i <= MAX_GOALS; i++) {
    const pHome = poissonPmf(i, lambdaHome);
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = pHome * poissonPmf(j, lambdaAway) * lowScoreAdjustment(i, j, lambdaHome, lambdaAway);
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
    }
  }

  return normalise({ home, draw, away });
}

/** Rescale three non-negative numbers so they sum to exactly 1. */
export function normalise(p: Probabilities): Probabilities {
  const total = p.home + p.draw + p.away;
  if (!Number.isFinite(total) || total <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  return { home: p.home / total, draw: p.draw / total, away: p.away / total };
}

/**
 * Points per available point over the recent run, 0 to 1.
 *
 * A league-average side sits near 0.44, since a match distributes either 3
 * points (win) or 2 (draw) across the two teams.
 */
export function formRate(form: string | null | undefined): number | null {
  if (!form) return null;
  const results = form.toUpperCase().replace(/[^WDL]/g, "").split("");
  if (results.length === 0) return null;

  const points = results.reduce((sum, r) => sum + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
  return points / (results.length * 3);
}

const LEAGUE_AVERAGE_FORM = 0.44;

export interface LeagueAverages {
  homeGoals: number;
  awayGoals: number;
}

/**
 * Average goals scored by home sides and by away sides across the league.
 *
 * Computed from the table itself rather than assumed, so a low-scoring league
 * is not handed a high-scoring league's baseline.
 */
export function leagueAverages(teams: TeamRecord[]): LeagueAverages | null {
  let homeGoals = 0;
  let homePlayed = 0;
  let awayGoals = 0;
  let awayPlayed = 0;

  for (const t of teams) {
    homeGoals += t.home.goalsFor;
    homePlayed += t.home.played;
    awayGoals += t.away.goalsFor;
    awayPlayed += t.away.played;
  }

  if (homePlayed === 0 || awayPlayed === 0) return null;

  const avg = { homeGoals: homeGoals / homePlayed, awayGoals: awayGoals / awayPlayed };
  if (!Number.isFinite(avg.homeGoals) || !Number.isFinite(avg.awayGoals)) return null;
  if (avg.homeGoals <= 0 || avg.awayGoals <= 0) return null;
  return avg;
}

function totalPlayed(t: TeamRecord) {
  return t.home.played + t.away.played;
}

/**
 * Matches of league-average performance blended into every team's rate.
 *
 * A team plays only ten or so home games a season, so a side scoring at twice
 * the league rate over eleven home matches is usually good but rarely twice as
 * good — most of that gap is noise. Two such rates get multiplied together
 * here, which compounds the error: unshrunk, this model priced a domestic away
 * win at 3%, a probability no real football match has.
 *
 * Blending in a fixed number of average matches pulls short records toward the
 * league and leaves long ones nearly untouched, so confidence grows with
 * evidence instead of being assumed from the start.
 */
const PRIOR_MATCHES = 6;

function shrink(scored: number, played: number, leagueRate: number): number {
  return (scored + PRIOR_MATCHES * leagueRate) / (played + PRIOR_MATCHES);
}

/**
 * Expected goals for both sides, before form and head to head.
 *
 * A team's home attack is its home scoring rate relative to the league's, and
 * the opponent's away defence is its away conceding rate relative to the
 * league's. Multiplying those by the league baseline gives the expectation for
 * this particular pairing.
 */
export function expectedGoals(
  home: TeamRecord,
  away: TeamRecord,
  avg: LeagueAverages
): { home: number; away: number } | null {
  if (home.home.played === 0 || away.away.played === 0) return null;

  const homeAttack =
    shrink(home.home.goalsFor, home.home.played, avg.homeGoals) / avg.homeGoals;
  const homeDefence =
    shrink(home.home.goalsAgainst, home.home.played, avg.awayGoals) / avg.awayGoals;
  const awayAttack =
    shrink(away.away.goalsFor, away.away.played, avg.awayGoals) / avg.awayGoals;
  const awayDefence =
    shrink(away.away.goalsAgainst, away.away.played, avg.homeGoals) / avg.homeGoals;

  const lambdaHome = homeAttack * awayDefence * avg.homeGoals;
  const lambdaAway = awayAttack * homeDefence * avg.awayGoals;

  if (!Number.isFinite(lambdaHome) || !Number.isFinite(lambdaAway)) return null;

  return {
    home: clamp(lambdaHome, MIN_LAMBDA, MAX_LAMBDA),
    away: clamp(lambdaAway, MIN_LAMBDA, MAX_LAMBDA),
  };
}

/** Scale expected goals by how far a side's recent form sits from average. */
function applyForm(lambda: number, form: string | null): number {
  const rate = formRate(form);
  if (rate === null) return lambda;
  return clamp(lambda * (1 + FORM_WEIGHT * (rate - LEAGUE_AVERAGE_FORM) * 2), MIN_LAMBDA, MAX_LAMBDA);
}

/**
 * Blend the model's probabilities toward what past meetings suggest.
 *
 * Only applied with enough meetings to mean anything, and weighted low: two
 * clubs' history is a small sample and often stale.
 */
export function applyHeadToHead(p: Probabilities, h2h: HeadToHead | null): Probabilities {
  if (!h2h || h2h.played < 3) return p;

  const observed = normalise({
    home: h2h.homeWins,
    draw: h2h.draws,
    away: h2h.awayWins,
  });

  return normalise({
    home: p.home * (1 - H2H_WEIGHT) + observed.home * H2H_WEIGHT,
    draw: p.draw * (1 - H2H_WEIGHT) + observed.draw * H2H_WEIGHT,
    away: p.away * (1 - H2H_WEIGHT) + observed.away * H2H_WEIGHT,
  });
}

export interface PredictionInput {
  home: TeamRecord;
  away: TeamRecord;
  table: TeamRecord[];
  h2h?: HeadToHead | null;
}

/**
 * Win, draw and loss probabilities for a fixture, or null when the inputs are
 * too thin to say anything useful.
 */
export function predictFixture({ home, away, table, h2h }: PredictionInput): Probabilities | null {
  if (totalPlayed(home) < MIN_MATCHES_PLAYED || totalPlayed(away) < MIN_MATCHES_PLAYED) {
    return null;
  }

  const avg = leagueAverages(table);
  if (!avg) return null;

  const lambdas = expectedGoals(home, away, avg);
  if (!lambdas) return null;

  const adjusted = {
    home: applyForm(lambdas.home, home.form),
    away: applyForm(lambdas.away, away.form),
  };

  return applyHeadToHead(outcomeProbabilities(adjusted.home, adjusted.away), h2h ?? null);
}

/** Percentages rounded to whole numbers that still total exactly 100. */
export function toPercentages(p: Probabilities): { home: number; draw: number; away: number } {
  const raw = [p.home * 100, p.draw * 100, p.away * 100];
  const rounded = raw.map(Math.floor);
  let remainder = 100 - rounded.reduce((a, b) => a + b, 0);

  // Hand the leftover points to whichever outcomes lost most to flooring, so
  // the three displayed figures add up rather than reading 99.
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (const { i } of order) {
    if (remainder <= 0) break;
    rounded[i] += 1;
    remainder -= 1;
  }

  return { home: rounded[0], draw: rounded[1], away: rounded[2] };
}
