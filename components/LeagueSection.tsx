"use client";

import { useState, useEffect } from "react";
import { Match } from "@/types";
import MatchRow from "./MatchRow";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import { countryFlags } from "@/data/matches";
import { useFavourites } from "@/context/FavouritesContext";

interface Props {
  league: string;
  country: string;
  leagueId?: number;
  matches: Match[];
}

type FixtureVotes = Record<string, { home: number; draw: number; away: number }>;

export default function LeagueSection({ league, country, leagueId, matches }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [votes, setVotes] = useState<FixtureVotes>({});
  const [votesFetched, setVotesFetched] = useState(false);
  const flag = countryFlags[country] || "🌍";
  const liveCount = matches.filter((m) => m.status === "live").length;
  const { isFavourite, toggleFavourite } = useFavourites();
  const starred = leagueId ? isFavourite("league", leagueId) : false;

  // Fetch votes when section is expanded (once per mount)
  useEffect(() => {
    if (collapsed || votesFetched || matches.length === 0) return;
    setVotesFetched(true);

    const ids = matches.map((m) => m.id).join(",");
    fetch(`/api/community/votes/batch?fixtures=${ids}`)
      .then((r) => r.json())
      .then((data: Record<string, { "1x2"?: { home: number; draw: number; away: number } }>) => {
        const mapped: FixtureVotes = {};
        for (const [fixtureId, markets] of Object.entries(data)) {
          if (markets["1x2"]) {
            mapped[fixtureId] = markets["1x2"];
          }
        }
        setVotes(mapped);
      })
      .catch(() => { /* silent fail — chips just stay empty */ });
  }, [collapsed, votesFetched, matches]);

  return (
    <div className="mb-0.5">
      {/* League Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-3 bg-brand-dark-3 hover:bg-brand-dark-4 transition-colors text-left"
      >
        <span className="text-base">{flag}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-200">{league}</span>
          <span className="text-xs text-gray-500 ml-2">{country}</span>
        </div>
        <span className="text-[10px] text-gray-500 font-medium">
          {matches.length} match{matches.length !== 1 ? "es" : ""}{liveCount > 0 ? ` · ${liveCount} live` : " · upcoming"}
        </span>
        <Star
          size={13}
          className={starred ? "text-yellow-400 shrink-0 mr-1" : "text-gray-600 hover:text-yellow-400 transition-colors shrink-0 mr-1"}
          onClick={(e) => {
            e.stopPropagation();
            if (leagueId) toggleFavourite("league", leagueId, league);
          }}
        />
        {collapsed ? (
          <ChevronDown size={14} className="text-gray-500 shrink-0" />
        ) : (
          <ChevronUp size={14} className="text-gray-500 shrink-0" />
        )}
      </button>

      {!collapsed && (
        <>
          {matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              votes={votes[String(match.id)]}
            />
          ))}
        </>
      )}
    </div>
  );
}
