"use client";

import { useState, useEffect, useRef } from "react";
import LeagueSection from "@/components/LeagueSection";
import { compareLeagues } from "@/lib/league-rank";
import SportsTabBar from "@/components/SportsTabBar";
import SeasonPicksPanel from "@/components/SeasonPicksPanel";
import { Match, APIFixture } from "@/types";
import { normalizeFixture } from "@/lib/api-football";
import { isListable } from "@/lib/match-status";
import { getDateParams } from "@/lib/match-dates";
import { withOdds, type OddsMap } from "@/lib/odds";
import { useLiveData } from "@/lib/use-live-data";
import { Zap } from "lucide-react";

/**
 * Bookmakers price only a minority of fixtures, so after odds land the gaps are
 * filled from two further sources in turn.
 *
 * Our own model goes first. Measured against production over the same fifteen
 * fixtures, it answered all fifteen with figures that differed match to match,
 * while the provider's forecast answered thirteen using only three distinct
 * values — 45/45/10, 10/45/45 and 35/35/30 — which is what put the same
 * percentages on unrelated matches all down the list. The model is also cheaper
 * per batch: one standings call per competition against one prediction call per
 * fixture.
 *
 * Bounded deliberately: /predictions has no bulk form, so each fixture left
 * over is its own upstream request. Filling a whole day would be hundreds of
 * calls, so this covers the top of the feed — what a visitor actually sees
 * first — and leaves the rest showing a dash.
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

  // Best source first. The model costs one call per competition and answers
  // for anything with a published table; the provider's forecast is one call
  // per fixture and mostly returns a bucket rather than a prediction.
  const filled = new Set<string>();

  const merge = (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const map = data as OddsMap;
    for (const id of Object.keys(map)) filled.add(id);
    apply(map);
  };

  try {
    const res = await fetch(`/api/football/model?ids=${missing.join(",")}`);
    if (res.ok) merge(await res.json());
  } catch {
    // Fall through to the provider's forecast.
  }

  const stillMissing = missing.filter((id) => !filled.has(id));
  if (stillMissing.length === 0) return;

  try {
    const res = await fetch(`/api/football/forecasts?ids=${stillMissing.join(",")}`);
    if (res.ok) merge(await res.json());
  } catch {
    // A failed fill just leaves those rows with a dash.
  }
}

// Finished is deliberately absent: those fixtures are filtered out before the
// chip is consulted, so an entry here would be a filter that can never match.
const STATUS_MAP: Record<string, Match["status"]> = {
  Live: "live",
  Upcoming: "upcoming",
};

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
  const [activeDate, setActiveDate] = useState("Today");
  const [activeStatus, setActiveStatus] = useState("All");
  const [matches, setMatches] = useState<Match[]>([]);

  // Prices held across refreshes — see the homepage for why they must survive.
  const knownOdds = useRef<OddsMap>({});

  useEffect(() => {
    setActiveStatus("All");
  }, [activeTab]);

  const loading = useLiveData(
    async (background) => {
      const dateParams = getDateParams(activeDate);
      if (!background) knownOdds.current = {};

      const qp = new URLSearchParams({ ...dateParams }); // no season — let API resolve per competition
      const fixturesData = await fetch(`/api/football/fixtures?${qp}`).then((r) => r.json()).catch(() => []);
      const deduped = dedupe(
        (Array.isArray(fixturesData) ? fixturesData as APIFixture[] : []).map(normalizeFixture)
      );

      setMatches(deduped.map((m) => withOdds(m, knownOdds.current)));

      // Prices are cached for fifteen minutes upstream, so a background refresh
      // re-asking for them would cost a round trip and learn nothing.
      if (background || !dateParams.date) return;

      // Loaded after the list rather than with it — see the homepage for why.
      fetch(`/api/football/odds?date=${dateParams.date}`)
        .then((r) => r.json())
        .then((oddsData) => {
          if (!oddsData || typeof oddsData !== "object") return;
          knownOdds.current = { ...knownOdds.current, ...(oddsData as OddsMap) };
          const merged = deduped.map((m) => withOdds(m, knownOdds.current));
          setMatches(merged);

          // Outside the state updater — see the homepage: a fetch inside one
          // fires twice under reactStrictMode.
          fillMissingOdds(merged, (extra) => {
            knownOdds.current = { ...knownOdds.current, ...extra };
            setMatches((cur) => cur.map((m) => withOdds(m, extra)));
          });
        })
        .catch(() => {});
    },
    activeDate === "Today" ? 30_000 : null,
    [activeDate]
  );

  const listable = matches.filter((m) => isListable(m.status));
  const liveCount = listable.filter((m) => m.status === "live").length;

  const filtered = matches.filter((m) => {
    // See the homepage: only what can still be predicted is listed.
    if (!isListable(m.status)) return false;
    if (activeStatus !== "All") return m.status === STATUS_MAP[activeStatus];
    if (activeTab === "Live") return m.status === "live";
    if (activeTab === "Upcoming") return m.status === "upcoming";
    return true;
  });

  /*
   * Grouped by league id, not by name.
   *
   * "Premier League" is the name of the top division in England, Wales,
   * Belarus, Egypt, Russia, Armenia, Kazakhstan, Malta, Hong Kong, Lesotho and
   * Bhutan, and keying on the name collapsed all of them into one section —
   * England's fixtures listed under the same heading as Bhutan's. Country and
   * name together is the fallback for the rare fixture with no league id.
   */
  const grouped = filtered.reduce<
    Record<string, { league: string; country: string; leagueId?: number; matches: Match[] }>
  >((acc, m) => {
    const key = m.leagueId !== undefined ? `id:${m.leagueId}` : `name:${m.country}:${m.league}`;
    if (!acc[key]) {
      acc[key] = { league: m.league, country: m.country, leagueId: m.leagueId, matches: [] };
    }
    acc[key].matches.push(m);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-5 bg-brand-dark-2">
        <span className="text-2xl">⚽</span>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Soccer</h1>
          <p className="text-gray-400 text-xs">
            {/* The filtered count, not the fetched one: finished, cancelled and
                postponed fixtures are no longer listed, so counting them here
                would promise rows the list does not contain. */}
            {liveCount > 0 ? `${liveCount} live · ` : ""}{listable.length} match{listable.length !== 1 ? "es" : ""} today
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
              <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading &&
            Object.entries(grouped)
              .sort(([, a], [, b]) => compareLeagues(a, b))
              .map(([key, { league, country, leagueId, matches: leagueMatches }]) => (
                <LeagueSection
                  key={key}
                  league={league}
                  country={country}
                  leagueId={leagueId}
                  matches={leagueMatches}
                />
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
