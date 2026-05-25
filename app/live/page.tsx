"use client";

import { useState, useEffect } from "react";
import LeagueSection from "@/components/LeagueSection";
import { Match, APIFixture } from "@/types";
import { normalizeFixture } from "@/lib/api-football";
import { Zap, Activity } from "lucide-react";
import clsx from "clsx";

export default function LivePage() {
  const [activeSport, setActiveSport] = useState("all");
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetch("/api/football/live").then((r) => r.json()).catch(() => []);
        const normalized = (Array.isArray(data) ? data as APIFixture[] : []).map(normalizeFixture);
        setLiveMatches(normalized);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const filtered =
    activeSport === "all"
      ? liveMatches
      : liveMatches.filter((m) => m.sport === activeSport);

  const grouped = filtered.reduce<Record<string, { country: string; leagueId?: number; matches: Match[] }>>(
    (acc, m) => {
      if (!acc[m.league]) acc[m.league] = { country: m.country, leagueId: m.leagueId, matches: [] };
      acc[m.league].matches.push(m);
      return acc;
    },
    {}
  );

  // Build sport filter chips from actual live data
  const sportCounts = liveMatches.reduce<Record<string, number>>((acc, m) => {
    acc[m.sport] = (acc[m.sport] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Live header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-brand-dark-2 border-b border-brand-dark-5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse" />
          <Activity size={18} className="text-brand-green" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Live Matches</h1>
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
        {Object.entries(sportCounts).map(([sportId, count]) => (
          <button
            key={sportId}
            onClick={() => setActiveSport(sportId)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
              activeSport === sportId
                ? "bg-brand-green text-black"
                : "bg-brand-dark-4 text-gray-400 hover:text-white"
            )}
          >
            {sportId === "soccer" ? "⚽" : sportId}
            <span
              className={clsx(
                "text-[10px] font-bold px-1 rounded",
                activeSport === sportId ? "text-black/60" : "text-brand-green"
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Matches */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length > 0 &&
          Object.entries(grouped).map(([league, { country, leagueId, matches: leagueMatches }]) => (
            <LeagueSection
              key={league}
              league={league}
              country={country}
              leagueId={leagueId}
              matches={leagueMatches}
            />
          ))
        }

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
            <Zap size={32} />
            <p className="text-sm">No live matches right now.</p>
            <p className="text-xs text-gray-600">Check back soon or browse upcoming fixtures on the homepage.</p>
          </div>
        )}
      </div>
    </div>
  );
}
