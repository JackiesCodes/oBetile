/**
 * Turning bookmaker prices into win probabilities.
 *
 * A bookmaker's decimal odds imply probabilities that deliberately sum to more
 * than 100% — the overround, which is their margin. Displaying 1/odds directly
 * would show a match as e.g. 48% / 29% / 28%, totalling 105%, which reads as
 * broken in a predictions UI.
 *
 * Removing the margin proportionally ("de-vigging") rescales the three implied
 * probabilities to sum to exactly 1. The result is converted back into decimal
 * odds so the rest of the app is unchanged: oddsToPercent() still does 1/odds,
 * and now the three buttons total 100%.
 */

export interface OneXTwo {
  home: number;
  draw: number;
  away: number;
}

/** Parse an API-Football odd, which arrives as a string like "2.10". */
export function parseOdd(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  // Decimal odds are always > 1; anything else is unusable and would produce a
  // probability above 100%.
  return Number.isFinite(n) && n > 1 ? n : null;
}

/**
 * Rescale a set of decimal odds so their implied probabilities sum to 1, and
 * return the resulting fair decimal odds.
 */
export function deVig(odds: OneXTwo): OneXTwo | null {
  const implied = {
    home: 1 / odds.home,
    draw: 1 / odds.draw,
    away: 1 / odds.away,
  };

  const total = implied.home + implied.draw + implied.away;
  // A total at or below 1 means the numbers aren't a coherent book — a bad feed
  // rather than a generous bookmaker. Refuse rather than invent probabilities.
  if (!Number.isFinite(total) || total <= 1) return null;

  return {
    home: total / implied.home,
    draw: total / implied.draw,
    away: total / implied.away,
  };
}

/** Fixture id -> fair 1X2 odds, as returned by /api/football/odds. */
export type OddsMap = Record<string, OneXTwo>;

/**
 * Attach prices to a normalised fixture.
 *
 * Fixtures without a priced market keep their null odds, which OddsButton
 * already renders as a dash — most small competitions are never priced, so this
 * is the normal case rather than an error.
 */
export function withOdds<T extends { id: string; odds: { home: number | null; draw: number | null; away: number | null } }>(
  match: T,
  odds: OddsMap
): T {
  const found = odds[match.id];
  if (!found) return match;
  return { ...match, odds: { home: found.home, draw: found.draw, away: found.away } };
}

/** Convenience: the probabilities the UI will end up showing, as percentages. */
export function impliedPercents(odds: OneXTwo): OneXTwo {
  return {
    home: Math.round((1 / odds.home) * 100),
    draw: Math.round((1 / odds.draw) * 100),
    away: Math.round((1 / odds.away) * 100),
  };
}
