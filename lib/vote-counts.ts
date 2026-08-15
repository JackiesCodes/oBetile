/**
 * Vote tallies as the community endpoint returns them: market -> selection ->
 * count.
 *
 * Kept out of the component so the shape check can be tested directly, which
 * matters because the failure it guards against is silent rather than loud.
 */
export type VoteCounts = Record<string, Record<string, number>>;

/**
 * Whether a payload really is a tally.
 *
 * An error body such as `{ error: "…" }` is an object too. Stored as counts it
 * made the total a string — `[].reduce` starting at 0 turns `0 + "…"` into
 * `"0…"` — which is truthy, so the `if (!total) return 0` guard let it through
 * and the division produced NaN. The panel then rendered percentages of
 * nothing rather than showing that the request had failed.
 */
export function isVoteCounts(value: unknown): value is VoteCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (market) =>
      market !== null &&
      typeof market === "object" &&
      !Array.isArray(market) &&
      Object.values(market as Record<string, unknown>).every(
        (n) => typeof n === "number" && Number.isFinite(n)
      )
  );
}

/** Total votes cast in one market. */
export function totalVotes(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

/** One selection's share of its market, as a whole percentage. */
export function votePercent(counts: Record<string, number>, key: string): number {
  const total = totalVotes(counts);
  if (total <= 0) return 0;
  return Math.round(((counts[key] ?? 0) / total) * 100);
}
