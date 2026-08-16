import { describe, it, expect } from "vitest";
import {
  awayPerformance,
  cleanSheetPercentage,
  compareForm,
  currentStreak,
  drawRate,
  formIndex,
  goalsConcededPerMatch,
  goalsPerMatch,
  homePerformance,
  lossRate,
  playerMetrics,
  pointsPerMatch,
  round,
  summariseH2H,
  teamMetrics,
  unbeatenRun,
  winRate,
  type TeamRecord,
} from "@/lib/statistics";

/**
 * A worked example: 20 played, 12 W / 5 D / 3 L, 38 scored, 20 conceded,
 * 8 clean sheets, split 12 home / 8 away.
 */
const record: TeamRecord = {
  played: { home: 12, away: 8, total: 20 },
  wins: { home: 9, away: 3, total: 12 },
  draws: { home: 2, away: 3, total: 5 },
  losses: { home: 1, away: 2, total: 3 },
  goalsFor: { home: 26, away: 12, total: 38 },
  goalsAgainst: { home: 8, away: 12, total: 20 },
  cleanSheets: { home: 6, away: 2, total: 8 },
  failedToScore: { home: 1, away: 3, total: 4 },
  form: "WWDLWWWDWW",
};

const empty: TeamRecord = {
  played: { home: 0, away: 0, total: 0 },
  wins: { home: 0, away: 0, total: 0 },
  draws: { home: 0, away: 0, total: 0 },
  losses: { home: 0, away: 0, total: 0 },
  goalsFor: { home: 0, away: 0, total: 0 },
  goalsAgainst: { home: 0, away: 0, total: 0 },
  cleanSheets: { home: 0, away: 0, total: 0 },
  failedToScore: { home: 0, away: 0, total: 0 },
  form: null,
};

describe("team rates", () => {
  it("computes the three outcome rates against matches played", () => {
    expect(winRate(record)).toBe(60);
    expect(drawRate(record)).toBe(25);
    expect(lossRate(record)).toBe(15);
  });

  it("has the three rates total 100", () => {
    const total = winRate(record)! + drawRate(record)! + lossRate(record)!;
    expect(total).toBeCloseTo(100);
  });

  it("computes goals scored and conceded per match", () => {
    expect(goalsPerMatch(record)).toBe(1.9);
    expect(goalsConcededPerMatch(record)).toBe(1);
  });

  it("computes clean sheet share", () => {
    expect(cleanSheetPercentage(record)).toBe(40);
  });

  it("awards three for a win and one for a draw, like the table does", () => {
    // 12*3 + 5 = 41 points from 20 matches.
    expect(pointsPerMatch(record)).toBeCloseTo(2.05);
  });

  it("separates a strong home record from a weaker away one", () => {
    const home = homePerformance(record);
    const away = awayPerformance(record);
    expect(home.winRate).toBe(75);
    expect(away.winRate).toBeCloseTo(37.5);
    expect(home.winRate!).toBeGreaterThan(away.winRate!);
  });
});

/**
 * The distinction the whole module is built around: a team that has played
 * nothing has no rate, and reporting 0% would read as "never wins".
 */
describe("nothing played means no metric, not zero", () => {
  it("returns null rather than 0 for every rate", () => {
    expect(winRate(empty)).toBeNull();
    expect(drawRate(empty)).toBeNull();
    expect(lossRate(empty)).toBeNull();
    expect(goalsPerMatch(empty)).toBeNull();
    expect(goalsConcededPerMatch(empty)).toBeNull();
    expect(cleanSheetPercentage(empty)).toBeNull();
    expect(pointsPerMatch(empty)).toBeNull();
  });

  it("still reports the played count as a real zero", () => {
    // The count is a fact; the rates derived from it are not.
    expect(teamMetrics(empty).played).toBe(0);
    expect(teamMetrics(empty).winRate).toBeNull();
  });

  it("never yields NaN or Infinity anywhere in the bundle", () => {
    const m = teamMetrics(empty);
    for (const [key, value] of Object.entries(m)) {
      if (typeof value === "number") {
        expect(Number.isFinite(value), `${key} is not finite`).toBe(true);
      }
    }
  });
});

describe("formIndex", () => {
  it("gives a perfect run 100 and a losing run 0", () => {
    expect(formIndex("WWWWWW")).toBe(100);
    expect(formIndex("LLLLLL")).toBe(0);
  });

  it("puts an all-draw run at a third, matching one point of three", () => {
    expect(formIndex("DDDDDD")).toBeCloseTo(33.33, 1);
  });

  it("weights the most recent matches more heavily", () => {
    // API-Football writes the string oldest-first, so the last character is the
    // newest result. Improving form must therefore score above declining form
    // with the same tally — if this pair ever matched, the direction is wrong.
    const improving = formIndex("LLLWWW")!;
    const declining = formIndex("WWWLLL")!;
    expect(improving).toBeGreaterThan(declining);
  });

  it("only looks at the recent window, not the whole season", () => {
    // A long-ago run of losses must not drag down current form.
    expect(formIndex("LLLLLLLLLLWWWWWW", 6)).toBe(100);
  });

  it("ignores characters that are not results", () => {
    expect(formIndex("W-W-W")).toBe(100);
  });

  it("says nothing when there is no form string", () => {
    expect(formIndex(null)).toBeNull();
    expect(formIndex("")).toBeNull();
    expect(formIndex("?????")).toBeNull();
  });
});

describe("streaks", () => {
  it("measures the current run from the most recent end", () => {
    expect(currentStreak("LLWWW")).toEqual({ type: "W", length: 3 });
    expect(currentStreak("WWWLL")).toEqual({ type: "L", length: 2 });
  });

  it("counts draws as unbeaten but not as a winning run", () => {
    expect(currentStreak("WWDD")).toEqual({ type: "D", length: 2 });
    expect(unbeatenRun("LWWDD")).toBe(4);
  });

  it("reports a zero streak rather than guessing when there is no form", () => {
    expect(currentStreak(null)).toEqual({ type: null, length: 0 });
    expect(unbeatenRun(null)).toBe(0);
  });

  it("handles a whole string of one result", () => {
    expect(currentStreak("WWWW")).toEqual({ type: "W", length: 4 });
    expect(unbeatenRun("LLLL")).toBe(0);
  });
});

describe("player metrics", () => {
  const striker = { appearances: 20, minutes: 1710, goals: 18, assists: 6 };

  it("computes per-match and per-90 contribution", () => {
    const m = playerMetrics(striker);
    expect(m.goalsPerMatch).toBeCloseTo(0.9);
    expect(m.assistsPerMatch).toBeCloseTo(0.3);
    expect(m.contributionRate).toBeCloseTo(1.2);
    expect(m.contributionsPer90).toBeCloseTo(1.263, 2);
  });

  it("computes minutes per goal and per assist", () => {
    const m = playerMetrics(striker);
    expect(m.minutesPerGoal).toBeCloseTo(95);
    expect(m.minutesPerAssist).toBeCloseTo(285);
  });

  it("returns null rather than Infinity for a player who has not scored", () => {
    // Dividing minutes by zero goals is the obvious bug this guards.
    const defender = playerMetrics({ appearances: 20, minutes: 1800, goals: 0, assists: 0 });
    expect(defender.minutesPerGoal).toBeNull();
    expect(defender.minutesPerAssist).toBeNull();
    expect(defender.goalsPerMatch).toBe(0);
  });

  it("returns null for a player who has not appeared", () => {
    const unused = playerMetrics({ appearances: 0, minutes: 0, goals: 0, assists: 0 });
    expect(unused.goalsPerMatch).toBeNull();
    expect(unused.contributionsPer90).toBeNull();
  });
});

describe("head to head", () => {
  // Team 10 is at home in the upcoming fixture. Two of these meetings were
  // played at team 20's ground, so the sides must be re-oriented.
  const fixtures = [
    { homeTeamId: 10, awayTeamId: 20, homeGoals: 2, awayGoals: 1 },
    { homeTeamId: 20, awayTeamId: 10, homeGoals: 0, awayGoals: 3 },
    { homeTeamId: 10, awayTeamId: 20, homeGoals: 1, awayGoals: 1 },
    { homeTeamId: 20, awayTeamId: 10, homeGoals: 2, awayGoals: 0 },
  ];

  it("counts from the upcoming fixture's perspective, not each old venue", () => {
    const s = summariseH2H(fixtures, 10);
    expect(s).toMatchObject({ played: 4, homeWins: 2, draws: 1, awayWins: 1 });
    expect(s.homeGoals).toBe(6);
    expect(s.awayGoals).toBe(4);
  });

  it("flips entirely when asked from the other side", () => {
    const a = summariseH2H(fixtures, 10);
    const b = summariseH2H(fixtures, 20);
    expect(b.homeWins).toBe(a.awayWins);
    expect(b.awayWins).toBe(a.homeWins);
    expect(b.draws).toBe(a.draws);
  });

  it("skips meetings with no score rather than counting them as goalless", () => {
    const withUnplayed = [...fixtures, { homeTeamId: 10, awayTeamId: 20, homeGoals: null, awayGoals: null }];
    expect(summariseH2H(withUnplayed, 10).played).toBe(4);
  });

  it("says nothing for sides that have never met", () => {
    const s = summariseH2H([], 10);
    expect(s.played).toBe(0);
    expect(s.homeWinRate).toBeNull();
    expect(s.averageGoals).toBeNull();
  });
});

describe("form comparison", () => {
  it("signs the edge towards the home side", () => {
    const weaker: TeamRecord = { ...record, form: "LLLLLL", wins: { home: 1, away: 1, total: 2 } };
    const c = compareForm(record, weaker);
    expect(c.formEdge).toBeGreaterThan(0);
    expect(c.pointsEdge).toBeGreaterThan(0);
  });

  it("reverses when the away side is the stronger one", () => {
    const weaker: TeamRecord = { ...record, form: "LLLLLL" };
    expect(compareForm(weaker, record).formEdge).toBeLessThan(0);
  });

  it("declines to state an edge when either side has no form", () => {
    expect(compareForm(record, empty).formEdge).toBeNull();
  });
});

describe("round", () => {
  it("keeps null as null rather than turning it into zero", () => {
    expect(round(null)).toBeNull();
  });

  it("refuses to present a non-finite number", () => {
    expect(round(Infinity)).toBeNull();
    expect(round(NaN)).toBeNull();
  });

  it("rounds to the requested precision", () => {
    expect(round(66.666)).toBe(66.7);
    expect(round(66.666, 2)).toBe(66.67);
  });
});
