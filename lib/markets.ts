/**
 * The markets a prediction can be made in, priced and settled from one place.
 *
 * Every market here is derived from the same scoreline grid the model already
 * computes (lib/model.ts, predictGrid). Both teams to score, a total goals
 * line, odd or even — none of these are separate models, they are different
 * sums over the same cells. That is what makes them cheap: no new upstream
 * data, no second thing to keep calibrated, and a set of markets that cannot
 * contradict each other because they came from one distribution.
 *
 * Pricing, the allowlist and settlement all read this file. lib/vote-markets.ts
 * exists because a UI catalogue and a route allowlist were declared separately
 * and drifted: the panel offered "over_under", the route accepted only "ou", and
 * every such vote was rejected with a 400 nothing surfaced. One definition is
 * the fix, and the same reasoning applies here with more at stake — a market
 * that is offered but cannot be settled leaves a pick pending forever.
 *
 * Kept free of React and Supabase so the arithmetic can be tested directly.
 */

import type { ScoreGrid } from "@/lib/model";
import type { Outcome, PickResult } from "@/lib/slips";

/** A score, as the goal markets see it. */
export interface Score {
  home: number;
  away: number;
}

/**
 * What a market needs in order to settle.
 *
 * "outcome" markets are about who won and read the settled outcome, which
 * accounts for a tie decided on penalties. "goals" markets are about how many
 * were scored and read the ninety-minute score, because extra time is not part
 * of what was predicted.
 */
export type SettlesOn = "outcome" | "goals" | "halves";

/**
 * Everything a market may price itself from.
 *
 * `full` is the fitted full-match grid. `first` and `second` are the two halves,
 * built from the same expected goals split by the measured first-half share.
 * A market takes what it needs and ignores the rest; passing one grid was
 * enough until a market had to talk about both halves at once.
 */
export interface MarketContext {
  full: ScoreGrid;
  first: ScoreGrid;
  second: ScoreGrid;
}

/** The two halves of a finished match, as scores in their own right. */
export interface Halves {
  first: Score;
  second: Score;
}

export interface MarketChoice {
  id: string;
  label: string;
  /** Probability of this choice, summed off the fitted distributions. */
  probability(ctx: MarketContext): number;
  /**
   * Whether this choice came in.
   *
   * `halves` is present only for markets that declared settlesOn "halves";
   * settlePick refuses to call them without it rather than passing a guess.
   */
  settle(score: Score, outcome: Outcome, halves?: Halves): PickResult;
}

export interface Market {
  id: string;
  label: string;
  description: string;
  settlesOn: SettlesOn;
  /**
   * Whether this market may be offered to anyone.
   *
   * Set from measurement, not from whether the code works. scripts/backtest.ts
   * --markets scores every market against the only bar that matters: skill
   * against its own base rate, which is what quoting the season average for
   * every fixture would score. Over the 2025 Premier League, LaLiga and Serie A
   * seasons, the markets made of match results carry real skill — draw no bet
   * the most of anything measured, at +7.6% to +14.6% — and every goal market
   * lands at or below zero in at least two of the three.
   *
   * Below zero means the fixture-specific number is worse than saying nothing,
   * and it is not a calibration problem that a correction could fix: the banded
   * tables show the actual rate flat or inverted across prediction bands, so
   * there is no relationship there to correct. Those markets stay defined —
   * they are correct, tested, and settle properly — and stay unoffered until
   * something can actually predict a total.
   */
  offered: boolean;
  /**
   * What measurement says the percentages are worth.
   *
   * Separate from `offered` on purpose. Whether a market is shown is a product
   * decision; whether its numbers beat quoting the season average is a fact,
   * and the two should not be conflated in one boolean. A market can be offered
   * with this set to "no-better-than-base-rate" — the honest handling is then to
   * say so where the number is shown, not to hide the market.
   */
  evidence: "beats-base-rate" | "no-better-than-base-rate" | "unmeasured";
  choices: MarketChoice[];
}

/**
 * A market as it is written below: everything except what measurement says.
 *
 * `evidence` is attached once, from one table, when MARKETS is built. Declaring
 * it alongside each definition would scatter a finding that has to be updated
 * as a set every time the backtest is re-run.
 */
type MarketDefinition = Omit<Market, "evidence">;

/** Sum every cell of the grid whose scoreline satisfies the test. */
export function sumGrid(grid: ScoreGrid, keep: (home: number, away: number) => boolean): number {
  let total = 0;
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      if (keep(i, j)) total += grid[i][j];
    }
  }
  return total;
}

const hit = (won: boolean): PickResult => (won ? "correct" : "wrong");

/** Which of the three results a scoreline is, ignoring penalties. */
const resultOf = (home: number, away: number): Outcome =>
  home > away ? "home" : home < away ? "away" : "draw";

/* ── Match result ──────────────────────────────────────────────── */

const MATCH_RESULT: MarketDefinition = {
  id: "1x2",
  label: "Match Result",
  description: "Who wins the match",
  settlesOn: "outcome",
  offered: true,
  choices: (["home", "draw", "away"] as const).map((side) => ({
    id: side,
    label: side === "home" ? "Home" : side === "away" ? "Away" : "Draw",
    probability: (ctx) => sumGrid(ctx.full, (h, a) => resultOf(h, a) === side),
    settle: (_score, outcome) => hit(outcome === side),
  })),
};

const DOUBLE_CHANCE: MarketDefinition = {
  id: "double_chance",
  label: "Double Chance",
  description: "Two of the three results covered",
  settlesOn: "outcome",
  offered: true,
  choices: (
    [
      { id: "1x", label: "Home or Draw", sides: ["home", "draw"] },
      { id: "12", label: "Home or Away", sides: ["home", "away"] },
      { id: "x2", label: "Draw or Away", sides: ["draw", "away"] },
    ] as const
  ).map(({ id, label, sides }) => ({
    id,
    label,
    probability: (ctx: MarketContext) =>
      sumGrid(ctx.full, (h, a) => (sides as readonly Outcome[]).includes(resultOf(h, a))),
    settle: (_score: Score, outcome: Outcome) =>
      hit((sides as readonly Outcome[]).includes(outcome)),
  })),
};

const DRAW_NO_BET: MarketDefinition = {
  id: "dnb",
  label: "Draw No Bet",
  description: "Backing a side, with a draw voided rather than lost",
  settlesOn: "outcome",
  offered: true,
  choices: (["home", "away"] as const).map((side) => ({
    id: side,
    label: side === "home" ? "Home" : "Away",
    // Priced as it settles: a draw returns the stake, so it is excluded from
    // the denominator rather than counted as a loss.
    //
    // Divided by the grid's own total rather than by 1. A grid straight out of
    // scoreGrid is unnormalised — the tail past MAX_GOALS is dropped — so
    // assuming it sums to one silently misprices this market by whatever that
    // tail was worth. predictGrid normalises, but this must not depend on the
    // caller having done so.
    probability: (ctx: MarketContext) => {
      const win = sumGrid(ctx.full, (h, a) => resultOf(h, a) === side);
      const draw = sumGrid(ctx.full, (h, a) => h === a);
      const decisive = sumGrid(ctx.full, () => true) - draw;
      return decisive > 0 ? win / decisive : 0;
    },
    settle: (_score: Score, outcome: Outcome): PickResult =>
      outcome === "draw" ? "push" : hit(outcome === side),
  })),
};

/* ── Goals ─────────────────────────────────────────────────────── */

const BTTS: MarketDefinition = {
  id: "btts",
  label: "Both Teams to Score",
  description: "Both sides get on the scoresheet",
  settlesOn: "goals",
  // Skill -5.1% / -4.0% / -3.2% across the three seasons measured.
  offered: true,
  choices: [
    {
      id: "yes",
      label: "Yes",
      probability: (ctx) => sumGrid(ctx.full, (h, a) => h > 0 && a > 0),
      settle: ({ home, away }) => hit(home > 0 && away > 0),
    },
    {
      id: "no",
      label: "No",
      probability: (ctx) => sumGrid(ctx.full, (h, a) => h === 0 || a === 0),
      settle: ({ home, away }) => hit(home === 0 || away === 0),
    },
  ],
};

/**
 * Total goals over or under a line.
 *
 * Half-goal lines only, so a total can never land on the line and the market
 * cannot push. Whole and quarter lines settle with full and half refunds and
 * need selection semantics this does not have yet.
 *
 * Known bias at the top line. The grid stops at MAX_GOALS a side, and for a
 * high-scoring fixture the mass beyond it is not negligible — around four per
 * cent when a side expects nearly five goals. All of it belongs to Over, so
 * normalising the grid hands part of it back to Under and Over 4.5 is priced a
 * little low. Raising the cap would change the published 1X2, which is pinned;
 * the honest fix is to measure the size of it per line in the backtest before
 * this line is offered, not to guess at a correction here.
 */
function overUnder(line: number): MarketDefinition {
  const shown = line.toFixed(1);
  return {
    id: `ou_${String(line).replace(".", "_")}`,
    label: `Over/Under ${shown} Goals`,
    description: `Total goals in the match, against a line of ${shown}`,
    settlesOn: "goals",
    // Every line scored at or below zero skill in at least two of three seasons.
    offered: true,
      choices: [
      {
        id: "over",
        label: `Over ${shown}`,
        probability: (ctx) => sumGrid(ctx.full, (h, a) => h + a > line),
        settle: ({ home, away }) => hit(home + away > line),
      },
      {
        id: "under",
        label: `Under ${shown}`,
        probability: (ctx) => sumGrid(ctx.full, (h, a) => h + a < line),
        settle: ({ home, away }) => hit(home + away < line),
      },
    ],
  };
}

export const OVER_UNDER_LINES = [0.5, 1.5, 2.5, 3.5, 4.5];

const ODD_EVEN: MarketDefinition = {
  id: "odd_even",
  label: "Odd or Even Goals",
  description: "Whether the total number of goals is odd or even",
  settlesOn: "goals",
  // Skill within a point of zero every season: a coin flip, priced as if not.
  offered: true,
  choices: [
    {
      id: "odd",
      label: "Odd",
      probability: (ctx) => sumGrid(ctx.full, (h, a) => (h + a) % 2 === 1),
      settle: ({ home, away }) => hit((home + away) % 2 === 1),
    },
    {
      id: "even",
      // 0-0 is even, which surprises people often enough to be worth saying.
      label: "Even",
      probability: (ctx) => sumGrid(ctx.full, (h, a) => (h + a) % 2 === 0),
      settle: ({ home, away }) => hit((home + away) % 2 === 0),
    },
  ],
};

/* ── Scorelines and totals ─────────────────────────────────────── */

/** Every scoreline market below shares this: unmeasured until the backtest runs. */
const GOAL_SHAPED = {
  settlesOn: "goals",
  offered: true,
} as const;

/**
 * Exactly N goals in the match.
 *
 * Six or more is a bucket rather than a line of its own: past five the
 * individual totals are too rare to price from a season of fixtures, and the
 * grid's own tail is truncated anyway.
 */
const EXACT_GOALS: MarketDefinition = {
  id: "exact_goals",
  label: "Exact Total Goals",
  description: "How many goals in total",
  ...GOAL_SHAPED,
  choices: [0, 1, 2, 3, 4, 5, 6].map((n) => {
    const open = n === 6;
    const matches = (total: number) => (open ? total >= 6 : total === n);
    return {
      id: open ? "6plus" : String(n),
      label: open ? "6 or more" : String(n),
      probability: (ctx: MarketContext) => sumGrid(ctx.full, (h, a) => matches(h + a)),
      settle: ({ home, away }: Score) => hit(matches(home + away)),
    };
  }),
};

/** Total goals inside a range, inclusive at both ends. */
function band(id: string, label: string, lo: number, hi: number) {
  const matches = (total: number) => total >= lo && total <= hi;
  return {
    id,
    label,
    probability: (ctx: MarketContext) => sumGrid(ctx.full, (h, a) => matches(h + a)),
    settle: ({ home, away }: Score) => hit(matches(home + away)),
  };
}

const GOAL_BANDS: MarketDefinition = {
  id: "goal_bands",
  label: "Goal Bands",
  description: "Total goals within a range",
  ...GOAL_SHAPED,
  choices: [
    band("0_1", "0–1", 0, 1),
    band("2_3", "2–3", 2, 3),
    band("4_6", "4–6", 4, 6),
    band("7plus", "7+", 7, Number.MAX_SAFE_INTEGER),
  ],
};

const MULTI_GOALS: MarketDefinition = {
  id: "multi_goals",
  label: "Multi Goals",
  description: "Total goals within a wider range",
  ...GOAL_SHAPED,
  choices: [
    band("1_2", "1–2", 1, 2),
    band("1_3", "1–3", 1, 3),
    band("2_4", "2–4", 2, 4),
    band("2_5", "2–5", 2, 5),
    band("3_6", "3–6", 3, 6),
  ],
};

/**
 * The exact final score.
 *
 * Every scoreline up to three apiece, plus one bucket for everything else. The
 * bucket is not a rounding convenience: without it the choices would not
 * partition the outcome space, and a match finishing 4-2 would settle every
 * selection as wrong including the one that was closest.
 */
const CORRECT_SCORE: MarketDefinition = {
  id: "correct_score",
  label: "Correct Score",
  description: "The exact final score",
  ...GOAL_SHAPED,
  choices: [
    ...[0, 1, 2, 3].flatMap((h) =>
      [0, 1, 2, 3].map((a) => ({
        id: `${h}_${a}`,
        label: `${h}–${a}`,
        probability: (ctx: MarketContext) => sumGrid(ctx.full, (i, j) => i === h && j === a),
        settle: ({ home, away }: Score) => hit(home === h && away === a),
      }))
    ),
    {
      id: "other",
      label: "Any other score",
      probability: (ctx: MarketContext) => sumGrid(ctx.full, (i, j) => i > 3 || j > 3),
      settle: ({ home, away }: Score) => hit(home > 3 || away > 3),
    },
  ],
};

/* ── One team at a time ────────────────────────────────────────── */

const sideName = (side: "home" | "away") => (side === "home" ? "Home" : "Away");
const goalsOf = (side: "home" | "away", h: number, a: number) => (side === "home" ? h : a);

/** One side's goals over or under a half-goal line. */
function teamTotal(side: "home" | "away", line: number): MarketDefinition {
  const shown = line.toFixed(1);
  return {
    id: `team_total_${side}_${String(line).replace(".", "_")}`,
    label: `${sideName(side)} Team Total ${shown}`,
    description: `Goals scored by the ${side} side alone`,
    ...GOAL_SHAPED,
    choices: [
      {
        id: "over",
        label: `Over ${shown}`,
        probability: (ctx) => sumGrid(ctx.full, (h, a) => goalsOf(side, h, a) > line),
        settle: ({ home, away }) => hit(goalsOf(side, home, away) > line),
      },
      {
        id: "under",
        label: `Under ${shown}`,
        probability: (ctx) => sumGrid(ctx.full, (h, a) => goalsOf(side, h, a) < line),
        settle: ({ home, away }) => hit(goalsOf(side, home, away) < line),
      },
    ],
  };
}

/** A side conceding nothing. */
function cleanSheet(side: "home" | "away"): MarketDefinition {
  const conceded = (h: number, a: number) => goalsOf(side === "home" ? "away" : "home", h, a);
  return {
    id: `clean_sheet_${side}`,
    label: `${sideName(side)} Clean Sheet`,
    description: `The ${side} side concedes nothing`,
    ...GOAL_SHAPED,
    choices: [
      {
        id: "yes",
        label: "Yes",
        probability: (ctx) => sumGrid(ctx.full, (h, a) => conceded(h, a) === 0),
        settle: ({ home, away }) => hit(conceded(home, away) === 0),
      },
      {
        id: "no",
        label: "No",
        probability: (ctx) => sumGrid(ctx.full, (h, a) => conceded(h, a) > 0),
        settle: ({ home, away }) => hit(conceded(home, away) > 0),
      },
    ],
  };
}

/** Winning without conceding. */
function winToNil(side: "home" | "away"): MarketDefinition {
  const won = (h: number, a: number) => resultOf(h, a) === side;
  const nil = (h: number, a: number) => goalsOf(side === "home" ? "away" : "home", h, a) === 0;
  return {
    id: `win_to_nil_${side}`,
    label: `${sideName(side)} Win to Nil`,
    description: `The ${side} side wins and concedes nothing`,
    ...GOAL_SHAPED,
    choices: [
      {
        id: "yes",
        label: "Yes",
        probability: (ctx) => sumGrid(ctx.full, (h, a) => won(h, a) && nil(h, a)),
        settle: ({ home, away }) => hit(won(home, away) && nil(home, away)),
      },
      {
        id: "no",
        label: "No",
        probability: (ctx) => sumGrid(ctx.full, (h, a) => !(won(h, a) && nil(h, a))),
        settle: ({ home, away }) => hit(!(won(home, away) && nil(home, away))),
      },
    ],
  };
}

/* ── Handicaps ─────────────────────────────────────────────────── */

/**
 * European handicap: a whole-goal head start, with the draw still playable.
 *
 * The handicap is applied to the home side, so -1 means the home team starts a
 * goal down and +1 a goal up. Three outcomes, exactly like the match result,
 * which is what separates this from the Asian version.
 */
function europeanHandicap(line: number): MarketDefinition {
  const sign = line > 0 ? `+${line}` : String(line);
  const adjusted = (h: number, a: number) => resultOf(h + line, a);
  return {
    id: `eh_${sign.replace("+", "p").replace("-", "m")}`,
    label: `European Handicap ${sign}`,
    description: `Home side starts ${Math.abs(line)} goal${Math.abs(line) === 1 ? "" : "s"} ${line > 0 ? "up" : "down"}`,
    ...GOAL_SHAPED,
    choices: (["home", "draw", "away"] as const).map((side) => ({
      id: side,
      label: side === "home" ? "Home" : side === "away" ? "Away" : "Draw",
      probability: (ctx: MarketContext) => sumGrid(ctx.full, (h, a) => adjusted(h, a) === side),
      settle: ({ home, away }: Score) => hit(adjusted(home, away) === side),
    })),
  };
}

/**
 * Asian handicap: a head start that removes the draw.
 *
 * Half lines cannot land level, so they always resolve. Whole lines can, and
 * that is a push — the stake back, neither right nor wrong.
 *
 * Quarter lines are deliberately absent. They settle half win, half stake back,
 * and a pick here records one of correct, wrong or push — there is no way to
 * express half of anything. Offering them would mean settling them wrongly.
 */
function asianHandicap(line: number): MarketDefinition {
  const sign = line > 0 ? `+${line}` : String(line);
  const margin = (h: number, a: number) => h + line - a;
  const forSide = (side: "home" | "away") => ({
    id: side,
    label: `${sideName(side)} ${sign}`,
    probability: (ctx: MarketContext) => {
      const win = sumGrid(ctx.full, (h, a) => (side === "home" ? margin(h, a) > 0 : margin(h, a) < 0));
      const push = sumGrid(ctx.full, (h, a) => margin(h, a) === 0);
      const decided = sumGrid(ctx.full, () => true) - push;
      return decided > 0 ? win / decided : 0;
    },
    settle: ({ home, away }: Score): PickResult => {
      const m = margin(home, away);
      if (m === 0) return "push";
      return hit(side === "home" ? m > 0 : m < 0);
    },
  });
  return {
    id: `ah_${sign.replace("+", "p").replace("-", "m").replace(".", "_")}`,
    label: `Asian Handicap ${sign}`,
    description: `Home side starts ${Math.abs(line)} ${line > 0 ? "up" : "down"}, draw removed`,
    ...GOAL_SHAPED,
    choices: [forSide("home"), forSide("away")],
  };
}

/* ── Combinations ──────────────────────────────────────────────── */

/**
 * Two conditions that must both hold.
 *
 * Worth having as first-class markets rather than left to the slip: two
 * selections on one fixture are not independent, and the slip multiplies its
 * selections as though they were. Read off the grid, the joint probability is
 * exact — it is the mass where both conditions hold, correlation included.
 */
function combo(
  id: string,
  label: string,
  description: string,
  parts: { id: string; label: string; test: (h: number, a: number) => boolean }[]
): MarketDefinition {
  return {
    id,
    label,
    description,
    ...GOAL_SHAPED,
    choices: parts.map((p) => ({
      id: p.id,
      label: p.label,
      probability: (ctx: MarketContext) => sumGrid(ctx.full, p.test),
      settle: ({ home, away }: Score) => hit(p.test(home, away)),
    })),
  };
}

const bothScore = (h: number, a: number) => h > 0 && a > 0;
const overLine = (line: number) => (h: number, a: number) => h + a > line;

const RESULT_BTTS = combo(
  "result_btts",
  "Result & Both Teams to Score",
  "The winner and whether both sides scored",
  (["home", "draw", "away"] as const).flatMap((side) =>
    [true, false].map((yes) => ({
      id: `${side}_${yes ? "yes" : "no"}`,
      label: `${side === "draw" ? "Draw" : sideName(side)} & BTTS ${yes ? "Yes" : "No"}`,
      test: (h: number, a: number) => resultOf(h, a) === side && bothScore(h, a) === yes,
    }))
  )
);

const RESULT_OVER_UNDER = combo(
  "result_ou_2_5",
  "Result & Over/Under 2.5",
  "The winner and whether the match passed 2.5 goals",
  (["home", "draw", "away"] as const).flatMap((side) =>
    [true, false].map((over) => ({
      id: `${side}_${over ? "over" : "under"}`,
      label: `${side === "draw" ? "Draw" : sideName(side)} & ${over ? "Over" : "Under"} 2.5`,
      test: (h: number, a: number) => resultOf(h, a) === side && overLine(2.5)(h, a) === over,
    }))
  )
);

const BTTS_OVER_UNDER = combo(
  "btts_ou_2_5",
  "Both Teams to Score & Over/Under 2.5",
  "Whether both sides scored, and whether the match passed 2.5 goals",
  [true, false].flatMap((yes) =>
    [true, false].map((over) => ({
      id: `${yes ? "yes" : "no"}_${over ? "over" : "under"}`,
      label: `BTTS ${yes ? "Yes" : "No"} & ${over ? "Over" : "Under"} 2.5`,
      test: (h: number, a: number) => bothScore(h, a) === yes && overLine(2.5)(h, a) === over,
    }))
  )
);

const DOUBLE_CHANCE_OVER_UNDER = combo(
  "dc_ou_1_5",
  "Double Chance & Over/Under 1.5",
  "Two results covered, and whether the match passed 1.5 goals",
  (
    [
      { id: "1x", label: "Home or Draw", sides: ["home", "draw"] },
      { id: "12", label: "Home or Away", sides: ["home", "away"] },
      { id: "x2", label: "Draw or Away", sides: ["draw", "away"] },
    ] as const
  ).flatMap(({ id, label, sides }) =>
    [true, false].map((over) => ({
      id: `${id}_${over ? "over" : "under"}`,
      label: `${label} & ${over ? "Over" : "Under"} 1.5`,
      test: (h: number, a: number) =>
        (sides as readonly Outcome[]).includes(resultOf(h, a)) && overLine(1.5)(h, a) === over,
    }))
  )
);

/* ── Halves ────────────────────────────────────────────────────── */

/**
 * Markets about one half or both.
 *
 * These rest on two things the full-match markets do not. The halves are split
 * by a measured share rather than evenly — the second half really is the higher
 * scoring one — and they are then treated as independent, which is an
 * assumption and a slightly false one: a side two down at the break plays the
 * second half differently from a side level. Unmeasured until the backtest
 * scores them.
 *
 * They settle on the half-time score, which fixture_results has only carried
 * since 20 August 2026. Anything older settles to nothing rather than guessing.
 *
 * Since measured, and none of them clear the bar: half time / full time +0.9%,
 * first half result +0.5%, second half result 0.0%, highest scoring half -0.6%,
 * both teams to score -3.0% and -4.5% for the two halves — pooled skill in the
 * worst of the three seasons. Two of those are margin-shaped and would have been
 * expected to inherit some signal; they do not, because half a match is half the
 * goals and the noise swamps what little edge there is.
 */
const HALF_SHAPED = { settlesOn: "halves", offered: true } as const;

const goalsIn = (s: Score) => s.home + s.away;

/** Joint probability over (first-half scoreline, second-half scoreline). */
function sumHalves(
  ctx: MarketContext,
  keep: (h1: number, a1: number, h2: number, a2: number) => boolean
): number {
  let total = 0;
  for (let i = 0; i < ctx.first.length; i++) {
    for (let j = 0; j < ctx.first[i].length; j++) {
      const pFirst = ctx.first[i][j];
      if (pFirst <= 0) continue;
      for (let k = 0; k < ctx.second.length; k++) {
        for (let l = 0; l < ctx.second[k].length; l++) {
          if (keep(i, j, k, l)) total += pFirst * ctx.second[k][l];
        }
      }
    }
  }
  return total;
}

const FIRST_HALF_RESULT: MarketDefinition = {
  id: "first_half_result",
  label: "First Half Result",
  description: "Who leads at half time",
  ...HALF_SHAPED,
  choices: (["home", "draw", "away"] as const).map((side) => ({
    id: side,
    label: side === "home" ? "Home" : side === "away" ? "Away" : "Draw",
    probability: (ctx: MarketContext) => sumGrid(ctx.first, (h, a) => resultOf(h, a) === side),
    settle: (_score: Score, _outcome: Outcome, halves?: Halves) =>
      hit(!!halves && resultOf(halves.first.home, halves.first.away) === side),
  })),
};

const SECOND_HALF_RESULT: MarketDefinition = {
  id: "second_half_result",
  label: "Second Half Result",
  description: "Who wins the second half, with the score reset at the break",
  ...HALF_SHAPED,
  choices: (["home", "draw", "away"] as const).map((side) => ({
    id: side,
    label: side === "home" ? "Home" : side === "away" ? "Away" : "Draw",
    probability: (ctx: MarketContext) => sumGrid(ctx.second, (h, a) => resultOf(h, a) === side),
    settle: (_score: Score, _outcome: Outcome, halves?: Halves) =>
      hit(!!halves && resultOf(halves.second.home, halves.second.away) === side),
  })),
};

/**
 * Half time and full time together.
 *
 * Nine combinations, and the reason it needs the joint distribution rather than
 * two separate ones: full time is the two halves added, so "draw at the break,
 * home win at the end" is a statement about both at once.
 */
const HT_FT: MarketDefinition = {
  id: "ht_ft",
  label: "Half Time / Full Time",
  description: "The result at the break and at the end",
  ...HALF_SHAPED,
  choices: (["home", "draw", "away"] as const).flatMap((half) =>
    (["home", "draw", "away"] as const).map((full) => ({
      id: `${half}_${full}`,
      label: `${half === "draw" ? "Draw" : sideName(half)} / ${full === "draw" ? "Draw" : sideName(full)}`,
      probability: (ctx: MarketContext) =>
        sumHalves(
          ctx,
          (h1, a1, h2, a2) =>
            resultOf(h1, a1) === half && resultOf(h1 + h2, a1 + a2) === full
        ),
      settle: (score: Score, _outcome: Outcome, halves?: Halves) =>
        hit(
          !!halves &&
            resultOf(halves.first.home, halves.first.away) === half &&
            resultOf(score.home, score.away) === full
        ),
    }))
  ),
};

const BTTS_FIRST_HALF: MarketDefinition = {
  id: "btts_1h",
  label: "Both Teams to Score — 1st Half",
  description: "Both sides score before the break",
  ...HALF_SHAPED,
  choices: [
    {
      id: "yes",
      label: "Yes",
      probability: (ctx: MarketContext) => sumGrid(ctx.first, (h, a) => h > 0 && a > 0),
      settle: (_s: Score, _o: Outcome, halves?: Halves) =>
        hit(!!halves && halves.first.home > 0 && halves.first.away > 0),
    },
    {
      id: "no",
      label: "No",
      probability: (ctx: MarketContext) => sumGrid(ctx.first, (h, a) => h === 0 || a === 0),
      settle: (_s: Score, _o: Outcome, halves?: Halves) =>
        hit(!!halves && (halves.first.home === 0 || halves.first.away === 0)),
    },
  ],
};

const BTTS_SECOND_HALF: MarketDefinition = {
  id: "btts_2h",
  label: "Both Teams to Score — 2nd Half",
  description: "Both sides score after the break",
  ...HALF_SHAPED,
  choices: [
    {
      id: "yes",
      label: "Yes",
      probability: (ctx: MarketContext) => sumGrid(ctx.second, (h, a) => h > 0 && a > 0),
      settle: (_s: Score, _o: Outcome, halves?: Halves) =>
        hit(!!halves && halves.second.home > 0 && halves.second.away > 0),
    },
    {
      id: "no",
      label: "No",
      probability: (ctx: MarketContext) => sumGrid(ctx.second, (h, a) => h === 0 || a === 0),
      settle: (_s: Score, _o: Outcome, halves?: Halves) =>
        hit(!!halves && (halves.second.home === 0 || halves.second.away === 0)),
    },
  ],
};

const HIGHEST_SCORING_HALF: MarketDefinition = {
  id: "highest_scoring_half",
  label: "Highest Scoring Half",
  description: "Which half produced more goals",
  ...HALF_SHAPED,
  choices: [
    {
      id: "first",
      label: "1st Half",
      probability: (ctx: MarketContext) =>
        sumHalves(ctx, (h1, a1, h2, a2) => h1 + a1 > h2 + a2),
      settle: (_s: Score, _o: Outcome, halves?: Halves) =>
        hit(!!halves && goalsIn(halves.first) > goalsIn(halves.second)),
    },
    {
      id: "equal",
      label: "Equal",
      probability: (ctx: MarketContext) =>
        sumHalves(ctx, (h1, a1, h2, a2) => h1 + a1 === h2 + a2),
      settle: (_s: Score, _o: Outcome, halves?: Halves) =>
        hit(!!halves && goalsIn(halves.first) === goalsIn(halves.second)),
    },
    {
      id: "second",
      label: "2nd Half",
      probability: (ctx: MarketContext) =>
        sumHalves(ctx, (h1, a1, h2, a2) => h1 + a1 < h2 + a2),
      settle: (_s: Score, _o: Outcome, halves?: Halves) =>
        hit(!!halves && goalsIn(halves.first) < goalsIn(halves.second)),
    },
  ],
};

const HALF_MARKETS = [
  FIRST_HALF_RESULT,
  SECOND_HALF_RESULT,
  HT_FT,
  BTTS_FIRST_HALF,
  BTTS_SECOND_HALF,
  HIGHEST_SCORING_HALF,
];

const DEFINITIONS: MarketDefinition[] = [
  MATCH_RESULT,
  DOUBLE_CHANCE,
  DRAW_NO_BET,
  BTTS,
  ...OVER_UNDER_LINES.map(overUnder),
  ODD_EVEN,
  EXACT_GOALS,
  GOAL_BANDS,
  MULTI_GOALS,
  CORRECT_SCORE,
  ...(["home", "away"] as const).flatMap((side) =>
    [0.5, 1.5, 2.5].map((line) => teamTotal(side, line))
  ),
  ...(["home", "away"] as const).map(cleanSheet),
  ...(["home", "away"] as const).map(winToNil),
  ...[-2, -1, 1, 2].map(europeanHandicap),
  ...[-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2].map(asianHandicap),
  RESULT_BTTS,
  RESULT_OVER_UNDER,
  BTTS_OVER_UNDER,
  DOUBLE_CHANCE_OVER_UNDER,
  ...HALF_MARKETS,
];

/**
 * The markets whose percentages were shown to beat their own base rate.
 *
 * From scripts/backtest.ts --markets over the 2025 Premier League, LaLiga and
 * Serie A seasons, roughly 340 fixtures each. The figure per market is Brier
 * skill pooled across its choices, taken from its WORST of the three seasons,
 * and the bar for inclusion is one per cent — below that is inside the noise a
 * single season carries.
 *
 * Read as a list this looks arbitrary. It is not: with one exception every
 * entry is a market about the MARGIN between the two sides, and every market
 * absent is one about the TOTAL they combine for. That is exactly what the
 * model is: the 1X2 pins the difference between the two expected-goal figures,
 * and nothing pins their sum. Handicaps ask about the difference, so they
 * inherit the signal. Over/under, both teams to score, correct score and the
 * rest ask about the sum, and there is nothing there to inherit.
 *
 * The exception is team_total_home_2_5, the one total-shaped market that
 * cleared the bar. Forty markets were scored, so a couple passing by chance is
 * expected, and an isolated pass with no family around it is the shape chance
 * takes. Believe the pattern rather than that one line.
 *
 * Re-run the backtest and update this when the model changes. Anything not
 * listed is offered with its number labelled for what it is.
 */
const BEATS_BASE_RATE = new Set([
  "dnb",
  "1x2",
  "double_chance",
  "ah_m0_5",
  "ah_m1",
  "ah_m1_5",
  "ah_m2",
  "ah_p0_5",
  "eh_m1",
  "eh_m2",
  "eh_p1",
  "win_to_nil_home",
  "team_total_home_2_5",
]);

export const MARKETS: Market[] = DEFINITIONS.map((definition) => ({
  ...definition,
  evidence: BEATS_BASE_RATE.has(definition.id)
    ? ("beats-base-rate" as const)
    : ("no-better-than-base-rate" as const),
}));

const BY_ID = new Map(MARKETS.map((m) => [m.id, m]));

export function marketById(id: string): Market | undefined {
  return BY_ID.get(id);
}

/** The markets that may actually be shown and picked. */
export const OFFERED_MARKETS: Market[] = MARKETS.filter((m) => m.offered);

/**
 * Whether a market/selection pair is one the app actually offers.
 *
 * Derived from the catalogue rather than restated, so a market cannot be
 * offered without also being accepted — and, since it reads `offered`, a market
 * that measured badly cannot be picked even if something tries.
 *
 * Note what this is not: settlePick deliberately does not consult `offered`, so
 * withdrawing a market never strands a pick somebody already made.
 */
export function isValidSelection(market: string, selection: string): boolean {
  const m = BY_ID.get(market);
  if (!m?.offered) return false;
  return m.choices.some((c) => c.id === selection);
}

/**
 * How a selection reads on a slip, where the fixture is already named above it.
 *
 * Markets whose choices are sides of the fixture take the team's name, because
 * that is what the app has always shown for a match result and a slip full of
 * "Home" would be a regression. The rest need enough of the market to stand on
 * their own: "Yes" under a fixture is not a prediction anyone can read, while
 * "Both teams to score: Yes" is.
 */
export function selectionLabel(
  marketId: string,
  selection: string,
  home: string,
  away: string
): string {
  const market = BY_ID.get(marketId);
  const choice = market?.choices.find((c) => c.id === selection);
  if (!market || !choice) return selection;

  const side = (id: string) => (id === "home" ? home : id === "away" ? away : "Draw");

  switch (market.id) {
    case "1x2":
      return side(selection);
    case "dnb":
      return `${side(selection)} (draw no bet)`;
    case "double_chance":
      // "Home or Draw" reads better as the club's own name.
      return selection
        .split("")
        .map((c) => side(c === "1" ? "home" : c === "2" ? "away" : "draw"))
        .join(" or ");
    case "btts":
      return `Both teams to score: ${choice.label}`;
    case "odd_even":
      return `${choice.label} number of goals`;
    default:
      // Over/Under already names its line, so the choice label is the whole
      // prediction on its own.
      return choice.label;
  }
}

/** Every choice in a market, priced off one grid. */
export function priceMarket(market: Market, ctx: MarketContext | ScoreGrid): Record<string, number> {
  // A bare grid is accepted and read as the full-match one, so the many callers
  // that have no interest in halves stay unchanged.
  const context: MarketContext = Array.isArray(ctx)
    ? { full: ctx, first: ctx, second: ctx }
    : ctx;
  return Object.fromEntries(market.choices.map((c) => [c.id, c.probability(context)]));
}

/**
 * A minimal grid carrying only the three results.
 *
 * 1-0 is a home win, 0-0 a draw, 0-1 an away win — enough for any market whose
 * choices are made of results, and meaningless for one that reads a scoreline.
 */
function outcomeGrid(p: { home: number; draw: number; away: number }): ScoreGrid {
  return [
    [p.draw, p.away],
    [p.home, 0],
  ];
}

/**
 * Price a market from the published 1X2 alone.
 *
 * Double chance and draw no bet are functions of the match result and nothing
 * else, so they need no scoreline grid, no extra request and no model call —
 * the three percentages the app already fetches are the entire input. They are
 * also then incapable of disagreeing with the figure shown beside them, which
 * fitting the grid was the long way round to achieving.
 *
 * Returns null for a market that reads scorelines, because those cannot be
 * recovered from three numbers and a plausible-looking wrong answer is worse
 * than none.
 *
 * Input may be fractions or percentages. It is normalised first, because the
 * markets do not agree on units otherwise: double chance adds its two results
 * and keeps whatever scale it was given, while draw no bet divides one by
 * another and always lands between nought and one. Handed percentages, those
 * two would return 78 and 0.7 and both look plausible.
 *
 * Returns fractions.
 */
export function priceFromOutcomes(
  market: Market,
  p: { home: number; draw: number; away: number }
): Record<string, number> | null {
  if (market.settlesOn !== "outcome") return null;

  const total = p.home + p.draw + p.away;
  if (!Number.isFinite(total) || total <= 0) return null;
  const unit = { home: p.home / total, draw: p.draw / total, away: p.away / total };

  return priceMarket(market, outcomeGrid(unit));
}

/**
 * What a finished fixture means for one selection.
 *
 * Returns null when the fixture cannot settle this market yet — not finished,
 * or finished but missing the score the market needs. A row stored before the
 * ninety-minute columns existed is the ordinary case, and returning null leaves
 * the pick pending rather than settling it against extra time and looking
 * entirely correct doing so.
 */
export interface SettlementFixture {
  finished: boolean;
  outcome: Outcome | null;
  /**
   * Score at ninety minutes.
   *
   * Optional, and not merely nullable. The results route is edge-cached, so for
   * a few minutes after any deploy a client can be handed a response written
   * before this field existed — and a settlement loop that destructures it
   * would throw rather than degrade.
   */
  goals90?: { home: number | null; away: number | null } | null;
  /**
   * Score at half time, for the markets about halves.
   *
   * fixture_results has only carried this since 20 August 2026, so it is absent
   * for every fixture stored before then, and those picks stay pending rather
   * than being settled against a half-time score nobody recorded.
   */
  goalsHt?: { home: number | null; away: number | null } | null;
}

export function settlePick(
  marketId: string,
  selection: string,
  fixture: SettlementFixture
): PickResult | null {
  const market = BY_ID.get(marketId);
  if (!market) return null;

  const choice = market.choices.find((c) => c.id === selection);
  if (!choice) return null;

  if (!fixture.finished) return null;

  if (market.settlesOn === "outcome") {
    if (!fixture.outcome) return null;
    return choice.settle({ home: 0, away: 0 }, fixture.outcome);
  }

  const home = fixture.goals90?.home;
  const away = fixture.goals90?.away;
  if (typeof home !== "number" || typeof away !== "number") return null;

  const score = { home, away };
  if (market.settlesOn === "goals") return choice.settle(score, resultOf(home, away));

  // A half market needs the half-time score as well, and the second half is
  // what is left once the first is taken off the full-time score. No half-time
  // score means no answer — settling these off the full-time score alone would
  // be inventing the very thing they are about.
  const htHome = fixture.goalsHt?.home;
  const htAway = fixture.goalsHt?.away;
  if (typeof htHome !== "number" || typeof htAway !== "number") return null;

  const halves: Halves = {
    first: { home: htHome, away: htAway },
    second: { home: home - htHome, away: away - htAway },
  };
  // A half-time score above the full-time one is the provider contradicting
  // itself. Refuse rather than settle from a negative second half.
  if (halves.second.home < 0 || halves.second.away < 0) return null;

  return choice.settle(score, resultOf(home, away), halves);
}
