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
