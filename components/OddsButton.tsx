"use client";

import { usePredictions } from "@/context/PredictionContext";
import { oddsToPercent } from "@/lib/utils";
import { Match } from "@/types";
import clsx from "clsx";

interface Props {
  match: Match;
  market: "home" | "draw" | "away";
  label: "Home" | "Draw" | "Away";
}

export default function OddsButton({ match, market, label }: Props) {
  const { addPrediction, removePrediction, hasPrediction } = usePredictions();
  const odds = match.odds[market];
  const marketKey = `1x2-${market}`;
  const selected = hasPrediction(match.id, marketKey);

  if (odds === null) {
    return (
      // Same footprint as the real button so rows stay aligned whether or not
      // a fixture is priced.
      <div className="w-[3.1rem] h-12 sm:w-16 sm:h-14 flex items-center justify-center bg-brand-dark-4 rounded text-gray-600 text-xs shrink-0">
        —
      </div>
    );
  }

  const pct = oddsToPercent(odds);

  const selectionLabel =
    market === "home" ? match.home : market === "away" ? match.away : "Draw";

  const handleClick = () => {
    if (selected) {
      removePrediction(match.id, marketKey);
    } else {
      addPrediction({
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
        // Narrower on phones: three of these plus the kick-off time otherwise
        // leave no room for the team names on a 390px screen.
        "relative w-[3.1rem] h-12 sm:w-16 sm:h-14 shrink-0 flex flex-col items-center justify-center rounded text-xs font-semibold transition-all border overflow-hidden",
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
      {/* Selected checkmark */}
      {selected && (
        <span className="absolute top-0.5 right-1 text-[9px] text-black/60 leading-none font-bold z-10">✓</span>
      )}
    </button>
  );
}
