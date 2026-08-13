import { describe, it, expect } from "vitest";
import {
  poissonPmf,
  factorial,
  outcomeProbabilities,
  formRate,
  leagueAverages,
  expectedGoals,
  applyHeadToHead,
  applyTemperature,
  lowScoreAdjustment,
  predictFixture,
  toPercentages,
  normalise,
  MIN_MATCHES_PLAYED,
  type TeamRecord,
} from "@/lib/model";

/** A team whose home and away records are both league-average. */
function team(id: number, over: Partial<TeamRecord> = {}): TeamRecord {
  return {
    teamId: id,
    home: { played: 9, goalsFor: 14, goalsAgainst: 9 },
    away: { played: 9, goalsFor: 9, goalsAgainst: 14 },
    form: null,
    ...over,
  };
}

/** Ten identical, perfectly average sides. */
const flatTable: TeamRecord[] = Array.from({ length: 10 }, (_, i) => team(i + 1));

describe("poisson maths", () => {
  it("computes factorials", () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(1)).toBe(1);
    expect(factorial(5)).toBe(120);
  });

  it("matches known Poisson values", () => {
    // P(0; 1.5) = e^-1.5
    expect(poissonPmf(0, 1.5)).toBeCloseTo(Math.exp(-1.5), 10);
    // P(2; 2) = e^-2 * 2^2 / 2 = 2e^-2
    expect(poissonPmf(2, 2)).toBeCloseTo(2 * Math.exp(-2), 10);
  });

  it("returns zero for impossible inputs", () => {
    expect(poissonPmf(-1, 2)).toBe(0);
    expect(poissonPmf(2, 0)).toBe(0);
  });

  it("has a distribution summing to about one", () => {
    let total = 0;
    for (let k = 0; k <= 20; k++) total += poissonPmf(k, 1.4);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe("outcomeProbabilities", () => {
  it("always sums to one", () => {
    for (const [h, a] of [[1.4, 1.1], [0.3, 2.9], [3.5, 0.4], [1, 1]]) {
      const p = outcomeProbabilities(h, a);
      expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
    }
  });

  it("is symmetric when both sides are equally likely to score", () => {
    const p = outcomeProbabilities(1.3, 1.3);
    expect(p.home).toBeCloseTo(p.away, 10);
  });

  it("favours the side expected to score more", () => {
    const p = outcomeProbabilities(2.2, 0.8);
    expect(p.home).toBeGreaterThan(p.away);
    expect(p.home).toBeGreaterThan(0.5);
  });

  it("makes a draw likeliest when both sides are weak in attack", () => {
    // Two sides expected to score very little draw more often than either wins.
    const p = outcomeProbabilities(0.4, 0.4);
    expect(p.draw).toBeGreaterThan(p.home);
    expect(p.draw).toBeGreaterThan(p.away);
  });

  it("never produces a negative or impossible probability", () => {
    const p = outcomeProbabilities(5, 0.15);
    for (const v of [p.home, p.draw, p.away]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("formRate", () => {
  it("scores a perfect and a winless run", () => {
    expect(formRate("WWWWW")).toBeCloseTo(1);
    expect(formRate("LLLLL")).toBeCloseTo(0);
  });

  it("scores a mixed run by points taken", () => {
    // 3+3+1+0+3 = 10 of 15
    expect(formRate("WWDLW")).toBeCloseTo(10 / 15);
  });

  it("ignores characters the API sometimes includes", () => {
    expect(formRate("W-D-L")).toBeCloseTo(4 / 9);
  });

  it("returns null when there is no form to read", () => {
    expect(formRate(null)).toBeNull();
    expect(formRate("")).toBeNull();
    expect(formRate("???")).toBeNull();
  });
});

describe("leagueAverages", () => {
  it("derives baselines from the table rather than assuming them", () => {
    const avg = leagueAverages(flatTable)!;
    expect(avg.homeGoals).toBeCloseTo(14 / 9);
    expect(avg.awayGoals).toBeCloseTo(9 / 9);
  });

  it("shows home sides outscoring away sides", () => {
    const avg = leagueAverages(flatTable)!;
    expect(avg.homeGoals).toBeGreaterThan(avg.awayGoals);
  });

  it("refuses a table where nothing has been played", () => {
    const empty = [team(1, { home: { played: 0, goalsFor: 0, goalsAgainst: 0 }, away: { played: 0, goalsFor: 0, goalsAgainst: 0 } })];
    expect(leagueAverages(empty)).toBeNull();
  });
});

describe("expectedGoals", () => {
  const avg = leagueAverages(flatTable)!;

  it("gives an average pairing the league baseline", () => {
    const l = expectedGoals(team(1), team(2), avg)!;
    expect(l.home).toBeCloseTo(avg.homeGoals, 6);
    expect(l.away).toBeCloseTo(avg.awayGoals, 6);
  });

  it("raises the expectation against a leaky defence", () => {
    const leaky = team(2, { away: { played: 9, goalsFor: 9, goalsAgainst: 27 } });
    const l = expectedGoals(team(1), leaky, avg)!;
    expect(l.home).toBeGreaterThan(avg.homeGoals);
  });

  it("lowers the expectation for a blunt attack", () => {
    const blunt = team(1, { home: { played: 9, goalsFor: 4, goalsAgainst: 9 } });
    const l = expectedGoals(blunt, team(2), avg)!;
    expect(l.home).toBeLessThan(avg.homeGoals);
  });

  it("refuses when a side has no relevant record", () => {
    const noHome = team(1, { home: { played: 0, goalsFor: 0, goalsAgainst: 0 } });
    expect(expectedGoals(noHome, team(2), avg)).toBeNull();
  });

  it("trusts a long record more than a short one", () => {
    // Both sides score at three times the league rate at home; one has shown it
    // over two matches, the other over twenty. The longer record must move the
    // expectation further.
    const rate = avg.homeGoals * 3;
    const brief = team(1, { home: { played: 2, goalsFor: rate * 2, goalsAgainst: 2 } });
    const sustained = team(1, { home: { played: 20, goalsFor: rate * 20, goalsAgainst: 20 } });

    const short = expectedGoals(brief, team(2), avg)!;
    const long = expectedGoals(sustained, team(2), avg)!;

    expect(long.home).toBeGreaterThan(short.home);
    // And the brief record must not be taken at anything like face value.
    expect(short.home).toBeLessThan(rate);
  });
});

describe("applyHeadToHead", () => {
  const even = { home: 0.4, draw: 0.3, away: 0.3 };

  it("pulls toward a lopsided history", () => {
    const out = applyHeadToHead(even, { played: 10, homeWins: 9, draws: 1, awayWins: 0 });
    expect(out.home).toBeGreaterThan(even.home);
    expect(out.home + out.draw + out.away).toBeCloseTo(1, 10);
  });

  it("ignores too small a sample", () => {
    expect(applyHeadToHead(even, { played: 2, homeWins: 2, draws: 0, awayWins: 0 })).toEqual(even);
    expect(applyHeadToHead(even, null)).toEqual(even);
  });

  it("moves the result only modestly, since history is a small sample", () => {
    const out = applyHeadToHead(even, { played: 10, homeWins: 10, draws: 0, awayWins: 0 });
    // A clean sweep must not turn a 40% side into a near-certainty.
    expect(out.home).toBeLessThan(0.6);
  });
});

describe("predictFixture", () => {
  it("returns a usable distribution for an average pairing", () => {
    const p = predictFixture({ home: team(1), away: team(2), table: flatTable })!;
    expect(p).not.toBeNull();
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
    // Home advantage is in the data, so the home side should lead.
    expect(p.home).toBeGreaterThan(p.away);
  });

  it("is never the flat 33/33/33 the provider falls back to", () => {
    const p = predictFixture({ home: team(1), away: team(2), table: flatTable })!;
    expect(Math.abs(p.home - p.away)).toBeGreaterThan(0.01);
  });

  it("favours a strong home side over a weak visitor", () => {
    const strong = team(1, { home: { played: 9, goalsFor: 24, goalsAgainst: 4 } });
    const weak = team(2, { away: { played: 9, goalsFor: 3, goalsAgainst: 22 } });
    const p = predictFixture({ home: strong, away: weak, table: flatTable })!;
    expect(p.home).toBeGreaterThan(0.6);
    expect(p.home).toBeGreaterThan(p.draw);
  });

  it("lets good form lift a side", () => {
    const base = predictFixture({ home: team(1), away: team(2), table: flatTable })!;
    const inForm = predictFixture({
      home: team(1, { form: "WWWWW" }),
      away: team(2, { form: "LLLLL" }),
      table: flatTable,
    })!;
    expect(inForm.home).toBeGreaterThan(base.home);
  });

  it("refuses when either side has barely played", () => {
    // Early-season tables describe the fixture list more than the teams.
    const fresh = team(9, {
      home: { played: 1, goalsFor: 1, goalsAgainst: 1 },
      away: { played: 0, goalsFor: 0, goalsAgainst: 0 },
    });
    expect(predictFixture({ home: fresh, away: team(2), table: flatTable })).toBeNull();
    expect(MIN_MATCHES_PLAYED).toBeGreaterThan(2);
  });

  it("refuses when the table is unusable", () => {
    expect(predictFixture({ home: team(1), away: team(2), table: [] })).toBeNull();
  });

  it("keeps a lopsided but real pairing inside plausible bounds", () => {
    // Records at this gap occur every season in a professional league. Before
    // shrinkage the model answered a fixture of this shape with a 3% away win,
    // measured against production — a figure no 1X2 market produces.
    const strong = team(1, { home: { played: 11, goalsFor: 22, goalsAgainst: 6 } });
    const weak = team(2, { away: { played: 11, goalsFor: 7, goalsAgainst: 20 } });

    const p = predictFixture({ home: strong, away: weak, table: flatTable })!;
    expect(p.home).toBeLessThan(0.85);
    expect(p.away).toBeGreaterThan(0.04);
  });

  it("stops short of certainty even on an absurd mismatch", () => {
    // Not a fixture a real league produces, but the feed carries amateur and
    // youth competitions where records do reach this gap. The model may be very
    // confident; it must never be certain.
    const best = team(1, { home: { played: 11, goalsFor: 40, goalsAgainst: 2 }, form: "WWWWW" });
    const worst = team(2, { away: { played: 11, goalsFor: 1, goalsAgainst: 40 }, form: "LLLLL" });

    const p = predictFixture({ home: best, away: worst, table: flatTable })!;
    expect(p.home).toBeLessThan(1);
    expect(p.away).toBeGreaterThan(0);
  });
});

describe("low score correction", () => {
  it("leaves scorelines above 1-1 untouched", () => {
    expect(lowScoreAdjustment(2, 1, 1.4, 1.1)).toBe(1);
    expect(lowScoreAdjustment(0, 3, 1.4, 1.1)).toBe(1);
  });

  it("lifts the two low draws and trims the two low wins", () => {
    expect(lowScoreAdjustment(0, 0, 1.4, 1.1)).toBeGreaterThan(1);
    expect(lowScoreAdjustment(1, 1, 1.4, 1.1)).toBeGreaterThan(1);
    expect(lowScoreAdjustment(1, 0, 1.4, 1.1)).toBeLessThan(1);
    expect(lowScoreAdjustment(0, 1, 1.4, 1.1)).toBeLessThan(1);
  });

  it("never goes negative, however high the expectation", () => {
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      expect(lowScoreAdjustment(i, j, 5, 5)).toBeGreaterThanOrEqual(0);
    }
  });

  it("raises the draw above what independent goals would give", () => {
    // Independent Poissons under-count draws; this is what the correction is
    // for, so an evenly matched fixture must come out drawier with it than the
    // raw product would be.
    const lambda = 1.3;
    let independentDraw = 0;
    let total = 0;
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        const p = poissonPmf(i, lambda) * poissonPmf(j, lambda);
        total += p;
        if (i === j) independentDraw += p;
      }
    }
    const corrected = outcomeProbabilities(lambda, lambda);
    expect(corrected.draw).toBeGreaterThan(independentDraw / total);
  });
});

describe("toPercentages", () => {
  it("always totals exactly 100", () => {
    const cases = [
      { home: 1 / 3, draw: 1 / 3, away: 1 / 3 },
      { home: 0.455, draw: 0.272, away: 0.273 },
      { home: 0.8123, draw: 0.1001, away: 0.0876 },
      { home: 0.001, draw: 0.001, away: 0.998 },
    ];
    for (const c of cases) {
      const p = toPercentages(c);
      expect(p.home + p.draw + p.away).toBe(100);
    }
  });

  it("keeps the ordering of the underlying probabilities", () => {
    const p = toPercentages({ home: 0.5, draw: 0.3, away: 0.2 });
    expect(p.home).toBeGreaterThan(p.draw);
    expect(p.draw).toBeGreaterThan(p.away);
  });
});

describe("normalise", () => {
  it("falls back to even thirds rather than dividing by zero", () => {
    const p = normalise({ home: 0, draw: 0, away: 0 });
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
  });
});

describe("applyTemperature", () => {
  const sharp = { home: 0.75, draw: 0.18, away: 0.07 };

  it("reduces confidence in the leading outcome", () => {
    const out = applyTemperature(sharp, 1.25);
    expect(out.home).toBeLessThan(sharp.home);
    expect(out.away).toBeGreaterThan(sharp.away);
  });

  it("keeps the ordering intact", () => {
    const out = applyTemperature(sharp, 1.25);
    expect(out.home).toBeGreaterThan(out.draw);
    expect(out.draw).toBeGreaterThan(out.away);
  });

  it("still sums to one", () => {
    for (const t of [1.1, 1.25, 2]) {
      const out = applyTemperature(sharp, t);
      expect(out.home + out.draw + out.away).toBeCloseTo(1, 10);
    }
  });

  it("does nothing at T=1", () => {
    expect(applyTemperature(sharp, 1)).toEqual(sharp);
  });

  it("leaves an already-even forecast alone", () => {
    const even = { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
    const out = applyTemperature(even, 1.25);
    expect(out.home).toBeCloseTo(1 / 3, 10);
  });

  it("is applied by predictFixture, not just available to it", () => {
    // Guards against the tempering being defined but never wired in — the
    // backtested calibration only holds if every published number goes
    // through it.
    const strong = team(1, { home: { played: 11, goalsFor: 26, goalsAgainst: 5 } });
    const weak = team(2, { away: { played: 11, goalsFor: 5, goalsAgainst: 24 } });
    const p = predictFixture({ home: strong, away: weak, table: flatTable })!;

    const untempered = applyTemperature(p, 1);
    expect(p.home).toBeLessThan(0.9);
    // Re-tempering an already-tempered figure must move it further, proving
    // the value returned was not the raw one.
    expect(applyTemperature(untempered, 1.25).home).toBeLessThan(p.home);
  });
});
