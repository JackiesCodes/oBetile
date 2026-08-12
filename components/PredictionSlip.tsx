"use client";

import { usePredictions } from "@/context/PredictionContext";
import { X, Trash2, Check } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";

type Tab = "picks" | "history";

export default function PredictionSlip() {
  const { items, history, historyLoading, removePrediction, clearAll } = usePredictions();
  const { user, openAuthModal } = useAuth();
  const [tab, setTab] = useState<Tab>("picks");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tapping a pick navigates, so the mobile drawer must not stay open over the
  // page it just opened.
  const closeDrawer = () => setDrawerOpen(false);

  const correctCount = history.filter((h) => h.correct).length;


  const tabBar = (
    <div className="flex border-b border-brand-dark-5 shrink-0">
      {(["picks", "history"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={clsx(
            "flex-1 py-3 text-sm font-semibold uppercase tracking-wide transition-colors",
            tab === t
              ? "text-white border-b-2 border-brand-accent"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          {t === "picks" ? (
            <span className="flex items-center justify-center gap-1.5">
              My Picks
              {items.length > 0 && (
                <span className="bg-brand-green text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </span>
          ) : (
            "Pick History"
          )}
        </button>
      ))}
    </div>
  );

  const picksBody = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
          <div className="w-16 h-16 rounded-full bg-brand-dark-4 flex items-center justify-center">
            <span className="text-3xl">🔮</span>
          </div>
          <p className="text-gray-400 text-sm">
            Tap any win percentage to add a pick. Picks stay here until the
            match finishes, then move to Pick History with the result.
          </p>
        </div>
      ) : (
        <>
          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {items.map((item) => (
              <div
                key={`${item.matchId}-${item.market}`}
                className="bg-brand-dark-3 rounded-lg border border-brand-dark-5 hover:border-brand-accent/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 p-3">
                  {/* The card body navigates; the remove button sits outside the
                      link so tapping it does not open the match. */}
                  <Link
                    href={`/match/${item.matchId}`}
                    onClick={closeDrawer}
                    className="flex-1 min-w-0"
                  >
                    <div className="text-xs text-brand-accent font-semibold truncate">
                      {item.selection}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {item.home} vs {item.away}
                    </div>
                    <div className="text-[11px] text-gray-500">Match Result</div>
                  </Link>
                  <div className="flex items-start gap-2 shrink-0">
                    <span className="text-brand-accent font-bold text-sm">
                      {Math.round((1 / item.odds) * 100)}%
                    </span>
                    <button
                      onClick={() => removePrediction(item.matchId, item.market)}
                      aria-label="Remove pick"
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-brand-dark-5 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{items.length} pick{items.length !== 1 ? "s" : ""} awaiting results</span>
            </div>
            <button
              onClick={clearAll}
              className="w-full flex items-center justify-center gap-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors py-1.5 border border-brand-dark-5 rounded-lg"
            >
              <Trash2 size={12} />
              Clear All
            </button>
          </div>
        </>
      )}
    </div>
  );

  const historyBody = (
    <div className="flex-1 overflow-y-auto">
      {!user ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
          <div className="w-16 h-16 rounded-full bg-brand-dark-4 flex items-center justify-center">
            <span className="text-3xl">📋</span>
          </div>
          <p className="text-gray-400 text-sm">Log in to view your pick history.</p>
          <button
            onClick={() => openAuthModal("login")}
            className="w-full bg-brand-green text-black font-bold py-2.5 rounded text-sm hover:bg-brand-green-hover transition-colors"
          >
            Log In
          </button>
        </div>
      ) : historyLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
          <div className="w-16 h-16 rounded-full bg-brand-dark-4 flex items-center justify-center">
            <span className="text-3xl">📋</span>
          </div>
          <p className="text-gray-400 text-sm">
            No finished picks yet. Once a match you picked ends, it moves here with
            the final score and whether you called it right.
          </p>
        </div>
      ) : (
        <div className="p-2 space-y-1.5">
          {/* Running record across settled picks */}
          <div className="flex items-center justify-between px-1 pb-1.5 text-[11px]">
            <span className="text-gray-500">
              {correctCount} of {history.length} correct
            </span>
            <span className="text-gray-400 font-semibold">
              {Math.round((correctCount / history.length) * 100)}%
            </span>
          </div>

          {history.map((pick) => (
            <Link
              key={`${pick.matchId}-${pick.market}`}
              href={`/match/${pick.matchId}`}
              onClick={closeDrawer}
              className={clsx(
                "block rounded-lg px-3 py-2.5 border transition-colors",
                pick.correct
                  ? "bg-brand-green/5 border-brand-accent/30 hover:border-brand-accent/60"
                  : "bg-brand-dark-3 border-brand-dark-5 hover:border-gray-600"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-400 truncate">
                    {pick.home} vs {pick.away}
                  </p>
                  <p className="text-xs font-semibold mt-0.5 text-gray-300 truncate">
                    You picked <span className="text-white">{pick.selection}</span>
                  </p>
                </div>

                {/* Final score */}
                <div className="text-center shrink-0 px-1">
                  <p className="text-sm font-bold text-white tabular-nums leading-none">
                    {pick.goals.home ?? "–"}–{pick.goals.away ?? "–"}
                  </p>
                  <p className="text-[9px] text-gray-600 mt-0.5 uppercase tracking-wide">Final</p>
                </div>

                {/* Verdict */}
                <span
                  className={clsx(
                    "shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                    pick.correct ? "bg-brand-green text-black" : "bg-red-500/20 text-red-400"
                  )}
                  title={pick.correct ? "Correct" : "Wrong"}
                >
                  {pick.correct ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const panelContent = (
    <>
      {tabBar}
      {tab === "picks" ? picksBody : historyBody}
    </>
  );

  return (
    <>
      {/* Desktop sidebar (xl+) */}
      <aside className="w-72 shrink-0 bg-brand-dark-2 border-l border-brand-dark-5 flex-col hidden 2xl:flex">
        {panelContent}
      </aside>

      {/* Mobile FAB (< xl) */}
      <div className="2xl:hidden fixed bottom-6 right-5 z-50">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 bg-brand-green text-black font-bold px-4 py-3 rounded-full shadow-lg hover:bg-brand-green-hover transition-colors"
        >
          <span>🔮</span>
          <span>My Picks</span>
          {items.length > 0 && (
            <span className="bg-black/25 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ml-0.5">
              {items.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile bottom drawer (< xl) */}
      {drawerOpen && (
        <div className="2xl:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative bg-brand-dark-2 rounded-t-2xl max-h-[82vh] flex flex-col border-t border-brand-dark-5 shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-brand-dark-5 shrink-0">
              <span className="text-white font-bold text-sm">
                My Picks {items.length > 0 && `(${items.length})`}
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {panelContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
