"use client";

import { useState, useEffect } from "react";
import LeagueSection from "@/components/LeagueSection";
import SportsTabBar from "@/components/SportsTabBar";
import SeasonPicksPanel from "@/components/SeasonPicksPanel";
import { Match, APIFixture } from "@/types";
import { normalizeFixture } from "@/lib/api-football";
import { withOdds, type OddsMap } from "@/lib/odds";
import { Zap } from "lucide-react";

/**
 * Bookmakers price only a minority of fixtures, so after odds land the gaps are
 * filled from two further sources in turn.
 *
 * Bounded deliberately: /predictions has no bulk form, so each fixture is its
 * own upstream request. Filling a whole day would be hundreds of calls, so this
 * covers the top of the feed — what a visitor actually sees first — and leaves
 * the rest showing a dash.
 */
const FORECAST_FILL_LIMIT = 20;

async function fillMissingOdds(
  matches: Match[],
  apply: (map: OddsMap) => void
): Promise<void> {
  const missing = matches
    .filter((m) => m.odds.home === null)
    .slice(0, FORECAST_FILL_LIMIT)
    .map((m) => m.id);

  if (missing.length === 0) return;

  // Two sources, cheapest first. The provider's own forecast is one request per
  // fixture but needs no other data; our model costs one call per competition
  // and answers for anything with a published table, including matches the
  // provider knows nothing about.
  const filled = new Set<string>();

  const merge = (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const map = data as OddsMap;
    for (const id of Object.keys(map)) filled.add(id);
    apply(map);
  };

  try {
    const res = await fetch(`/api/football/forecasts?ids=${missing.join(",")}`);
    if (res.ok) merge(await res.json());
  } catch {
    // Fall through to the model.
  }

  const stillMissing = missing.filter((id) => !filled.has(id));
  if (stillMissing.length === 0) return;

  try {
    const res = await fetch(`/api/football/model?ids=${stillMissing.join(",")}`);
    if (res.ok) merge(await res.json());
  } catch {
    // A failed fill just leaves those rows with a dash.
  }
}

const STATUS_MAP: Record<string, Match["status"]> = {
  Live: "live",
  Upcoming: "upcoming",
  Finished: "finished",
};

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

export default function SoccerPage() {
  const [activeTab, setActiveTab] = useState("Highlights");
  const [activeDate, setActiveDate] = useState("Today");
  const [activeStatus, setActiveStatus] = useState("All");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveStatus("All");
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      setLoading(true);
      try {
        const dateParams = getDateParams(activeDate);
        const qp = new URLSearchParams({ ...dateParams }); // no season — let API resolve per competition
        const fixturesData = await fetch(`/api/football/fixtures?${qp}`).then((r) => r.json()).catch(() => []);
        const deduped = dedupe(
          (Array.isArray(fixturesData) ? fixturesData as APIFixture[] : []).map(normalizeFixture)
        );

        if (!cancelled) setMatches(deduped);

        // Loaded after the list rather than with it — see the homepage for why.
        if (dateParams.date) {
          fetch(`/api/football/odds?date=${dateParams.date}`)
            .then((r) => r.json())
            .then((oddsData) => {
              if (cancelled || !oddsData || typeof oddsData !== "object") return;
              const odds = oddsData as OddsMap;
              const merged = deduped.map((m) => withOdds(m, odds));
              setMatches(merged);

              // Outside the state updater — see the homepage: a fetch inside one
              // fires twice under reactStrictMode.
              fillMissingOdds(merged, (extra) => {
                if (!cancelled) setMatches((cur) => cur.map((m) => withOdds(m, extra)));
              });
            })
            .catch(() => {});
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

  const liveCount = matches.filter((m) => m.status === "live").length;

  const filtered = matches.filter((m) => {
    if (activeStatus !== "All") return m.status === STATUS_MAP[activeStatus];
    if (activeTab === "Live") return m.status === "live";
    if (activeTab === "Upcoming") return m.status === "upcoming";
    return true;
  });

  const grouped = filtered.reduce<Record<string, { country: string; leagueId?: number; matches: Match[] }>>(
    (acc, m) => {
      if (!acc[m.league]) acc[m.league] = { country: m.country, leagueId: m.leagueId, matches: [] };
      acc[m.league].matches.push(m);
      return acc;
    },
    {}
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-5 bg-brand-dark-2">
        <span className="text-2xl">⚽</span>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Soccer</h1>
          <p className="text-gray-400 text-xs">
            {liveCount > 0 ? `${liveCount} live · ` : ""}{matches.length} match{matches.length !== 1 ? "es" : ""} today
          </p>
        </div>
      </div>

      <SportsTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        liveCount={liveCount}
        activeDate={activeDate}
        onDateChange={setActiveDate}
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
      />

      {activeTab === "Season Picks" && <SeasonPicksPanel />}

      {activeTab !== "Season Picks" && (
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && Object.entries(grouped).map(([league, { country, leagueId, matches: leagueMatches }]) => (
            <LeagueSection key={league} league={league} country={country} leagueId={leagueId} matches={leagueMatches} />
          ))}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
              <Zap size={32} />
              <p className="text-sm">No fixtures for this selection.</p>
              <p className="text-xs text-gray-600">Try Tomorrow or This Week to see upcoming fixtures.</p>
            </div>
          )}

          <div className="px-4 py-6 border-t border-brand-dark-5 mt-4">
            <h2 className="text-white font-bold text-base mb-2">
              Football Predictions Worldwide — Predict with oBetile
            </h2>
            <p className="text-gray-500 text-xs leading-relaxed">
              Win probabilities for matches across the globe, from the Premier League and the UEFA
              Champions League to MLS, the Brasileirão and Liga MX. Live scores, standings and
              outcome analysis — wherever you are, and whoever you follow.
            </p>
            {/* Named competitions span several continents, so the coverage claim
                above is visibly backed up rather than being Europe-only. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {["Premier League", "UEFA Champions League", "MLS", "Brasileirão"].map((l) => (
                <div key={l} className="bg-brand-dark-3 rounded px-3 py-2 text-xs text-gray-400 text-center">
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
