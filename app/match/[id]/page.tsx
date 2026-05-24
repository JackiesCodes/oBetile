"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MatchHeader from "@/components/match-detail/MatchHeader";
import MatchTabs, { MatchTab } from "@/components/match-detail/MatchTabs";
import MatchSummary from "@/components/match-detail/MatchSummary";
import MatchLineups from "@/components/match-detail/MatchLineups";
import MatchStats from "@/components/match-detail/MatchStats";
import MatchH2H from "@/components/match-detail/MatchH2H";
import MatchStandings from "@/components/match-detail/MatchStandings";
import MatchPredictions from "@/components/match-detail/MatchPredictions";
import { ChevronLeft } from "lucide-react";

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState<MatchTab>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [fixture, setFixture] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lineups, setLineups] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [h2h, setH2H] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      try {
        // Fetch fixture first to get league/team info needed for h2h and standings
        const [fixtureRes, eventsRes, lineupsRes, statsRes, predRes] = await Promise.all([
          fetch(`/api/football/fixture/${id}`).then((r) => r.json()),
          fetch(`/api/football/events/${id}`).then((r) => r.json()),
          fetch(`/api/football/lineups/${id}`).then((r) => r.json()),
          fetch(`/api/football/statistics/${id}`).then((r) => r.json()),
          fetch(`/api/football/predictions/${id}`).then((r) => r.json()),
        ]);

        const fix = Array.isArray(fixtureRes) ? fixtureRes[0] : null;
        if (!fix) throw new Error("Fixture not found");

        setFixture(fix);
        setEvents(Array.isArray(eventsRes) ? eventsRes : []);
        setLineups(Array.isArray(lineupsRes) ? lineupsRes : []);
        setStats(Array.isArray(statsRes) ? statsRes : []);
        setPrediction(Array.isArray(predRes) ? predRes[0] ?? null : null);

        // Now fetch h2h and standings with the fixture data
        const homeId = fix.teams.home.id;
        const awayId = fix.teams.away.id;
        const leagueId = fix.league.id;

        const [h2hRes, standingsRes] = await Promise.all([
          fetch(`/api/football/h2h?h2h=${homeId}-${awayId}`).then((r) => r.json()),
          fetch(`/api/football/standings/${leagueId}`).then((r) => r.json()),
        ]);

        setH2H(Array.isArray(h2hRes) ? h2hRes : []);

        // Standings is nested: [{ league: { standings: [[...]] } }]
        const standingsGroup = standingsRes?.[0]?.league?.standings?.[0] ?? [];
        setStandings(standingsGroup);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load match data");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark">
        {/* Header skeleton */}
        <div className="bg-brand-dark-2 border-b border-brand-dark-5 animate-pulse">
          <div className="px-4 py-2 border-b border-brand-dark-5 flex items-center gap-2">
            <div className="w-5 h-5 bg-brand-dark-4 rounded" />
            <div className="h-3 bg-brand-dark-4 rounded w-32" />
          </div>
          <div className="px-4 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-14 h-14 bg-brand-dark-4 rounded-full" />
                <div className="h-4 bg-brand-dark-4 rounded w-20" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-10 w-20 bg-brand-dark-4 rounded" />
                <div className="h-3 w-16 bg-brand-dark-4 rounded mt-1" />
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-14 h-14 bg-brand-dark-4 rounded-full" />
                <div className="h-4 bg-brand-dark-4 rounded w-20" />
              </div>
            </div>
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="flex border-b border-brand-dark-5 bg-brand-dark-2 animate-pulse">
          {["Summary","Lineups","Statistics","H2H","Standings","AI Insight"].map((t) => (
            <div key={t} className="px-4 py-3 h-10 flex items-center">
              <div className="h-3 bg-brand-dark-4 rounded w-14" />
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <div className="p-4 space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-brand-dark-3 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !fixture) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center gap-4 p-8">
        <span className="text-5xl">⚽</span>
        <p className="text-white text-lg font-semibold">Match not found</p>
        <p className="text-gray-500 text-sm text-center">{error ?? "This fixture could not be loaded."}</p>
        <button
          onClick={() => router.back()}
          className="mt-2 px-4 py-2 bg-brand-green text-black text-sm font-bold rounded-lg hover:bg-brand-green-hover transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  const homeTeamId = fixture.teams.home.id;
  const awayTeamId = fixture.teams.away.id;

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Back button */}
      <div className="px-4 pt-3 pb-1">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ChevronLeft size={16} />
          Back
        </button>
      </div>

      {/* Match header */}
      <MatchHeader
        fixture={fixture.fixture}
        league={fixture.league}
        teams={fixture.teams}
        goals={fixture.goals}
        score={fixture.score}
      />

      {/* Tabs */}
      <MatchTabs active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div>
        {activeTab === "summary" && (
          <MatchSummary
            events={events}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
            fixtureStatus={fixture.fixture.status.short}
          />
        )}

        {activeTab === "lineups" && (
          <MatchLineups lineups={lineups} fixtureStatus={fixture.fixture.status.short} />
        )}

        {activeTab === "statistics" && (
          <MatchStats stats={stats} fixtureStatus={fixture.fixture.status.short} />
        )}

        {activeTab === "h2h" && (
          <MatchH2H
            fixtures={h2h}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
          />
        )}

        {activeTab === "standings" && (
          <MatchStandings
            standings={standings}
            highlightTeamIds={[homeTeamId, awayTeamId]}
          />
        )}

        {activeTab === "ai" && (
          <MatchPredictions prediction={prediction} />
        )}
      </div>
    </div>
  );
}
