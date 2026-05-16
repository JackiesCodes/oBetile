"use client";

import { useState } from "react";
import { matches, sports } from "@/data/matches";
import LeagueSection from "@/components/LeagueSection";
import { Match } from "@/types";
import { Zap, Activity } from "lucide-react";
import clsx from "clsx";

export default function LivePage() {
  const [activeSport, setActiveSport] = useState("all");

  const liveMatches = matches.filter((m) => m.status === "live");

  const filtered =
    activeSport === "all"
      ? liveMatches
      : liveMatches.filter((m) => m.sport === activeSport);

  const grouped = filtered.reduce<Record<string, { country: string; matches: Match[] }>>(
    (acc, m) => {
      if (!acc[m.league]) acc[m.league] = { country: m.country, matches: [] };
      acc[m.league].matches.push(m);
      return acc;
    },
    {}
  );

  const liveSports = sports.filter((s) => (s.liveCount ?? 0) > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Live header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-brand-dark-2 border-b border-brand-dark-5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse" />
          <Activity size={18} className="text-brand-green" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Live Betting</h1>
          <p className="text-gray-400 text-xs">{liveMatches.length} live events right now</p>
        </div>
      </div>

      {/* Sport filter chips */}
      <div className="flex overflow-x-auto gap-2 px-3 py-2.5 border-b border-brand-dark-5 bg-brand-dark-2 scrollbar-hide">
        <button
          onClick={() => setActiveSport("all")}
          className={clsx(
            "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
            activeSport === "all"
              ? "bg-brand-green text-black"
              : "bg-brand-dark-4 text-gray-400 hover:text-white"
          )}
        >
          All ({liveMatches.length})
        </button>
        {liveSports.map((sport) => (
          <button
            key={sport.id}
            onClick={() => setActiveSport(sport.id)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
              activeSport === sport.id
                ? "bg-brand-green text-black"
                : "bg-brand-dark-4 text-gray-400 hover:text-white"
            )}
          >
            <span>{sport.icon}</span>
            {sport.name}
            <span
              className={clsx(
                "text-[10px] font-bold px-1 rounded",
                activeSport === sport.id
                  ? "text-black/60"
                  : "text-brand-green"
              )}
            >
              {sport.liveCount}
            </span>
          </button>
        ))}
      </div>

      {/* Matches */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length > 0 ? (
          Object.entries(grouped).map(([league, { country, matches: leagueMatches }]) => (
            <LeagueSection
              key={league}
              league={league}
              country={country}
              matches={leagueMatches}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
            <Zap size={32} />
            <p className="text-sm">No live events for this sport right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
