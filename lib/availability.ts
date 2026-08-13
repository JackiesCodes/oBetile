/**
 * Turning the provider's injury list into the count the model consumes.
 *
 * Kept out of the route so the same reduction runs in the backtest, and so it
 * can be tested without a network call.
 */

/**
 * One row of /injuries: a single player unavailable for a single fixture.
 *
 * Every field is optional here on purpose. This shape follows the provider's
 * documentation rather than a response captured from the live API, so the
 * reducer below treats anything missing as "not counted" instead of assuming
 * it is present.
 */
export interface APIInjuryRow {
  player?: { id?: number; name?: string; type?: string | null; reason?: string | null };
  team?: { id?: number; name?: string };
  fixture?: { id?: number } | null;
}

/** Players out for each side of a fixture, keyed by fixture id. */
export type UnavailableByFixture = Record<string, { home?: number; away?: number; teams: Record<string, number> }>;

/**
 * Count distinct unavailable players per fixture and team.
 *
 * Rows without a fixture or team are dropped rather than guessed at, and the
 * same player appearing twice for one fixture is counted once — the provider
 * sometimes lists a player under more than one reason.
 */
export function countUnavailable(rows: APIInjuryRow[]): UnavailableByFixture {
  const seen = new Map<string, Set<string>>();

  for (const row of rows ?? []) {
    const fixtureId = row?.fixture?.id;
    const teamId = row?.team?.id;
    if (!fixtureId || !teamId) continue;

    const key = `${fixtureId}:${teamId}`;
    if (!seen.has(key)) seen.set(key, new Set());
    // Fall back to the name when the id is absent, so an unidentified player
    // still counts once rather than not at all.
    seen.get(key)!.add(String(row.player?.id ?? row.player?.name ?? Math.random()));
  }

  const out: UnavailableByFixture = {};
  for (const [key, players] of seen) {
    const [fixtureId, teamId] = key.split(":");
    if (!out[fixtureId]) out[fixtureId] = { teams: {} };
    out[fixtureId].teams[teamId] = players.size;
  }
  return out;
}

/**
 * The two counts for a fixture, in the order the model wants them.
 *
 * Returns null when neither side has an entry, which the model reads as "not
 * known" rather than "nobody out".
 */
export function availabilityFor(
  byFixture: UnavailableByFixture,
  fixtureId: number | string,
  homeTeamId: number,
  awayTeamId: number
): { home: { out: number }; away: { out: number } } | null {
  const entry = byFixture[String(fixtureId)];
  if (!entry) return null;
  const home = entry.teams[String(homeTeamId)] ?? 0;
  const away = entry.teams[String(awayTeamId)] ?? 0;
  if (home === 0 && away === 0) return null;
  return { home: { out: home }, away: { out: away } };
}
