/**
 * How much of a side is actually missing for a fixture.
 *
 * The first attempt at this counted absences and was rejected on measurement —
 * see docs/model-experiments.md. A bare count scored a squad missing eight
 * fringe players the same as one missing its first-choice striker, and the
 * backtest said so across three leagues.
 *
 * This weights each absence by how much that player normally plays, so an
 * ever-present is worth many times a squad filler.
 */

/** One row of /injuries: a single player unavailable for a single fixture. */
export interface APIInjuryRow {
  player?: { id?: number; name?: string };
  team?: { id?: number };
  fixture?: { id?: number } | null;
}

/** Who is missing, as player ids, keyed by fixture then team. */
export type MissingByFixture = Record<string, Record<string, number[]>>;

/** Minutes each player has on the season, keyed by player id. */
export type MinutesByPlayer = Record<string, number>;

/**
 * Group injury rows into player ids per fixture and team.
 *
 * Rows without a fixture, team or identifiable player are dropped rather than
 * guessed at, and a player listed twice for one fixture counts once — the
 * provider sometimes repeats a player under more than one reason.
 */
export function missingPlayers(rows: APIInjuryRow[]): MissingByFixture {
  const seen = new Map<string, Set<number>>();

  for (const row of rows ?? []) {
    const fixtureId = row?.fixture?.id;
    const teamId = row?.team?.id;
    const playerId = row?.player?.id;
    if (!fixtureId || !teamId || !playerId) continue;

    const key = `${fixtureId}:${teamId}`;
    if (!seen.has(key)) seen.set(key, new Set());
    seen.get(key)!.add(playerId);
  }

  const out: MissingByFixture = {};
  for (const [key, players] of seen) {
    const [fixtureId, teamId] = key.split(":");
    if (!out[fixtureId]) out[fixtureId] = {};
    out[fixtureId][teamId] = [...players];
  }
  return out;
}

/**
 * A full league season of minutes for one team's regular starter.
 *
 * Used to turn a player's minutes into a 0-to-1 importance. Any player at or
 * above this is treated as a full-time starter; the exact figure matters little
 * because the result is clamped.
 */
const STARTER_SEASON_MINUTES = 2200;

/** Players on the pitch at once — the denominator for "how much of a side". */
const TEAM_SIZE = 11;

/**
 * How much of a starting eleven is missing, 0 to 1.
 *
 * Each absent player counts for the fraction of a regular starter's season he
 * plays, and the total is expressed as a share of eleven. A first-choice
 * striker missing is roughly 1/11; four regulars out is roughly a third of the
 * side.
 *
 * Returns null when nothing is known about the fixture, which the model reads
 * as "no information" rather than "everyone available".
 */
export function missingShare(
  playerIds: number[] | undefined,
  minutes: MinutesByPlayer
): number | null {
  if (!playerIds || playerIds.length === 0) return null;

  let weight = 0;
  for (const id of playerIds) {
    const played = minutes[String(id)];
    if (!Number.isFinite(played) || played <= 0) continue;
    weight += Math.min(1, played / STARTER_SEASON_MINUTES);
  }

  return Math.min(1, weight / TEAM_SIZE);
}

/** The two shares for a fixture, or null when neither side is known. */
export function availabilityFor(
  missing: MissingByFixture,
  minutes: MinutesByPlayer,
  fixtureId: number | string,
  homeTeamId: number,
  awayTeamId: number
): { home: number; away: number } | null {
  const entry = missing[String(fixtureId)];
  if (!entry) return null;

  const home = missingShare(entry[String(homeTeamId)], minutes) ?? 0;
  const away = missingShare(entry[String(awayTeamId)], minutes) ?? 0;
  if (home === 0 && away === 0) return null;
  return { home, away };
}
