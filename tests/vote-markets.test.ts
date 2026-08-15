import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  ALL_MARKETS,
  FREE_MARKETS,
  PREMIUM_MARKETS,
  MARKET_SELECTIONS,
  isValidVote,
} from "@/lib/vote-markets";
import { isVoteCounts, totalVotes, votePercent } from "@/lib/vote-counts";

const ROOT = path.resolve(__dirname, "..");

/**
 * The bug: the panel offered a market it called "over_under" while the route
 * would only accept "ou". Every Over/Under vote was rejected with a 400 the UI
 * never surfaced — the bar moved optimistically and nothing was stored. The
 * premium markets were absent from the allowlist entirely, so those failed too.
 */
describe("every offered market is an accepted market", () => {
  it("accepts every choice the UI can render", () => {
    for (const market of ALL_MARKETS) {
      for (const choice of market.choices) {
        expect(
          isValidVote(market.id, choice.id),
          `${market.id}/${choice.id} is offered but would be rejected`
        ).toBe(true);
      }
    }
  });

  it("covers the premium markets too, not just the free ones", () => {
    expect(PREMIUM_MARKETS.length).toBeGreaterThan(0);
    for (const m of PREMIUM_MARKETS) expect(MARKET_SELECTIONS[m.id]).toBeDefined();
  });

  it("still refuses anything not offered", () => {
    expect(isValidVote("1x2", "sideways")).toBe(false);
    expect(isValidVote("made_up_market", "home")).toBe(false);
    expect(isValidVote("", "")).toBe(false);
    // The old name must not quietly work again.
    expect(isValidVote("over_under", "over")).toBe(false);
  });

  it("gives every market a unique id", () => {
    const ids = ALL_MARKETS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every choice within a market a unique id", () => {
    for (const m of ALL_MARKETS) {
      const ids = m.choices.map((c) => c.id);
      expect(new Set(ids).size, `${m.id} has duplicate choices`).toBe(ids.length);
    }
  });
});

/**
 * Structural guard: the moment either side declares its own list again, they
 * can drift apart again.
 */
describe("client and server share one definition", () => {
  it("the route derives its allowlist rather than restating one", () => {
    const route = readFileSync(path.join(ROOT, "app/api/community/votes/route.ts"), "utf8");
    expect(route).toMatch(/isValidVote/);
    expect(route).not.toMatch(/new Set\(\["home", "draw", "away"\]\)/);
  });

  it("the panel imports the catalogue rather than declaring one", () => {
    const panel = readFileSync(
      path.join(ROOT, "components/match-detail/MatchVotePanel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(/from "@\/lib\/vote-markets"/);
    expect(panel).not.toMatch(/const FREE_MARKETS/);
    expect(panel).not.toMatch(/const PREMIUM_MARKETS/);
  });

  it("keeps 1X2 free, since it is the headline market", () => {
    expect(FREE_MARKETS.some((m) => m.id === "1x2")).toBe(true);
  });
});

/**
 * An error body is an object too. Stored as counts it made the total a string
 * — 0 + "…" is "0…", which is truthy — so the zero guard passed and the
 * division produced NaN, rendering percentages of nothing.
 */
describe("vote count validation", () => {
  it("accepts a real tally", () => {
    expect(isVoteCounts({ "1x2": { home: 3, draw: 1, away: 0 } })).toBe(true);
    expect(isVoteCounts({})).toBe(true);
  });

  it("rejects an error body", () => {
    expect(isVoteCounts({ error: "Community features are not configured." })).toBe(false);
    expect(isVoteCounts(null)).toBe(false);
    expect(isVoteCounts([])).toBe(false);
    expect(isVoteCounts("nope")).toBe(false);
  });

  it("rejects counts that are not finite numbers", () => {
    expect(isVoteCounts({ "1x2": { home: "3" } })).toBe(false);
    expect(isVoteCounts({ "1x2": { home: NaN } })).toBe(false);
  });

  it("never divides by zero or produces NaN", () => {
    expect(votePercent({}, "home")).toBe(0);
    expect(votePercent({ home: 0, away: 0 }, "home")).toBe(0);
    expect(Number.isNaN(votePercent({}, "home"))).toBe(false);
  });

  it("computes an ordinary share", () => {
    expect(votePercent({ home: 3, away: 1 }, "home")).toBe(75);
    expect(totalVotes({ home: 3, away: 1 })).toBe(4);
  });

  it("treats a selection nobody picked as zero rather than undefined", () => {
    expect(votePercent({ home: 4 }, "away")).toBe(0);
  });
});
