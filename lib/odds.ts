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

/**
 * Turn three probabilities into fair decimal odds summing to 100%.
 *
 * Model forecasts arrive as percentages rather than prices. They are supposed
 * to total 100 but do not always, so they are rescaled the same way a
 * bookmaker's margin is removed — leaving one representation, decimal odds,
 * for every source the UI displays.
 */
export function normaliseToFairOdds(percents: OneXTwo): OneXTwo | null {
  const total = percents.home + percents.draw + percents.away;
  if (!Number.isFinite(total) || total <= 0) return null;
  if (percents.home <= 0 || percents.draw <= 0 || percents.away <= 0) return null;

  /*
   * Reject a perfectly flat forecast.
   *
   * For fixtures with little history the model returns 33/33/33, which is not a
   * prediction — it is the absence of one. Rendering it would put an identical,
   * confident-looking 33% on every obscure match, which is worse than the dash
   * it replaced: a dash reads as "no forecast", 33/33/33 reads as a forecast.
   *
   * Only exact equality is refused, so a genuinely balanced 34/33/33 still shows.
   */
  if (percents.home === percents.draw && percents.draw === percents.away) return null;

  return {
    home: total / percents.home,
    draw: total / percents.draw,
    away: total / percents.away,
  };
}

/**
 * Whether a set of percentages is a placeholder rather than a forecast.
 *
 * The provider's /predictions endpoint does not estimate the fixture in front
 * of it. Sampled live across thirteen fixtures in unrelated competitions it
 * returned exactly three values — 45/45/10, 10/45/45 and 35/35/30 — the same
 * handful of buckets over and over, which is why identical percentages appeared
 * on match after match down the feed.
 *
 * The tell is an exact tie. Every bucket has the draw landing on precisely the
 * same whole number as one of the sides, because they are labels chosen from a
 * short list rather than a calculation. A real estimate lands on continuous
 * values that essentially never coincide: over the same fixtures our own model
 * produced 44/23/33, 33/28/39, 53/24/23, 23/41/36, 62/25/13, 33/38/29 and
 * 23/31/46 — not one exact tie among them.
 *
 * An earlier version of this rule refused any forecast whose draw was the
 * highest outcome, on the theory that draws never lead. Two of those seven
 * model outputs put the draw first, so that test threw away real predictions;
 * the tie is the property that actually separates the two.
 *
 * Refusing leaves the row to a better source, and failing that a dash — which
 * honestly reads as "no forecast", where a confident 45% does not.
 */
export function isPlaceholderForecast(percents: OneXTwo): boolean {
  return (
    percents.home === percents.draw ||
    percents.draw === percents.away ||
    percents.home === percents.away
  );
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
