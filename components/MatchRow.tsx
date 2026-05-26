"use client";

import Link from "next/link";
import { Match } from "@/types";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";

interface VoteCounts {
  home: number;
  draw: number;
  away: number;
}

interface Props {
  match: Match;
  votes?: VoteCounts;
}

function VoteChips({ votes, home, away }: { votes: VoteCounts; home: string; away: string }) {
  const total = votes.home + votes.draw + votes.away;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : null);

  const homePct = pct(votes.home);
  const drawPct = pct(votes.draw);
  const awayPct = pct(votes.away);

  return (
    <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-0.5 pl-[4.25rem]">
      {[
        { label: "1", pct: homePct, title: home },
        { label: "X", pct: drawPct, title: "Draw" },
        { label: "2", pct: awayPct, title: away },
      ].map(({ label, pct, title }) => (
        <div
          key={label}
          title={title}
          className="flex items-center gap-1 bg-brand-dark-4 rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-400"
        >
          <span className="text-gray-500">{label}</span>
          <span className={clsx(pct !== null ? "text-brand-green" : "text-gray-600")}>
            {pct !== null ? `${pct}%` : "—"}
          </span>
        </div>
      ))}
      {total > 0 && (
        <span className="text-[9px] text-gray-600 ml-0.5">{total} votes</span>
      )}
    </div>
  );
}

export default function MatchRow({ match, votes }: Props) {
  const isLive = match.status === "live";

  return (
    <div className="border-b border-brand-dark-5">
      <Link
        href={`/match/${match.id}`}
        className="flex items-center gap-2 px-3 py-3.5 hover:bg-brand-dark-3 transition-colors group cursor-pointer"
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

      {/* Vote chips — outside the Link so clicking doesn't navigate */}
      {votes && (
        <VoteChips votes={votes} home={match.home} away={match.away} />
      )}
    </div>
  );
}
