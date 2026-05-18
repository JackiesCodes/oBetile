"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { PredictionItem } from "@/types";

interface PredictionContextType {
  items: PredictionItem[];
  addBet: (item: PredictionItem) => void;
  removeBet: (matchId: string, market: string) => void;
  clearAll: () => void;
  hasBet: (matchId: string, market: string) => boolean;
  stake: number;
  setStake: (v: number) => void;
}

const PredictionContext = createContext<PredictionContextType | undefined>(undefined);

export function PredictionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PredictionItem[]>([]);
  const [stake, setStake] = useState<number>(0);

  const addBet = (item: PredictionItem) => {
    setItems((prev) => {
      const exists = prev.find(
        (b) => b.matchId === item.matchId && b.market === item.market
      );
      if (exists) {
        return prev.map((b) =>
          b.matchId === item.matchId && b.market === item.market ? item : b
        );
      }
      return [...prev, item];
    });
  };

  const removeBet = (matchId: string, market: string) => {
    setItems((prev) =>
      prev.filter((b) => !(b.matchId === matchId && b.market === market))
    );
  };

  const clearAll = () => setItems([]);

  const hasBet = (matchId: string, market: string) =>
    items.some((b) => b.matchId === matchId && b.market === market);

  return (
    <PredictionContext.Provider
      value={{ items, addBet, removeBet, clearAll, hasBet, stake, setStake }}
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
