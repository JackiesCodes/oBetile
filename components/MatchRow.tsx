"use client";

import Link from "next/link";
import { Match } from "@/types";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";

interface Props {
  match: Match;
}

export default function MatchRow({ match }: Props) {
  const isLive = match.status === "live";

  return (
    <Link
      href={`/match/${match.id}`}
      className="flex items-center gap-2 px-3 py-2.5 hover:bg-brand-dark-3 transition-colors border-b border-brand-dark-5 group cursor-pointer"
    >
      {/* Time / Live indicator */}
      <div className="w-14 shrink-0 text-center">
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
          {/* Score (live only) */}
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

      <ChevronRight size={15} className="text-gray-600 group-hover:text-brand-green transition-colors shrink-0" />
    </Link>
  );
}
