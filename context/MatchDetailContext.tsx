"use client";

import { createContext, useContext, useState } from "react";

export interface MatchDetailData {
  fixture: any;
  events: any[];
  lineups: any[];
  stats: any[];
  h2h: any[];
  standings: any[];
  prediction: any | null;
}

interface MatchDetailCtx {
  matchDetail: MatchDetailData | null;
  setMatchDetail: (data: MatchDetailData | null) => void;
}

const MatchDetailContext = createContext<MatchDetailCtx>({
  matchDetail: null,
  setMatchDetail: () => {},
});

export function MatchDetailProvider({ children }: { children: React.ReactNode }) {
  const [matchDetail, setMatchDetail] = useState<MatchDetailData | null>(null);
  return (
    <MatchDetailContext.Provider value={{ matchDetail, setMatchDetail }}>
      {children}
    </MatchDetailContext.Provider>
  );
}

export function useMatchDetail() {
  return useContext(MatchDetailContext);
}
