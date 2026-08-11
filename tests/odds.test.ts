import { describe, it, expect } from "vitest";
import { deVig, parseOdd, impliedPercents, withOdds, normaliseToFairOdds, type OneXTwo } from "@/lib/odds";
import { oddsToPercent } from "@/lib/utils";

/**
 * Percentages are whole numbers, so three of them can legitimately total 99 or
 * 101 after rounding — measured on real books in production. The invariant is
 * "sums to 100 apart from rounding", not exact equality.
 */
const expectSumsTo100 = (parts: number[]) => {
  expect(Math.abs(parts.reduce((a, b) => a + b, 0) - 100)).toBeLessThanOrEqual(1);
};

const percentsFor = (o: OneXTwo) => {
  const fair = deVig(o);
  if (!fair) throw new Error("expected a de-vigged book");
  return [oddsToPercent(fair.home), oddsToPercent(fair.draw), oddsToPercent(fair.away)];
};

/**
 * Bookmaker prices carry an overround, so raw implied probabilities sum to
 * about 105%. Displayed as prediction percentages that reads as broken, so the
 * margin is removed before the numbers reach a button.
 */
describe("deVig", () => {
  it("rescales a typical book to sum to 100%", () => {
    expectSumsTo100(percentsFor({ home: 2.1, draw: 3.4, away: 3.5 }));
  });

  it("removes even a very large margin", () => {
    // 117% before de-vigging.
    expectSumsTo100(percentsFor({ home: 1.9, draw: 3.0, away: 3.2 }));
  });

  it("keeps a heavy favourite heavily favoured", () => {
    const [home, draw, away] = percentsFor({ home: 1.2, draw: 6.5, away: 15.0 });
    expect(home).toBeGreaterThan(70);
    expect(home).toBeGreaterThan(draw);
    expect(draw).toBeGreaterThan(away);
  });

  it("preserves an away favourite rather than flattening it", () => {
    const [home, , away] = percentsFor({ home: 5.0, draw: 3.9, away: 1.7 });
    expect(away).toBeGreaterThan(home);
  });

  it("rejects a book whose implied probabilities do not exceed 1", () => {
    // Not a generous bookmaker — a broken feed. Inventing probabilities from it
    // would be worse than showing nothing.
    expect(deVig({ home: 5, draw: 5, away: 5 })).toBeNull();
  });

  it("leaves raw prices summing to more than 100", () => {
    const raw = impliedPercents({ home: 2.1, draw: 3.4, away: 3.5 });
    expect(raw.home + raw.draw + raw.away).toBeGreaterThan(100);
  });
});

describe("parseOdd", () => {
  it("parses the string form the API returns", () => {
    expect(parseOdd("2.10")).toBeCloseTo(2.1);
    expect(parseOdd(3)).toBe(3);
  });

  it("rejects anything that is not usable decimal odds", () => {
    // Decimal odds are always above 1; anything at or below implies a
    // probability over 100%.
    for (const bad of ["abc", null, undefined, "", 1, 0.5, -2]) {
      expect(parseOdd(bad)).toBeNull();
    }
  });
});

describe("withOdds", () => {
  const match = { id: "111", odds: { home: null, draw: null, away: null } };

  it("attaches prices for a fixture that has them", () => {
    const out = withOdds(match, { "111": { home: 2, draw: 3, away: 4 } });
    expect(out.odds).toEqual({ home: 2, draw: 3, away: 4 });
  });

  it("leaves an unpriced fixture untouched", () => {
    // Most smaller competitions are never priced; that is normal, and the
    // button renders a dash rather than an error.
    expect(withOdds(match, {}).odds).toEqual({ home: null, draw: null, away: null });
  });

  it("does not mutate the match it was given", () => {
    withOdds(match, { "111": { home: 2, draw: 3, away: 4 } });
    expect(match.odds.home).toBeNull();
  });
});

/**
 * Model forecasts arrive as percentages rather than prices, and fill in for the
 * majority of fixtures no bookmaker prices. They are converted to the same fair
 * odds representation so one code path renders both sources.
 */
describe("normaliseToFairOdds", () => {
  const pct = (o: OneXTwo) => [
    oddsToPercent(o.home),
    oddsToPercent(o.draw),
    oddsToPercent(o.away),
  ];

  it("round-trips percentages that already total 100", () => {
    const fair = normaliseToFairOdds({ home: 45, draw: 28, away: 27 });
    expect(fair).not.toBeNull();
    expect(pct(fair!)).toEqual([45, 28, 27]);
  });

  it("rescales percentages that do not total 100", () => {
    // API forecasts are not guaranteed to sum exactly.
    const p = pct(normaliseToFairOdds({ home: 50, draw: 30, away: 30 })!);
    expectSumsTo100(p);
    expect(p[0]).toBeGreaterThan(p[1]);
  });

  it("refuses a set containing a zero or negative share", () => {
    // Would otherwise divide by zero and render Infinity.
    expect(normaliseToFairOdds({ home: 0, draw: 50, away: 50 })).toBeNull();
    expect(normaliseToFairOdds({ home: -10, draw: 60, away: 50 })).toBeNull();
  });

  it("produces odds the display helper turns back into whole percentages", () => {
    expectSumsTo100(pct(normaliseToFairOdds({ home: 83, draw: 12, away: 5 })!));
  });
});
