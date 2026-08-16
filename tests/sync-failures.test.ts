import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * What a partial sync reports.
 *
 * The first live run of the statistics job came back "league 39: 3 team(s)
 * failed" and there was nothing to act on: seventeen of twenty teams stored,
 * three missing, and no way to tell a rate limit from a competition the
 * provider has no record for. settle() had captured each reason and the count
 * discarded them — the same loss settle() was written to prevent.
 *
 * These tests run the job against a stubbed upstream, so they check what the
 * caller is actually told rather than what the source happens to say.
 */

const apiFetch = vi.fn();

vi.mock("@/lib/api-football", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  MAJOR_LEAGUES: [{ id: 39, name: "Premier League" }],
  resolveSeason: async () => "2026",
}));

const upsert = vi.fn(async (_rows: unknown[], _opts?: unknown) => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  hasAdminConfig: () => true,
  createAdminClient: () => ({ from: () => ({ upsert, insert: async () => ({ error: null }) }) }),
}));

const { syncTeamStatistics } = await import("@/lib/sync");

/** A standings response naming the given teams. */
const standings = (ids: number[]) => [
  { league: { standings: [ids.map((id) => ({ team: { id } }))] } },
];

const teamStats = (id: number) => ({
  team: { id, name: `Team ${id}` },
  form: "WWDLW",
  fixtures: {
    played: { home: 5, away: 5, total: 10 },
    wins: { home: 3, away: 2, total: 5 },
    draws: { home: 1, away: 1, total: 2 },
    loses: { home: 1, away: 2, total: 3 },
  },
});

beforeEach(() => {
  apiFetch.mockReset();
  upsert.mockClear();
});

describe("a partly failed league says why", () => {
  beforeEach(() => {
    apiFetch.mockImplementation(async (endpoint: string, params: Record<string, string>) => {
      if (endpoint === "/standings") return standings([1, 2, 3, 4]);
      if (params.team === "2") throw new Error("rateLimit: Too many requests");
      if (params.team === "3") throw new Error("rateLimit: Too many requests");
      return teamStats(Number(params.team));
    });
  });

  it("names the reason, not just a count", async () => {
    const out = await syncTeamStatistics([39]);
    expect(out.detail).toContain("rateLimit: Too many requests");
  });

  it("names which teams were lost, so the gap can be checked", async () => {
    // Asserted on the team list itself rather than on bare digits: "2" and "3"
    // both appear in the league id 39, so a looser check passed against the
    // very code this replaces.
    const out = await syncTeamStatistics([39]);
    expect(out.detail).toMatch(/teams 2,3/);
  });

  it("gives the failure a denominator", async () => {
    // "3 failed" out of four is a bad league; out of four hundred it is noise.
    const out = await syncTeamStatistics([39]);
    expect(out.detail).toMatch(/2 of 4 team/);
  });

  it("groups one shared cause into one statement", async () => {
    // Twenty teams hitting a single rate limit is one fact. Repeating it per
    // team is what pushes the real second cause off the end of the field.
    const out = await syncTeamStatistics([39]);
    expect(out.detail.match(/rateLimit/g)).toHaveLength(1);
  });

  it("separates distinct causes", async () => {
    apiFetch.mockImplementation(async (endpoint: string, params: Record<string, string>) => {
      if (endpoint === "/standings") return standings([1, 2, 3, 4]);
      if (params.team === "2") throw new Error("rateLimit: Too many requests");
      if (params.team === "3") throw new Error("no season coverage");
      return teamStats(Number(params.team));
    });
    const out = await syncTeamStatistics([39]);
    expect(out.detail).toContain("rateLimit: Too many requests");
    expect(out.detail).toContain("no season coverage");
  });

  it("still stores everything that did come back", async () => {
    // A partial failure that dropped the successes would be a worse trade than
    // the missing rows it was reporting.
    const out = await syncTeamStatistics([39]);
    expect(out.records).toBe(2);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toHaveLength(2);
  });

  it("marks the run as not ok", async () => {
    const out = await syncTeamStatistics([39]);
    expect(out.ok).toBe(false);
  });
});

describe("a clean league stays quiet", () => {
  it("reports success with no failure text", async () => {
    apiFetch.mockImplementation(async (endpoint: string, params: Record<string, string>) => {
      if (endpoint === "/standings") return standings([1, 2]);
      return teamStats(Number(params.team));
    });
    const out = await syncTeamStatistics([39]);
    expect(out.ok).toBe(true);
    expect(out.records).toBe(2);
    expect(out.detail).not.toMatch(/failed/);
  });

  it("treats a league with no published table as nothing to do, not a failure", async () => {
    // Cup ties and pre-season competitions look exactly like this.
    apiFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/standings") return standings([]);
      throw new Error("should not have asked for team statistics");
    });
    const out = await syncTeamStatistics([39]);
    expect(out.ok).toBe(true);
    expect(out.records).toBe(0);
  });
});

describe("one league failing does not abandon the others", () => {
  it("carries on and reports both", async () => {
    apiFetch.mockImplementation(async (endpoint: string, params: Record<string, string>) => {
      if (endpoint === "/standings") {
        if (params.league === "39") throw new Error("upstream 500");
        return standings([7]);
      }
      return teamStats(Number(params.team));
    });
    const out = await syncTeamStatistics([39, 140]);
    expect(out.records).toBe(1);
    expect(out.detail).toContain("upstream 500");
    expect(out.ok).toBe(false);
  });
});
