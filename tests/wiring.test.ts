import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Guards against the failure this codebase has hit twice: a finished, correct
 * component that nothing renders.
 *
 * OddsButton was removed from MatchRow and sat unused for months — a whole odds
 * pipeline was built to feed it before anyone noticed the buttons were not on
 * the page. PredictionSlip was the same: tabs, history and a mobile drawer,
 * mounted nowhere. Both typechecked and built cleanly the entire time.
 */

const ROOT = path.resolve(__dirname, "..");
const SEARCH_DIRS = ["app", "components", "context", "lib"];

function sourceFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const full = path.join(abs, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(path.join(dir, entry)));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = SEARCH_DIRS.flatMap(sourceFiles);
const SOURCES = new Map(FILES.map((f) => [f, readFileSync(f, "utf8")]));

/** Every place a component is referenced other than its own definition file. */
function usageCount(componentName: string, ownFile: string): number {
  let count = 0;
  for (const [file, text] of SOURCES) {
    if (file.endsWith(ownFile)) continue;
    if (new RegExp(`<${componentName}[\\s/>]`).test(text)) count++;
  }
  return count;
}

describe("components are actually rendered", () => {
  const mustBeMounted: [string, string][] = [
    ["OddsButton", "components/OddsButton.tsx"],
    ["PredictionSlip", "components/PredictionSlip.tsx"],
    ["MatchRow", "components/MatchRow.tsx"],
    ["LeagueSection", "components/LeagueSection.tsx"],
    ["Footer", "components/Footer.tsx"],
    ["AuthModal", "components/AuthModal.tsx"],
    ["MatchTeamNews", "components/match-detail/MatchTeamNews.tsx"],
  ];

  it.each(mustBeMounted)("%s is rendered somewhere", (name, file) => {
    expect(usageCount(name, file)).toBeGreaterThan(0);
  });
});

describe("layout wiring", () => {
  const layout = readFileSync(path.join(ROOT, "components/ClientLayout.tsx"), "utf8");

  it("mounts the picks slip so picks and history are reachable", () => {
    expect(layout).toMatch(/<PredictionSlip\s*\/>/);
  });

  it("mounts the footer carrying the legal disclosures", () => {
    expect(layout).toMatch(/<Footer\s*\/>/);
  });
});

describe("match rows expose the prediction buttons", () => {
  const row = readFileSync(path.join(ROOT, "components/MatchRow.tsx"), "utf8");

  it("renders all three outcomes", () => {
    for (const market of ["home", "draw", "away"]) {
      expect(row).toContain(`market="${market}"`);
    }
  });

  it("keeps the odds buttons outside the navigating link", () => {
    // Inside the <Link>, tapping a percentage would navigate instead of
    // recording a pick.
    const linkOpen = row.indexOf("<Link");
    const linkClose = row.indexOf("</Link>");
    const insideFirstLink = row.slice(linkOpen, linkClose);
    expect(insideFirstLink).not.toContain("<OddsButton");
  });
});

describe("no betting vocabulary in user-facing identifiers", () => {
  it("has no BetSlip or addBet left behind", () => {
    for (const [file, text] of SOURCES) {
      if (file.includes("tests")) continue;
      expect(text, `${file} still uses betting naming`).not.toMatch(/\b(BetSlip|addBet|removeBet|hasBet)\b/);
    }
  });
});

/**
 * The percentages are the product, so what the site says about them has to stay
 * true. This caught a real defect: after the model shipped, both the footer and
 * the terms still told users every percentage came from bookmaker prices.
 */
describe("what the site claims about its percentages", () => {
  const footer = readFileSync(path.join(ROOT, "components/Footer.tsx"), "utf8");
  const terms = readFileSync(path.join(ROOT, "app/legal/terms/page.tsx"), "utf8");
  const method = readFileSync(path.join(ROOT, "app/how-predictions-work/page.tsx"), "utf8");

  it("does not claim bookmaker prices are the only source", () => {
    // The model supplies percentages for matches no bookmaker prices, so any
    // copy describing a single source is false.
    for (const [name, text] of [["footer", footer], ["terms", terms]] as const) {
      const claimsSingleSource =
        /derived from publicly\s*\n?\s*available bookmaker prices and are/.test(text) ||
        /are derived from publicly available bookmaker prices,\s*\n?\s*converted/.test(text);
      expect(claimsSingleSource, `${name} still describes only one source`).toBe(false);
    }
    expect(footer).toMatch(/our own model/);
    expect(terms).toMatch(/standings, recent form and head-to-head/);
  });

  it("reaches the methodology page from every page", () => {
    // Footer renders site-wide, so a link there is reachable everywhere.
    expect(footer).toMatch(/href="\/how-predictions-work"/);
  });

  it("states the limits rather than only the strengths", () => {
    for (const claim of [/Injuries, suspensions/, /wrong about half the time/, /not advice/]) {
      expect(method).toMatch(claim);
    }
  });

  it("keeps the published accuracy figures traceable to the backtest", () => {
    // If someone edits a number on the page, the script that produced it must
    // still exist to re-check it against.
    expect(method).toMatch(/scripts\/backtest\.ts/);
    expect(() => readFileSync(path.join(ROOT, "scripts/backtest.ts"), "utf8")).not.toThrow();
  });
});

/**
 * Team news is presentation only. The same injury data was measured twice as a
 * prediction input and rejected both times (docs/model-experiments.md), so a
 * future change that quietly routes it back into the model would invalidate the
 * published accuracy figures without anyone noticing.
 */
describe("team news stays out of the model", () => {
  const model = readFileSync(path.join(ROOT, "lib/model.ts"), "utf8");
  const teamNews = readFileSync(
    path.join(ROOT, "components/match-detail/MatchTeamNews.tsx"),
    "utf8"
  );

  it("keeps the model free of availability inputs", () => {
    for (const banned of [/availability/i, /\binjur/i, /missing\??:/]) {
      expect(model).not.toMatch(banned);
    }
  });

  it("shows both sides of the fixture, not just one", () => {
    expect(teamNews).toMatch(/homeTeamId/);
    expect(teamNews).toMatch(/awayTeamId/);
  });

  it("tells the reader the list does not move the percentages", () => {
    expect(teamNews).toMatch(/does not affect the win percentages/);
  });

  it("does not call international duty an injury", () => {
    // The provider mixes injuries, suspensions and international call-ups under
    // one endpoint, so the heading has to be broader than "Injuries".
    expect(teamNews).toMatch(/team news/i);
  });
});

/**
 * Selections are staged and committed as a group. The previous model wrote a
 * row the instant a percentage was tapped, and a regression to that would
 * silently destroy the grouping the whole feature exists for.
 */
describe("predictions are staged, then saved as a group", () => {
  const context = readFileSync(path.join(ROOT, "context/PredictionContext.tsx"), "utf8");
  const button = readFileSync(path.join(ROOT, "components/OddsButton.tsx"), "utf8");
  const slip = readFileSync(path.join(ROOT, "components/PredictionSlip.tsx"), "utf8");

  it("does not write to the database when a percentage is tapped", () => {
    // OddsButton may only stage. Any persistence call in it means selections
    // are being saved individually again.
    expect(button).not.toMatch(/supabase/i);
    expect(button).toMatch(/select\(/);
  });

  it("keeps staged selections across a reload", () => {
    expect(context).toMatch(/localStorage/);
  });

  it("saves the whole set under one slip", () => {
    expect(context).toMatch(/prediction_slips/);
    expect(context).toMatch(/slip_picks/);
  });

  it("offers sharing and taking it back", () => {
    expect(context).toMatch(/shareSlip/);
    expect(context).toMatch(/unshareSlip/);
  });

  it("warns that sharing is public before it happens", () => {
    expect(slip).toMatch(/public community feed/i);
  });

  it("shows the combined likelihood, not just the count", () => {
    // A six-fold slip at 60% each is under 5%; hiding that would let length
    // read as strength.
    expect(slip).toMatch(/combinedConfidence/);
  });
});
