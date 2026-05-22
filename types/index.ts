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

export interface PredictionItem {
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

// API-Football response types
export interface APIFixture {
  fixture: {
    id: number;
    date: string;
    referee: string | null;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null; city: string | null };
  };
  league: { id: number; name: string; logo: string; country: string; round: string; season: number };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null }; fulltime: { home: number | null; away: number | null } };
}

export interface APIStanding {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  form: string;
  all: { played: number; win: number; draw: number; lose: number };
}

export interface APITopScorer {
  player: { id: number; name: string; photo: string };
  statistics: [{ goals: { total: number }; team: { id: number; name: string; logo: string } }];
}

export interface APIEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
  comments: string | null;
}

export interface APILineup {
  team: { id: number; name: string; logo: string };
  coach: { id: number; name: string; photo: string };
  formation: string;
  startXI: Array<{ player: { id: number; name: string; number: number; pos: string; grid: string | null } }>;
  substitutes: Array<{ player: { id: number; name: string; number: number; pos: string; grid: string | null } }>;
}

export interface APIStatistic {
  type: string;
  value: string | number | null;
}

export interface NewsItem {
  id: string;
  type: "injury" | "result";
  text: string;
  timestamp: string;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  fixture_id: number | null;
  league_id: number | null;
  sport: string;
  likes_count: number;
  created_at: string;
  profiles: { username: string | null; avatar_url: string | null } | null;
}

export interface APIPrediction {
  winner: { id: number | null; name: string | null; comment: string } | null;
  win_or_draw: boolean;
  under_over: string | null;
  goals: { home: string; away: string };
  advice: string;
  percent: { home: string; draw: string; away: string };
  teams: {
    home: { id: number; name: string; logo: string; last_5: { win: number; draw: number; lose: number }; league: { goals: { for: { average: { total: string } }; against: { average: { total: string } } } } };
    away: { id: number; name: string; logo: string; last_5: { win: number; draw: number; lose: number }; league: { goals: { for: { average: { total: string } }; against: { average: { total: string } } } } };
  };
}
