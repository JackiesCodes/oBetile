import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { isPlaceholderForecast, normaliseToFairOdds, impliedPercents } from "@/lib/odds";

const ROOT = path.resolve(__dirname, "..");

/**
 * The provider's /predictions endpoint does not forecast a fixture; it answers
 * from a small set of buckets. Sampled live against production across thirteen
 * fixtures in unrelated competitions it returned exactly these three, which is
 * why the same percentages appeared on match after match down the feed.
 */
const OBSERVED_IN_PRODUCTION = [
  { home: 45, draw: 45, away: 10 },
  { home: 10, draw: 45, away: 45 },
  { home: 35, draw: 35, away: 30 },
];

describe("placeholder forecasts are refused", () => {
  it("rejects every bucket seen in production", () => {
    for (const p of OBSERVED_IN_PRODUCTION) {
      expect(
        isPlaceholderForecast(p),
        `${p.home}/${p.draw}/${p.away} was rendered on real matches and must not be`
      ).toBe(true);
    }
  });

  it("rejects the flat forecast too", () => {
    expect(isPlaceholderForecast({ home: 33, draw: 33, away: 33 })).toBe(true);
  });

  it("keeps a forecast whose three figures are all distinct", () => {
    expect(isPlaceholderForecast({ home: 44, draw: 27, away: 29 })).toBe(false);
    expect(isPlaceholderForecast({ home: 20, draw: 30, away: 50 })).toBe(false);
  });

  it("keeps a forecast that leads with the draw, which real ones do", () => {
    // An earlier rule refused these on the theory that draws never lead. Two of
    // the model's own outputs did exactly that, so the theory was wrong and the
    // rule was discarding real predictions.
    expect(isPlaceholderForecast({ home: 23, draw: 41, away: 36 })).toBe(false);
    expect(isPlaceholderForecast({ home: 33, draw: 38, away: 29 })).toBe(false);
  });

  it("does not reject the app's own model output", () => {
    /*
     * Fair odds the model returned for real fixtures on the same day, taken
     * from production. None contains an exact tie, so the rule costs nothing
     * worth keeping.
     */
    const modelOutput = [
      { home: 2.285003224234873, draw: 4.381164657180944, away: 2.992990002870324 },
      { home: 3.0260947351626872, draw: 3.618718140383812, away: 2.543234142800959 },
      { home: 1.8828510871320825, draw: 4.190838126652338, away: 4.342637603590245 },
      { home: 4.3160859858762, draw: 2.4451498190275753, away: 2.7829129777631514 },
      { home: 1.6242900867887704, draw: 3.9842373193255156, away: 7.498648792962343 },
      { home: 2.995502154883447, draw: 2.635535288277655, away: 3.4875213764609265 },
      { home: 4.435476419374811, draw: 3.221510424692495, away: 2.1545609779736012 },
    ];
    for (const odds of modelOutput) {
      const percents = impliedPercents(odds);
      expect(
        isPlaceholderForecast(percents),
        `model gave ${percents.home}/${percents.draw}/${percents.away} and it must survive`
      ).toBe(false);
    }
  });

  it("turns the rejected buckets into exactly what the screen showed", () => {
    // Confirms the diagnosis rather than the fix: these percentages really are
    // what a visitor saw, so refusing them is refusing the right thing.
    for (const p of OBSERVED_IN_PRODUCTION) {
      const fair = normaliseToFairOdds(p)!;
      expect(impliedPercents(fair)).toEqual(p);
    }
  });
});

/**
 * Ordering matters as much as the filter: the weaker source used to run first
 * and win, so a fixture the model could describe well got a bucket instead.
 */
describe("the model is consulted before the provider forecast", () => {
  for (const file of ["app/page.tsx", "app/sport/soccer/page.tsx"]) {
    it(`${file} asks the model first`, () => {
      const src = readFileSync(path.join(ROOT, file), "utf8");
      const model = src.indexOf("/api/football/model?ids=");
      const forecasts = src.indexOf("/api/football/forecasts?ids=");
      expect(model, "model call missing").toBeGreaterThan(-1);
      expect(forecasts, "forecast call missing").toBeGreaterThan(-1);
      expect(model).toBeLessThan(forecasts);
    });
  }

  it("the forecast route applies the filter", () => {
    const route = readFileSync(path.join(ROOT, "app/api/football/forecasts/route.ts"), "utf8");
    expect(route).toMatch(/isPlaceholderForecast/);
  });
});
