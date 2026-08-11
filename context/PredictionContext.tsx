"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { PredictionItem } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { FixtureResult } from "@/app/api/football/results/route";

/** A pick whose match has finished, with how it turned out. */
export interface SettledPick extends PredictionItem {
  goals: { home: number | null; away: number | null };
  outcome: "home" | "draw" | "away";
  correct: boolean;
  kickoff: string;
}

interface PredictionContextType {
  /** Picks on matches that have not finished — upcoming or in play. */
  items: PredictionItem[];
  /** Picks on matches that have finished, newest first. */
  history: SettledPick[];
  historyLoading: boolean;
  addPrediction: (item: PredictionItem) => void;
  removePrediction: (matchId: string, market: string) => void;
  clearAll: () => void;
  hasPrediction: (matchId: string, market: string) => boolean;
}

const PredictionContext = createContext<PredictionContextType | undefined>(undefined);

function selectionToPick(selection: string, home: string): "home" | "draw" | "away" {
  if (selection === home) return "home";
  if (selection.toLowerCase() === "draw") return "draw";
  return "away";
}

/**
 * The market key OddsButton uses to decide whether it is selected.
 *
 * Reloaded picks have to rebuild exactly this string. They previously came back
 * labelled "Match Result", which matches nothing, so a saved pick was invisible
 * to the button and every tile looked unselected after a refresh.
 */
function marketKeyFor(pick: "home" | "draw" | "away") {
  return `1x2-${pick}`;
}

/**
 * Confidence is stored as a whole percentage, so it cannot round-trip through
 * Math.round twice without drifting: an 83% pick came back as odds 1 and
 * displayed as 100%. Dividing without rounding returns the same percentage the
 * user originally saw.
 */
function oddsFromConfidence(confidence: number | null): number {
  if (!confidence || confidence < 1) return 2;
  return 100 / confidence;
}

interface PickRow {
  fixture_id: number;
  home_team: string;
  away_team: string;
  pick: "home" | "draw" | "away";
  confidence: number | null;
  result: string | null;
}

export function PredictionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PredictionItem[]>([]);
  const [history, setHistory] = useState<SettledPick[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { user } = useAuth();

  const rowToItem = (row: PickRow): PredictionItem => ({
    matchId: String(row.fixture_id),
    home: row.home_team,
    away: row.away_team,
    market: marketKeyFor(row.pick),
    selection: row.pick === "home" ? row.home_team : row.pick === "away" ? row.away_team : "Draw",
    odds: oddsFromConfidence(row.confidence),
  });

  /**
   * Load every saved pick, then ask which of those fixtures have finished and
   * split on the answer. A pick belongs in exactly one place: still to play, or
   * settled with a result. Doing this in the provider rather than in each panel
   * keeps one source of truth and one round of requests.
   */
  const loadPicks = useCallback(async () => {
    if (!user || !hasSupabaseConfig()) {
      setItems([]);
      setHistory([]);
      return;
    }

    setHistoryLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_picks")
      .select("fixture_id, home_team, away_team, pick, confidence, result")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) {
      if (error) console.error("Loading picks failed", error.message);
      setHistoryLoading(false);
      return;
    }

    const rows = data as PickRow[];
    if (rows.length === 0) {
      setItems([]);
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    let results: Record<string, FixtureResult> = {};
    try {
      const ids = rows.map((r) => r.fixture_id).join(",");
      const res = await fetch(`/api/football/results?ids=${ids}`);
      if (res.ok) results = await res.json();
    } catch {
      // Leave results empty; everything then stays under active picks rather
      // than being wrongly filed as history on a transient network failure.
    }

    const active: PredictionItem[] = [];
    const settled: SettledPick[] = [];

    for (const row of rows) {
      const info = results[String(row.fixture_id)];
      const item = rowToItem(row);

      if (info?.finished && info.outcome) {
        settled.push({
          ...item,
          goals: info.goals,
          outcome: info.outcome,
          correct: info.outcome === row.pick,
          kickoff: info.kickoff,
        });
      } else {
        active.push(item);
      }
    }

    settled.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
    setItems(active);
    setHistory(settled);
    setHistoryLoading(false);

    // Record how settled picks turned out. Only writes rows whose stored result
    // is missing or now disagrees, so a reload is not a hundred pointless
    // updates.
    const needsWrite = settled.filter((s) => {
      const row = rows.find((r) => String(r.fixture_id) === s.matchId);
      const verdict = s.correct ? "correct" : "wrong";
      return row && row.result !== verdict;
    });

    for (const s of needsWrite) {
      const { error: writeError } = await supabase
        .from("user_picks")
        .update({ result: s.correct ? "correct" : "wrong" })
        .eq("user_id", user.id)
        .eq("fixture_id", parseInt(s.matchId, 10));
      if (writeError) console.error("Recording pick result failed", writeError.message);
    }
  }, [user]);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  const addPrediction = (item: PredictionItem) => {
    // One pick per fixture. Home, draw and away are mutually exclusive, and
    // user_picks is unique on (user_id, fixture_id) — so keying local state by
    // fixture *and* market let the UI show two outcomes selected on the same
    // match while the database kept only the last one.
    setItems((prev) => [...prev.filter((b) => b.matchId !== item.matchId), item]);

    if (user && hasSupabaseConfig()) {
      const supabase = createClient();
      const pick = selectionToPick(item.selection, item.home);
      // Clamped: the column is constrained to 0-100, and a stored 0 would make
      // the reload divide by zero.
      const confidence = Math.min(100, Math.max(1, Math.round((1 / item.odds) * 100)));
      supabase
        .from("user_picks")
        .upsert({
          user_id: user.id,
          fixture_id: parseInt(item.matchId, 10),
          home_team: item.home,
          away_team: item.away,
          pick,
          confidence,
          // A re-pick on a fixture starts undecided again.
          result: null,
        }, { onConflict: "user_id,fixture_id" })
        .then(({ error }) => {
          // Was swallowed entirely, so a pick that failed to save looked
          // identical to one that saved — until the next reload lost it.
          if (error) console.error("Saving pick failed", error.message);
        });
    }
  };

  const removePrediction = (matchId: string, _market: string) => {
    // Matched on fixture alone, mirroring the delete below and the one-pick-per
    // -fixture rule. Filtering on the market string too would silently fail
    // whenever the stored key and the caller's key disagreed.
    setItems((prev) => prev.filter((b) => b.matchId !== matchId));

    if (user && hasSupabaseConfig()) {
      const supabase = createClient();
      supabase
        .from("user_picks")
        .delete()
        .eq("user_id", user.id)
        .eq("fixture_id", parseInt(matchId, 10))
        .then(({ error }) => {
          if (error) console.error("Removing pick failed", error.message);
        });
    }
  };

  /** Clears the picks still to play. Settled history is deliberately kept. */
  const clearAll = () => {
    const activeIds = items.map((i) => parseInt(i.matchId, 10)).filter(Number.isInteger);
    setItems([]);

    if (user && hasSupabaseConfig() && activeIds.length > 0) {
      const supabase = createClient();
      supabase
        .from("user_picks")
        .delete()
        .eq("user_id", user.id)
        .in("fixture_id", activeIds)
        .then(({ error }) => {
          if (error) console.error("Clearing picks failed", error.message);
        });
    }
  };

  const hasPrediction = (matchId: string, market: string) =>
    items.some((b) => b.matchId === matchId && b.market === market);

  return (
    <PredictionContext.Provider
      value={{ items, history, historyLoading, addPrediction, removePrediction, clearAll, hasPrediction }}
    >
      {children}
    </PredictionContext.Provider>
  );
}

export function usePredictions() {
  const ctx = useContext(PredictionContext);
  if (!ctx) throw new Error("usePredictions must be used inside PredictionProvider");
  return ctx;
}
