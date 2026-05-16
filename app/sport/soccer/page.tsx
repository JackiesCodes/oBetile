"use client";

import { useState } from "react";
import { matches } from "@/data/matches";
import LeagueSection from "@/components/LeagueSection";
import SportsTabBar from "@/components/SportsTabBar";
import { Match } from "@/types";
import { Zap } from "lucide-react";

export default function SoccerPage() {
  const [activeTab, setActiveTab] = useState("Highlights");

  const soccerMatches = matches.filter((m) => m.sport === "soccer");

  const filtered = soccerMatches.filter((m) => {
    if (activeTab === "Live") return m.status === "live";
    if (activeTab === "Upcoming") return m.status === "upcoming";
    return true;
  });

  const grouped = filtered.reduce<Record<string, { country: string; matches: Match[] }>>(
    (acc, m) => {
      if (!acc[m.league]) acc[m.league] = { country: m.country, matches: [] };
      acc[m.league].matches.push(m);
      return acc;
    },
    {}
  );

  const liveCount = soccerMatches.filter((m) => m.status === "live").length;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-5 bg-brand-dark-2">
        <span className="text-2xl">⚽</span>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Soccer</h1>
          <p className="text-gray-400 text-xs">
            {liveCount} live matches · {soccerMatches.length} total
          </p>
        </div>
      </div>

      <SportsTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([league, { country, matches: leagueMatches }]) => (
          <LeagueSection
            key={league}
            league={league}
            country={country}
            matches={leagueMatches}
          />
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
            <Zap size={32} />
            <p className="text-sm">No matches available.</p>
          </div>
        )}

        {/* SEO Footer */}
        <div className="px-4 py-6 border-t border-brand-dark-5 mt-4">
          <h2 className="text-white font-bold text-base mb-2">
            Soccer Betting in Botswana — Bet Live with BetPlay
          </h2>
          <p className="text-gray-500 text-xs leading-relaxed">
            Bet on all your favourite matches from the Premier League to the UEFA Champions League
            with great odds and live in-play markets. Register, deposit in Pula (BWP), and cash out
            your winnings instantly. Enjoy exclusive soccer promotions built for Botswana.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {["English Premier League", "UEFA Champions League", "Serie A", "La Liga"].map((l) => (
              <div key={l} className="bg-brand-dark-3 rounded px-3 py-2 text-xs text-gray-400 text-center">
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
