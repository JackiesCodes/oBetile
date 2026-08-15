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
 */
export async function inBatches<T>(
  tasks: (() => Promise<T>)[],
  size: number
): Promise<T[]> {
  if (size < 1) throw new Error("batch size must be at least 1");
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    out.push(...(await Promise.all(tasks.slice(i, i + size).map((task) => task()))));
  }
  return out;
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
