"use client";

import { useState, useEffect } from "react";
import LeagueSection from "@/components/LeagueSection";
import SportsTabBar from "@/components/SportsTabBar";
import { Match, APIFixture } from "@/types";
import { normalizeFixture, CURRENT_SEASON } from "@/lib/api-football";
import { Zap } from "lucide-react";

const TOP_LEAGUE_IDS = [39, 140, 78, 135, 61]; // PL, LaLiga, Bundesliga, Serie A, Ligue 1

function dedupe(matches: Match[]): Match[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export default function SoccerPage() {
  const [activeTab, setActiveTab] = useState("Highlights");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const fixtureArrays = await Promise.all(
          TOP_LEAGUE_IDS.map((id) =>
            fetch(`/api/football/fixtures?date=${today}&league=${id}&season=${CURRENT_SEASON}`)
              .then((r) => r.json())
              .catch(() => [])
          )
        );
        const all = (fixtureArrays as APIFixture[][]).flat().map(normalizeFixture);
        setMatches(dedupe(all));
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const liveCount = matches.filter((m) => m.status === "live").length;

  const filtered = matches.filter((m) => {
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

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-5 bg-brand-dark-2">
        <span className="text-2xl">⚽</span>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Soccer</h1>
          <p className="text-gray-400 text-xs">
            {liveCount > 0 ? `${liveCount} live · ` : ""}{matches.length} match{matches.length !== 1 ? "es" : ""} today
          </p>
        </div>
      </div>

      <SportsTabBar activeTab={activeTab} onTabChange={setActiveTab} liveCount={liveCount} />

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && Object.entries(grouped).map(([league, { country, matches: leagueMatches }]) => (
          <LeagueSection
            key={league}
            league={league}
            country={country}
            matches={leagueMatches}
          />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
            <Zap size={32} />
            <p className="text-sm">No fixtures today.</p>
          </div>
        )}

        {/* SEO Footer */}
        <div className="px-4 py-6 border-t border-brand-dark-5 mt-4">
          <h2 className="text-white font-bold text-base mb-2">
            Soccer Predictions in Botswana — Predict with oBetile
          </h2>
          <p className="text-gray-500 text-xs leading-relaxed">
            Get win probability predictions for all your favourite matches from the Premier League
            to the UEFA Champions League. Live match insights, real-time percentage forecasts, and
            intelligent outcome analysis — all built for Botswana sports fans.
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
