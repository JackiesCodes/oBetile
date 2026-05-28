"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PredictionItem } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

interface PredictionContextType {
  items: PredictionItem[];
  addBet: (item: PredictionItem) => void;
  removeBet: (matchId: string, market: string) => void;
  clearAll: () => void;
  hasBet: (matchId: string, market: string) => boolean;
}

const PredictionContext = createContext<PredictionContextType | undefined>(undefined);

function selectionToPick(selection: string, home: string): "home" | "draw" | "away" {
  if (selection === home) return "home";
  if (selection.toLowerCase() === "draw") return "draw";
  return "away";
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
          market: "Match Result",
          selection: row.pick === "home" ? row.home_team : row.pick === "away" ? row.away_team : "Draw",
          odds: row.confidence ? Math.round(100 / row.confidence) : 2,
        }));
        setItems(loaded);
      });
  }, [user]);

  // Clear picks when user logs out
  useEffect(() => {
    if (!user) setItems([]);
  }, [user]);

  const addBet = (item: PredictionItem) => {
    setItems((prev) => {
      const exists = prev.find((b) => b.matchId === item.matchId && b.market === item.market);
      if (exists) {
        return prev.map((b) => b.matchId === item.matchId && b.market === item.market ? item : b);
      }
      return [...prev, item];
    });

    if (user && hasSupabaseConfig()) {
      const supabase = createClient();
      const pick = selectionToPick(item.selection, item.home);
      const confidence = Math.round((1 / item.odds) * 100);
      // Upsert — if same fixture already exists, replace it
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
        .then(() => {});
    }
  };

  const removeBet = (matchId: string, market: string) => {
    setItems((prev) => prev.filter((b) => !(b.matchId === matchId && b.market === market)));

    if (user && hasSupabaseConfig()) {
      const supabase = createClient();
      supabase
        .from("user_picks")
        .delete()
        .eq("user_id", user.id)
        .eq("fixture_id", parseInt(matchId, 10))
        .then(() => {});
    }
  };

  const clearAll = () => {
    setItems([]);
    if (user && hasSupabaseConfig()) {
      const supabase = createClient();
      supabase.from("user_picks").delete().eq("user_id", user.id).then(() => {});
    }
  };

  const hasBet = (matchId: string, market: string) =>
    items.some((b) => b.matchId === matchId && b.market === market);

  return (
    <PredictionContext.Provider value={{ items, addBet, removeBet, clearAll, hasBet }}>
      {children}
    </PredictionContext.Provider>
  );
}

export function usePredictions() {
  const ctx = useContext(PredictionContext);
  if (!ctx) throw new Error("usePredictions must be used inside PredictionProvider");
  return ctx;
}
