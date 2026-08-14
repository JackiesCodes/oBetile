"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Load once, then keep fresh in the background.
 *
 * Every page that polled was doing the same three things wrong.
 *
 * A refresh flipped the same `loading` flag as the first load, and the pages
 * render the list as `{!loading && …}`. So every thirty seconds the whole list
 * unmounted and became a spinner — under your finger, mid-scroll, collapsing
 * the page height and throwing the scroll position away. Here `loading` is true
 * only while there is nothing to show yet; a refresh swaps the data in place
 * and the list never leaves the screen.
 *
 * A slow connection stacked requests on top of each other. On the 3G the app
 * actually sees, a day of fixtures takes far longer to arrive than the thirty
 * second interval, so the next poll started while the last was still in flight
 * and the two split the same tiny bandwidth — each making the other slower. A
 * poll is skipped while one is already running.
 *
 * A backgrounded tab polled forever, spending the visitor's data allowance on a
 * screen nobody is looking at.
 */
export function useLiveData(
  /** Receives `true` when this is a background refresh rather than a first load. */
  load: (background: boolean) => Promise<void>,
  /** Milliseconds between refreshes, or null to load once and stop. */
  intervalMs: number | null,
  /** Reloading from scratch — and showing the spinner again — when these change. */
  deps: unknown[]
): boolean {
  const [loading, setLoading] = useState(true);

  // Kept in a ref so callers can pass an inline closure without restarting the
  // poll on every render; `deps` alone decides when to start over.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    // Deliberately local rather than a ref: overlapping polls can only come
    // from this effect's own interval, and a ref would still read as busy
    // during Strict Mode's remount and leave the spinner up forever.
    let inFlight = false;

    setLoading(true);

    const run = async (background: boolean) => {
      if (cancelled || inFlight) return;
      if (background && typeof document !== "undefined" && document.hidden) return;
      inFlight = true;
      try {
        await loadRef.current(background);
      } catch {
        // A failed refresh leaves the last good data on screen, which is much
        // better than an empty list.
      } finally {
        inFlight = false;
        if (!cancelled && !background) setLoading(false);
      }
    };

    run(false);

    let interval: ReturnType<typeof setInterval> | null = null;
    if (intervalMs !== null) interval = setInterval(() => run(true), intervalMs);

    // A tab returning to the foreground has stale data and a visitor looking
    // straight at it, so catch up immediately rather than waiting out the
    // interval.
    const onVisible = () => {
      if (!document.hidden && intervalMs !== null) run(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return loading;
}
