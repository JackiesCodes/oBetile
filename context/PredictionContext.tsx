"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PredictionItem } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

interface PredictionContextType {
  items: PredictionItem[];
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

export function PredictionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PredictionItem[]>([]);
  const { user } = useAuth();

  // Load picks from Supabase when user logs in
  useEffect(() => {
    if (!user || !hasSupabaseConfig()) return;
    const supabase = createClient();
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("user_picks")
      .select("fixture_id, home_team, away_team, pick, confidence")
      .eq("user_id", user.id)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const loaded: PredictionItem[] = data.map((row) => ({
          matchId: String(row.fixture_id),
          home: row.home_team,
          away: row.away_team,
          market: marketKeyFor(row.pick),
          selection: row.pick === "home" ? row.home_team : row.pick === "away" ? row.away_team : "Draw",
          odds: oddsFromConfidence(row.confidence),
        }));
        setItems(loaded);
      });
  }, [user]);

  // Clear picks when user logs out
  useEffect(() => {
    if (!user) setItems([]);
  }, [user]);

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

  const clearAll = () => {
    setItems([]);
    if (user && hasSupabaseConfig()) {
      const supabase = createClient();
      supabase.from("user_picks").delete().eq("user_id", user.id).then(({ error }) => {
        if (error) console.error("Clearing picks failed", error.message);
      });
    }
  };

  const hasPrediction = (matchId: string, market: string) =>
    items.some((b) => b.matchId === matchId && b.market === market);

  return (
    <PredictionContext.Provider value={{ items, addPrediction, removePrediction, clearAll, hasPrediction }}>
      {children}
    </PredictionContext.Provider>
  );
}

export function usePredictions() {
  const ctx = useContext(PredictionContext);
  if (!ctx) throw new Error("usePredictions must be used inside PredictionProvider");
  return ctx;
}
