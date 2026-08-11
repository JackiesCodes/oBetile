import { describe, it, expect } from "vitest";
import { outcomeOf, FINISHED_STATUSES, LIVE_STATUSES } from "@/lib/fixture-outcome";
import type { APIFixture } from "@/types";

/**
 * This decides whether a saved pick is filed as still-to-play or settled, and
 * whether it counts as correct. Getting it wrong shows a user the wrong verdict
 * on their own record.
 */
function fixture(opts: {
  status: string;
  home?: number | null;
  away?: number | null;
  homeWinner?: boolean | null;
  awayWinner?: boolean | null;
}): APIFixture {
  return {
    fixture: {
      id: 1,
      date: "2026-08-06T12:00:00+00:00",
      referee: null,
      status: { short: opts.status, elapsed: null },
      venue: { name: null, city: null },
    },
    league: { id: 1, name: "L", logo: "", country: "C", round: "R", season: 2026 },
    teams: {
      home: { id: 1, name: "Home", logo: "", winner: opts.homeWinner ?? null },
      away: { id: 2, name: "Away", logo: "", winner: opts.awayWinner ?? null },
    },
    goals: { home: opts.home ?? null, away: opts.away ?? null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: opts.home ?? null, away: opts.away ?? null },
    },
  } as APIFixture;
}

describe("outcomeOf", () => {
  it("reads a decisive full-time score", () => {
    expect(outcomeOf(fixture({ status: "FT", home: 2, away: 1 }))).toBe("home");
    expect(outcomeOf(fixture({ status: "FT", home: 0, away: 3 }))).toBe("away");
  });

  it("calls a level full-time score a draw", () => {
    // Verified against a real 0-0 in production; this used to be the case most
    // likely to fall through to "home".
    expect(outcomeOf(fixture({ status: "FT", home: 0, away: 0 }))).toBe("draw");
    expect(outcomeOf(fixture({ status: "FT", home: 2, away: 2 }))).toBe("draw");
  });

  it("uses the winner flag for a penalty shoot-out", () => {
    // Level on goals but a real winner — comparing the score alone would call
    // this a draw and mark a correct pick wrong.
    const pens = fixture({ status: "PEN", home: 1, away: 1, homeWinner: false, awayWinner: true });
    expect(outcomeOf(pens)).toBe("away");
  });

  it("resolves from a single loser flag", () => {
    expect(outcomeOf(fixture({ status: "AET", home: 1, away: 1, homeWinner: false }))).toBe("away");
  });

  it("returns nothing while a match is unplayed or in progress", () => {
    for (const status of ["NS", "TBD", "1H", "HT", "2H", "PST"]) {
      expect(outcomeOf(fixture({ status, home: 1, away: 0 }))).toBeNull();
    }
  });

  it("returns nothing when a finished fixture has no score", () => {
    // Better to leave a pick pending than to guess a verdict.
    expect(outcomeOf(fixture({ status: "FT", home: null, away: null }))).toBeNull();
  });
});

describe("status sets", () => {
  it("treats abandoned and walkover results as finished", () => {
    for (const s of ["FT", "AET", "PEN", "AWD", "WO"]) expect(FINISHED_STATUSES.has(s)).toBe(true);
  });

  it("keeps in-progress statuses out of the finished set", () => {
    for (const s of ["1H", "HT", "2H", "ET", "P"]) {
      expect(LIVE_STATUSES.has(s)).toBe(true);
      expect(FINISHED_STATUSES.has(s)).toBe(false);
    }
  });

  it("treats a not-started fixture as neither", () => {
    expect(FINISHED_STATUSES.has("NS")).toBe(false);
    expect(LIVE_STATUSES.has("NS")).toBe(false);
  });
});
