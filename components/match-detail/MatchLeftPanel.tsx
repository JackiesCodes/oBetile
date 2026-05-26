"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import clsx from "clsx";
import { useMatchDetail } from "@/context/MatchDetailContext";

const FINISHED = new Set(["FT", "AET", "PEN"]);

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

export default function MatchLeftPanel() {
  const { matchDetail, setMatchDetail } = useMatchDetail();
  if (!matchDetail) return null;

  const { fixture, events, lineups, h2h } = matchDetail;
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const status = fixture.fixture.status.short;
  const isFinished = FINISHED.has(status);
  const isUpcoming = ["NS", "TBD", "PST"].includes(status);

  // Filter to goals + red cards only
  const keyEvents = events.filter((e: any) =>
    e.type === "Goal" || (e.type === "Card" && e.detail === "Red Card")
  );

  const [home, away] = lineups;

  // H2H last 5
  const h2hLast5 = h2h.slice(0, 5);

  return (
    <aside className="flex flex-col overflow-y-auto h-full bg-brand-dark-2 border-r border-brand-dark-5">
      {/* Back button */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-brand-dark-5 bg-brand-dark-3">
        <span className="text-xs font-bold text-white truncate">
          {fixture.teams.home.name} vs {fixture.teams.away.name}
        </span>
        <button
          onClick={() => setMatchDetail(null)}
          className="text-gray-500 hover:text-white transition-colors shrink-0 ml-2"
          title="Back to sidebar"
        >
          <X size={14} />
        </button>
      </div>

      {/* Match Events */}
      <Section title="Events">
        {keyEvents.length === 0 ? (
          <p className="px-3 pb-2 text-[11px] text-gray-600">
            {isUpcoming ? "Match hasn't started yet." : isFinished ? "No event data for this competition." : "No events yet."}
          </p>
        ) : (
          keyEvents.map((e: any, i: number) => {
            const isHome = e.team.id === homeId;
            const isGoal = e.type === "Goal";
            return (
              <div
                key={i}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 text-xs",
                  isHome ? "flex-row" : "flex-row-reverse"
                )}
              >
                <span className="text-gray-500 w-6 text-center shrink-0">{e.time.elapsed}&apos;</span>
                <span>{isGoal ? "⚽" : "🟥"}</span>
                <span className="flex-1 truncate text-gray-200">{e.player.name}</span>
              </div>
            );
          })
        )}
      </Section>

      {/* Lineups */}
      <Section title="Lineups" defaultOpen={false}>
        {!home && !away ? (
          <p className="px-3 pb-2 text-[11px] text-gray-600">
            {isUpcoming ? "Lineups not announced yet." : "Lineup data not available for this competition."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-0 divide-x divide-brand-dark-5">
            {[home, away].filter(Boolean).map((lineup: any) => (
              <div key={lineup.team.id} className="px-2 pb-2">
                <div className="flex items-center gap-1 py-1.5 mb-1">
                  {lineup.team.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lineup.team.logo} alt="" className="w-4 h-4 object-contain shrink-0" />
                  )}
                  <span className="text-[10px] font-bold text-gray-300 truncate">{lineup.formation}</span>
                </div>
                {lineup.startXI.map(({ player }: any) => (
                  <div key={player.id} className="flex items-center gap-1 py-0.5">
                    <span className="text-[10px] text-gray-600 w-4 text-center shrink-0">{player.number}</span>
                    <span className="text-[10px] text-gray-300 truncate">{player.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* H2H */}
      <Section title="H2H" defaultOpen={false}>
        {h2hLast5.length === 0 ? (
          <p className="px-3 pb-2 text-[11px] text-gray-600">No head-to-head history found.</p>
        ) : (
          h2hLast5.map((f: any) => {
            const date = new Date(f.fixture.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
            const isHomeWin = f.teams.home.winner === true;
            const isAwayWin = f.teams.away.winner === true;
            return (
              <div key={f.fixture.id} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] border-b border-brand-dark-5 last:border-0">
                <span className="text-gray-600 w-12 shrink-0">{date}</span>
                <span className="flex-1 text-right text-gray-300 truncate">{f.teams.home.name}</span>
                <span className={clsx("font-bold px-1 shrink-0 tabular-nums", isHomeWin ? "text-brand-green" : isAwayWin ? "text-red-400" : "text-gray-400")}>
                  {f.goals.home ?? "–"}-{f.goals.away ?? "–"}
                </span>
                <span className="flex-1 text-left text-gray-300 truncate">{f.teams.away.name}</span>
              </div>
            );
          })
        )}
      </Section>
    </aside>
  );
}
