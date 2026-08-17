/**
 * Run async work a few items at a time.
 *
 * Written for paging a whole day of odds out of the upstream. Doing that
 * strictly one page after another is what the old page cap was really
 * protecting against — not the request allowance, which had plenty of room,
 * but the wall clock: seventy-odd sequential round trips outlive the
 * function's time limit. Firing all seventy at once instead would be a burst
 * the upstream rejects.
 *
 * Order is preserved so a caller can match results back to inputs positionally.
 *
 * `gate`, when given, is awaited immediately before each task starts. Concurrency
 * alone bounds how many calls are in flight, not how fast they are issued, which
 * is a different limit and the one the upstream actually enforces — see
 * rateLimiter below.
 */
export async function inBatches<T>(
  tasks: (() => Promise<T>)[],
  size: number,
  gate?: () => Promise<void>
): Promise<T[]> {
  if (size < 1) throw new Error("batch size must be at least 1");
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    out.push(
      ...(await Promise.all(
        tasks.slice(i, i + size).map(async (task) => {
          if (gate) await gate();
          return task();
        })
      ))
    );
  }
  return out;
}

/**
 * Issue start slots no faster than a fixed rate.
 *
 * Small concurrency was mistaken for a rate limit and it is not one. Three calls
 * in flight against an upstream answering in ~170ms is roughly eighteen requests
 * a second; the subscription allows five. The first full cron run made ~235 calls
 * in 13 seconds and the provider rejected 72 of them, losing a third of the team
 * statistics for the day.
 *
 * Slots are handed out on a running clock rather than by sleeping between
 * batches, so the spacing holds no matter how many callers await the same gate
 * or how long any individual call takes.
 */
export function rateLimiter(perSecond: number): () => Promise<void> {
  const spacing = perSecond > 0 ? 1000 / perSecond : 0;
  let next = 0;
  return async () => {
    if (spacing <= 0) return;
    const now = Date.now();
    // A slot in the past means the limiter has been idle; start from now rather
    // than letting an old timestamp bank up a burst.
    const slot = Math.max(now, next);
    next = slot + spacing;
    const wait = slot - now;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  };
}

/**
 * Wrap a task so a failure yields null instead of rejecting the batch.
 *
 * One bad page must not lose the pages that succeeded: a partial map still
 * fills most of the list, and the fixtures it misses fall through to the model
 * exactly as an unpriced fixture already does.
 */
export function orNull<T>(task: () => Promise<T>): () => Promise<T | null> {
  return () => task().then((value) => value).catch(() => null);
}

export type Settled<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/**
 * Like orNull, but keeps why it failed.
 *
 * Isolating a failure and discarding its cause are different things, and the
 * first version of the odds sweep conflated them: a live run came back with 43
 * of 72 pages and the logs said nothing at all, so the cause had to be guessed
 * at from the outside. Keeping the message costs nothing and turns "some pages
 * are missing" into a specific, checkable claim.
 */
export function settle<T>(task: () => Promise<T>): () => Promise<Settled<T>> {
  return () =>
    task()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({
        ok: false as const,
        reason: e instanceof Error ? e.message : String(e),
      }));
}
