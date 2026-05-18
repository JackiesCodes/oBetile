"use client";

import { usePredictions } from "@/context/BetSlipContext";
import { oddsToPercent } from "@/lib/utils";
import { Match } from "@/types";
import clsx from "clsx";

interface Props {
  match: Match;
  market: "home" | "draw" | "away";
  label: "Home" | "Draw" | "Away";
}

export default function OddsButton({ match, market, label }: Props) {
  const { addBet, removeBet, hasBet } = usePredictions();
  const odds = match.odds[market];
  const marketKey = `1x2-${market}`;
  const selected = hasBet(match.id, marketKey);

  if (odds === null) {
    return (
      <div className="w-16 h-14 flex items-center justify-center bg-brand-dark-4 rounded text-gray-600 text-xs">
        —
      </div>
    );
  }

  const pct = oddsToPercent(odds);

  const selectionLabel =
    market === "home" ? match.home : market === "away" ? match.away : "Draw";

  const handleClick = () => {
    if (selected) {
      removeBet(match.id, marketKey);
    } else {
      addBet({
        matchId: match.id,
        home: match.home,
        away: match.away,
        market: marketKey,
        selection: selectionLabel,
        odds,
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={clsx(
        "relative w-16 h-14 flex flex-col items-center justify-center rounded text-xs font-semibold transition-all border overflow-hidden",
        selected
          ? "bg-brand-green text-black border-brand-green shadow-[0_0_8px_rgba(0,185,9,0.4)]"
          : "bg-brand-dark-4 text-white border-transparent hover:border-brand-green"
      )}
    >
      {/* Label */}
      <span
        className="text-[9px] leading-none mb-0.5 z-10"
        style={{ color: selected ? "rgba(0,0,0,0.55)" : "#6b7280" }}
      >
        {label}
      </span>
      {/* Percentage */}
      <span
        className={clsx("text-sm font-bold leading-none z-10", selected ? "text-black" : "text-brand-green")}
      >
        {pct}%
      </span>
      {/* Fill bar track */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-dark-5 z-10">
        <div
          className={clsx("h-full transition-all", selected ? "bg-white/40" : "bg-brand-green")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
