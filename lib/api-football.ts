import type { APIFixture, Match } from "@/types";

const BASE = "https://v3.football.api-sports.io";

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
  revalidate = 60
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": process.env.APIFOOTBALL_KEY ?? "",
    },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.response as T;
}

// Current season helper — update each year
export const CURRENT_SEASON = "2025";

// League IDs
export const TOP_LEAGUES = {
  // Top 5 Europe
  premierLeague: 39,
  laLiga: 140,
  bundesliga: 78,
  serieA: 135,
  ligue1: 61,
  championsLeague: 2,
  // Europe extended
  eredivisie: 88,
  primeiraLiga: 94,
  championship: 40,
  // Americas
  mls: 253,
  brasileirao: 71,
  ligaMx: 262,
  // Other
  saudiProLeague: 307,
};

// Normalise an API-Football fixture response into the local Match type
const LIVE_STATUSES = new Set(["1H", "2H", "ET", "P", "HT", "BT"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

export function normalizeFixture(f: APIFixture): Match {
  const { short, elapsed } = f.fixture.status;
  const status: Match["status"] = LIVE_STATUSES.has(short)
    ? "live"
    : FINISHED_STATUSES.has(short)
    ? "finished"
    : "upcoming";

  const score =
    f.goals.home !== null && f.goals.away !== null
      ? `${f.goals.home}-${f.goals.away}`
      : null;

  const minute =
    short === "HT"
      ? "HT"
      : status === "live" && elapsed
      ? String(elapsed)
      : undefined;

  const time = new Date(f.fixture.date).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    id: String(f.fixture.id),
    sport: "soccer",
    league: f.league.name,
    leagueId: f.league.id,
    country: f.league.country,
    home: f.teams.home.name,
    away: f.teams.away.name,
    score,
    minute,
    status,
    time,
    odds: { home: null, draw: null, away: null },
  };
}
