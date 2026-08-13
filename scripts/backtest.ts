/**
 * Walk-forward backtest for the win-probability model.
 *
 * For each finished fixture in a season, the table and form are rebuilt from
 * only the matches that had been played before it, the model predicts, and the
 * prediction is scored against what actually happened. Nothing after the match
 * is ever visible to the prediction — that is the whole point, and it is what
 * separates a real evaluation from one that flatters itself.
 *
 * Usage:
 *   npx tsx scripts/backtest.ts <path-to-fixtures.json> [label]
 *   npx tsx scripts/backtest.ts --league 39 --season 2025 [--base https://o-betile.vercel.app]
 *
 * The second form pulls the season straight from the deployed fixtures route,
 * so the numbers in the commit message can be reproduced without a stored
 * dataset or an API key.
 */

import { readFileSync } from "fs";
import { predictFixture, type TeamRecord, type Probabilities } from "@/lib/model";
import {
  availabilityFor,
  type MinutesByPlayer,
  type MissingByFixture,
} from "@/lib/availability";

interface Row {
  id: number;
  date: string;
  status: string;
  h: number;
  a: number;
  hn: string;
  an: string;
  gh: number | null;
  ga: number | null;
}

type Outcome = "home" | "draw" | "away";

const outcomeOf = (gh: number, ga: number): Outcome =>
  gh > ga ? "home" : gh < ga ? "away" : "draw";

/** Mutable running record for one team, in the shape the model expects. */
interface Running {
  teamId: number;
  home: { played: number; goalsFor: number; goalsAgainst: number };
  away: { played: number; goalsFor: number; goalsAgainst: number };
  results: string[];
}

const blank = (teamId: number): Running => ({
  teamId,
  home: { played: 0, goalsFor: 0, goalsAgainst: 0 },
  away: { played: 0, goalsFor: 0, goalsAgainst: 0 },
  results: [],
});

const toRecord = (r: Running): TeamRecord => ({
  teamId: r.teamId,
  home: { ...r.home },
  away: { ...r.away },
  // The standings endpoint reports the last five, so the replay matches it.
  form: r.results.length ? r.results.slice(-5).join("") : null,
});

/**
 * Ranked Probability Score, the standard measure for football forecasts.
 *
 * Unlike plain Brier it respects the ordering home > draw > away, so calling an
 * away win when the home side wins is penalised more than calling a draw.
 * Lower is better; 0 is perfect.
 */
function rps(p: Probabilities, actual: Outcome): number {
  const f = [p.home, p.draw, p.away];
  const o = [actual === "home" ? 1 : 0, actual === "draw" ? 1 : 0, actual === "away" ? 1 : 0];
  let cumF = 0;
  let cumO = 0;
  let sum = 0;
  for (let i = 0; i < 2; i++) {
    cumF += f[i];
    cumO += o[i];
    sum += (cumF - cumO) ** 2;
  }
  return sum / 2;
}

function logLoss(p: Probabilities, actual: Outcome): number {
  const q = Math.max(1e-15, p[actual]);
  return -Math.log(q);
}

interface Scored {
  p: Probabilities;
  actual: Outcome;
}

function summarise(name: string, scored: Scored[]) {
  const n = scored.length;
  const meanRps = scored.reduce((s, x) => s + rps(x.p, x.actual), 0) / n;
  const meanLog = scored.reduce((s, x) => s + logLoss(x.p, x.actual), 0) / n;
  const hits = scored.filter((x) => {
    const top = (["home", "draw", "away"] as Outcome[]).reduce((b, k) => (x.p[k] > x.p[b] ? k : b), "home");
    return top === x.actual;
  }).length;
  console.log(
    `${name.padEnd(26)} n=${String(n).padStart(4)}  RPS ${meanRps.toFixed(4)}  logloss ${meanLog.toFixed(4)}  top-pick ${((hits / n) * 100).toFixed(1)}%`
  );
  return meanRps;
}

/** Of the matches we called at X%, how often did X actually happen? */
function calibration(scored: Scored[]) {
  const edges = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.01];
  const buckets = edges.slice(0, -1).map(() => ({ n: 0, predicted: 0, actual: 0 }));

  for (const { p, actual } of scored) {
    for (const k of ["home", "draw", "away"] as Outcome[]) {
      const v = p[k];
      const b = edges.findIndex((e, i) => v >= e && v < edges[i + 1]);
      if (b < 0) continue;
      buckets[b].n++;
      buckets[b].predicted += v;
      buckets[b].actual += actual === k ? 1 : 0;
    }
  }

  console.log("\n  band        n     said    happened   gap");
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    if (b.n === 0) continue;
    const said = b.predicted / b.n;
    const happened = b.actual / b.n;
    const flag = Math.abs(said - happened) > 0.05 ? "  <-- off" : "";
    console.log(
      `  ${(edges[i] * 100).toFixed(0).padStart(2)}-${(Math.min(edges[i + 1], 1) * 100).toFixed(0).padStart(3)}%  ${String(b.n).padStart(5)}  ${(said * 100).toFixed(1).padStart(6)}%  ${(happened * 100).toFixed(1).padStart(8)}%  ${((happened - said) * 100).toFixed(1).padStart(6)}${flag}`
    );
  }
}

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/** Whatever the fixtures route returns, reduced to the fields the replay uses. */
interface APIShape {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

async function loadRows(): Promise<{ rows: Row[]; label: string }> {
  const league = arg("--league");
  const season = arg("--season");

  if (league && season) {
    const base = arg("--base") ?? "https://o-betile.vercel.app";
    const url = `${base}/api/football/fixtures?league=${league}&season=${season}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const raw: APIShape[] = await res.json();
    return {
      label: `league ${league}, season ${season}`,
      rows: raw.map((f) => ({
        id: f.fixture.id,
        date: f.fixture.date,
        status: f.fixture.status.short,
        h: f.teams.home.id,
        a: f.teams.away.id,
        hn: f.teams.home.name,
        an: f.teams.away.name,
        gh: f.goals.home,
        ga: f.goals.away,
      })),
    };
  }

  const file = process.argv[2];
  if (!file) throw new Error("pass a fixtures file, or --league <id> --season <year>");
  return { label: arg("--label") ?? process.argv[3] ?? file, rows: JSON.parse(readFileSync(file, "utf8")) };
}

/**
 * Injury lists and player minutes, when the comparison is requested.
 *
 * Both come from files: --missing <injuries.json> --minutes <minutes.json>.
 * Absent, the run scores the model exactly as it ships.
 */
function loadAvailability(): { missing: MissingByFixture; minutes: MinutesByPlayer } | null {
  const missingFile = arg("--missing");
  const minutesFile = arg("--minutes");
  if (!missingFile || !minutesFile) return null;
  return {
    missing: JSON.parse(readFileSync(missingFile, "utf8")) as MissingByFixture,
    minutes: JSON.parse(readFileSync(minutesFile, "utf8")) as MinutesByPlayer,
  };
}

async function main() {
  const loaded = await loadRows();
  const availability = loadAvailability();
  const label = loaded.label;
  const rows: Row[] = loaded.rows
    .filter((r: Row) => r.status === "FT" && r.gh !== null && r.ga !== null)
    .sort((a: Row, b: Row) => a.date.localeCompare(b.date));

  const running = new Map<number, Running>();
  const modelScored: Scored[] = [];
  const weightedScored: Scored[] = [];
  const covered: Row[] = [];
  let skipped = 0;
  let withAvailability = 0;
  let shareTotal = 0;

  for (const r of rows) {
    const home = running.get(r.h) ?? blank(r.h);
    const away = running.get(r.a) ?? blank(r.a);
    const table = [...running.values()].map(toRecord);

    // Predict from the state of the world before this match only.
    const p = predictFixture({ home: toRecord(home), away: toRecord(away), table });
    const actual = outcomeOf(r.gh!, r.ga!);

    if (p) {
      modelScored.push({ p, actual });
      covered.push(r);

      if (availability) {
        const missing = availabilityFor(
          availability.missing,
          availability.minutes,
          r.id,
          r.h,
          r.a
        );
        if (missing) {
          withAvailability++;
          shareTotal += (missing.home + missing.away) / 2;
        }
        const weighted = predictFixture({
          home: toRecord(home),
          away: toRecord(away),
          table,
          missing,
        });
        // Same fixture set for both, or the comparison is not a comparison.
        weightedScored.push({ p: weighted ?? p, actual });
      }
    } else {
      skipped++;
    }

    // Now let the result into the record, for later matches.
    home.home.played++;
    home.home.goalsFor += r.gh!;
    home.home.goalsAgainst += r.ga!;
    away.away.played++;
    away.away.goalsFor += r.ga!;
    away.away.goalsAgainst += r.gh!;
    home.results.push(actual === "home" ? "W" : actual === "draw" ? "D" : "L");
    away.results.push(actual === "away" ? "W" : actual === "draw" ? "D" : "L");
    running.set(r.h, home);
    running.set(r.a, away);
  }

  // Baseline: always predict the season's actual split. It peeks at the answer,
  // which makes it a harder bar than anything shippable — deliberately.
  const all = rows.map((r) => outcomeOf(r.gh!, r.ga!));
  const base: Probabilities = {
    home: all.filter((o) => o === "home").length / all.length,
    draw: all.filter((o) => o === "draw").length / all.length,
    away: all.filter((o) => o === "away").length / all.length,
  };

  console.log(`\n=== ${label} ===`);
  console.log(`fixtures ${rows.length}, predicted ${modelScored.length}, declined ${skipped} (${((skipped / rows.length) * 100).toFixed(0)}% — early rounds with too little history)`);
  console.log(`season split: home ${(base.home * 100).toFixed(1)}%  draw ${(base.draw * 100).toFixed(1)}%  away ${(base.away * 100).toFixed(1)}%\n`);

  // Both scored on the same fixtures, or the comparison is meaningless.
  const baseScored: Scored[] = modelScored.map((x) => ({ p: base, actual: x.actual }));

  const modelRps = summarise("model", modelScored);
  const baseRps = summarise("baseline (season split)", baseScored);

  const lift = ((baseRps - modelRps) / baseRps) * 100;
  console.log(`\nRPS improvement over baseline: ${lift.toFixed(1)}%  ${lift > 0 ? "(model is better)" : "(MODEL IS WORSE — do not ship)"}`);

  if (availability) {
    const weightedRps = summarise("model + weighted absences", weightedScored);
    const delta = ((modelRps - weightedRps) / modelRps) * 100;
    console.log(
      `\navailability on ${withAvailability}/${modelScored.length} fixtures ` +
        `(${((withAvailability / modelScored.length) * 100).toFixed(0)}%), ` +
        `mean share of an eleven missing ${(withAvailability ? (shareTotal / withAvailability) * 100 : 0).toFixed(1)}%`
    );
    console.log(
      `weighted absences change RPS by ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%  ` +
        (delta > 0.5
          ? "(worth shipping)"
          : delta < -0.5
            ? "(WORSE — do not ship)"
            : "(no real difference — do not ship complexity that buys nothing)")
    );
  }

  calibration(modelScored);
}

main();
