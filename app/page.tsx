"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { sports, countryFlags } from "@/data/matches";
import LeagueSection from "@/components/LeagueSection";
import SportsTabBar from "@/components/SportsTabBar";
import CommunityPanel from "@/components/CommunityPanel";
import SeasonPicksPanel from "@/components/SeasonPicksPanel";
import { Match, APIFixture } from "@/types";
import { normalizeFixture, CURRENT_SEASON } from "@/lib/api-football";
import { Flame, Zap } from "lucide-react";

const TOP_LEAGUE_IDS = [39, 140, 78, 135, 61]; // PL, LaLiga, Bundesliga, Serie A, Ligue 1

function dedupe(matches: Match[]): Match[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function getDateParams(activeDate: string): Record<string, string> {
  const d = new Date();
  if (activeDate === "Tomorrow") {
    d.setDate(d.getDate() + 1);
    return { date: d.toISOString().split("T")[0] };
  }
  if (activeDate === "This Week") {
    const from = d.toISOString().split("T")[0];
    const to = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return { from, to };
  }
  return { date: d.toISOString().split("T")[0] };
}

const STATUS_MAP: Record<string, Match["status"]> = {
  Live: "live",
  Upcoming: "upcoming",
  Finished: "finished",
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("Highlights");
  const [activeDate, setActiveDate] = useState("Today");
  const [activeStatus, setActiveStatus] = useState("All");
  const [matches, setMatches] = useState<Match[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Read ?tab= URL param on first load (used by sidebar deep links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) setActiveTab(tab);
  }, []);

  // Reset status chip when tab changes
  useEffect(() => {
    setActiveStatus("All");
  }, [activeTab]);

  // Fetch fixtures when activeDate changes; auto-refresh every 30s for Today only
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      setLoading(true);
      try {
        const dateParams = getDateParams(activeDate);

        const [fixtureArrays, liveData] = await Promise.all([
          Promise.all(
            TOP_LEAGUE_IDS.map((id) => {
              const qp = new URLSearchParams({
                league: String(id),
                season: CURRENT_SEASON,
                ...dateParams,
              });
              return fetch(`/api/football/fixtures?${qp}`)
                .then((r) => r.json())
                .catch(() => []);
            })
          ),
          fetch("/api/football/live").then((r) => r.json()).catch(() => []),
        ]);

        if (!cancelled) {
          const all = (fixtureArrays as APIFixture[][]).flat().map(normalizeFixture);
          setMatches(dedupe(all));
          setLiveCount(Array.isArray(liveData) ? liveData.length : 0);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    let interval: ReturnType<typeof setInterval> | null = null;
    if (activeDate === "Today") {
      interval = setInterval(load, 30_000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [activeDate]);

  const filtered = matches.filter((m) => {
    // Status chip overrides when explicitly set
    if (activeStatus !== "All") {
      return m.status === STATUS_MAP[activeStatus];
    }
    // Tab-based implicit filter
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

  const featuredMatches =
    matches.filter((m) => m.status === "live").slice(0, 2).length === 2
      ? matches.filter((m) => m.status === "live").slice(0, 2)
      : matches.filter((m) => m.status === "upcoming").slice(0, 2);

  const sportsWithLive = sports.map((s) =>
    s.id === "soccer" ? { ...s, liveCount } : s
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sports icon strip */}
      <div className="flex overflow-x-auto gap-2 px-3 py-3 border-b border-brand-dark-5 bg-brand-dark-2 scrollbar-hide">
        {sportsWithLive.slice(0, 10).map((sport) => (
          <Link
            key={sport.id}
            href={`/sport/${sport.id}`}
            className="flex flex-col items-center gap-1 shrink-0 group"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-brand-dark-4 group-hover:bg-brand-dark-5 flex items-center justify-center text-2xl transition-colors border border-transparent group-hover:border-brand-green">
                {sport.icon}
              </div>
              {(sport.liveCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-green text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-0.5 ring-2 ring-brand-dark z-10">
                  {sport.liveCount}
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors text-center leading-tight w-14 truncate">
              {sport.name}
            </span>
          </Link>
        ))}
      </div>

      {/* Tab bar */}
      <SportsTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        liveCount={liveCount}
        activeDate={activeDate}
        onDateChange={setActiveDate}
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
      />

      {/* Community tab */}
      {activeTab === "Community" && <CommunityPanel />}

      {/* Season Picks tab */}
      {activeTab === "Season Picks" && <SeasonPicksPanel />}

      {/* Match feed (all other tabs) */}
      {activeTab !== "Community" && activeTab !== "Season Picks" && (
        <div className="flex-1 overflow-y-auto">
          {/* Skeleton loader */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Featured / Top Predictions */}
          {!loading && activeTab === "Highlights" && activeStatus === "All" && featuredMatches.length > 0 && (
            <div className="px-3 pt-3 pb-1">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={14} className="text-orange-400" />
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Top Matches
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {featuredMatches.map((m) => (
                  <FeaturedCard key={m.id} match={m} countryFlags={countryFlags} />
                ))}
              </div>
            </div>
          )}

          {/* League groups */}
          {!loading &&
            Object.entries(grouped).map(([league, { country, matches: leagueMatches }]) => (
              <LeagueSection
                key={league}
                league={league}
                country={country}
                matches={leagueMatches}
              />
            ))}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
              <Zap size={32} />
              <p className="text-sm">No matches for this selection.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeaturedCard({
  match,
  countryFlags,
}: {
  match: Match;
  countryFlags: Record<string, string>;
}) {
  return (
    <Link
      href={`/match/${match.id}`}
      className="block bg-brand-dark-3 border border-brand-dark-5 rounded-xl p-3 hover:border-brand-green/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 font-medium">
          {countryFlags[match.country] ?? "🌍"} {match.league}
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
        {match.score && (
          <div className="text-brand-green font-bold text-lg leading-none text-center">
            <div>{match.score.split("-")[0]}</div>
            <div>{match.score.split("-")[1]}</div>
          </div>
        )}
      </div>
    </Link>
  );
}
