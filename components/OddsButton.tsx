"use client";

import { useBetSlip } from "@/context/BetSlipContext";
import { Match } from "@/types";
import clsx from "clsx";

interface Props {
  match: Match;
  market: "home" | "draw" | "away";
  label: "1" | "X" | "2";
}

export default function OddsButton({ match, market, label }: Props) {
  const { addBet, removeBet, hasBet } = useBetSlip();
  const odds = match.odds[market];
  const marketKey = `1x2-${market}`;
  const selected = hasBet(match.id, marketKey);

  if (odds === null) {
    return (
      <div className="w-16 h-9 flex items-center justify-center bg-brand-dark-4 rounded text-gray-600 text-xs">
        —
      </div>
    );
  }

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
        "w-16 h-9 flex flex-col items-center justify-center rounded text-xs font-semibold transition-all border",
        selected
          ? "bg-brand-green text-black border-brand-green shadow-[0_0_8px_rgba(0,185,9,0.4)]"
          : "bg-brand-dark-4 text-white border-transparent hover:border-brand-green hover:text-brand-green"
      )}
    >
      <span className="text-[10px] text-gray-400 leading-none mb-0.5" style={{ color: selected ? "rgba(0,0,0,0.6)" : undefined }}>
        {label}
      </span>
      <span className="leading-none">{odds.toFixed(2)}</span>
    </button>
  );
}
