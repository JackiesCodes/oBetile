/**
 * Which calendar day to ask the fixtures endpoint for.
 *
 * The obvious `new Date().toISOString().split("T")[0]` is wrong, and was the
 * bug this replaces: toISOString converts to UTC first, so "today" was the UTC
 * day rather than the visitor's. For anyone far enough from Greenwich that is a
 * different date for part of every day — a visitor in Auckland (UTC+13) sees
 * yesterday's fixtures until 1pm local, and one in Los Angeles (UTC-7) starts
 * seeing tomorrow's at 5pm. For an app whose whole pitch is worldwide football,
 * that is most of the map.
 *
 * Reading the local components instead gives the date on the visitor's own
 * calendar, which is what "Today" means to them.
 */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Query parameters for one of the date chips. */
export function getDateParams(
  activeDate: string,
  now: Date = new Date()
): Record<string, string> {
  if (activeDate === "Tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return { date: localDay(d) };
  }
  if (activeDate === "This Week") {
    const to = new Date(now);
    to.setDate(to.getDate() + 6);
    return { from: localDay(now), to: localDay(to) };
  }
  return { date: localDay(now) };
}
