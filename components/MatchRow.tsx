"use client";

import { Match } from "@/types";
import { getTopPick } from "@/lib/utils";
import OddsButton from "./OddsButton";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";

interface Props {
  match: Match;
}

export default function MatchRow({ match }: Props) {
  const isLive = match.status === "live";
  const pick = getTopPick(match);

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-brand-dark-3 transition-colors border-b border-brand-dark-5 group">
      {/* Time / Live indicator */}
      <div className="w-16 shrink-0 text-center">
        {isLive ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse inline-block" />
              <span className="text-brand-green text-[11px] font-bold">LIVE</span>
            </span>
            {match.minute && (
              <span className="text-gray-400 text-[11px]">{match.minute}&apos;</span>
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">{match.time}</span>
        )}
      </div>

      {/* Teams + Score */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className={clsx("text-sm font-medium truncate", isLive ? "text-white" : "text-gray-200")}>
              {match.home}
            </div>
            <div className={clsx("text-sm font-medium truncate", isLive ? "text-white" : "text-gray-200")}>
              {match.away}
            </div>
          </div>
          {/* Score */}
          {isLive && match.score && (
            <div className="text-center shrink-0">
              <div className="text-brand-green font-bold text-sm leading-tight">
                {match.score.split("-")[0]}
              </div>
              <div className="text-brand-green font-bold text-sm leading-tight">
                {match.score.split("-")[1]}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confidence indicator */}
      {pick && (
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-500 shrink-0 mr-1">
          <span>🔮</span>
          <span className="text-brand-green font-semibold">{pick.label}</span>
          <span>{pick.pct}%</span>
        </div>
      )}

      {/* Prediction buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <OddsButton match={match} market="home" label="Home" />
        <OddsButton match={match} market="draw" label="Draw" />
        <OddsButton match={match} market="away" label="Away" />
      </div>

      {/* More markets */}
      <button className="text-gray-600 hover:text-brand-green transition-colors shrink-0">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
