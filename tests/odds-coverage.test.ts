import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const ROUTE = readFileSync(path.join(ROOT, "app/api/football/odds/route.ts"), "utf8");

/**
 * The cap that caused the dashes.
 *
 * /odds paginates about ten fixtures a page. The ceiling was 25 while a day
 * genuinely ran to roughly twenty-two pages, but production later reported 72
 * available against 25 fetched — two thirds of the fixtures that had a
 * published price were rendering a dash. Quota was never the binding
 * constraint: the account allows 7,500 a day and 300 a minute against about
 * 170 used. Wall-clock time in a single invocation was.
 */
describe("a whole day of prices is reachable", () => {
  const constant = (name: string): number => {
    const m = ROUTE.match(new RegExp(`const ${name} = (\\d+)`));
    if (!m) throw new Error(`${name} not found in the odds route`);
    return Number(m[1]);
  };

  it("allows far more pages than a day actually needs", () => {
    // 72 was the real figure; the ceiling has to clear it with room to spare
    // rather than sit just above today's observation.
    expect(constant("MAX_PAGES")).toBeGreaterThanOrEqual(100);
  });

  it("fetches pages several at a time so a full sweep fits in one request", () => {
    const concurrency = constant("PAGE_CONCURRENCY");
    expect(concurrency).toBeGreaterThan(1);
    // Well under the 300-per-minute burst allowance.
    expect(concurrency).toBeLessThanOrEqual(20);
    expect(ROUTE).toMatch(/inBatches/);
  });

  it("raises its own time limit, since a cold sweep is dozens of pages", () => {
    expect(ROUTE).toMatch(/export const maxDuration/);
  });

  it("stays inside the quota even at its own ceiling", () => {
    /*
     * The arithmetic that picked the cache lifetime, kept here so widening the
     * sweep again cannot quietly exhaust the account. Worst case is one full
     * sweep per cache lifetime, all day, at the maximum page count. The live
     * plan allows 7,500 a day and every other endpoint draws on the same pool,
     * so half is the most this one may claim.
     */
    const DAILY_ALLOWANCE = 7500;
    const sweepsPerDay = 86_400 / constant("ODDS_TTL");
    const worstCase = sweepsPerDay * constant("MAX_PAGES");
    expect(worstCase).toBeLessThan(DAILY_ALLOWANCE / 2);

    // And the realistic figure — 72 pages, as production reported — should be
    // a comfortable fraction rather than merely legal.
    expect(sweepsPerDay * 72).toBeLessThan(DAILY_ALLOWANCE / 3);
  });

  it("does not lose good pages when one fails", () => {
    // A rejected page used to abort the whole sweep. A partial map still fills
    // most of the list, and what it misses falls through to the model.
    expect(ROUTE).toMatch(/settle\(/);
  });

  it("retries the pages it missed rather than leaving the day short", () => {
    // Measured live: a cold sweep got 43 of 72 and simply asking again got 53,
    // so the misses are transient and a second pass is worth having.
    expect(ROUTE).toMatch(/RETRY_CONCURRENCY/);
    expect(ROUTE).toMatch(/RETRY_PAUSE_MS/);
  });

  it("retries more gently than the pass that just failed", () => {
    expect(constant("RETRY_CONCURRENCY")).toBeLessThan(constant("PAGE_CONCURRENCY"));
  });

  it("says why a sweep fell short instead of only that it did", () => {
    // The first version swallowed the reason, so a live shortfall left nothing
    // in the logs to diagnose it with.
    expect(ROUTE).toMatch(/x-odds-incomplete/);
    expect(ROUTE).toMatch(/console\.warn\("odds sweep incomplete"/);
    expect(ROUTE).toMatch(/reasons/);
  });

  it("reports the upstream total rather than its own cap", () => {
    // The point of the header is to reveal a shortfall; echoing the capped
    // number back would hide it.
    expect(ROUTE).toMatch(/"x-odds-pages-available": String\(first\.paging\.total\)/);
  });
});
