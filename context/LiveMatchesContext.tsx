"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { APIFixture, Match } from "@/types";
import { normalizeFixture } from "@/lib/api-football";
import { useLiveData } from "@/lib/use-live-data";

/**
 * The live fixture list, fetched once for the whole app.
 *
 * Three separate components were each polling /api/football/live every thirty
 * seconds — the header badge, the notifications panel and the feed — so a
 * phone made three requests for one answer, on a connection where one was
 * already slow. They also drifted: the header could show a count that did not
 * match the list the panel was showing, because each had fetched at a
 * different moment.
 *
 * One poll, one answer, shared. Polling stops while the tab is hidden and
 * requests never stack, both inherited from useLiveData.
 */

interface LiveMatchesValue {
  matches: Match[];
  count: number;
  loading: boolean;
}

const LiveMatchesContext = createContext<LiveMatchesValue | undefined>(undefined);

const REFRESH_MS = 30_000;

export function LiveMatchesProvider({ children }: { children: ReactNode }) {
  const [matches, setMatches] = useState<Match[]>([]);

  const loading = useLiveData(
    async () => {
      const data = await fetch("/api/football/live")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      setMatches((Array.isArray(data) ? (data as APIFixture[]) : []).map(normalizeFixture));
    },
    REFRESH_MS,
    []
  );

  const value = useMemo(
    () => ({ matches, count: matches.length, loading }),
    [matches, loading]
  );

  return <LiveMatchesContext.Provider value={value}>{children}</LiveMatchesContext.Provider>;
}

export function useLiveMatches() {
  const ctx = useContext(LiveMatchesContext);
  if (!ctx) throw new Error("useLiveMatches must be used within a LiveMatchesProvider");
  return ctx;
}
