/**
 * What a fixture's status code means, and whether it belongs in the feed.
 *
 * The classification used to be two sets and an else: anything not live and not
 * finished became "upcoming". That quietly swept up CANC, PST and ABD, so a
 * cancelled match rendered as a perfectly normal upcoming fixture with
 * pickable percentages — and it would never settle, because it is never going
 * to be played. Naming those states is the fix; filtering them out is the
 * point.
 */

export type MatchState = "live" | "upcoming" | "finished" | "postponed" | "cancelled";

/** In play, including the breaks and stoppages that are still part of a match. */
export const LIVE_STATUSES = new Set(["1H", "2H", "ET", "P", "HT", "BT", "LIVE"]);

/**
 * Played to a conclusion. AWD and WO are decided off the pitch — a technical
 * loss and a walkover — but they have a winner, so they settle like any result.
 */
export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

/** Will be played, but not when the calendar currently says. */
export const POSTPONED_STATUSES = new Set(["PST", "SUSP", "INT"]);

/** Will not be played at all, or was stopped and voided. */
export const CANCELLED_STATUSES = new Set(["CANC", "ABD"]);

/**
 * TBD is deliberately absent from all of these.
 *
 * "Time to be defined" is a real forthcoming fixture whose kick-off has not been
 * confirmed, so it stays upcoming and stays in the list.
 */
export function classifyStatus(short: string | null | undefined): MatchState {
  const code = (short ?? "").toUpperCase();
  if (LIVE_STATUSES.has(code)) return "live";
  if (FINISHED_STATUSES.has(code)) return "finished";
  if (POSTPONED_STATUSES.has(code)) return "postponed";
  if (CANCELLED_STATUSES.has(code)) return "cancelled";
  return "upcoming";
}

/**
 * Whether a fixture belongs in a match list.
 *
 * Only what can still be predicted: matches to come, and matches under way.
 * A finished match is a result rather than a fixture; a cancelled or postponed
 * one is not happening on this date at all. None of the three can be picked, so
 * listing them fills the feed with rows whose only purpose is to be refused.
 *
 * This governs the lists, not the match page. A direct link still opens any
 * fixture — that is how a saved prediction is inspected afterwards, and where
 * the result, player ratings and head-to-head live.
 */
export function isListable(status: MatchState): boolean {
  return status === "upcoming" || status === "live";
}

/** Why a fixture is not being listed, for anywhere that needs to say so. */
export function unlistableReason(status: MatchState): string | null {
  if (status === "finished") return "Match finished";
  if (status === "postponed") return "Postponed";
  if (status === "cancelled") return "Cancelled";
  return null;
}
