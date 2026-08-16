import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const SYNC = read("lib/sync.ts");
const ROUTE = read("app/api/sync/route.ts");
const RESULTS = read("app/api/football/results/route.ts");
const MIGRATION = read("supabase/migrations/0011_football_cache.sql");

/**
 * The sync layer is shaped by three hard limits — one cron run a day, 500MB
 * that pauses when idle, and a shared request allowance. These guard the
 * decisions that follow from them, because each one is easy to undo by
 * accident and expensive to discover in production.
 */
describe("the sync endpoint cannot be run by strangers", () => {
  it("requires a secret", () => {
    expect(ROUTE).toMatch(/CRON_SECRET/);
    expect(ROUTE).toMatch(/Unauthorized/);
  });

  it("fails closed when no secret is configured", () => {
    // The open version hands the upstream request budget to anyone who finds
    // the URL, so absence of a secret must deny rather than allow.
    expect(ROUTE).toMatch(/if \(!secret\) return false/);
  });

  it("reports itself unconfigured rather than crashing", () => {
    expect(ROUTE).toMatch(/status: 503/);
    expect(ROUTE).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("is never cached, since a cached sync would do nothing", () => {
    expect(ROUTE).toMatch(/force-dynamic/);
  });
});

describe("writes are closed to the browser", () => {
  it("grants select publicly but never insert or update", () => {
    expect(MIGRATION).toMatch(/for select using \(true\)/);
    // Any write policy would mean the anon key could populate these tables.
    expect(MIGRATION).not.toMatch(/for insert/);
    expect(MIGRATION).not.toMatch(/for update/);
  });

  it("keeps row level security on every new table", () => {
    for (const table of ["fixture_results", "team_season_stats", "sync_runs"]) {
      expect(
        MIGRATION.includes(`alter table public.${table} enable row level security`),
        `${table} has RLS off`
      ).toBe(true);
    }
  });

  it("keeps operational bookkeeping out of public reach", () => {
    // sync_runs has RLS on but no policy of any kind, so only the service role
    // can read it. Naming it in a policy would expose run detail publicly.
    const policies = MIGRATION.match(/create policy[^;]+;/g) ?? [];
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      expect(p, "sync_runs must not have a policy").not.toMatch(/sync_runs/);
    }
  });

  it("uses a server-only key name", () => {
    const admin = read("lib/supabase/admin.ts");
    expect(admin).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(admin).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE/);
  });
});

describe("what gets stored is bounded on purpose", () => {
  it("stores only finished fixtures", () => {
    // A row that exists but says nothing is worse than no row: the read path
    // would treat it as an answer.
    expect(SYNC).toMatch(/if \(!finished\) continue/);
  });

  it("does not try to mirror volatile or bulky endpoints", () => {
    for (const endpoint of ["/players", "/transfers", "/fixtures/events", "/fixtures/lineups", "/odds"]) {
      expect(SYNC.includes(`"${endpoint}"`), `sync should not persist ${endpoint}`).toBe(false);
    }
  });

  it("stays well under the burst allowance", () => {
    const concurrency = Number(SYNC.match(/const SYNC_CONCURRENCY = (\d+)/)?.[1]);
    expect(concurrency).toBeGreaterThan(0);
    expect(concurrency).toBeLessThanOrEqual(5);
  });

  it("lets one competition fail without abandoning the rest", () => {
    expect(SYNC).toMatch(/catch \(e\)/);
    expect(SYNC).toMatch(/problems\.push/);
  });

  it("records every run so a failure is visible without platform logs", () => {
    expect(SYNC).toMatch(/sync_runs/);
    expect(ROUTE).toMatch(/recordRun/);
  });
});

describe("the read path prefers the local copy", () => {
  it("asks the database before the provider", () => {
    const stored = RESULTS.indexOf("readStoredResults");
    const upstream = RESULTS.indexOf('apiFetch<APIFixture[]>');
    expect(stored).toBeGreaterThan(-1);
    expect(upstream).toBeGreaterThan(-1);
    expect(stored).toBeLessThan(upstream);
  });

  it("only asks the provider for what it does not already have", () => {
    expect(RESULTS).toMatch(/const missing = ids\.filter/);
  });

  it("falls back rather than breaking when the database is unreachable", () => {
    // Settlement must degrade to the behaviour that existed before this table.
    expect(RESULTS).toMatch(/catch \{\s*return \{\};/);
  });

  it("says which source answered", () => {
    expect(RESULTS).toMatch(/x-results-source/);
  });
});

describe("the schedule fits the platform", () => {
  it("declares a cron", () => {
    expect(existsSync(path.join(ROOT, "vercel.json"))).toBe(true);
    const cfg = JSON.parse(read("vercel.json"));
    expect(cfg.crons).toHaveLength(1);
    expect(cfg.crons[0].path).toBe("/api/sync");
  });

  it("asks for one run a day, which is what the hobby plan allows", () => {
    const cfg = JSON.parse(read("vercel.json"));
    const [minute, hour, dom, month, dow] = cfg.crons[0].schedule.split(" ");
    // A daily schedule pins minute and hour and wildcards the rest. Anything
    // more frequent is silently downgraded by the platform.
    expect(minute).toMatch(/^\d+$/);
    expect(hour).toMatch(/^\d+$/);
    expect([dom, month, dow]).toEqual(["*", "*", "*"]);
  });
});
