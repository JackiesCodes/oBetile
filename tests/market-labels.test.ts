import { describe, it, expect } from "vitest";
import { MARKETS, selectionLabel } from "@/lib/markets";
import { DEFAULT_MARKET } from "@/lib/slips";

/**
 * How a selection reads once it is on a slip.
 *
 * The fixture is already named on the line above, so the label carries the
 * prediction alone. That is easy to get wrong in the direction of ambiguity —
 * a slip row reading "Yes" is not something anyone can act on — and wrong in
 * the direction of regression, because a match result has always shown the
 * club's own name and a slip full of "Home" would be a step backwards.
 */

const HOME = "Arsenal";
const AWAY = "Chelsea";
const label = (market: string, selection: string) =>
  selectionLabel(market, selection, HOME, AWAY);

describe("match-result shaped markets name the club", () => {
  it("shows the team, not the side", () => {
    expect(label("1x2", "home")).toBe(HOME);
    expect(label("1x2", "away")).toBe(AWAY);
    expect(label("1x2", "draw")).toBe("Draw");
  });

  it("says which market when the side alone would be ambiguous", () => {
    // "Arsenal" under a fixture already means a home win; draw no bet is a
    // materially different prediction and has to say so.
    expect(label("dnb", "home")).toBe(`${HOME} (draw no bet)`);
    expect(label("dnb", "away")).toBe(`${AWAY} (draw no bet)`);
  });

  it("spells out both halves of a double chance", () => {
    expect(label("double_chance", "1x")).toBe(`${HOME} or Draw`);
    expect(label("double_chance", "12")).toBe(`${HOME} or ${AWAY}`);
    expect(label("double_chance", "x2")).toBe(`Draw or ${AWAY}`);
  });
});

describe("goal markets carry enough of the market to stand alone", () => {
  it("does not leave a bare yes or no", () => {
    expect(label("btts", "yes")).toBe("Both teams to score: Yes");
    expect(label("btts", "no")).toBe("Both teams to score: No");
  });

  it("leaves over and under alone, since the line is already in the label", () => {
    expect(label("ou_2_5", "over")).toBe("Over 2.5");
    expect(label("ou_0_5", "under")).toBe("Under 0.5");
  });

  it("says what is odd or even", () => {
    expect(label("odd_even", "odd")).toBe("Odd number of goals");
    expect(label("odd_even", "even")).toBe("Even number of goals");
  });
});

describe("nothing renders blank", () => {
  it("labels every choice of every market non-emptily", () => {
    for (const m of MARKETS) {
      for (const c of m.choices) {
        const text = label(m.id, c.id);
        expect(text.length).toBeGreaterThan(0);
        // A missing entry in a lookup table renders as nothing at all, which is
        // how this would fail in practice rather than by throwing.
        expect(text).not.toBe("undefined");
      }
    }
  });

  it("falls back to the raw selection for a market it does not know", () => {
    // A row written by a newer client, read by an older one. Showing the raw
    // value is ugly; showing an empty line is a bug.
    expect(label("corners_over_under", "over")).toBe("over");
    expect(label("btts", "maybe")).toBe("maybe");
  });

  it("labels the default market, which is what every old row carries", () => {
    expect(label(DEFAULT_MARKET, "home")).toBe(HOME);
  });
});
