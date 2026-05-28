"use client";

import { usePredictions } from "@/context/BetSlipContext";
import { X, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

interface HistoryPick {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  pick: "home" | "draw" | "away";
  created_at: string;
}

const PICK_LABEL: Record<string, string> = { home: "Home", draw: "Draw", away: "Away" };
const PICK_COLOR: Record<string, string> = { home: "text-brand-green", draw: "text-gray-400", away: "text-red-400" };

type Tab = "picks" | "history";

export default function BetSlip() {
  const { items, removeBet, clearAll } = usePredictions();
  const { user, openAuthModal } = useAuth();
  const [tab, setTab] = useState<Tab>("picks");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [history, setHistory] = useState<HistoryPick[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!user || !hasSupabaseConfig()) { setHistory([]); return; }
    if (tab !== "history") return;
    setHistoryLoading(true);
    const supabase = createClient();
    supabase
      .from("user_picks")
      .select("id, fixture_id, home_team, away_team, pick, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistory((data as HistoryPick[]) ?? []);
        setHistoryLoading(false);
      });
  }, [user, tab]);

  const tabBar = (
    <div className="flex border-b border-brand-dark-5 shrink-0">
      {(["picks", "history"] as Tab[]).map((t) => (
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
            Click any match outcome to add a pick.
          </p>
        </div>
      ) : (
        <>
          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {items.map((item) => (
              <div
                key={`${item.matchId}-${item.market}`}
                className="bg-brand-dark-3 rounded-lg p-3 border border-brand-dark-5"
              >
                <div className="flex items-start justify-between gap-2">
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
                      {Math.round((1 / item.odds) * 100)}%
                    </span>
                    <button
                      onClick={() => removeBet(item.matchId, item.market)}
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
              <span>{items.length} pick{items.length !== 1 ? "s" : ""} selected</span>
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
          <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
          <div className="w-16 h-16 rounded-full bg-brand-dark-4 flex items-center justify-center">
            <span className="text-3xl">📋</span>
          </div>
          <p className="text-gray-400 text-sm">No pick history yet. Start picking matches!</p>
        </div>
      ) : (
        <div className="p-2 space-y-1.5">
          {history.map((pick) => (
            <div key={pick.id} className="bg-brand-dark-3 rounded-lg px-3 py-2.5 border border-brand-dark-5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-400 truncate">{pick.home_team} vs {pick.away_team}</p>
                <p className={`text-xs font-semibold mt-0.5 ${PICK_COLOR[pick.pick]}`}>{PICK_LABEL[pick.pick]} Win</p>
              </div>
              <p className="text-[10px] text-gray-600 shrink-0">
                {new Date(pick.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            </div>
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
      <aside className="w-72 shrink-0 bg-brand-dark-2 border-l border-brand-dark-5 flex-col hidden xl:flex">
        {panelContent}
      </aside>

      {/* Mobile FAB (< xl) */}
      <div className="xl:hidden fixed bottom-6 right-5 z-50">
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
        <div className="xl:hidden fixed inset-0 z-50 flex flex-col justify-end">
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
