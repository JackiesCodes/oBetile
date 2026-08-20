import { describe, it, expect } from "vitest";
import {
  MARKETS,
  OFFERED_MARKETS,
  isValidSelection,
  priceFromOutcomes,
  marketById,
  priceMarket,
  settlePick,
  sumGrid,
  type SettlementFixture,
} from "@/lib/markets";
import { predictFixture, predictGrid, scoreGrid, type TeamRecord } from "@/lib/model";

/**
 * Pricing and settling the goal-derived markets.
 *
 * Settlement is the half that has to be right. A mispriced market shows a
 * number that is a bit off; a missettled one tells somebody their prediction
 * was wrong when it was not, permanently, in a record they cannot correct. So
 * every market gets a truth table rather than a sample.
 */

const grid = scoreGrid(1.6, 1.2);

const finished = (home: number, away: number): SettlementFixture => ({
  finished: true,
  outcome: home > away ? "home" : home < away ? "away" : "draw",
  goals90: { home, away },
});

describe("every market adds up the way its shape implies", () => {
  /**
   * How many times over each market covers the grid.
   *
   * Most markets partition it, so their choices sum to the grid's own total —
   * which is just under one, since the tail past MAX_GOALS is dropped. Double
   * Chance covers two of three results per choice, so its three choices cover
   * everything twice. Draw No Bet renormalises onto the decisive fixtures and
   * sums to exactly one regardless.
   */
  const coverage = (id: string) => (id === "double_chance" ? 2 : id === "dnb" ? null : 1);

  it.each(MARKETS.map((m) => [m.id, m] as const))("%s covers the grid as expected", (id, m) => {
    const total = Object.values(priceMarket(m, grid)).reduce((a, b) => a + b, 0);
    const times = coverage(id);
    expect(total).toBeCloseTo(times === null ? 1 : sumGrid(grid, () => true) * times, 9);
  });

  it.each(MARKETS.map((m) => [m.id, m] as const))("%s prices nothing negative", (_id, m) => {
    expect(Object.values(priceMarket(m, grid)).every((p) => p >= 0)).toBe(true);
  });
});

describe("both teams to score", () => {
  it.each([
    [1, 1, "correct"],
    [2, 3, "correct"],
    [0, 0, "wrong"],
    [3, 0, "wrong"],
    [0, 2, "wrong"],
  ] as const)("%i-%i settles yes as %s", (h, a, expected) => {
    expect(settlePick("btts", "yes", finished(h, a))).toBe(expected);
  });

  it("settles no as the exact complement", () => {
    for (const [h, a] of [
      [1, 1],
      [0, 0],
      [3, 0],
      [0, 2],
    ]) {
      const yes = settlePick("btts", "yes", finished(h, a));
      const no = settlePick("btts", "no", finished(h, a));
      expect(no).toBe(yes === "correct" ? "wrong" : "correct");
    }
  });
});

describe("over and under", () => {
  it.each([
    [2.5, 2, 1, "over"],
    [2.5, 1, 1, "under"],
    [2.5, 2, 0, "under"],
    [0.5, 0, 0, "under"],
    [0.5, 1, 0, "over"],
    [4.5, 3, 2, "over"],
    [4.5, 2, 2, "under"],
  ] as const)("a %f line with %i-%i comes in %s", (line, h, a, winner) => {
    const id = `ou_${String(line).replace(".", "_")}`;
    const loser = winner === "over" ? "under" : "over";
    expect(settlePick(id, winner, finished(h, a))).toBe("correct");
    expect(settlePick(id, loser, finished(h, a))).toBe("wrong");
  });

  it("never pushes, because every line is a half goal", () => {
    for (const m of MARKETS.filter((m) => m.id.startsWith("ou_"))) {
      for (let h = 0; h <= 5; h++) {
        for (let a = 0; a <= 5; a++) {
          for (const c of m.choices) {
            expect(settlePick(m.id, c.id, finished(h, a))).not.toBe("push");
          }
        }
      }
    }
  });
});

describe("odd and even", () => {
  it.each([
    [0, 0, "even"],
    [1, 0, "odd"],
    [1, 1, "even"],
    [2, 1, "odd"],
    [3, 3, "even"],
  ] as const)("%i-%i is %s", (h, a, expected) => {
    expect(settlePick("odd_even", expected, finished(h, a))).toBe("correct");
  });
});

describe("double chance", () => {
  it.each([
    ["1x", "home", "correct"],
    ["1x", "draw", "correct"],
    ["1x", "away", "wrong"],
    ["12", "draw", "wrong"],
    ["12", "away", "correct"],
    ["x2", "home", "wrong"],
    ["x2", "draw", "correct"],
  ] as const)("%s against a %s win settles %s", (choice, outcome, expected) => {
    expect(
      settlePick("double_chance", choice, { finished: true, outcome, goals90: { home: 1, away: 1 } })
    ).toBe(expected);
  });
});

describe("draw no bet", () => {
  it("voids the draw rather than losing it", () => {
    expect(settlePick("dnb", "home", finished(1, 1))).toBe("push");
    expect(settlePick("dnb", "away", finished(1, 1))).toBe("push");
  });

  it("settles normally otherwise", () => {
    expect(settlePick("dnb", "home", finished(2, 1))).toBe("correct");
    expect(settlePick("dnb", "home", finished(0, 1))).toBe("wrong");
  });

  it("prices the two sides to one between them", () => {
    const priced = priceMarket(marketById("dnb")!, grid);
    expect(priced.home + priced.away).toBeCloseTo(1, 9);
  });
});

describe("what cannot be settled stays pending", () => {
  const base: SettlementFixture = { finished: true, outcome: "home", goals90: { home: 2, away: 1 } };

  it("returns null for a fixture that has not finished", () => {
    expect(settlePick("btts", "yes", { ...base, finished: false })).toBeNull();
  });

  it("returns null rather than throwing when the field is absent entirely", () => {
    // What an edge-cached response written before goals90 existed looks like.
    // Destructuring it threw, which would have taken the whole settlement loop
    // down and left every pick in every slip pending.
    const stale = { finished: true, outcome: "home" } as const;
    expect(settlePick("btts", "yes", stale)).toBeNull();
    expect(settlePick("ou_2_5", "over", { ...stale, goals90: null })).toBeNull();
    // The outcome markets still settle off such a response, as they always did.
    expect(settlePick("1x2", "home", stale)).toBe("correct");
  });

  it("returns null for a goal market with no ninety-minute score", () => {
    // The ordinary case for rows written before those columns existed. Settling
    // these against the final score would quietly resolve extra-time goals into
    // a market that was never about them.
    expect(settlePick("btts", "yes", { ...base, goals90: { home: null, away: null } })).toBeNull();
    expect(settlePick("ou_2_5", "over", { ...base, goals90: { home: 2, away: null } })).toBeNull();
  });

  it("still settles an outcome market without a ninety-minute score", () => {
    // Who won is known from the outcome alone, penalties included.
    expect(
      settlePick("1x2", "home", { ...base, goals90: { home: null, away: null } })
    ).toBe("correct");
  });

  it("returns null for a market or selection that does not exist", () => {
    expect(settlePick("corners", "over", base)).toBeNull();
    expect(settlePick("btts", "maybe", base)).toBeNull();
  });
});

describe("the catalogue is the allowlist", () => {
  it("accepts every choice of every offered market", () => {
    for (const m of OFFERED_MARKETS) {
      for (const c of m.choices) expect(isValidSelection(m.id, c.id)).toBe(true);
    }
  });

  it("rejects a market that measured badly, however valid its choice", () => {
    // btts:yes is a real, correct, tested selection. It is refused because the
    // backtest said its fixture-specific price is worse than the season
    // average, and there is no point offering a number like that.
    expect(MARKETS.some((m) => m.id === "btts")).toBe(true);
    expect(isValidSelection("btts", "yes")).toBe(false);
    expect(isValidSelection("ou_2_5", "over")).toBe(false);
    expect(isValidSelection("odd_even", "odd")).toBe(false);
  });

  it("still settles a withdrawn market, so no pick is ever stranded", () => {
    // The gate is on making new picks, not on honouring old ones. If a market
    // is ever withdrawn after someone has picked it, that pick must still
    // resolve rather than sit pending forever.
    expect(settlePick("btts", "yes", finished(1, 1))).toBe("correct");
  });

  it("offers only what the backtest cleared", () => {
    expect(OFFERED_MARKETS.map((m) => m.id).sort()).toEqual(["1x2", "dnb", "double_chance"]);
  });

  it("rejects anything else", () => {
    expect(isValidSelection("btts", "sometimes")).toBe(false);
    expect(isValidSelection("player_shots", "over")).toBe(false);
  });

  it("has no duplicate market ids", () => {
    expect(new Set(MARKETS.map((m) => m.id)).size).toBe(MARKETS.length);
  });

  it("has no duplicate choice ids within a market", () => {
    for (const m of MARKETS) {
      expect(new Set(m.choices.map((c) => c.id)).size).toBe(m.choices.length);
    }
  });
});

describe("pricing from the published 1X2 alone", () => {
  const published = { home: 0.52, draw: 0.26, away: 0.22 };

  it("gives double chance the sum of its two results", () => {
    const priced = priceFromOutcomes(marketById("double_chance")!, published)!;
    expect(priced["1x"]).toBeCloseTo(0.78, 12);
    expect(priced["12"]).toBeCloseTo(0.74, 12);
    expect(priced["x2"]).toBeCloseTo(0.48, 12);
  });

  it("gives draw no bet the decisive share", () => {
    const priced = priceFromOutcomes(marketById("dnb")!, published)!;
    expect(priced.home).toBeCloseTo(0.52 / 0.74, 12);
    expect(priced.away).toBeCloseTo(0.22 / 0.74, 12);
    expect(priced.home + priced.away).toBeCloseTo(1, 12);
  });

  it("returns the published figures back for the match result itself", () => {
    const priced = priceFromOutcomes(marketById("1x2")!, published)!;
    expect(priced.home).toBeCloseTo(0.52, 12);
    expect(priced.draw).toBeCloseTo(0.26, 12);
    expect(priced.away).toBeCloseTo(0.22, 12);
  });

  it("refuses a market that reads scorelines", () => {
    // Three numbers cannot say how many goals were scored, and a confident
    // wrong answer here would be indistinguishable from a right one.
    expect(priceFromOutcomes(marketById("btts")!, published)).toBeNull();
    expect(priceFromOutcomes(marketById("ou_2_5")!, published)).toBeNull();
  });

  it("agrees exactly with the same market priced off a fitted grid", () => {
    // The shortcut exists because the fit guarantees these are the same number.
    // If that ever stops being true, the app would show one figure on the card
    // and a different one on the match page for the same prediction.
    const team = (gf: number, ga: number): TeamRecord => ({
      teamId: Math.round(gf * 100 + ga),
      home: { played: 10, goalsFor: gf * 10, goalsAgainst: ga * 10 },
      away: { played: 10, goalsFor: gf * 8, goalsAgainst: ga * 12 },
      form: null,
    });
    const table = [team(1.8, 0.9), team(1.5, 1.1), team(1.2, 1.4), team(0.9, 1.8)];
    const input = { home: team(1.9, 0.8), away: team(1.0, 1.5), table };

    const grid = predictGrid(input)!;
    const outcomes = predictFixture(input)!;

    for (const id of ["1x2", "double_chance", "dnb"]) {
      const market = marketById(id)!;
      const viaGrid = priceMarket(market, grid);
      const viaOutcomes = priceFromOutcomes(market, outcomes)!;
      for (const c of market.choices) {
        expect(viaOutcomes[c.id]).toBeCloseTo(viaGrid[c.id], 10);
      }
    }
  });
});

describe("pricing off a real fixture", () => {
  const team = (gf: number, ga: number): TeamRecord => ({
    teamId: Math.round(gf * 100 + ga),
    home: { played: 10, goalsFor: gf * 10, goalsAgainst: ga * 10 },
    away: { played: 10, goalsFor: gf * 8, goalsAgainst: ga * 12 },
    form: null,
  });
  const table = [team(1.8, 0.9), team(1.5, 1.1), team(1.2, 1.4), team(0.9, 1.8)];

  it("prices every market from one grid", () => {
    const fixtureGrid = predictGrid({ home: team(1.9, 0.8), away: team(1.0, 1.5), table })!;
    for (const m of MARKETS) {
      const priced = priceMarket(m, fixtureGrid);
      expect(Object.keys(priced)).toHaveLength(m.choices.length);
      expect(Object.values(priced).every((p) => p >= 0 && p <= 1)).toBe(true);
    }
  });

  it("agrees with itself across lines: over 0.5 is likelier than over 4.5", () => {
    const fixtureGrid = predictGrid({ home: team(1.9, 0.8), away: team(1.0, 1.5), table })!;
    const over = (id: string) => priceMarket(marketById(id)!, fixtureGrid).over;
    expect(over("ou_0_5")).toBeGreaterThan(over("ou_1_5"));
    expect(over("ou_1_5")).toBeGreaterThan(over("ou_2_5"));
    expect(over("ou_2_5")).toBeGreaterThan(over("ou_3_5"));
    expect(over("ou_3_5")).toBeGreaterThan(over("ou_4_5"));
  });
});
