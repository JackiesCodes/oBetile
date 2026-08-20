import { describe, it, expect } from "vitest";
import {
  CATEGORY_LABELS,
  MARKETS,
  OFFERED_MARKETS,
  categoryOf,
  isValidSelection,
  priceFromOutcomes,
  marketById,
  priceMarket,
  settlePick,
  sumGrid,
  type SettlementFixture,
} from "@/lib/markets";
import { predictFixture, predictGrid, scoreGrid, type TeamRecord } from "@/lib/model";
import { normaliseToFairOdds } from "@/lib/odds";

/**
 * Pricing and settling the goal-derived markets.
 *
 * Settlement is the half that has to be right. A mispriced market shows a
 * number that is a bit off; a missettled one tells somebody their prediction
 * was wrong when it was not, permanently, in a record they cannot correct. So
 * every market gets a truth table rather than a sample.
 */

const rawGrid = scoreGrid(1.6, 1.2);
/**
 * The same grid, normalised to exactly one.
 *
 * The coverage check below compares against a round number, and an unnormalised
 * grid makes that number depend on how much mass fell off the top — differently
 * for a market that reads one period and one that ranges over both, where the
 * shortfall is squared. Normalising first removes that from the question so the
 * test is about whether a market's choices partition the outcome space, which is
 * the thing worth asserting.
 */
const gridMass = rawGrid.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
const grid = rawGrid.map((row) => row.map((p) => p / gridMass));

const finished = (home: number, away: number): SettlementFixture => ({
  finished: true,
  outcome: home > away ? "home" : home < away ? "away" : "draw",
  goals90: { home, away },
});

describe("every market adds up the way its shape implies", () => {
  /**
   * Nearly every market partitions the outcome space, so its choices sum to
   * one. Draw No Bet and the Asian handicaps drop what voids and renormalise
   * onto the rest, which also sums to one. Two shapes do not, and they are the
   * exceptions worth naming.
   */
  // Double chance covers two of three results per choice, so its choices cover
  // the space twice; anything built on top of it inherits that.
  const doubleCovering = (id: string) => id === "double_chance" || id.startsWith("dc_");
  // Multi Goals overlaps itself deliberately — 1-2 and 1-3 are both offered — so
  // there is no round number for it to add up to.
  const overlapping = (id: string) => id.startsWith("multi_goals");

  it.each(MARKETS.map((m) => [m.id, m] as const))("%s covers the grid as expected", (id, m) => {
    if (overlapping(id)) return;
    const total = Object.values(priceMarket(m, grid)).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(doubleCovering(id) ? 2 : 1, 9);
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

describe("scorelines and totals", () => {
  it("settles an exact total, with a bucket above five", () => {
    expect(settlePick("exact_goals", "2", finished(1, 1))).toBe("correct");
    expect(settlePick("exact_goals", "2", finished(2, 0))).toBe("correct");
    expect(settlePick("exact_goals", "3", finished(1, 1))).toBe("wrong");
    expect(settlePick("exact_goals", "6plus", finished(4, 2))).toBe("correct");
    expect(settlePick("exact_goals", "6plus", finished(5, 4))).toBe("correct");
    expect(settlePick("exact_goals", "6plus", finished(3, 2))).toBe("wrong");
  });

  it("settles bands inclusively at both ends", () => {
    expect(settlePick("goal_bands", "2_3", finished(2, 0))).toBe("correct");
    expect(settlePick("goal_bands", "2_3", finished(2, 1))).toBe("correct");
    expect(settlePick("goal_bands", "2_3", finished(2, 2))).toBe("wrong");
    expect(settlePick("goal_bands", "0_1", finished(0, 0))).toBe("correct");
  });

  it("settles a correct score, and buckets anything past 3–3", () => {
    expect(settlePick("correct_score", "2_1", finished(2, 1))).toBe("correct");
    expect(settlePick("correct_score", "2_1", finished(1, 2))).toBe("wrong");
    expect(settlePick("correct_score", "other", finished(4, 2))).toBe("correct");
    expect(settlePick("correct_score", "other", finished(2, 4))).toBe("correct");
    // A 4-2 must not settle every listed scoreline as wrong with nothing right.
    expect(settlePick("correct_score", "other", finished(3, 3))).toBe("wrong");
  });

  it("isolates one side for a team total", () => {
    expect(settlePick("team_total_home_1_5", "over", finished(2, 0))).toBe("correct");
    expect(settlePick("team_total_home_1_5", "over", finished(1, 5))).toBe("wrong");
    expect(settlePick("team_total_away_0_5", "over", finished(0, 1))).toBe("correct");
    expect(settlePick("team_total_away_0_5", "under", finished(3, 0))).toBe("correct");
  });

  it("reads a clean sheet from what the other side scored", () => {
    expect(settlePick("clean_sheet_home", "yes", finished(0, 0))).toBe("correct");
    expect(settlePick("clean_sheet_home", "yes", finished(3, 1))).toBe("wrong");
    expect(settlePick("clean_sheet_away", "yes", finished(0, 2))).toBe("correct");
  });

  it("needs both halves of win to nil", () => {
    expect(settlePick("win_to_nil_home", "yes", finished(1, 0))).toBe("correct");
    // Won, but conceded.
    expect(settlePick("win_to_nil_home", "yes", finished(3, 1))).toBe("wrong");
    // Clean sheet, but did not win.
    expect(settlePick("win_to_nil_home", "yes", finished(0, 0))).toBe("wrong");
  });
});

describe("handicaps", () => {
  it("keeps the draw playable on a European line", () => {
    // Home -1: a 2-1 becomes 1-1, which is the draw rather than a home win.
    expect(settlePick("eh_m1", "draw", finished(2, 1))).toBe("correct");
    expect(settlePick("eh_m1", "home", finished(2, 1))).toBe("wrong");
    expect(settlePick("eh_m1", "home", finished(3, 1))).toBe("correct");
    expect(settlePick("eh_m1", "away", finished(1, 1))).toBe("correct");
  });

  it("never pushes on a half line", () => {
    for (const id of ["ah_m0_5", "ah_m1_5", "ah_p0_5", "ah_p1_5"]) {
      for (let h = 0; h <= 4; h++) {
        for (let a = 0; a <= 4; a++) {
          expect(settlePick(id, "home", finished(h, a))).not.toBe("push");
        }
      }
    }
  });

  it("pushes on a whole line that lands level", () => {
    // Home -1 with a 2-1: the margin is exactly the handicap, so the stake
    // comes back rather than the pick being scored either way.
    expect(settlePick("ah_m1", "home", finished(2, 1))).toBe("push");
    expect(settlePick("ah_m1", "away", finished(2, 1))).toBe("push");
    expect(settlePick("ah_m1", "home", finished(3, 1))).toBe("correct");
    expect(settlePick("ah_m1", "away", finished(3, 1))).toBe("wrong");
  });

  it("offers no quarter lines, which it could not settle honestly", () => {
    // A quarter line settles half win, half stake back. A pick records one of
    // correct, wrong or push and cannot express half of anything, so these are
    // absent rather than settled wrongly.
    expect(MARKETS.filter((m) => m.id.startsWith("ah_")).map((m) => m.id)).not.toContain("ah_m0_25");
    expect(MARKETS.every((m) => !m.id.includes("_25"))).toBe(true);
  });
});

describe("combinations", () => {
  it("needs both halves of a result-and-goals combo", () => {
    expect(settlePick("result_btts", "home_yes", finished(2, 1))).toBe("correct");
    // Home won, but the away side did not score.
    expect(settlePick("result_btts", "home_yes", finished(2, 0))).toBe("wrong");
    expect(settlePick("result_btts", "home_no", finished(2, 0))).toBe("correct");
    expect(settlePick("result_ou_2_5", "away_over", finished(1, 3))).toBe("correct");
    expect(settlePick("result_ou_2_5", "away_over", finished(0, 1))).toBe("wrong");
  });

  it("prices a combo as the joint, not the product", () => {
    // The reason these are markets rather than two slip selections: the two
    // conditions are correlated, and multiplying them would be wrong. Home win
    // and over 2.5 is not P(home) x P(over).
    const priced = priceMarket(marketById("result_ou_2_5")!, grid);
    const joint = priced.home_over;
    const home = priceMarket(marketById("1x2")!, grid).home;
    const over = priceMarket(marketById("ou_2_5")!, grid).over;
    expect(joint).not.toBeCloseTo(home * over, 3);
  });

  it("partitions the outcome space across its choices", () => {
    for (const id of ["result_btts", "result_ou_2_5", "btts_ou_2_5"]) {
      const total = Object.values(priceMarket(marketById(id)!, grid)).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(sumGrid(grid, () => true), 9);
    }
  });
});

describe("halves", () => {
  /** A finished match with both a half-time and a full-time score. */
  const withHalves = (h1: number, a1: number, h: number, a: number): SettlementFixture => ({
    finished: true,
    outcome: h > a ? "home" : h < a ? "away" : "draw",
    goals90: { home: h, away: a },
    goalsHt: { home: h1, away: a1 },
  });

  it("reads the first half straight off the half-time score", () => {
    expect(settlePick("first_half_result", "home", withHalves(1, 0, 1, 1))).toBe("correct");
    expect(settlePick("first_half_result", "draw", withHalves(0, 0, 3, 0))).toBe("correct");
    expect(settlePick("first_half_result", "away", withHalves(0, 2, 2, 2))).toBe("correct");
  });

  it("derives the second half by subtraction, not by the final score", () => {
    // 1-0 at the break, 1-3 at the end: the second half was 0-3 to the away
    // side, even though the away side did not win the match outright at 1-3.
    expect(settlePick("second_half_result", "away", withHalves(1, 0, 1, 3))).toBe("correct");
    // 2-0 at the break, 2-2 at the end: second half 0-2, away.
    expect(settlePick("second_half_result", "away", withHalves(2, 0, 2, 2))).toBe("correct");
    expect(settlePick("second_half_result", "draw", withHalves(2, 0, 3, 1))).toBe("correct");
  });

  it("needs both ends of a half-time/full-time pick", () => {
    // Behind at the break, winning at the end — the combination the market
    // exists for.
    expect(settlePick("ht_ft", "away_home", withHalves(0, 1, 2, 1))).toBe("correct");
    expect(settlePick("ht_ft", "home_home", withHalves(0, 1, 2, 1))).toBe("wrong");
    expect(settlePick("ht_ft", "away_away", withHalves(0, 1, 0, 1))).toBe("correct");
    expect(settlePick("ht_ft", "draw_draw", withHalves(0, 0, 1, 1))).toBe("correct");
  });

  it("scopes both-teams-to-score to the half it names", () => {
    // 1-1 at the break: yes in the first half. Nothing after: no in the second.
    expect(settlePick("btts_1h", "yes", withHalves(1, 1, 1, 1))).toBe("correct");
    expect(settlePick("btts_2h", "yes", withHalves(1, 1, 1, 1))).toBe("wrong");
    expect(settlePick("btts_2h", "no", withHalves(1, 1, 1, 1))).toBe("correct");
    // 0-0 at the break, 1-1 at the end: the reverse.
    expect(settlePick("btts_1h", "yes", withHalves(0, 0, 1, 1))).toBe("wrong");
    expect(settlePick("btts_2h", "yes", withHalves(0, 0, 1, 1))).toBe("correct");
  });

  it("counts goals per half for the highest scoring half", () => {
    expect(settlePick("highest_scoring_half", "first", withHalves(2, 0, 2, 1))).toBe("correct");
    expect(settlePick("highest_scoring_half", "second", withHalves(0, 0, 1, 1))).toBe("correct");
    // 1-0 at the break is one goal; 2-0 at the end makes the second half one
    // goal too.
    expect(settlePick("highest_scoring_half", "equal", withHalves(1, 0, 2, 0))).toBe("correct");
    expect(settlePick("highest_scoring_half", "equal", withHalves(0, 0, 0, 0))).toBe("correct");
  });

  it("stays pending when there is no half-time score", () => {
    // Every fixture stored before 20 August 2026. Settling these off the final
    // score would be inventing the one number the market is about.
    const noHalf: SettlementFixture = {
      finished: true,
      outcome: "home",
      goals90: { home: 2, away: 1 },
    };
    expect(settlePick("first_half_result", "home", noHalf)).toBeNull();
    expect(settlePick("ht_ft", "home_home", noHalf)).toBeNull();
    // The full-match markets are unaffected and settle as they always did.
    expect(settlePick("btts", "yes", noHalf)).toBe("correct");
  });

  it("refuses a half-time score larger than the full-time one", () => {
    // The provider contradicting itself. A negative second half would settle
    // confidently and wrongly.
    expect(settlePick("second_half_result", "home", withHalves(3, 0, 1, 0))).toBeNull();
  });

  it("carries the backtest result now that it has one", () => {
    // These were shipped as "unmeasured" and then measured. Every one lost to
    // its own base rate, so the label is the same as the goal markets get —
    // the section they render in still says more, because the independence
    // assumption is a caveat measurement does not capture.
    for (const m of MARKETS.filter((m) => m.settlesOn === "halves")) {
      expect(m.evidence).toBe("no-better-than-base-rate");
    }
  });
});

describe("the shapes applied to a half", () => {
  const withHalves = (h1: number, a1: number, h: number, a: number): SettlementFixture => ({
    finished: true,
    outcome: h > a ? "home" : h < a ? "away" : "draw",
    goals90: { home: h, away: a },
    goalsHt: { home: h1, away: a1 },
  });

  it("reads a half total off that half alone", () => {
    // 1-0 at the break, 1-3 at the end. First half one goal, second half three.
    expect(settlePick("ou_1h_0_5", "over", withHalves(1, 0, 1, 3))).toBe("correct");
    expect(settlePick("ou_1h_1_5", "over", withHalves(1, 0, 1, 3))).toBe("wrong");
    expect(settlePick("ou_2h_1_5", "over", withHalves(1, 0, 1, 3))).toBe("correct");
  });

  it("counts odd and even within the half", () => {
    // Second half is 0-3: odd, even though the match total of four is even.
    expect(settlePick("odd_even_2h", "odd", withHalves(1, 0, 1, 3))).toBe("correct");
    expect(settlePick("odd_even", "even", withHalves(1, 0, 1, 3))).toBe("correct");
  });

  it("voids a half draw no bet on a level half", () => {
    // 1-1 first half: level, so the stake comes back regardless of the result.
    expect(settlePick("dnb_1h", "home", withHalves(1, 1, 2, 1))).toBe("push");
    expect(settlePick("dnb_1h", "home", withHalves(1, 0, 2, 1))).toBe("correct");
  });

  it("covers two results with a half double chance", () => {
    expect(settlePick("dc_1h", "1x", withHalves(0, 0, 1, 0))).toBe("correct");
    expect(settlePick("dc_1h", "x2", withHalves(1, 0, 1, 0))).toBe("wrong");
  });

  it("settles a half-time correct score", () => {
    expect(settlePick("correct_score_1h", "1_0", withHalves(1, 0, 3, 2))).toBe("correct");
    expect(settlePick("correct_score_1h", "other", withHalves(3, 0, 4, 0))).toBe("correct");
  });

  it("needs both halves for the both-halves markets", () => {
    // 1-1 and 1-1: both sides scored in each half.
    expect(settlePick("btts_both_halves", "yes", withHalves(1, 1, 2, 2))).toBe("correct");
    // 1-1 then 1-0 to the home side: the away side did not score after the break.
    expect(settlePick("btts_both_halves", "yes", withHalves(1, 1, 2, 1))).toBe("wrong");
    expect(settlePick("score_both_halves_home", "yes", withHalves(1, 1, 2, 1))).toBe("correct");
    expect(settlePick("score_both_halves_away", "yes", withHalves(1, 1, 2, 1))).toBe("wrong");
  });

  it("separates winning either half from winning both", () => {
    // Home wins the first 1-0, second half 0-0: either yes, both no.
    expect(settlePick("win_either_half_home", "yes", withHalves(1, 0, 1, 0))).toBe("correct");
    expect(settlePick("win_both_halves_home", "yes", withHalves(1, 0, 1, 0))).toBe("wrong");
    // 1-0 then 1-0 again: both.
    expect(settlePick("win_both_halves_home", "yes", withHalves(1, 0, 2, 0))).toBe("correct");
  });

  it("stays pending without a half-time score", () => {
    const noHalf: SettlementFixture = {
      finished: true,
      outcome: "home",
      goals90: { home: 2, away: 1 },
    };
    for (const id of ["ou_1h_0_5", "dnb_1h", "btts_both_halves", "win_both_halves_home"]) {
      expect(settlePick(id, marketById(id)!.choices[0].id, noHalf), id).toBeNull();
    }
  });
});

describe("the new full-match shapes", () => {
  it("counts one side's goals for team exact goals", () => {
    expect(settlePick("team_exact_goals_home", "2", finished(2, 3))).toBe("correct");
    expect(settlePick("team_exact_goals_away", "3plus", finished(2, 3))).toBe("correct");
    expect(settlePick("team_exact_goals_away", "3plus", finished(2, 5))).toBe("correct");
  });

  it("reads the winning margin", () => {
    expect(settlePick("winning_margin", "home_1", finished(2, 1))).toBe("correct");
    expect(settlePick("winning_margin", "home_3plus", finished(4, 0))).toBe("correct");
    expect(settlePick("winning_margin", "draw", finished(2, 2))).toBe("correct");
    expect(settlePick("winning_margin", "away_2", finished(0, 2))).toBe("correct");
  });

  it("takes either half of a draw-or market", () => {
    // A draw satisfies it whatever the goals did.
    expect(settlePick("draw_or_over_2_5", "yes", finished(0, 0))).toBe("correct");
    // Not a draw, but past the line.
    expect(settlePick("draw_or_over_2_5", "yes", finished(3, 0))).toBe("correct");
    // Neither.
    expect(settlePick("draw_or_over_2_5", "yes", finished(2, 0))).toBe("wrong");
    expect(settlePick("draw_or_btts", "yes", finished(2, 1))).toBe("correct");
    expect(settlePick("draw_or_btts", "yes", finished(2, 0))).toBe("wrong");
  });

  it("needs all three parts of the triple combo", () => {
    // Home win, both scored, over 2.5.
    expect(settlePick("result_btts_ou_2_5", "home_yes_over", finished(2, 1))).toBe("correct");
    // Home win and over 2.5, but the away side did not score.
    expect(settlePick("result_btts_ou_2_5", "home_yes_over", finished(3, 0))).toBe("wrong");
    expect(settlePick("result_btts_ou_2_5", "home_no_over", finished(3, 0))).toBe("correct");
  });

  it("needs both parts of double chance and both teams to score", () => {
    expect(settlePick("dc_btts", "1x_yes", finished(2, 1))).toBe("correct");
    expect(settlePick("dc_btts", "1x_yes", finished(2, 0))).toBe("wrong");
    expect(settlePick("dc_btts", "x2_yes", finished(1, 1))).toBe("correct");
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

  it("keeps the measurement attached to every market it offers", () => {
    // The markets that measured badly are shown rather than hidden, which is
    // only defensible while the finding travels with them. A market that lost
    // its evidence would be indistinguishable on screen from one that earned
    // its number.
    for (const m of OFFERED_MARKETS) {
      expect(["beats-base-rate", "no-better-than-base-rate", "unmeasured"]).toContain(m.evidence);
    }
  });

  it("does not quietly promote a market that measured badly", () => {
    // These three were measured across three seasons and lost to their own base
    // rate every time. They may be offered; they may not claim to be good.
    for (const id of ["btts", "ou_2_5", "odd_even"]) {
      expect(marketById(id)!.evidence).toBe("no-better-than-base-rate");
    }
  });

  it("credits only the markets the backtest actually cleared", () => {
    // Pinned as a list because the badge is a claim about measurement, and a
    // market drifting into it without being re-measured would make the badge
    // worthless. Update this when scripts/backtest.ts --markets is re-run.
    expect(
      MARKETS.filter((m) => m.evidence === "beats-base-rate")
        .map((m) => m.id)
        .sort()
    ).toEqual([
      "1x2",
      "ah_m0_5",
      "ah_m1",
      "ah_m1_5",
      "ah_m2",
      "ah_p0_5",
      "dnb",
      "double_chance",
      "eh_m1",
      "eh_m2",
      "eh_p1",
      "team_total_home_2_5",
      "win_to_nil_home",
    ]);
  });

  it("credits margin-shaped markets and not total-shaped ones", () => {
    // The finding, stated as a property rather than a list: what the model
    // knows is the gap between the two sides, not how many they combine for.
    // Every over/under line asks about the total, and none of them qualify.
    for (const m of MARKETS.filter((m) => m.id.startsWith("ou_"))) {
      expect(m.evidence).toBe("no-better-than-base-rate");
    }
    // Handicaps ask about the margin, and the negative lines all qualify.
    for (const id of ["ah_m0_5", "ah_m1", "ah_m1_5", "ah_m2"]) {
      expect(marketById(id)!.evidence).toBe("beats-base-rate");
    }
  });

  it("settles a market regardless of what its evidence says", () => {
    // Settlement is about what happened, not about whether the price was good.
    expect(settlePick("btts", "yes", finished(1, 1))).toBe("correct");
    expect(settlePick("correct_score", "2_1", finished(2, 1))).toBe("correct");
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

describe("categories decide what a filter shows", () => {
  it("puts every market in exactly one category", () => {
    // A market that lands in the wrong bucket is not merely mislabelled — it
    // disappears from the filter someone would look under for it.
    for (const m of MARKETS) {
      expect(Object.keys(CATEGORY_LABELS)).toContain(categoryOf(m));
    }
  });

  it("groups by what the market asks about, not by its name", () => {
    expect(categoryOf(marketById("dnb")!)).toBe("result");
    expect(categoryOf(marketById("ou_2_5")!)).toBe("totals");
    expect(categoryOf(marketById("team_total_home_1_5")!)).toBe("totals");
    expect(categoryOf(marketById("ah_m1")!)).toBe("handicap");
    expect(categoryOf(marketById("eh_p1")!)).toBe("handicap");
    expect(categoryOf(marketById("result_btts")!)).toBe("combo");
    expect(categoryOf(marketById("btts")!)).toBe("goals");
  });

  it("sends a half market to halves even when its name says otherwise", () => {
    // btts_1h starts with "btts" and would match the goals rule; it is about a
    // half, and the half check runs first for exactly that reason.
    expect(categoryOf(marketById("btts_1h")!)).toBe("halves");
    expect(categoryOf(marketById("btts_2h")!)).toBe("halves");
    expect(categoryOf(marketById("ht_ft")!)).toBe("halves");
  });

  it("leaves no category empty of markets", () => {
    // An empty filter tab is a dead control.
    for (const category of Object.keys(CATEGORY_LABELS)) {
      expect(MARKETS.some((m) => categoryOf(m) === category), category).toBe(true);
    }
  });
});

describe("odds are not probabilities", () => {
  it("inverts the ordering if the two are confused", () => {
    /*
     * The shape of a bug that shipped. normaliseToFairOdds returns decimal
     * ODDS — total/percent — and those were handed to the grid fit as though
     * they were probabilities. Odds run the other way: the likeliest outcome
     * carries the SMALLEST number. So the favourite was priced as the least
     * likely, every one of the forty markets inherited it, and every figure
     * still looked like a plausible percentage.
     *
     * Asserted as a property rather than a fixed number: whatever else changes,
     * the shortest price must stay the likeliest outcome.
     */
    const p = { home: 0.5, draw: 0.3, away: 0.2 };
    const odds = normaliseToFairOdds({ home: p.home * 100, draw: p.draw * 100, away: p.away * 100 })!;

    expect(odds.home).toBeLessThan(odds.draw);
    expect(odds.draw).toBeLessThan(odds.away);
    // And the way back is reciprocal, not division by a hundred.
    expect(1 / odds.home).toBeCloseTo(p.home, 10);
    expect(1 / odds.draw).toBeCloseTo(p.draw, 10);
    expect(1 / odds.away).toBeCloseTo(p.away, 10);
  });

  it("keeps the favourite the favourite once markets are priced", () => {
    const team = (gf: number, ga: number): TeamRecord => ({
      teamId: Math.round(gf * 100 + ga),
      home: { played: 10, goalsFor: gf * 10, goalsAgainst: ga * 10 },
      away: { played: 10, goalsFor: gf * 8, goalsAgainst: ga * 12 },
      form: null,
    });
    const table = [team(1.8, 0.9), team(1.5, 1.1), team(1.2, 1.4), team(0.9, 1.8)];
    // A strong home side against a weak away one: home must come out likeliest
    // in the priced market, not merely in the raw model output.
    const input = { home: team(2.1, 0.6), away: team(0.8, 1.9), table };
    const published = predictFixture(input)!;
    const priced = priceMarket(marketById("1x2")!, predictGrid(input)!);

    expect(published.home).toBeGreaterThan(published.away);
    expect(priced.home).toBeGreaterThan(priced.away);
    expect(priced.home).toBeCloseTo(published.home, 10);
  });
});

describe("every offered market can actually be priced", () => {
  const team = (gf: number, ga: number): TeamRecord => ({
    teamId: Math.round(gf * 100 + ga),
    home: { played: 10, goalsFor: gf * 10, goalsAgainst: ga * 10 },
    away: { played: 10, goalsFor: gf * 8, goalsAgainst: ga * 12 },
    form: null,
  });
  const table = [team(1.8, 0.9), team(1.5, 1.1), team(1.2, 1.4), team(0.9, 1.8)];
  const fixtureGrid = predictGrid({ home: team(1.9, 0.8), away: team(1.0, 1.5), table })!;

  it("returns a number for every choice of every offered market", () => {
    // The gap this closes: markets were offered, tested and correct, and still
    // rendered nothing, because the panel priced them through a path that only
    // handles result-shaped markets and returned null for the other 37. Every
    // unit test passed throughout. Offering a market and being able to price it
    // are separate facts and both need asserting.
    for (const market of OFFERED_MARKETS) {
      const priced = priceMarket(market, fixtureGrid);
      for (const choice of market.choices) {
        const p = priced[choice.id];
        expect(typeof p, `${market.id}:${choice.id}`).toBe("number");
        expect(Number.isFinite(p), `${market.id}:${choice.id}`).toBe(true);
        expect(p, `${market.id}:${choice.id}`).toBeGreaterThanOrEqual(0);
        expect(p, `${market.id}:${choice.id}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("prices something other than zero for every market", () => {
    // A market whose every choice prices at zero renders as a row of 0% tiles,
    // which looks like a rendering fault rather than a prediction.
    for (const market of OFFERED_MARKETS) {
      const total = Object.values(priceMarket(market, fixtureGrid)).reduce((a, b) => a + b, 0);
      expect(total, market.id).toBeGreaterThan(0);
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
