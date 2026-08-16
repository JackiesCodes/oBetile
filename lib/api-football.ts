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
  /** Endpoints like /odds return large result sets a page at a time. */
  paging: { current: number; total: number };
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

/**
 * How long any single upstream call may take.
 *
 * A network fetch has no timeout by default, so a stalled connection would sit
 * open until the platform killed the whole invocation. Ten seconds is far
 * beyond a healthy response and far inside the function ceiling.
 */
const UPSTREAM_TIMEOUT_MS = 10_000;

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

  // Tag the entry so a poisoned response can be dropped again below.
  const tag = `apifootball:${path}:${url.searchParams.toString()}`;

  /*
   * Every upstream call is bounded.
   *
   * Without this a hung connection holds a serverless invocation until the
   * platform kills it, and the caller waits the whole time for a response that
   * is never coming. It matters most where a route fans out: the odds sweep
   * makes dozens of calls in one request, so a single stalled page could spend
   * the entire function budget on its own and take the other seventy with it.
   *
   * Ten seconds is well beyond a healthy response and well inside the function
   * ceiling, so a slow call fails as a normal error the caller can handle
   * rather than as a timeout nobody sees.
   */
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": readKey() },
    next: { revalidate, tags: [tag] },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  }).catch((e: unknown) => {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new ApiFootballError(
      timedOut
        ? `API-Football did not respond within ${UPSTREAM_TIMEOUT_MS}ms (${path})`
        : `API-Football unreachable (${path}): ${e instanceof Error ? e.message : String(e)}`,
      "http"
    );
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

  try {
    assertNoApiError(json?.errors);
  } catch (e) {
    /*
     * The upstream reports failure inside an HTTP 200, which Next's Data Cache
     * has just stored as a perfectly good response. Left alone, a single
     * transient blip — one burst over the per-minute allowance — is replayed
     * for the whole revalidate window, so an hour-cached endpoint stays broken
     * for an hour while the request never reaches API-Football again.
     *
     * Dropping the tag evicts that entry so the next caller retries.
     */
    // Imported lazily: this module is also pulled into client components via
    // normalizeFixture, and next/cache is server-only. This branch only ever
    // runs on the server, so the import is never reached in the browser.
    // expire: 0 — evict now rather than schedule a future refresh.
    const { revalidateTag } = await import("next/cache");
    revalidateTag(tag, { expire: 0 });
    throw e;
  }

  return {
    response: (json?.response ?? []) as T,
    resultCount: typeof json?.results === "number" ? json.results : 0,
    paging: {
      current: Number(json?.paging?.current) || 1,
      total: Number(json?.paging?.total) || 1,
    },
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

/**
 * How a competition labels its seasons in API-Football.
 *
 * - `split-year`: runs Aug–May and is labelled by its *start* year, so the
 *   2026/27 Premier League season is `"2026"` right through to May 2027.
 * - `calendar-year`: runs within one year and is labelled by it, so MLS in
 *   Feb 2027 is `"2027"` while the Premier League is still `"2026"`.
 *
 * That divergence is why a single global season constant cannot be correct for
 * every competition at once — see resolveSeason below.
 */
export type SeasonCalendar = "split-year" | "calendar-year";

/** Date-derived season label. No network call — used as the fallback. */
export function seasonFromDate(
  calendar: SeasonCalendar = "split-year",
  now: Date = new Date()
): string {
  const year = now.getUTCFullYear();
  if (calendar === "calendar-year") return String(year);
  // Split-year seasons roll over in the summer: from July onwards we are in the
  // season labelled with the current year, before that still the previous one.
  return String(now.getUTCMonth() >= 6 ? year : year - 1);
}

/**
 * Default season for split-year competitions, derived from today's date rather
 * than hardcoded so it stops going stale every August.
 *
 * Evaluated when the module loads, which is per server boot / serverless cold
 * start — fine for a value that changes once a year. Prefer `resolveSeason()`
 * anywhere the competition is known; this is only the fallback.
 */
export const CURRENT_SEASON = seasonFromDate("split-year");

/**
 * Shared TTL for /leagues metadata. resolveSeason and the leagues/active route
 * fetch the same URL with this same value so they land on one Next fetch-cache
 * entry instead of each spending a request — season data changes about twice a
 * year, and the free plan only allows 100 requests/day.
 */
export const LEAGUE_META_TTL = 3600;

export interface APILeagueSeason {
  year: number;
  start: string;
  end: string;
  current: boolean;
}

export interface APILeagueInfo {
  league: { id: number; name: string; logo: string };
  country: { name: string; flag: string | null };
  seasons: APILeagueSeason[];
}

/**
 * Every league with a season currently in progress, in a single request.
 *
 * Deliberately one call rather than one per league. Asking about each of the
 * thirteen major leagues individually put thirteen requests inside the same
 * minute, which the account's burst allowance rejects — the observed ceiling is
 * far below the 300/min the status headers advertise, and a single visitor was
 * enough to trigger it. One call, shared by resolveSeason and the active-leagues
 * route through the same cache entry, removes the burst entirely.
 */
export async function fetchCurrentLeagues(): Promise<APILeagueInfo[]> {
  return apiFetch<APILeagueInfo[]>("/leagues", { current: "true" }, LEAGUE_META_TTL);
}

/** The season currently in progress, if today falls inside one. */
export function inProgressSeason(
  seasons: APILeagueSeason[],
  now: Date = new Date()
): APILeagueSeason | undefined {
  return seasons.find(
    (s) => s.current && now >= new Date(s.start) && now <= new Date(s.end)
  );
}

/**
 * Authoritative season for a league: asks API-Football which season is actually
 * running rather than guessing from the calendar, so split-year and
 * calendar-year competitions both come out right.
 *
 * Falls back to the date heuristic when the league is between seasons or the
 * lookup fails, so callers always get a usable value.
 */
export async function resolveSeason(leagueId: number | string): Promise<string> {
  const id = Number(leagueId);
  const calendar =
    MAJOR_LEAGUES.find((l) => l.id === id)?.calendar ?? "split-year";

  try {
    // Reuses the one shared /leagues call rather than asking per league, so a
    // page resolving several competitions still costs a single request.
    const leagues = await fetchCurrentLeagues();
    const seasons = leagues.find((l) => l.league?.id === id)?.seasons ?? [];
    // Prefer the season actually in progress; on an off-season break fall back
    // to whichever season the API still flags as current.
    const season =
      inProgressSeason(seasons) ??
      [...seasons].reverse().find((s) => s.current);
    if (season) return String(season.year);
  } catch {
    // Credential and quota problems surface on the caller's own data request;
    // season resolution just degrades to the heuristic rather than failing.
  }

  return seasonFromDate(calendar);
}

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
  /** Season-labelling convention, used only when API lookup is unavailable. */
  calendar: SeasonCalendar;
}

// Canonical list of leagues the UI can surface for news/standings/scorers.
// A league only renders in those panels once /api/football/leagues/active
// confirms it has a season currently in progress (see that route for the
// start/end date check) — this is what keeps the panels from showing
// competitions that haven't kicked off yet (e.g. EPL in July).
export const MAJOR_LEAGUES: LeagueMeta[] = [
  { id: TOP_LEAGUES.premierLeague, name: "Premier League", country: "England", calendar: "split-year" },
  { id: TOP_LEAGUES.laLiga, name: "LaLiga", country: "Spain", calendar: "split-year" },
  { id: TOP_LEAGUES.bundesliga, name: "Bundesliga", country: "Germany", calendar: "split-year" },
  { id: TOP_LEAGUES.serieA, name: "Serie A", country: "Italy", calendar: "split-year" },
  { id: TOP_LEAGUES.ligue1, name: "Ligue 1", country: "France", calendar: "split-year" },
  { id: TOP_LEAGUES.championsLeague, name: "Champions League", country: "World", calendar: "split-year" },
  { id: TOP_LEAGUES.eredivisie, name: "Eredivisie", country: "Netherlands", calendar: "split-year" },
  { id: TOP_LEAGUES.primeiraLiga, name: "Primeira Liga", country: "Portugal", calendar: "split-year" },
  { id: TOP_LEAGUES.championship, name: "Championship", country: "England", calendar: "split-year" },
  // The Americas run inside a single calendar year, so from January they are a
  // season ahead of the European leagues.
  { id: TOP_LEAGUES.mls, name: "MLS", country: "USA", calendar: "calendar-year" },
  { id: TOP_LEAGUES.brasileirao, name: "Brasileirão", country: "Brazil", calendar: "calendar-year" },
  { id: TOP_LEAGUES.ligaMx, name: "Liga MX", country: "Mexico", calendar: "calendar-year" },
  { id: TOP_LEAGUES.saudiProLeague, name: "Saudi Pro League", country: "Saudi Arabia", calendar: "split-year" },
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
    kickoff: f.fixture.date,
    odds: { home: null, draw: null, away: null },
  };
}
