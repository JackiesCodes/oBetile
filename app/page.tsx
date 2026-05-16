"use client";

import { useState } from "react";
import Link from "next/link";
import { matches, sports, countryFlags } from "@/data/matches";
import LeagueSection from "@/components/LeagueSection";
import SportsTabBar from "@/components/SportsTabBar";
import { Match } from "@/types";
import { Flame, Zap } from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("Highlights");

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
      {/* Sports icon strip */}
      <div className="flex overflow-x-auto gap-2 px-3 py-3 border-b border-brand-dark-5 bg-brand-dark-2 scrollbar-hide">
        {sports.slice(0, 10).map((sport) => (
          <Link
            key={sport.id}
            href={`/sport/${sport.id}`}
            className="flex flex-col items-center gap-1 shrink-0 group"
          >
            <div className="w-12 h-12 rounded-xl bg-brand-dark-4 group-hover:bg-brand-dark-5 flex items-center justify-center text-2xl transition-colors border border-transparent group-hover:border-brand-green">
              {sport.icon}
            </div>
            <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors text-center leading-tight w-14 truncate">
              {sport.name}
            </span>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <SportsTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Match content */}
      <div className="flex-1 overflow-y-auto">
        {/* Featured / pinned matches */}
        {activeTab === "Highlights" && (
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={14} className="text-orange-400" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Featured Matches</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {matches.slice(19, 21).map((m) => (
                <FeaturedCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        )}

        {/* League groups */}
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
            <p className="text-sm">No matches available for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedCard({ match }: { match: Match }) {
  return (
    <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl p-3 hover:border-brand-green/40 transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 font-medium">
          {countryFlags[match.country]} {match.league}
        </span>
        {match.status === "live" ? (
          <span className="flex items-center gap-1 text-[10px] text-brand-green font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
            LIVE {match.minute}&apos;
          </span>
        ) : (
          <span className="text-[10px] text-gray-500">Today {match.time}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-sm font-semibold text-white truncate">{match.home}</div>
          <div className="text-sm font-semibold text-white truncate">{match.away}</div>
        </div>
        {match.status === "live" && match.score && (
          <div className="text-brand-green font-bold text-lg leading-none text-center">
            <div>{match.score.split("-")[0]}</div>
            <div>{match.score.split("-")[1]}</div>
          </div>
        )}
      </div>
    </div>
  );
}
