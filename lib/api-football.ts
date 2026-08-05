import type { APIFixture, Match } from "@/types";

const BASE = "https://v3.football.api-sports.io";

export class ApiFootballError extends Error {
  constructor(message: string, readonly kind: "auth" | "quota" | "plan" | "http" | "api") {
    super(message);
    this.name = "ApiFootballError";
  }
}

/** Quota counters API-Football reports on every response header. */
export interface RateLimit {
  dayLimit: number | null;
  dayRemaining: number | null;
  minuteLimit: number | null;
  minuteRemaining: number | null;
}

export interface ApiEnvelope<T> {
  response: T;
  rateLimit: RateLimit;
  resultCount: number;
}

function readKey(): string {
  const key = process.env.APIFOOTBALL_KEY?.trim();
  if (!key) {
    throw new ApiFootballError(
      "APIFOOTBALL_KEY is not set. Copy .env.example to .env.local and add your " +
        "key from https://dashboard.api-football.com, then restart the dev server.",
      "auth"
    );
  }
  return key;
}

const num = (v: string | null) => (v === null || v === "" ? null : Number(v));

/**
 * API-Football answers with HTTP 200 even when the request failed — a bad key,
 * an exhausted quota, or an endpoint your plan doesn't cover all arrive as a
 * populated `errors` field alongside an empty `response`. Reading `.response`
 * blindly turns every one of those into a silently empty UI, so classify the
 * error here and throw instead.
 */
function assertNoApiError(errors: unknown): void {
  if (!errors) return;
  // The success case is an empty array; failures are an object of field -> message.
  if (Array.isArray(errors)) {
    if (errors.length === 0) return;
    throw new ApiFootballError(`API-Football: ${errors.join("; ")}`, "api");
  }
  if (typeof errors !== "object") return;

  const entries = Object.entries(errors as Record<string, string>);
  if (entries.length === 0) return;

  const detail = entries.map(([k, v]) => `${k}: ${v}`).join("; ");
  const fields = new Set(entries.map(([k]) => k));
  const kind = fields.has("token")
    ? "auth"
    : fields.has("requests") || fields.has("rateLimit")
    ? "quota"
    : fields.has("plan") || fields.has("access")
    ? "plan"
    : "api";
  throw new ApiFootballError(`API-Football: ${detail}`, kind);
}

/** Full envelope — response payload plus quota headers. */
export async function apiFetchRaw<T>(
  path: string,
  params?: Record<string, string>,
  revalidate = 60
): Promise<ApiEnvelope<T>> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": readKey() },
    next: { revalidate },
  });

  if (!res.ok) {
    // 401 = key missing/invalid; 403 = key valid but the plan forbids it;
    // 429 (and API-Football's own 499) = rate limited.
    const kind =
      res.status === 401
        ? "auth"
        : res.status === 403
        ? "plan"
        : res.status === 429 || res.status === 499
        ? "quota"
        : "http";
    throw new ApiFootballError(
      `API-Football error: ${res.status} ${res.statusText} (${path})`,
      kind
    );
  }

  const json = await res.json();
  assertNoApiError(json?.errors);

  return {
    response: (json?.response ?? []) as T,
    resultCount: typeof json?.results === "number" ? json.results : 0,
    rateLimit: {
      dayLimit: num(res.headers.get("x-ratelimit-requests-limit")),
      dayRemaining: num(res.headers.get("x-ratelimit-requests-remaining")),
      minuteLimit: num(res.headers.get("X-RateLimit-Limit")),
      minuteRemaining: num(res.headers.get("X-RateLimit-Remaining")),
    },
  };
}

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
  revalidate = 60
): Promise<T> {
  const { response } = await apiFetchRaw<T>(path, params, revalidate);
  return response;
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

export interface LeagueMeta {
  id: number;
  name: string;
  country: string;
}

// Canonical list of leagues the UI can surface for news/standings/scorers.
// A league only renders in those panels once /api/football/leagues/active
// confirms it has a season currently in progress (see that route for the
// start/end date check) — this is what keeps the panels from showing
// competitions that haven't kicked off yet (e.g. EPL in July).
export const MAJOR_LEAGUES: LeagueMeta[] = [
  { id: TOP_LEAGUES.premierLeague, name: "Premier League", country: "England" },
  { id: TOP_LEAGUES.laLiga, name: "LaLiga", country: "Spain" },
  { id: TOP_LEAGUES.bundesliga, name: "Bundesliga", country: "Germany" },
  { id: TOP_LEAGUES.serieA, name: "Serie A", country: "Italy" },
  { id: TOP_LEAGUES.ligue1, name: "Ligue 1", country: "France" },
  { id: TOP_LEAGUES.championsLeague, name: "Champions League", country: "World" },
  { id: TOP_LEAGUES.eredivisie, name: "Eredivisie", country: "Netherlands" },
  { id: TOP_LEAGUES.primeiraLiga, name: "Primeira Liga", country: "Portugal" },
  { id: TOP_LEAGUES.championship, name: "Championship", country: "England" },
  { id: TOP_LEAGUES.mls, name: "MLS", country: "USA" },
  { id: TOP_LEAGUES.brasileirao, name: "Brasileirão", country: "Brazil" },
  { id: TOP_LEAGUES.ligaMx, name: "Liga MX", country: "Mexico" },
  { id: TOP_LEAGUES.saudiProLeague, name: "Saudi Pro League", country: "Saudi Arabia" },
];

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
