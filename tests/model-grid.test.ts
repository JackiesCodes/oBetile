import { describe, it, expect } from "vitest";
import {
  fitToOutcomes,
  gridOutcomes,
  outcomeProbabilities,
  predictFixture,
  predictGrid,
  scoreGrid,
  type Probabilities,
  type ScoreGrid,
  type TeamRecord,
} from "@/lib/model";

/**
 * The scoreline grid, and the promise that exposing it changed nothing.
 *
 * Goal markets are sums over the grid the model already built and threw away.
 * The risk in surfacing it is not that the new markets are wrong — they can be
 * measured — but that the published 1X2 quietly moves while nobody is looking,
 * because it is a number people have already seen and slips have already been
 * saved against. These tests pin it.
 */

const total = (grid: ScoreGrid) => grid.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);

const team = (gf: number, ga: number, played = 10, form: string | null = null): TeamRecord => ({
  teamId: Math.round(gf * 100 + ga),
  home: { played, goalsFor: gf * played, goalsAgainst: ga * played },
  away: { played, goalsFor: gf * played * 0.8, goalsAgainst: ga * played * 1.2 },
  form,
});

const table: TeamRecord[] = [team(1.8, 0.9), team(1.5, 1.1), team(1.2, 1.4), team(0.9, 1.8)];

describe("the grid and the three outcomes agree", () => {
  const lambdas: [number, number][] = [
    [1.5, 1.1],
    [0.4, 0.3],
    [2.9, 2.4],
    [4.8, 0.2],
    [0.15, 5],
  ];

  it.each(lambdas)("summing the grid for %f/%f matches outcomeProbabilities", (lh, la) => {
    // Exact, not approximate: the grid builds its cells in the same order
    // outcomeProbabilities sums them, so any difference here means the two have
    // drifted apart rather than merely rounded differently.
    expect(gridOutcomes(scoreGrid(lh, la))).toEqual(outcomeProbabilities(lh, la));
  });

  it.each(lambdas)("produces non-negative mass for %f/%f", (lh, la) => {
    const grid = scoreGrid(lh, la);
    expect(grid.every((row) => row.every((p) => p >= 0))).toBe(true);
    expect(total(grid)).toBeGreaterThan(0);
    expect(total(grid)).toBeLessThanOrEqual(1.000001);
  });

  it("loses real mass off the top when a side expects a lot of goals", () => {
    // Not a defect to fix here, but a limit worth stating out loud: the grid
    // stops at MAX_GOALS a side. A tame fixture loses almost nothing; one
    // expecting nearly five goals loses several per cent, and all of it belongs
    // to the Over side of a high line. fitToOutcomes normalises it away, which
    // is why Over 4.5 needs measuring before it is offered.
    expect(total(scoreGrid(1.5, 1.1))).toBeGreaterThan(0.999);
    expect(total(scoreGrid(4.8, 0.2))).toBeLessThan(0.96);
  });
});

describe("fitting a grid to published outcomes", () => {
  const grid = scoreGrid(1.6, 1.2);

  it("reproduces the target outcomes exactly", () => {
    const target: Probabilities = { home: 0.5, draw: 0.3, away: 0.2 };
    const fitted = gridOutcomes(fitToOutcomes(grid, target));
    expect(fitted.home).toBeCloseTo(0.5, 12);
    expect(fitted.draw).toBeCloseTo(0.3, 12);
    expect(fitted.away).toBeCloseTo(0.2, 12);
  });

  it("normalises to one", () => {
    expect(total(fitToOutcomes(grid, { home: 0.5, draw: 0.3, away: 0.2 }))).toBeCloseTo(1, 12);
  });

  it("leaves the shape within a region alone", () => {
    // Scaling a whole region by one factor must not change which scoreline is
    // the likeliest home win, nor the ratio between two of them.
    const fitted = fitToOutcomes(grid, { home: 0.7, draw: 0.2, away: 0.1 });
    expect(fitted[2][1] / fitted[1][0]).toBeCloseTo(grid[2][1] / grid[1][0], 12);
  });

  it("is a no-op when the target already matches", () => {
    const same = fitToOutcomes(grid, gridOutcomes(grid));
    // Only the normalisation differs, so ratios are untouched.
    expect(same[1][1] / same[0][0]).toBeCloseTo(grid[1][1] / grid[0][0], 12);
  });
});

describe("predictGrid", () => {
  const input = { home: team(1.9, 0.8), away: team(1.0, 1.5), table };

  it("adds up to exactly what predictFixture publishes", () => {
    // The whole point of the fit: a market read off this grid cannot disagree
    // with the percentage shown next to it.
    const published = predictFixture(input)!;
    const summed = gridOutcomes(predictGrid(input)!);
    expect(summed.home).toBeCloseTo(published.home, 12);
    expect(summed.draw).toBeCloseTo(published.draw, 12);
    expect(summed.away).toBeCloseTo(published.away, 12);
  });

  it("refuses exactly when predictFixture refuses", () => {
    // A fixture the model will not call must not be handed goal markets as a
    // consolation prize.
    const thin = { home: team(1.5, 1.0, 1), away: team(1.0, 1.5, 1), table };
    expect(predictFixture(thin)).toBeNull();
    expect(predictGrid(thin)).toBeNull();
  });

  it("still refuses when the table is too small to average", () => {
    expect(predictGrid({ home: team(1.9, 0.8), away: team(1.0, 1.5), table: [] })).toBeNull();
  });
});

describe("the published 1X2 has not moved", () => {
  it("returns the exact numbers it returned before the grid was extracted", () => {
    // Captured from the implementation as it stood before this refactor. The
    // refactor was meant to be invisible; if this fails it was not, and a
    // percentage people have already seen — and saved slips against — has
    // changed underneath them.
    expect(predictFixture({ home: team(1.9, 0.8), away: team(1.0, 1.5), table })).toEqual({
      home: 0.600312892342663,
      draw: 0.25077135994330896,
      away: 0.148915747714028,
    });
  });
});
