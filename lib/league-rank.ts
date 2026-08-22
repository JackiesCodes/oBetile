/**
 * The order competitions appear in the feed.
 *
 * A typical day carries fixtures from close to three hundred competitions, and
 * the provider returns them in no useful order at all — so without this a
 * Champions League tie sits below a regional Australian state league because
 * that is how the response happened to arrive.
 *
 * Ranked by league ID, never by name. "Premier League" is the name of the top
 * division in England, Wales, Belarus, Egypt, Russia, Armenia, Kazakhstan,
 * Malta, Hong Kong, Lesotho and Bhutan; matching on the string would sort them
 * together. Every id below was taken either from TOP_LEAGUES or from a real
 * day of fixtures rather than recalled.
 *
 * This is an editorial judgement, and it is in one list so it can be argued
 * with and changed in one place.
 */

/**
 * Competitions in the order they should appear, best first.
 *
 * The first eight are the elite tier — the European continental competition and
 * the five domestic leagues that feed it, plus the two next-strongest European
 * leagues. After that, second-tier and strong non-European leagues.
 */
export const RANKED_LEAGUE_IDS: number[] = [
  // The top eight.
  2, // Champions League
  39, // Premier League (England)
  140, // La Liga (Spain)
  135, // Serie A (Italy)
  78, // Bundesliga (Germany)
  61, // Ligue 1 (France)
  88, // Eredivisie (Netherlands)
  94, // Primeira Liga (Portugal)

  // Strong domestic leagues and the major non-European competitions.
  40, // Championship (England)
  203, // Süper Lig (Turkey)
  144, // Jupiler Pro League (Belgium)
  71, // Serie A (Brazil)
  128, // Liga Profesional (Argentina)
  253, // Major League Soccer (USA)
  262, // Liga MX (Mexico)
  180, // Championship (Scotland)
  218, // Bundesliga (Austria)
  345, // Czech Liga
  235, // Premier League (Russia)
  307, // Pro League (Saudi Arabia)

  // Second divisions of ranked leagues, and the next tier of top flights.
  136, // Serie B (Italy)
  72, // Serie B (Brazil)
  145, // Challenger Pro League (Belgium)
  286, // Super Liga (Serbia)
  332, // Super Liga (Slovakia)
  301, // Pro League (UAE)
  233, // Premier League (Egypt)
  255, // USL Championship (USA)
  479, // Canadian Premier League
];

/** How many of the above count as the elite tier. */
export const TOP_TIER_COUNT = 8;

const RANK_BY_ID = new Map(RANKED_LEAGUE_IDS.map((id, i) => [id, i]));

/**
 * Competitions below the senior game, whatever country they are in.
 *
 * Age-grade and reserve football is a fact about the competition rather than a
 * judgement about it: an under-19 fixture is not the senior match somebody
 * opened the app to look for. Deliberately nothing here keys on women's
 * football — a senior women's competition sorts with every other unranked
 * senior league, and belongs in the list above if it should rank higher.
 */
const BELOW_SENIOR = /\b(u1[5-9]|u2[0-3]|under[- ]?\d{2}|youth|reserves?|next pro|academy|primavera|juvenil|development)\b/i;

/** Sorted after everything explicitly ranked, before age-grade football. */
const UNRANKED = 1_000;
const AGE_GRADE = 2_000;

/**
 * Where a competition sits in the feed. Lower is higher up.
 *
 * Takes the name only to spot age-grade competitions, never to identify which
 * competition it is — that is the id's job.
 */
export function leagueRank(leagueId: number | undefined, name: string | undefined): number {
  if (leagueId !== undefined) {
    const explicit = RANK_BY_ID.get(leagueId);
    if (explicit !== undefined) return explicit;
  }
  if (name && BELOW_SENIOR.test(name)) return AGE_GRADE;
  return UNRANKED;
}

/** Whether this competition is in the elite tier the feed leads with. */
export function isTopTier(leagueId: number | undefined): boolean {
  if (leagueId === undefined) return false;
  const rank = RANK_BY_ID.get(leagueId);
  return rank !== undefined && rank < TOP_TIER_COUNT;
}

/**
 * Compare two competitions for feed order.
 *
 * Rank first, then country, then name — so everything past the ranked list has
 * a stable order of its own rather than shifting between loads as the provider
 * returns fixtures in a different sequence.
 */
export function compareLeagues(
  a: { leagueId?: number; league: string; country?: string },
  b: { leagueId?: number; league: string; country?: string }
): number {
  const byRank = leagueRank(a.leagueId, a.league) - leagueRank(b.leagueId, b.league);
  if (byRank !== 0) return byRank;
  const byCountry = (a.country ?? "").localeCompare(b.country ?? "");
  if (byCountry !== 0) return byCountry;
  return a.league.localeCompare(b.league);
}
