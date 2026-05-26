"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";
import { useMatchDetail } from "@/context/MatchDetailContext";

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-brand-dark-5">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-brand-dark-3 transition-colors"
      >
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</span>
        {open ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

const KEY_STATS = [
  "Ball Possession",
  "Shots on Goal",
  "Corners",
  "Fouls",
  "Yellow Cards",
  "Saves",
];

export default function MatchRightPanel() {
  const { matchDetail } = useMatchDetail();
  if (!matchDetail) return null;

  const { fixture, stats, standings } = matchDetail;
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const status = fixture.fixture.status.short;
  const isUpcoming = ["NS", "TBD", "PST"].includes(status);

  // Build stats map: { [type]: { home: val, away: val } }
  const homeStats: Record<string, string | number> = {};
  const awayStats: Record<string, string | number> = {};
  if (stats.length >= 1) {
    (stats[0]?.statistics ?? []).forEach((s: any) => { homeStats[s.type] = s.value ?? 0; });
  }
  if (stats.length >= 2) {
    (stats[1]?.statistics ?? []).forEach((s: any) => { awayStats[s.type] = s.value ?? 0; });
  }

  // Parse percentage strings like "60%"
  const parseVal = (v: string | number | undefined) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    return parseFloat(v.toString().replace("%", "")) || 0;
  };

  const highlightIds = [homeId, awayId];

  return (
    <aside className="flex flex-col overflow-y-auto h-full bg-brand-dark-2 border-l border-brand-dark-5">

      {/* Key Stats */}
      <Section title="Key Statistics">
        {isUpcoming || (!stats.length) ? (
          <p className="px-3 pb-2 text-[11px] text-gray-600">
            {isUpcoming ? "Stats will be available during the match." : "Statistics not available for this competition."}
          </p>
        ) : (
          <div className="px-3 pb-2 space-y-2">
            {/* Team headers */}
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
              <span className="truncate max-w-[35%]">{fixture.teams.home.name}</span>
              <span className="truncate max-w-[35%] text-right">{fixture.teams.away.name}</span>
            </div>
            {KEY_STATS.map((statName) => {
              const hv = parseVal(homeStats[statName]);
              const av = parseVal(awayStats[statName]);
              const total = hv + av;
              const hPct = total > 0 ? (hv / total) * 100 : 50;
              const aPct = total > 0 ? (av / total) * 100 : 50;
              return (
                <div key={statName}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="font-bold text-white">{homeStats[statName] ?? 0}</span>
                    <span className="text-gray-500 text-center flex-1 mx-1 truncate">{statName}</span>
                    <span className="font-bold text-white">{awayStats[statName] ?? 0}</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                    <div className="bg-brand-green rounded-l-full" style={{ width: `${hPct}%` }} />
                    <div className="bg-red-500 rounded-r-full" style={{ width: `${aPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* League Table */}
      <Section title="League Table" defaultOpen={true}>
        {!standings.length ? (
          <p className="px-3 pb-2 text-[11px] text-gray-600">Standings not available.</p>
        ) : (
          <div className="overflow-x-auto">
            {/* Header */}
            <div className="flex items-center px-3 py-1 text-[9px] text-gray-600 font-semibold">
              <span className="w-5 shrink-0">#</span>
              <span className="flex-1">Team</span>
              <span className="w-5 text-center">P</span>
              <span className="w-5 text-center">W</span>
              <span className="w-5 text-center">D</span>
              <span className="w-5 text-center">L</span>
              <span className="w-6 text-center font-bold">Pts</span>
            </div>
            {standings.map((row: any) => {
              const isHL = highlightIds.includes(row.team.id);
              return (
                <div
                  key={row.team.id}
                  className={clsx(
                    "flex items-center px-3 py-1 text-[10px]",
                    isHL ? "bg-brand-green/10 border-l-2 border-l-brand-green" : "hover:bg-brand-dark-3"
                  )}
                >
                  <span className={clsx("w-5 shrink-0 font-semibold", isHL ? "text-brand-green" : "text-gray-500")}>
                    {row.rank}
                  </span>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    {row.team.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.team.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 bg-brand-dark-4 rounded-full shrink-0" />
                    )}
                    <span className={clsx("truncate", isHL ? "text-white font-semibold" : "text-gray-300")}>
                      {row.team.name}
                    </span>
                  </div>
                  <span className="w-5 text-center text-gray-500">{row.all.played}</span>
                  <span className="w-5 text-center text-gray-500">{row.all.win}</span>
                  <span className="w-5 text-center text-gray-500">{row.all.draw}</span>
                  <span className="w-5 text-center text-gray-500">{row.all.lose}</span>
                  <span className="w-6 text-center font-bold text-white">{row.points}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </aside>
  );
}
