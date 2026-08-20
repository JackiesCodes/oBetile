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
export type SettlesOn = "outcome" | "goals";

export interface MarketChoice {
  id: string;
  label: string;
  /** Probability of this choice, summed off a fitted scoreline grid. */
  probability(grid: ScoreGrid): number;
  /** Whether this choice came in. */
  settle(score: Score, outcome: Outcome): PickResult;
}

export interface Market {
  id: string;
  label: string;
  description: string;
  settlesOn: SettlesOn;
  choices: MarketChoice[];
}

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

const MATCH_RESULT: Market = {
  id: "1x2",
  label: "Match Result",
  description: "Who wins the match",
  settlesOn: "outcome",
  choices: (["home", "draw", "away"] as const).map((side) => ({
    id: side,
    label: side === "home" ? "Home" : side === "away" ? "Away" : "Draw",
    probability: (grid) => sumGrid(grid, (h, a) => resultOf(h, a) === side),
    settle: (_score, outcome) => hit(outcome === side),
  })),
};

const DOUBLE_CHANCE: Market = {
  id: "double_chance",
  label: "Double Chance",
  description: "Two of the three results covered",
  settlesOn: "outcome",
  choices: (
    [
      { id: "1x", label: "Home or Draw", sides: ["home", "draw"] },
      { id: "12", label: "Home or Away", sides: ["home", "away"] },
      { id: "x2", label: "Draw or Away", sides: ["draw", "away"] },
    ] as const
  ).map(({ id, label, sides }) => ({
    id,
    label,
    probability: (grid: ScoreGrid) =>
      sumGrid(grid, (h, a) => (sides as readonly Outcome[]).includes(resultOf(h, a))),
    settle: (_score: Score, outcome: Outcome) =>
      hit((sides as readonly Outcome[]).includes(outcome)),
  })),
};

const DRAW_NO_BET: Market = {
  id: "dnb",
  label: "Draw No Bet",
  description: "Backing a side, with a draw voided rather than lost",
  settlesOn: "outcome",
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
    probability: (grid: ScoreGrid) => {
      const win = sumGrid(grid, (h, a) => resultOf(h, a) === side);
      const draw = sumGrid(grid, (h, a) => h === a);
      const decisive = sumGrid(grid, () => true) - draw;
      return decisive > 0 ? win / decisive : 0;
    },
    settle: (_score: Score, outcome: Outcome): PickResult =>
      outcome === "draw" ? "push" : hit(outcome === side),
  })),
};

/* ── Goals ─────────────────────────────────────────────────────── */

const BTTS: Market = {
  id: "btts",
  label: "Both Teams to Score",
  description: "Both sides get on the scoresheet",
  settlesOn: "goals",
  choices: [
    {
      id: "yes",
      label: "Yes",
      probability: (grid) => sumGrid(grid, (h, a) => h > 0 && a > 0),
      settle: ({ home, away }) => hit(home > 0 && away > 0),
    },
    {
      id: "no",
      label: "No",
      probability: (grid) => sumGrid(grid, (h, a) => h === 0 || a === 0),
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
function overUnder(line: number): Market {
  const shown = line.toFixed(1);
  return {
    id: `ou_${String(line).replace(".", "_")}`,
    label: `Over/Under ${shown} Goals`,
    description: `Total goals in the match, against a line of ${shown}`,
    settlesOn: "goals",
    choices: [
      {
        id: "over",
        label: `Over ${shown}`,
        probability: (grid) => sumGrid(grid, (h, a) => h + a > line),
        settle: ({ home, away }) => hit(home + away > line),
      },
      {
        id: "under",
        label: `Under ${shown}`,
        probability: (grid) => sumGrid(grid, (h, a) => h + a < line),
        settle: ({ home, away }) => hit(home + away < line),
      },
    ],
  };
}

export const OVER_UNDER_LINES = [0.5, 1.5, 2.5, 3.5, 4.5];

const ODD_EVEN: Market = {
  id: "odd_even",
  label: "Odd or Even Goals",
  description: "Whether the total number of goals is odd or even",
  settlesOn: "goals",
  choices: [
    {
      id: "odd",
      label: "Odd",
      probability: (grid) => sumGrid(grid, (h, a) => (h + a) % 2 === 1),
      settle: ({ home, away }) => hit((home + away) % 2 === 1),
    },
    {
      id: "even",
      // 0-0 is even, which surprises people often enough to be worth saying.
      label: "Even",
      probability: (grid) => sumGrid(grid, (h, a) => (h + a) % 2 === 0),
      settle: ({ home, away }) => hit((home + away) % 2 === 0),
    },
  ],
};

export const MARKETS: Market[] = [
  MATCH_RESULT,
  DOUBLE_CHANCE,
  DRAW_NO_BET,
  BTTS,
  ...OVER_UNDER_LINES.map(overUnder),
  ODD_EVEN,
];

const BY_ID = new Map(MARKETS.map((m) => [m.id, m]));

export function marketById(id: string): Market | undefined {
  return BY_ID.get(id);
}

/**
 * Whether a market/selection pair is one the app actually offers.
 *
 * Derived from the catalogue rather than restated, so a market cannot be
 * offered without also being accepted.
 */
export function isValidSelection(market: string, selection: string): boolean {
  return BY_ID.get(market)?.choices.some((c) => c.id === selection) ?? false;
}

/** Every choice in a market, priced off one grid. */
export function priceMarket(market: Market, grid: ScoreGrid): Record<string, number> {
  return Object.fromEntries(market.choices.map((c) => [c.id, c.probability(grid)]));
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
  /** Score at ninety minutes; null when the provider gave no split. */
  goals90: { home: number | null; away: number | null };
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

  const { home, away } = fixture.goals90;
  if (typeof home !== "number" || typeof away !== "number") return null;
  return choice.settle({ home, away }, resultOf(home, away));
}
