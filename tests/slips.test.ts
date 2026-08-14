import { describe, it, expect } from "vitest";
import {
  canAdd,
  cleanNote,
  cleanTitle,
  combinedConfidence,
  defaultTitle,
  formatConfidence,
  labelFor,
  outcomeFor,
  slipOutcome,
  tally,
  withSelection,
  withoutFixture,
  MAX_SELECTIONS,
  type SavedPick,
  type Selection,
} from "@/lib/slips";

const sel = (fixtureId: string, over: Partial<Selection> = {}): Selection => ({
  fixtureId,
  home: "Arsenal",
  away: "Chelsea",
  pick: "home",
  confidence: 50,
  ...over,
});

const saved = (result: SavedPick["result"], confidence = 50): SavedPick => ({
  ...sel("1"),
  confidence,
  result,
});

describe("outcomeFor / labelFor", () => {
  it("maps a team name to the side it plays", () => {
    expect(outcomeFor("Arsenal", "Arsenal", "Chelsea")).toBe("home");
    expect(outcomeFor("Chelsea", "Arsenal", "Chelsea")).toBe("away");
    expect(outcomeFor("Draw", "Arsenal", "Chelsea")).toBe("draw");
  });

  it("round-trips back to the same label", () => {
    for (const label of ["Arsenal", "Chelsea", "Draw"]) {
      const pick = outcomeFor(label, "Arsenal", "Chelsea");
      expect(labelFor(pick, "Arsenal", "Chelsea")).toBe(label);
    }
  });

  it("treats an unknown label as a draw rather than guessing a team", () => {
    expect(outcomeFor("???", "Arsenal", "Chelsea")).toBe("draw");
  });
});

describe("combinedConfidence", () => {
  it("multiplies, because every selection has to come in", () => {
    // 50% and 50% together is 25%, not 50%.
    expect(combinedConfidence([{ confidence: 50 }, { confidence: 50 }])).toBeCloseTo(25);
  });

  it("falls steeply as a slip grows", () => {
    const six = Array.from({ length: 6 }, () => ({ confidence: 60 }));
    const value = combinedConfidence(six)!;
    expect(value).toBeLessThan(5);
    // The honest counterweight to a long slip looking impressive.
    expect(value).toBeGreaterThan(4);
  });

  it("returns the single figure for one selection", () => {
    expect(combinedConfidence([{ confidence: 73 }])).toBeCloseTo(73);
  });

  it("says nothing for an empty slip or an impossible figure", () => {
    expect(combinedConfidence([])).toBeNull();
    expect(combinedConfidence([{ confidence: 0 }])).toBeNull();
  });
});

describe("formatConfidence", () => {
  it("keeps precision as the number shrinks", () => {
    expect(formatConfidence(42.4)).toBe("42%");
    expect(formatConfidence(4.7)).toBe("4.7%");
    expect(formatConfidence(0.38)).toBe("0.38%");
  });

  it("never renders a long slip as 0%", () => {
    // Rounding a genuinely small chance to zero would claim it is impossible.
    expect(formatConfidence(0.004)).not.toBe("0%");
  });

  it("shows a dash when there is nothing to say", () => {
    expect(formatConfidence(null)).toBe("—");
  });
});

describe("tally and slipOutcome", () => {
  it("counts each state separately", () => {
    const t = tally([saved("correct"), saved("wrong"), saved(null), saved("push")]);
    expect(t).toMatchObject({ correct: 1, wrong: 1, pending: 1, settled: 2, total: 4 });
  });

  it("is lost the moment one selection is wrong", () => {
    expect(slipOutcome([saved("correct"), saved("wrong"), saved(null)])).toBe("lost");
  });

  it("is pending while anything is unplayed", () => {
    expect(slipOutcome([saved("correct"), saved(null)])).toBe("pending");
  });

  it("is won only when every selection came in", () => {
    expect(slipOutcome([saved("correct"), saved("correct")])).toBe("won");
  });

  it("does not call an empty slip a win", () => {
    expect(slipOutcome([])).toBe("pending");
  });
});

describe("staging selections", () => {
  it("keeps one selection per fixture", () => {
    const staged = withSelection([sel("1")], sel("1", { pick: "away" }));
    expect(staged).toHaveLength(1);
    expect(staged[0].pick).toBe("away");
  });

  it("adds different fixtures alongside each other", () => {
    expect(withSelection([sel("1")], sel("2"))).toHaveLength(2);
  });

  it("refuses a new fixture once the slip is full", () => {
    const full = Array.from({ length: MAX_SELECTIONS }, (_, i) => sel(String(i)));
    expect(canAdd(full, "999")).toBe(false);
    expect(withSelection(full, sel("999"))).toHaveLength(MAX_SELECTIONS);
  });

  it("still allows changing a selection already in a full slip", () => {
    // Swapping an outcome is not a new selection, so the cap must not block it.
    const full = Array.from({ length: MAX_SELECTIONS }, (_, i) => sel(String(i)));
    const changed = withSelection(full, sel("0", { pick: "draw" }));
    expect(changed).toHaveLength(MAX_SELECTIONS);
    expect(changed.find((s) => s.fixtureId === "0")!.pick).toBe("draw");
  });

  it("reports a fixture already staged as not addable", () => {
    expect(canAdd([sel("7")], "7")).toBe(false);
    expect(canAdd([sel("7")], "8")).toBe(true);
  });

  it("removes by fixture", () => {
    expect(withoutFixture([sel("1"), sel("2")], "1")).toHaveLength(1);
  });
});

describe("titles and notes", () => {
  it("names a slip by count and date when nothing is typed", () => {
    const title = defaultTitle(3, new Date("2026-08-13T10:00:00Z"));
    expect(title).toContain("3 predictions");
    expect(title).toContain("Aug");
  });

  it("gets the singular right", () => {
    expect(defaultTitle(1, new Date("2026-08-13T10:00:00Z"))).toContain("1 prediction ");
  });

  it("falls back rather than saving an empty title", () => {
    expect(cleanTitle("   ", 2)).toContain("2 predictions");
  });

  it("bounds what a person typed", () => {
    expect(cleanTitle("x".repeat(200), 1)).toHaveLength(80);
    expect(cleanNote("y".repeat(500))).toHaveLength(280);
  });

  it("treats a blank note as no note", () => {
    expect(cleanNote("  ")).toBeNull();
  });
});
