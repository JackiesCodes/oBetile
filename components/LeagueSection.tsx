"use client";

import { useState } from "react";
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

export default function LeagueSection({ league, country, leagueId, matches }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const flag = countryFlags[country] || "🌍";
  const liveCount = matches.filter((m) => m.status === "live").length;
  const { isFavourite, toggleFavourite } = useFavourites();
  const starred = leagueId ? isFavourite("league", leagueId) : false;

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
            <MatchRow key={match.id} match={match} />
          ))}
        </>
      )}
    </div>
  );
}
