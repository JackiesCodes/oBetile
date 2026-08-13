import { describe, it, expect } from "vitest";
import { countUnavailable, availabilityFor, type APIInjuryRow } from "@/lib/availability";

const row = (fixture: number, team: number, player: number | null, name = "x"): APIInjuryRow => ({
  player: { id: player ?? undefined, name },
  team: { id: team },
  fixture: { id: fixture },
});

describe("countUnavailable", () => {
  it("counts players per fixture and team", () => {
    const out = countUnavailable([
      row(1, 10, 100),
      row(1, 10, 101),
      row(1, 20, 200),
      row(2, 10, 100),
    ]);
    expect(out["1"].teams["10"]).toBe(2);
    expect(out["1"].teams["20"]).toBe(1);
    expect(out["2"].teams["10"]).toBe(1);
  });

  it("counts a player once even when listed under two reasons", () => {
    const out = countUnavailable([row(1, 10, 100), row(1, 10, 100)]);
    expect(out["1"].teams["10"]).toBe(1);
  });

  it("drops rows with no fixture or no team rather than guessing", () => {
    const out = countUnavailable([
      { player: { id: 1 }, team: { id: 10 }, fixture: null },
      { player: { id: 2 }, fixture: { id: 5 } },
      row(7, 10, 100),
    ]);
    expect(out["5"]).toBeUndefined();
    expect(Object.keys(out)).toEqual(["7"]);
  });

  it("survives an empty or malformed payload", () => {
    expect(countUnavailable([])).toEqual({});
    expect(countUnavailable(undefined as unknown as APIInjuryRow[])).toEqual({});
    expect(countUnavailable([{} as APIInjuryRow])).toEqual({});
  });

  it("still counts a player the provider gave no id for", () => {
    const out = countUnavailable([row(1, 10, null, "Unnamed A"), row(1, 10, null, "Unnamed B")]);
    expect(out["1"].teams["10"]).toBe(2);
  });
});

describe("availabilityFor", () => {
  const data = countUnavailable([row(1, 10, 100), row(1, 10, 101), row(1, 20, 200)]);

  it("returns each side's count in the order the model wants", () => {
    const a = availabilityFor(data, 1, 10, 20)!;
    expect(a.home.out).toBe(2);
    expect(a.away.out).toBe(1);
  });

  it("reports zero for a side with nobody out, when the other side has someone", () => {
    const a = availabilityFor(countUnavailable([row(1, 10, 100)]), 1, 10, 20)!;
    expect(a.home.out).toBe(1);
    expect(a.away.out).toBe(0);
  });

  it("says nothing rather than zero when the fixture is absent", () => {
    // The model reads null as "not known" and predicts exactly as before.
    // Returning {out: 0} instead would claim a full-strength squad we never saw.
    expect(availabilityFor(data, 999, 10, 20)).toBeNull();
  });

  it("accepts the fixture id as a number or a string", () => {
    expect(availabilityFor(data, "1", 10, 20)).not.toBeNull();
  });
});
