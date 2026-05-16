"use client";

import { useState } from "react";
import { Match } from "@/types";
import MatchRow from "./MatchRow";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import { countryFlags } from "@/data/matches";

interface Props {
  league: string;
  country: string;
  matches: Match[];
}

export default function LeagueSection({ league, country, matches }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const flag = countryFlags[country] || "🌍";
  const liveCount = matches.filter((m) => m.status === "live").length;

  return (
    <div className="mb-0.5">
      {/* League Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-brand-dark-3 hover:bg-brand-dark-4 transition-colors text-left"
      >
        <span className="text-base">{flag}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-200">{league}</span>
          <span className="text-xs text-gray-500 ml-2">{country}</span>
        </div>
        {liveCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-brand-green font-bold bg-brand-green/10 px-1.5 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
            {liveCount} LIVE
          </span>
        )}
        <Star size={13} className="text-gray-600 hover:text-yellow-400 transition-colors shrink-0 mr-1" />
        {collapsed ? (
          <ChevronDown size={14} className="text-gray-500 shrink-0" />
        ) : (
          <ChevronUp size={14} className="text-gray-500 shrink-0" />
        )}
      </button>

      {/* Column Headers */}
      {!collapsed && (
        <>
          <div className="flex items-center px-3 py-1.5 bg-brand-dark-2 border-b border-brand-dark-5">
            <div className="w-16 shrink-0" />
            <div className="flex-1" />
            <div className="flex gap-1.5 shrink-0">
              {["1", "X", "2"].map((h) => (
                <div key={h} className="w-16 text-center text-[11px] text-gray-500 font-semibold">
                  {h}
                </div>
              ))}
              <div className="w-4" />
            </div>
          </div>
          {matches.map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </>
      )}
    </div>
  );
}
