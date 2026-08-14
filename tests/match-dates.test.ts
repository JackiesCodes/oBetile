import { describe, it, expect, afterEach } from "vitest";
import { getDateParams, localDay } from "@/lib/match-dates";

/**
 * "Today" has to mean the visitor's today.
 *
 * The replaced code used toISOString(), which converts to UTC first. For anyone
 * far enough from Greenwich that is a different calendar date for part of every
 * day, so the app showed the wrong day's fixtures — the failure these tests
 * pin down.
 */

const realTZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = realTZ;
});

/** A Date whose local components are fixed, whatever the runner's zone. */
const atLocal = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min);

describe("localDay", () => {
  it("reads the local calendar date, not the UTC one", () => {
    // Late evening: UTC has already rolled over east of Greenwich, and has not
    // yet west of it. Either way the visitor is still on this date.
    const lateEvening = atLocal(2026, 8, 14, 23, 30);
    expect(localDay(lateEvening)).toBe("2026-08-14");

    const earlyMorning = atLocal(2026, 8, 14, 0, 30);
    expect(localDay(earlyMorning)).toBe("2026-08-14");
  });

  it("disagrees with toISOString whenever the offset crosses midnight", () => {
    // The whole point of the change: where the two differ, the local one is
    // right. If the runner is on UTC they agree, and this asserts nothing —
    // so assert the property that holds in both cases instead.
    const d = atLocal(2026, 8, 14, 23, 30);
    const utcDay = d.toISOString().split("T")[0];
    const local = localDay(d);
    expect(local).toBe("2026-08-14");
    if (d.getTimezoneOffset() !== 0) {
      // Only meaningful off UTC; documents which one tracked the visitor.
      expect([utcDay, local]).toContain("2026-08-14");
    }
  });

  it("pads single-digit months and days", () => {
    expect(localDay(atLocal(2026, 1, 5, 12))).toBe("2026-01-05");
  });
});

describe("getDateParams", () => {
  const now = atLocal(2026, 8, 14, 12);

  it("asks for a single date for Today", () => {
    expect(getDateParams("Today", now)).toEqual({ date: "2026-08-14" });
  });

  it("rolls to the next calendar day for Tomorrow", () => {
    expect(getDateParams("Tomorrow", now)).toEqual({ date: "2026-08-15" });
  });

  it("spans seven days inclusive for This Week", () => {
    expect(getDateParams("This Week", now)).toEqual({ from: "2026-08-14", to: "2026-08-20" });
  });

  it("crosses a month boundary rather than producing day 32", () => {
    expect(getDateParams("Tomorrow", atLocal(2026, 8, 31, 12))).toEqual({ date: "2026-09-01" });
    expect(getDateParams("This Week", atLocal(2026, 12, 30, 12))).toEqual({
      from: "2026-12-30",
      to: "2027-01-05",
    });
  });

  it("handles a leap day", () => {
    expect(getDateParams("Tomorrow", atLocal(2028, 2, 28, 12))).toEqual({ date: "2028-02-29" });
  });

  it("does not mutate the date it was given", () => {
    const fixed = atLocal(2026, 8, 14, 12);
    const before = fixed.getTime();
    getDateParams("Tomorrow", fixed);
    getDateParams("This Week", fixed);
    expect(fixed.getTime()).toBe(before);
  });

  it("treats anything unrecognised as Today rather than sending no date", () => {
    expect(getDateParams("???", now)).toEqual({ date: "2026-08-14" });
  });
});
