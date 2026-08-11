import { describe, it, expect } from "vitest";
import { deVig, parseOdd, impliedPercents, withOdds, type OneXTwo } from "@/lib/odds";
import { oddsToPercent } from "@/lib/utils";

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
    const p = percentsFor({ home: 2.1, draw: 3.4, away: 3.5 });
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);
  });

  it("removes even a very large margin", () => {
    // 117% before de-vigging.
    const p = percentsFor({ home: 1.9, draw: 3.0, away: 3.2 });
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);
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
