"use client";

import { usePredictions } from "@/context/BetSlipContext";
import { oddsToPercent } from "@/lib/utils";
import { X, Trash2 } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

type Tab = "predictions" | "history";

export default function BetSlip() {
  const { items, removeBet, clearAll, stake, setStake } = usePredictions();
  const [tab, setTab] = useState<Tab>("predictions");
  const [betType, setBetType] = useState<"single" | "parlay">("parlay");

  const totalOdds = items.reduce((acc, b) => acc * b.odds, 1);
  const potentialWin = stake > 0 ? (stake * totalOdds).toFixed(2) : "0.00";

  return (
    <aside className="w-72 shrink-0 bg-brand-dark-2 border-l border-brand-dark-5 flex flex-col hidden xl:flex">
      {/* Tabs */}
      <div className="flex border-b border-brand-dark-5">
        {(["predictions", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "flex-1 py-3 text-sm font-semibold uppercase tracking-wide transition-colors",
              tab === t
                ? "text-white border-b-2 border-brand-green"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            {t === "predictions" ? (
              <span className="flex items-center justify-center gap-1.5">
                Predictions
                {items.length > 0 && (
                  <span className="bg-brand-green text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {items.length}
                  </span>
                )}
              </span>
            ) : (
              "History"
            )}
          </button>
        ))}
      </div>

      {tab === "predictions" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-brand-dark-4 flex items-center justify-center">
                <span className="text-3xl">🔮</span>
              </div>
              <p className="text-gray-400 text-sm">
                Click any outcome to add a prediction.
              </p>
            </div>
          ) : (
            <>
              {/* Single / Parlay toggle */}
              <div className="flex p-2 gap-1 border-b border-brand-dark-5">
                {(["single", "parlay"] as const).map((bt) => (
                  <button
                    key={bt}
                    onClick={() => setBetType(bt)}
                    className={clsx(
                      "flex-1 py-1.5 rounded text-xs font-semibold uppercase transition-colors",
                      betType === bt
                        ? "bg-brand-green text-black"
                        : "bg-brand-dark-4 text-gray-400 hover:text-white"
                    )}
                  >
                    {bt === "single" ? "Single" : "Parlay"}
                  </button>
                ))}
              </div>

              {/* Predictions list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map((item) => (
                  <div
                    key={`${item.matchId}-${item.market}`}
                    className="bg-brand-dark-3 rounded-lg p-3 border border-brand-dark-5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-brand-green font-semibold truncate">
                          {item.selection}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">
                          {item.home} vs {item.away}
                        </div>
                        <div className="text-[11px] text-gray-500">Match Result</div>
                      </div>
                      <div className="flex items-start gap-2 shrink-0">
                        <span className="text-brand-green font-bold text-sm">
                          {oddsToPercent(item.odds)}%
                        </span>
                        <button
                          onClick={() => removeBet(item.matchId, item.market)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {betType === "single" && (
                      <div className="mt-2">
                        <input
                          type="number"
                          placeholder="Entry Amount (BWP)"
                          className="w-full bg-brand-dark-5 text-white text-xs rounded px-2 py-1.5 outline-none border border-brand-dark-5 focus:border-brand-green"
                        />
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] text-gray-500">Potential Return</span>
                          <span className="text-[10px] text-brand-green font-semibold">BWP —</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Entry + Total */}
              {betType === "parlay" && (
                <div className="p-3 border-t border-brand-dark-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Parlay Odds</span>
                    <span className="text-white font-bold text-sm">{totalOdds.toFixed(2)}</span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">BWP</span>
                    <input
                      type="number"
                      min={0}
                      value={stake || ""}
                      onChange={(e) => setStake(parseFloat(e.target.value) || 0)}
                      placeholder="Entry Amount"
                      className="w-full bg-brand-dark-4 text-white text-sm rounded px-3 py-2.5 pl-10 outline-none border border-brand-dark-5 focus:border-brand-green"
                    />
                  </div>

                  {/* Quick stake buttons */}
                  <div className="grid grid-cols-4 gap-1">
                    {[10, 20, 50, 100].map((v) => (
                      <button
                        key={v}
                        onClick={() => setStake(v)}
                        className="bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-300 text-xs py-1.5 rounded transition-colors font-medium"
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Potential Return</span>
                    <span className="text-brand-green font-bold">BWP {potentialWin}</span>
                  </div>

                  <button className="w-full bg-brand-green hover:bg-brand-green-hover text-black font-bold py-3 rounded-lg text-sm transition-colors">
                    Submit Prediction
                  </button>

                  <button
                    onClick={clearAll}
                    className="w-full flex items-center justify-center gap-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors py-1"
                  >
                    <Trash2 size={12} />
                    Clear All
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-brand-dark-4 flex items-center justify-center">
            <span className="text-3xl">📋</span>
          </div>
          <p className="text-gray-400 text-sm">
            Log in to view your prediction history.
          </p>
          <button className="w-full bg-brand-green text-black font-bold py-2.5 rounded text-sm">
            Log In
          </button>
        </div>
      )}
    </aside>
  );
}
