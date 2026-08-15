/**
 * The community voting markets, defined once for both sides.
 *
 * These used to be declared twice: a catalogue in the vote panel and a separate
 * allowlist in the route that accepts the votes. They disagreed. The panel
 * offered a market it called "over_under" while the route would only accept
 * "ou", so every Over/Under vote was rejected with a 400 the UI never showed —
 * the optimistic bar moved and nothing was ever stored. The premium markets
 * were not in the allowlist at all, so those were rejected too.
 *
 * One definition, with the route deriving its allowlist from it, is what stops
 * that happening again: a market cannot be offered without also being accepted.
 */

export interface MarketChoice {
  id: string;
  label: string;
}

export interface MarketConfig {
  id: string;
  label: string;
  description: string;
  choices: MarketChoice[];
  premium?: boolean;
}

export const FREE_MARKETS: MarketConfig[] = [
  {
    id: "1x2",
    label: "1X2 — Match Result",
    description: "Who wins the match?",
    choices: [
      { id: "home", label: "Home Win" },
      { id: "draw", label: "Draw" },
      { id: "away", label: "Away Win" },
    ],
  },
  {
    id: "btts",
    label: "Both Teams to Score",
    description: "Will both teams get on the scoresheet?",
    choices: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  },
  {
    // Named "ou" because that is what the route already accepted and what any
    // stored rows would use; renaming the column value would orphan them.
    id: "ou",
    label: "Over/Under 2.5 Goals",
    description: "Total goals in the match",
    choices: [
      { id: "over", label: "Over 2.5" },
      { id: "under", label: "Under 2.5" },
    ],
  },
];

export const PREMIUM_MARKETS: MarketConfig[] = [
  {
    id: "double_chance",
    label: "Double Chance",
    description: "Two outcomes covered",
    premium: true,
    choices: [
      { id: "1x", label: "1X" },
      { id: "x2", label: "X2" },
      { id: "12", label: "12" },
    ],
  },
  {
    id: "halftime",
    label: "Half Time Result",
    description: "Result at half time",
    premium: true,
    choices: [
      { id: "home", label: "Home" },
      { id: "draw", label: "Draw" },
      { id: "away", label: "Away" },
    ],
  },
  {
    id: "correct_score",
    label: "Correct Score",
    description: "Predict the exact final score",
    premium: true,
    choices: [
      { id: "1-0", label: "1–0" },
      { id: "2-0", label: "2–0" },
      { id: "2-1", label: "2–1" },
      { id: "0-0", label: "0–0" },
      { id: "1-1", label: "1–1" },
      { id: "other", label: "Other" },
    ],
  },
  {
    id: "asian_handicap",
    label: "Asian Handicap",
    description: "Handicap market — one side given a virtual head start",
    premium: true,
    choices: [
      { id: "home", label: "Home -0.5" },
      { id: "away", label: "Away +0.5" },
    ],
  },
  {
    id: "combo",
    label: "Combo Builder",
    description: "Combine multiple outcomes",
    premium: true,
    choices: [
      { id: "home_over", label: "Home + Over 2.5" },
      { id: "btts_over", label: "BTTS + Over 2.5" },
    ],
  },
];

export const ALL_MARKETS: MarketConfig[] = [...FREE_MARKETS, ...PREMIUM_MARKETS];

/**
 * market id -> the selections it permits.
 *
 * Votes are counted straight out of these columns, so this is what keeps
 * arbitrary caller-supplied strings out of permanent, publicly-visible tally
 * data. Derived rather than restated so it always covers exactly what the UI
 * offers.
 */
export const MARKET_SELECTIONS: Record<string, ReadonlySet<string>> = Object.fromEntries(
  ALL_MARKETS.map((m) => [m.id, new Set(m.choices.map((c) => c.id))])
);

/** Whether a market/selection pair is one the app actually offers. */
export function isValidVote(market: string, selection: string): boolean {
  return MARKET_SELECTIONS[market]?.has(selection) ?? false;
}
