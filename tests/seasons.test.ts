import { describe, it, expect } from "vitest";
import { seasonFromDate, inProgressSeason, CURRENT_SEASON } from "@/lib/api-football";

/**
 * Season labelling is the bug this app has hit most often. Competitions use two
 * conventions that agree for part of the year and diverge for the rest, and
 * asking API-Football for the wrong season returns an empty response rather
 * than an error — so getting it wrong looks like "no data" instead of a fault.
 */
describe("seasonFromDate", () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

  it("labels a split-year season by its starting year", () => {
    expect(seasonFromDate("split-year", at("2026-08-05"))).toBe("2026");
  });

  it("keeps a split-year season on its start year into the following spring", () => {
    // The case a single global constant gets wrong: in February the Premier
    // League is still 2026 while calendar-year leagues have moved to 2027.
    expect(seasonFromDate("split-year", at("2027-02-15"))).toBe("2026");
    expect(seasonFromDate("calendar-year", at("2027-02-15"))).toBe("2027");
  });

  it("rolls split-year seasons over in July, not January", () => {
    expect(seasonFromDate("split-year", at("2026-06-30"))).toBe("2025");
    expect(seasonFromDate("split-year", at("2026-07-01"))).toBe("2026");
  });

  it("follows the calendar year for calendar-year competitions", () => {
    expect(seasonFromDate("calendar-year", at("2026-12-31"))).toBe("2026");
    expect(seasonFromDate("calendar-year", at("2027-01-01"))).toBe("2027");
  });

  it("defaults to the split-year convention", () => {
    expect(seasonFromDate(undefined, at("2026-08-05"))).toBe("2026");
  });

  it("exposes a current season that is a four digit year", () => {
    expect(CURRENT_SEASON).toMatch(/^\d{4}$/);
  });
});

describe("inProgressSeason", () => {
  const seasons = [
    { year: 2025, start: "2025-08-15", end: "2026-05-24", current: false },
    { year: 2026, start: "2026-08-14", end: "2027-05-23", current: true },
  ];

  it("finds the season containing the given date", () => {
    expect(inProgressSeason(seasons, new Date("2026-10-01T12:00:00Z"))?.year).toBe(2026);
  });

  it("returns nothing during the pre-season gap", () => {
    // This is what keeps competitions that have not kicked off out of the
    // standings and top-scorer panels.
    expect(inProgressSeason(seasons, new Date("2026-08-05T12:00:00Z"))).toBeUndefined();
  });

  it("ignores seasons not flagged as current even if the dates match", () => {
    expect(inProgressSeason(seasons, new Date("2025-10-01T12:00:00Z"))).toBeUndefined();
  });

  it("copes with an empty season list", () => {
    expect(inProgressSeason([], new Date())).toBeUndefined();
  });
});
