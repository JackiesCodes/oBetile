import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Which competitions a full sweep reaches first.
 *
 * The sweep is paced to the upstream's rate limit and a full pass is close to
 * the function's time limit, so it stops partway and the order decides what
 * goes stale. A fixed list starves the same tail every night; rotating the
 * start advances one place a day while the cut is three or four deep, which
 * left Brasileirão and Liga MX on three-day-old partial tables. Ordering by
 * staleness is the fix, and it is worth testing because nothing else in the
 * output reveals it — a starved league looks exactly like a fresh one until
 * someone reads the timestamps.
 */

const apiFetch = vi.fn();

vi.mock("@/lib/api-football", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  MAJOR_LEAGUES: [{ id: 1 }, { id: 2 }, { id: 3 }],
  resolveSeason: async () => "2026",
}));

/** Rows the stubbed team_season_stats table returns, and whether reading fails. */
const store: { rows: { league_id: number; updated_at: string }[]; fails: boolean } = {
  rows: [],
  fails: false,
};

const upsert = vi.fn(async (_rows: unknown[], _opts?: unknown) => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  hasAdminConfig: () => true,
  createAdminClient: () => ({
    from: () => ({
      upsert,
      insert: async () => ({ error: null }),
      select: async () =>
        store.fails
          ? { data: null, error: { message: "read failed" } }
          : { data: store.rows, error: null },
    }),
  }),
}));

const { syncTeamStatistics } = await import("@/lib/sync");

/** The order leagues were actually asked about, recorded from the standings calls. */
const swept: number[] = [];

beforeEach(() => {
  swept.length = 0;
  store.rows = [];
  store.fails = false;
  upsert.mockClear();
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (endpoint: string, params: Record<string, string>) => {
    if (endpoint === "/standings") {
      const league = Number(params.league);
      swept.push(league);
      return [{ league: { standings: [[{ team: { id: 100 + league } }]] } }];
    }
    return {
      team: { id: Number(params.team), name: `Team ${params.team}` },
      form: "W",
      fixtures: {
        played: { home: 1, away: 0, total: 1 },
        wins: { home: 1, away: 0, total: 1 },
        draws: { home: 0, away: 0, total: 0 },
        loses: { home: 0, away: 0, total: 0 },
      },
    };
  });
});

const touched = (league: number, when: string) => ({ league_id: league, updated_at: when });

describe("a full sweep starts with whatever is stalest", () => {
  it("orders by how long ago each league was last written", async () => {
    store.rows = [
      touched(1, "2026-08-19T03:00:00Z"), // freshest — goes last
      touched(2, "2026-08-17T03:00:00Z"), // stalest — goes first
      touched(3, "2026-08-18T03:00:00Z"),
    ];
    await syncTeamStatistics();
    expect(swept).toEqual([2, 3, 1]);
  });

  it("puts a league that has never been written at the very front", async () => {
    // League 2 has no rows at all: never swept, or its table is not published
    // yet. Either way it is the one worth looking at first.
    store.rows = [touched(1, "2026-08-19T03:00:00Z"), touched(3, "2026-08-18T03:00:00Z")];
    await syncTeamStatistics();
    expect(swept[0]).toBe(2);
  });

  it("takes the newest row per league, not whichever row came back first", async () => {
    // One row per team, so a league's freshness is the newest of many.
    store.rows = [
      touched(1, "2026-08-01T00:00:00Z"),
      touched(1, "2026-08-19T00:00:00Z"),
      touched(2, "2026-08-02T00:00:00Z"),
      touched(2, "2026-08-03T00:00:00Z"),
      touched(3, "2026-08-18T00:00:00Z"),
    ];
    await syncTeamStatistics();
    expect(swept).toEqual([2, 3, 1]);
  });

  it("keeps the configured order when nothing has been written yet", async () => {
    // A fresh database: every league equally unswept, so the sweep must still
    // be deterministic rather than ordered by whatever the map iterated.
    await syncTeamStatistics();
    expect(swept).toEqual([1, 2, 3]);
  });
});

describe("ordering never becomes the thing that fails", () => {
  it("still sweeps every league when the freshness read fails", async () => {
    store.fails = true;
    await syncTeamStatistics();
    expect([...swept].sort()).toEqual([1, 2, 3]);
  });

  it("leaves an explicit league list in the order it was asked for", async () => {
    // ?league=3,1 is a request for those two, in that order — not an invitation
    // to reorder them by staleness.
    store.rows = [touched(3, "2026-08-01T00:00:00Z")];
    await syncTeamStatistics([3, 1]);
    expect(swept).toEqual([3, 1]);
  });
});
