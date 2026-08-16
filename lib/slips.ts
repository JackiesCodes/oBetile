/**
 * Prediction slips: several selections saved together as one call.
 *
 * The old model saved a pick the instant a percentage was tapped, one row per
 * fixture. That cannot express "these six selections are one prediction I am
 * making together", which is the thing worth sharing and the thing worth
 * scoring. Selections are now staged first and committed as a group.
 *
 * Kept free of React and Supabase so the maths can be tested directly.
 */

import { classifyStatus } from "@/lib/match-status";

export type Outcome = "home" | "draw" | "away";
export type PickResult = "correct" | "wrong" | "push";

/** A selection the visitor has made but not yet saved. */
export interface Selection {
  fixtureId: string;
  home: string;
  away: string;
  pick: Outcome;
  /** The percentage shown on the tile when it was picked. */
  confidence: number;
  kickoff?: string | null;
}

/**
 * How long after kick-off a fixture stops being predictable.
 *
 * Ninety minutes plus half-time, extra time and a shootout still lands well
 * inside three hours, so anything older than this is over whatever the cached
 * status claims.
 */
export const PICKABLE_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Whether a fixture can still be predicted.
 *
 * Two ways a match stops being a prediction. The obvious one is that it has
 * finished: the answer is printed on the page, so "predicting" it only records
 * a result, and the slip settles the instant it is saved — which is exactly the
 * bug that produced slips full of already-decided selections.
 *
 * The second is subtler and is what actually let it through: fixture lists are
 * cached, so a match can still be labelled upcoming hours after it kicked off.
 * The kick-off time is the fact that does not go stale, so it decides. A match
 * genuinely in play stays pickable — the result is still unknown — which is why
 * the window is a duration rather than "kick-off has passed".
 */
export function isPickable(
  match: { status?: string | null; kickoff?: string | null },
  now: Date = new Date()
): boolean {
  if (match.status === "finished") return false;
  if (match.kickoff) {
    const started = Date.parse(match.kickoff);
    if (Number.isFinite(started) && now.getTime() - started > PICKABLE_WINDOW_MS) return false;
  }
  return true;
}

/** A saved selection, which may since have been settled. */
export interface SavedPick extends Selection {
  result: PickResult | null;
}

export interface Slip {
  id: string;
  title: string;
  note: string | null;
  createdAt: string;
  sharedAt: string | null;
  picks: SavedPick[];
  /** Set when the slip was written by someone else. */
  authorName?: string | null;
}

/** The most selections one slip may hold. */
export const MAX_SELECTIONS = 20;

export const MAX_TITLE = 80;
export const MAX_NOTE = 280;

/** Which side of a fixture a selection label refers to. */
export function outcomeFor(selection: string, home: string, away: string): Outcome {
  if (selection === home) return "home";
  if (selection === away) return "away";
  return "draw";
}

/** The team name (or "Draw") a stored outcome refers to. */
export function labelFor(pick: Outcome, home: string, away: string): string {
  if (pick === "home") return home;
  if (pick === "away") return away;
  return "Draw";
}

/**
 * How likely all selections are to come in together, as a percentage.
 *
 * Selections are treated as independent, which is close enough for fixtures in
 * different matches and is what makes the number fall so steeply: six coin
 * flips at 60% is 4.7%, not 60%. Showing that is the honest counterweight to a
 * slip that looks stronger simply because it is longer.
 */
export function combinedConfidence(picks: { confidence: number }[]): number | null {
  if (picks.length === 0) return null;
  let p = 1;
  for (const pick of picks) {
    const c = Number.isFinite(pick.confidence) ? pick.confidence : 0;
    if (c <= 0) return null;
    p *= Math.min(100, c) / 100;
  }
  return p * 100;
}

/** How a combined figure should read: two decimals once it goes very small. */
export function formatConfidence(value: number | null): string {
  if (value === null) return "—";
  if (value >= 10) return `${Math.round(value)}%`;
  if (value >= 1) return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}%`;
}

/** Correct, wrong and still-to-play counts for a settled or part-settled slip. */
export function tally(picks: SavedPick[]) {
  let correct = 0;
  let wrong = 0;
  let pending = 0;
  for (const p of picks) {
    if (p.result === "correct") correct++;
    else if (p.result === "wrong") wrong++;
    else if (p.result === "push") continue;
    else pending++;
  }
  return { correct, wrong, pending, settled: correct + wrong, total: picks.length };
}

/**
 * How long a postponed fixture is given before its selection is voided.
 *
 * A postponement is usually rescheduled under the same fixture id, which sets
 * the date forward and the status back to not-started — so a rule based on the
 * kick-off having passed corrects itself as soon as that happens. This window
 * only catches the other case: postponed, never rearranged, and therefore never
 * going to settle under this id.
 */
export const VOID_AFTER_POSTPONED_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Whether a selection should be voided rather than left waiting.
 *
 * Found in production: a pick on Junior v Deportivo Pereira sat pending four
 * days after a postponement, and would have sat there permanently, because
 * settlement only ever acted on a fixture that finished with an outcome. A
 * match that is never played has no outcome to wait for.
 *
 * Voided selections are recorded as a push — the same treatment a void bet
 * gets — which tally() excludes from correct, wrong and pending alike. That
 * matters: a match nobody played must neither break a slip nor flatter it.
 *
 * Cancelled and abandoned are immediate; those are final. Postponed waits out
 * the window above, in case it is simply rearranged.
 */
export function voidedResult(
  fixture: { status?: string | null; kickoff?: string | null },
  now: Date = new Date()
): "push" | null {
  const state = classifyStatus(fixture.status);
  if (state === "cancelled") return "push";

  if (state === "postponed") {
    if (!fixture.kickoff) return null;
    const scheduled = Date.parse(fixture.kickoff);
    if (!Number.isFinite(scheduled)) return null;
    if (now.getTime() - scheduled > VOID_AFTER_POSTPONED_MS) return "push";
  }

  return null;
}

/**
 * A slip only "lands" if every selection in it is correct — the accumulator
 * rule, and the reason the combined percentage matters.
 */
export function slipOutcome(picks: SavedPick[]): "won" | "lost" | "pending" {
  const t = tally(picks);
  if (t.wrong > 0) return "lost";
  if (t.pending > 0) return "pending";
  return t.correct > 0 ? "won" : "pending";
}

/**
 * How a collection of slips is doing.
 *
 * "Alive" is the number still capable of landing — won plus anything with
 * selections left to play. A slip is dead the moment one selection is wrong,
 * because every selection has to come in.
 */
export function summariseSlips(slips: { picks: SavedPick[] }[]) {
  let won = 0;
  let lost = 0;
  let running = 0;
  for (const slip of slips) {
    const outcome = slipOutcome(slip.picks);
    if (outcome === "won") won++;
    else if (outcome === "lost") lost++;
    else running++;
  }
  return { won, lost, running, alive: won + running, total: slips.length };
}

/**
 * A default name, so saving never demands typing.
 *
 * Uses the count and the date rather than team names: a slip spanning six
 * fixtures has no single subject, and a title built from the first match would
 * misdescribe the rest.
 */
export function defaultTitle(count: number, now = new Date()): string {
  const when = now.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${count} prediction${count === 1 ? "" : "s"} · ${when}`;
}

/** Trim and bound anything a person typed before it reaches the database. */
export function cleanTitle(raw: string, count: number): string {
  const trimmed = raw.trim().slice(0, MAX_TITLE);
  return trimmed.length > 0 ? trimmed : defaultTitle(count);
}

export function cleanNote(raw: string): string | null {
  const trimmed = raw.trim().slice(0, MAX_NOTE);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Whether a selection can still be added.
 *
 * One selection per fixture: two outcomes for the same match cannot both be
 * right, so allowing it would produce a slip that can never land.
 */
export function canAdd(staged: Selection[], fixtureId: string): boolean {
  if (staged.length >= MAX_SELECTIONS) return false;
  return !staged.some((s) => s.fixtureId === fixtureId);
}

/**
 * Add a selection, replacing any existing one on the same fixture.
 *
 * Tapping a different outcome on a match already in the slip is a change of
 * mind, not a second selection.
 */
export function withSelection(staged: Selection[], next: Selection): Selection[] {
  const without = staged.filter((s) => s.fixtureId !== next.fixtureId);
  if (without.length >= MAX_SELECTIONS) return staged;
  return [...without, next];
}

export function withoutFixture(staged: Selection[], fixtureId: string): Selection[] {
  return staged.filter((s) => s.fixtureId !== fixtureId);
}
