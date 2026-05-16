"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { BetSlipItem } from "@/types";

interface BetSlipContextType {
  items: BetSlipItem[];
  addBet: (item: BetSlipItem) => void;
  removeBet: (matchId: string, market: string) => void;
  clearSlip: () => void;
  hasBet: (matchId: string, market: string) => boolean;
  stake: number;
  setStake: (v: number) => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BetSlipItem[]>([]);
  const [stake, setStake] = useState<number>(0);

  const addBet = (item: BetSlipItem) => {
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

  const clearSlip = () => setItems([]);

  const hasBet = (matchId: string, market: string) =>
    items.some((b) => b.matchId === matchId && b.market === market);

  return (
    <BetSlipContext.Provider
      value={{ items, addBet, removeBet, clearSlip, hasBet, stake, setStake }}
    >
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used inside BetSlipProvider");
  return ctx;
}
