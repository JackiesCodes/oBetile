"use client";

import { useEffect, useState } from "react";
import { TOP_LEAGUES } from "@/lib/api-football";
import { ChevronDown, ChevronUp, TrendingUp, Award } from "lucide-react";
import clsx from "clsx";
import NewsFeedPanel from "@/components/NewsFeedPanel";

interface Standing {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  all: { played: number; win: number; draw: number; lose: number };
  form: string;
}

interface TopScorer {
  player: { id: number; name: string; photo: string };
  statistics: Array<{ goals: { total: number }; team: { name: string; logo: string } }>;
}

const LEAGUE_LABELS: Record<number, string> = {
  [TOP_LEAGUES.premierLeague]: "Premier League",
  [TOP_LEAGUES.laLiga]: "LaLiga",
  [TOP_LEAGUES.bundesliga]: "Bundesliga",
};

export default function RightPanel() {
  const [standings, setStandings] = useState<Record<number, Standing[]>>({});
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [activeScorersLeague, setActiveScorersLeague] = useState(TOP_LEAGUES.premierLeague);

  // Collapse state for each section
  const [newsFeedOpen, setNewsFeedOpen] = useState(true);
  const [scorersOpen, setScorersOpen] = useState(true);
  const [standingsCollapsed, setStandingsCollapsed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    [TOP_LEAGUES.premierLeague, TOP_LEAGUES.laLiga, TOP_LEAGUES.bundesliga].forEach(async (id) => {
      try {
        const res = await fetch(`/api/football/standings/${id}`);
        const data = await res.json();
        if (Array.isArray(data) && data[0]?.league?.standings?.[0]) {
          setStandings((prev) => ({ ...prev, [id]: data[0].league.standings[0].slice(0, 8) }));
        }
      } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    setScorers([]);
    fetch(`/api/football/topscorers/${activeScorersLeague}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setScorers(data.slice(0, 8));
      })
      .catch(() => { /* ignore */ });
  }, [activeScorersLeague]);

  const toggleStandings = (id: number) =>
    setStandingsCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside className="w-80 shrink-0 bg-brand-dark-2 border-l border-brand-dark-5 flex-col hidden xl:flex overflow-y-auto">

      {/* ── News Feed ────────────────────────────────────────── */}
      <NewsFeedPanel
        collapsed={!newsFeedOpen}
        onToggleCollapse={() => setNewsFeedOpen((p) => !p)}
      />

      {/* ── Top Scorers ──────────────────────────────────────── */}
      <section className="border-b border-brand-dark-5">
        <button
          onClick={() => setScorersOpen((p) => !p)}
          className="w-full flex items-center gap-2 px-4 py-3 hover:bg-brand-dark-3 transition-colors text-left"
        >
          <Award size={14} className="text-brand-green shrink-0" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex-1">
            Top Scorers
          </span>
          {scorersOpen ? (
            <ChevronUp size={13} className="text-gray-500" />
          ) : (
            <ChevronDown size={13} className="text-gray-500" />
          )}
        </button>

        {scorersOpen && (
          <>
            {/* League switcher */}
            <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
              {Object.entries(LEAGUE_LABELS).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveScorersLeague(Number(id))}
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors shrink-0",
                    activeScorersLeague === Number(id)
                      ? "bg-brand-green text-black"
                      : "bg-brand-dark-4 text-gray-400 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="px-2 pb-3 space-y-0.5">
              {scorers.length === 0 && (
                <div className="space-y-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-2.5 px-2 py-1.5">
                      <div className="w-4 h-4 bg-brand-dark-4 rounded shrink-0" />
                      <div className="w-7 h-7 bg-brand-dark-4 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-brand-dark-4 rounded w-3/4" />
                        <div className="h-2.5 bg-brand-dark-4 rounded w-1/2" />
                      </div>
                      <div className="w-5 h-4 bg-brand-dark-4 rounded shrink-0" />
                    </div>
                  ))}
                </div>
              )}
              {scorers.map((s, i) => (
                <div
                  key={s.player.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-brand-dark-3 transition-colors"
                >
                  <span className="text-[11px] text-gray-500 font-bold w-4 text-center shrink-0">
                    {i + 1}
                  </span>
                  {s.player.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.player.photo}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover shrink-0 bg-brand-dark-4"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-brand-dark-4 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{s.player.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {s.statistics[0]?.team?.name}
                    </div>
                  </div>
                  <span className="text-brand-green font-bold text-sm shrink-0">
                    {s.statistics[0]?.goals?.total ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── League Standings ─────────────────────────────────── */}
      <section className="flex-1">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-dark-5">
          <TrendingUp size={14} className="text-brand-green" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Standings</span>
        </div>

        {Object.entries(LEAGUE_LABELS).map(([idStr, label]) => {
          const id = Number(idStr);
          const table = standings[id] ?? [];
          const isCollapsed = standingsCollapsed[id];
          return (
            <div key={id} className="border-b border-brand-dark-5">
              <button
                onClick={() => toggleStandings(id)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-brand-dark-3 transition-colors text-left"
              >
                <span className="text-xs font-semibold text-gray-200">{label}</span>
                {isCollapsed ? (
                  <ChevronDown size={13} className="text-gray-500" />
                ) : (
                  <ChevronUp size={13} className="text-gray-500" />
                )}
              </button>

              {!isCollapsed && (
                <>
                  <div className="flex items-center px-3 py-1 text-[10px] text-gray-600 font-semibold">
                    <span className="w-5 shrink-0">#</span>
                    <span className="flex-1">Team</span>
                    <span className="w-6 text-center">P</span>
                    <span className="w-6 text-center">W</span>
                    <span className="w-6 text-center">D</span>
                    <span className="w-6 text-center">L</span>
                    <span className="w-7 text-center font-bold">Pts</span>
                  </div>

                  {table.length === 0 && (
                    <div className="flex items-center justify-center py-3">
                      <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {table.map((row) => (
                    <div
                      key={row.team.id}
                      className="flex items-center px-3 py-1.5 hover:bg-brand-dark-3 transition-colors"
                    >
                      <span className="w-5 text-[11px] text-gray-500 shrink-0">{row.rank}</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {row.team.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.team.logo} alt="" className="w-4 h-4 object-contain shrink-0" />
                        ) : (
                          <div className="w-4 h-4 bg-brand-dark-4 rounded-full shrink-0" />
                        )}
                        <span className="text-[11px] text-gray-200 truncate">{row.team.name}</span>
                      </div>
                      <span className="w-6 text-center text-[11px] text-gray-400">{row.all.played}</span>
                      <span className="w-6 text-center text-[11px] text-gray-400">{row.all.win}</span>
                      <span className="w-6 text-center text-[11px] text-gray-400">{row.all.draw}</span>
                      <span className="w-6 text-center text-[11px] text-gray-400">{row.all.lose}</span>
                      <span className="w-7 text-center text-[11px] font-bold text-white">{row.points}</span>
                    </div>
                  ))}

                  {table.length > 0 && (
                    <div className="px-3 py-1.5 border-t border-brand-dark-5">
                      <div className="space-y-1">
                        {table.slice(0, 3).map((row) => (
                          <div key={row.team.id} className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 w-24 truncate">{row.team.name}</span>
                            <div className="flex gap-0.5">
                              {(row.form ?? "").split("").slice(-5).map((f, i) => (
                                <span
                                  key={i}
                                  className={clsx(
                                    "w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center",
                                    f === "W" ? "bg-brand-green text-black" :
                                    f === "D" ? "bg-gray-500 text-white" :
                                    "bg-red-600 text-white"
                                  )}
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </section>
    </aside>
  );
}
