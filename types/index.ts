export interface Match {
  id: string;
  sport: string;
  league: string;
  country: string;
  home: string;
  away: string;
  score: string | null;
  minute?: string;
  status: "live" | "upcoming" | "finished";
  time?: string;
  odds: {
    home: number | null;
    draw: number | null;
    away: number | null;
  };
}

export interface League {
  name: string;
  country: string;
  flag?: string;
  matches: Match[];
}

export interface BetSlipItem {
  matchId: string;
  home: string;
  away: string;
  market: string;
  selection: string;
  odds: number;
}

export interface Sport {
  id: string;
  name: string;
  icon: string;
  liveCount?: number;
}
