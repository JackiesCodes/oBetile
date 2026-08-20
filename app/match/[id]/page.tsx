"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MatchHeader from "@/components/match-detail/MatchHeader";
import MatchSummary from "@/components/match-detail/MatchSummary";
import MatchLineups from "@/components/match-detail/MatchLineups";
import MatchPlayerRatings from "@/components/match-detail/MatchPlayerRatings";
import MatchTeamNews from "@/components/match-detail/MatchTeamNews";
import MatchStats from "@/components/match-detail/MatchStats";
import MatchH2H from "@/components/match-detail/MatchH2H";
import MatchStandings from "@/components/match-detail/MatchStandings";
import MatchVotePanel from "@/components/match-detail/MatchVotePanel";
import MatchDerivedMarkets from "@/components/match-detail/MatchDerivedMarkets";
import { ChevronLeft } from "lucide-react";
import clsx from "clsx";
import { useMatchDetail } from "@/context/MatchDetailContext";

type MobileTab = "predictions" | "summary" | "lineups" | "players" | "statistics" | "h2h" | "standings";

const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: "predictions", label: "Predictions" },
  { id: "summary", label: "Summary" },
  { id: "lineups", label: "Lineups" },
  { id: "players", label: "Players" },
  { id: "statistics", label: "Statistics" },
  { id: "h2h", label: "H2H" },
  { id: "standings", label: "Standings" },
];

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { setMatchDetail } = useMatchDetail();

  const [mobileTab, setMobileTab] = useState<MobileTab>("predictions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fixture, setFixture] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lineups, setLineups] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [h2h, setH2H] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [injuries, setInjuries] = useState<any[]>([]);
  const [playerRatings, setPlayerRatings] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      try {
        const [fixtureRes, eventsRes, lineupsRes, statsRes, predRes, injuriesRes, playersRes] =
          await Promise.all([
            fetch(`/api/football/fixture/${id}`).then((r) => r.json()),
            fetch(`/api/football/events/${id}`).then((r) => r.json()),
            fetch(`/api/football/lineups/${id}`).then((r) => r.json()),
            fetch(`/api/football/statistics/${id}`).then((r) => r.json()),
            fetch(`/api/football/predictions/${id}`).then((r) => r.json()),
            // Most competitions publish none, so a failure here must not take
            // the rest of the page down with it.
            fetch(`/api/football/injuries/${id}`)
              .then((r) => r.json())
              .catch(() => []),
            // Same tolerance as injuries: only exists once a match is under
            // way, and plenty of competitions never publish it.
            fetch(`/api/football/players/${id}`)
              .then((r) => (r.ok ? r.json() : []))
              .catch(() => []),
          ]);

        const fix = Array.isArray(fixtureRes) ? fixtureRes[0] : null;
        if (!fix) throw new Error("Fixture not found");

        const evs = Array.isArray(eventsRes) ? eventsRes : [];
        const lus = Array.isArray(lineupsRes) ? lineupsRes : [];
        const sts = Array.isArray(statsRes) ? statsRes : [];
        const pred = Array.isArray(predRes) ? (predRes[0]?.predictions ?? null) : null;

        setFixture(fix);
        setEvents(evs);
        setLineups(lus);
        setStats(sts);
        setPrediction(pred);
        const inj = Array.isArray(injuriesRes) ? injuriesRes : [];
        setInjuries(inj);
        setPlayerRatings(Array.isArray(playersRes) ? playersRes : []);

        const homeId = fix.teams.home.id;
        const awayId = fix.teams.away.id;
        const leagueId = fix.league.id;

        const [h2hRes, standingsRes] = await Promise.all([
          fetch(`/api/football/h2h?h2h=${homeId}-${awayId}`).then((r) => r.json()),
          fetch(`/api/football/standings/${leagueId}`).then((r) => r.json()),
        ]);

        const h2hData = Array.isArray(h2hRes) ? h2hRes : [];
        const standingsData = standingsRes?.[0]?.league?.standings?.[0] ?? [];

        setH2H(h2hData);
        setStandings(standingsData);

        // Populate global context so sidebars get match data
        setMatchDetail({
          fixture: fix,
          events: evs,
          lineups: lus,
          stats: sts,
          h2h: h2hData,
          standings: standingsData,
          prediction: pred,
          injuries: inj,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load match data");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();

    // Clear match context when leaving the page
    return () => setMatchDetail(null);
  }, [id, setMatchDetail]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark animate-pulse">
        <div className="bg-brand-dark-2 border-b border-brand-dark-5">
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
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-14 h-14 bg-brand-dark-4 rounded-full" />
                <div className="h-4 bg-brand-dark-4 rounded w-20" />
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
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
  const fixtureStatus = fixture.fixture.status.short;

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

      {/* Mobile-only tab bar (hidden on xl where sidebars take over) */}
      <div className="xl:hidden relative border-b border-brand-dark-5 bg-brand-dark-2 sticky top-0 z-10">
        <div className="flex overflow-x-auto scrollbar-hide">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={clsx(
                "px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 shrink-0",
                mobileTab === tab.id
                  ? "text-white border-brand-accent"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-brand-dark-2 to-transparent" />
      </div>

      {/* Main content area */}
      <div>
        {/* On xl+: always show Predictions hub in centre */}
        <div className="hidden xl:block">
          <MatchVotePanel
            fixtureId={fixture.fixture.id}
            prediction={prediction}
            homeTeamName={fixture.teams.home.name}
            awayTeamName={fixture.teams.away.name}
          />
          <MatchDerivedMarkets
            fixtureId={fixture.fixture.id}
            homeTeamName={fixture.teams.home.name}
            awayTeamName={fixture.teams.away.name}
            kickoff={fixture.fixture.date ?? null}
            status={fixtureStatus}
          />
          {/* Only once there is something to show. Above xl the centre column
              has no tabs, so an empty state here would be permanent furniture
              on every upcoming fixture. */}
          {playerRatings.length > 0 && (
            <div className="border-t border-brand-dark-5">
              <h3 className="px-4 pt-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                Player ratings
              </h3>
              <MatchPlayerRatings teams={playerRatings} fixtureStatus={fixtureStatus} />
            </div>
          )}
        </div>

        {/* Mobile: show whichever tab is active */}
        <div className="xl:hidden">
          {mobileTab === "predictions" && (
            <>
              <MatchVotePanel
                fixtureId={fixture.fixture.id}
                prediction={prediction}
                homeTeamName={fixture.teams.home.name}
                awayTeamName={fixture.teams.away.name}
              />
              <MatchDerivedMarkets
                fixtureId={fixture.fixture.id}
                homeTeamName={fixture.teams.home.name}
                awayTeamName={fixture.teams.away.name}
                kickoff={fixture.fixture.date ?? null}
                status={fixtureStatus}
              />
            </>
          )}
          {mobileTab === "summary" && (
            <MatchSummary
              events={events}
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
              fixtureStatus={fixtureStatus}
            />
          )}
          {mobileTab === "lineups" && (
            <>
              {/* Above the lineups on purpose: before kick-off the starting XI
                  does not exist yet, and who is unavailable is the only team
                  information there is. */}
              <div className="border-b border-brand-dark-5">
                <h3 className="px-4 pt-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Team news
                </h3>
                <MatchTeamNews
                  injuries={injuries}
                  homeTeamId={homeTeamId}
                  awayTeamId={awayTeamId}
                  homeTeamName={fixture.teams.home.name}
                  awayTeamName={fixture.teams.away.name}
                  fixtureStatus={fixtureStatus}
                />
              </div>
              <MatchLineups lineups={lineups} fixtureStatus={fixtureStatus} />
            </>
          )}
          {mobileTab === "players" && (
            <MatchPlayerRatings teams={playerRatings} fixtureStatus={fixtureStatus} />
          )}
          {mobileTab === "statistics" && (
            <MatchStats stats={stats} fixtureStatus={fixtureStatus} />
          )}
          {mobileTab === "h2h" && (
            <MatchH2H fixtures={h2h} homeTeamId={homeTeamId} awayTeamId={awayTeamId} />
          )}
          {mobileTab === "standings" && (
            <MatchStandings standings={standings} highlightTeamIds={[homeTeamId, awayTeamId]} />
          )}
        </div>
      </div>
    </div>
  );
}
