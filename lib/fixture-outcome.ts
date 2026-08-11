import type { APIFixture } from "@/types";

export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
export const LIVE_STATUSES = new Set(["1H", "2H", "ET", "P", "HT", "BT", "SUSP", "INT"]);

export type Outcome = "home" | "draw" | "away" | null;

/**
 * Who won a finished fixture.
 *
 * The API's winner flags are preferred over the score because a tie decided on
 * penalties has level goals but a real winner — comparing goals alone would
 * record it as a draw and mark a correct pick wrong.
 */
export function outcomeOf(f: APIFixture): Outcome {
  if (!FINISHED_STATUSES.has(f.fixture?.status?.short ?? "")) return null;

  if (f.teams?.home?.winner === true) return "home";
  if (f.teams?.away?.winner === true) return "away";
  // Exactly one side flagged as a loser still identifies the winner.
  if (f.teams?.home?.winner === false) return "away";
  if (f.teams?.away?.winner === false) return "home";

  const home = f.goals?.home;
  const away = f.goals?.away;
  if (home === null || away === null || home === undefined || away === undefined) return null;

  return home > away ? "home" : home < away ? "away" : "draw";
}
