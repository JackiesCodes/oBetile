import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  classifyStatus,
  isListable,
  unlistableReason,
  CANCELLED_STATUSES,
  FINISHED_STATUSES,
  LIVE_STATUSES,
  POSTPONED_STATUSES,
} from "@/lib/match-status";

const ROOT = path.resolve(__dirname, "..");

/**
 * Every status code API-Football publishes, and what it should become.
 *
 * The bug this replaces: the classifier was two sets and an else, so anything
 * not live and not finished became "upcoming". CANC, PST and ABD all landed
 * there, and a cancelled match therefore rendered as an ordinary upcoming
 * fixture with pickable percentages — one that could never settle, because it
 * is never going to be played.
 */
const EVERY_STATUS: [string, ReturnType<typeof classifyStatus>][] = [
  ["TBD", "upcoming"],
  ["NS", "upcoming"],
  ["1H", "live"],
  ["HT", "live"],
  ["2H", "live"],
  ["ET", "live"],
  ["BT", "live"],
  ["P", "live"],
  ["LIVE", "live"],
  ["SUSP", "postponed"],
  ["INT", "postponed"],
  ["FT", "finished"],
  ["AET", "finished"],
  ["PEN", "finished"],
  ["PST", "postponed"],
  ["CANC", "cancelled"],
  ["ABD", "cancelled"],
  ["AWD", "finished"],
  ["WO", "finished"],
];

describe("classifyStatus", () => {
  it.each(EVERY_STATUS)("maps %s to %s", (code, expected) => {
    expect(classifyStatus(code)).toBe(expected);
  });

  it("no longer calls a cancelled or postponed match upcoming", () => {
    // The exact defect. Each of these was pickable and unsettleable.
    for (const code of ["CANC", "ABD", "PST"]) {
      expect(classifyStatus(code), `${code} must not be upcoming`).not.toBe("upcoming");
    }
  });

  it("keeps TBD upcoming, since it is a real fixture without a confirmed time", () => {
    expect(classifyStatus("TBD")).toBe("upcoming");
    expect(isListable(classifyStatus("TBD"))).toBe(true);
  });

  it("treats an unknown or absent code as upcoming rather than dropping it", () => {
    // Erring towards showing a fixture is right: a code we do not recognise is
    // far more likely to be a new in-play state than a cancellation, and
    // silently hiding real matches is the worse failure.
    expect(classifyStatus("XYZ")).toBe("upcoming");
    expect(classifyStatus(null)).toBe("upcoming");
    expect(classifyStatus(undefined)).toBe("upcoming");
  });

  it("is case-insensitive", () => {
    expect(classifyStatus("canc")).toBe("cancelled");
    expect(classifyStatus("ft")).toBe("finished");
  });
});

describe("isListable", () => {
  it("lists only what can still be predicted", () => {
    expect(isListable("upcoming")).toBe(true);
    expect(isListable("live")).toBe(true);
  });

  it("excludes all three the feed must not load", () => {
    expect(isListable("finished")).toBe(false);
    expect(isListable("cancelled")).toBe(false);
    expect(isListable("postponed")).toBe(false);
  });

  it("excludes every status code in those three groups", () => {
    for (const code of [...FINISHED_STATUSES, ...CANCELLED_STATUSES, ...POSTPONED_STATUSES]) {
      expect(isListable(classifyStatus(code)), `${code} must not be listed`).toBe(false);
    }
  });

  it("includes every in-play code", () => {
    for (const code of LIVE_STATUSES) {
      expect(isListable(classifyStatus(code)), `${code} should be listed`).toBe(true);
    }
  });

  it("puts no status in more than one group", () => {
    const groups = [LIVE_STATUSES, FINISHED_STATUSES, POSTPONED_STATUSES, CANCELLED_STATUSES];
    const seen = new Set<string>();
    for (const g of groups) {
      for (const code of g) {
        expect(seen.has(code), `${code} appears in two groups`).toBe(false);
        seen.add(code);
      }
    }
  });
});

describe("unlistableReason", () => {
  it("names why a fixture is not shown", () => {
    expect(unlistableReason("finished")).toBe("Match finished");
    expect(unlistableReason("postponed")).toBe("Postponed");
    expect(unlistableReason("cancelled")).toBe("Cancelled");
  });

  it("says nothing for a fixture that is shown", () => {
    expect(unlistableReason("upcoming")).toBeNull();
    expect(unlistableReason("live")).toBeNull();
  });
});

/**
 * The filter has to be applied where the lists are built, not merely available.
 */
describe("the feeds apply the filter", () => {
  for (const file of ["app/page.tsx", "app/sport/soccer/page.tsx"]) {
    const src = readFileSync(path.join(ROOT, file), "utf8");

    it(`${file} filters the list`, () => {
      expect(src).toMatch(/isListable\(m\.status\)/);
    });

    it(`${file} offers no Finished chip that could never match`, () => {
      const map = src.match(/const STATUS_MAP[^}]+}/)?.[0] ?? "";
      expect(map).not.toMatch(/Finished/);
    });
  }

  it("the chip row drops Finished too", () => {
    const bar = readFileSync(path.join(ROOT, "components/SportsTabBar.tsx"), "utf8");
    expect(bar).toMatch(/const STATUSES = \["All", "Live", "Upcoming"\]/);
  });

  it("normalizeFixture uses the shared classifier rather than its own sets", () => {
    // Two copies of the rules is how the states diverged in the first place.
    const api = readFileSync(path.join(ROOT, "lib/api-football.ts"), "utf8");
    expect(api).toMatch(/classifyStatus\(short\)/);
    expect(api).not.toMatch(/const FINISHED_STATUSES = new Set/);
  });
});
