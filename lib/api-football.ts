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
export const CURRENT_SEASON = "2024";

// Top 5 European league IDs
export const TOP_LEAGUES = {
  premierLeague: 39,
  laLiga: 140,
  bundesliga: 78,
  serieA: 135,
  ligue1: 61,
  championsLeague: 2,
};
