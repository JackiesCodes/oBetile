"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import type { NewsItem } from "@/types";
import type { ActiveLeague } from "@/app/api/football/leagues/active/route";
import clsx from "clsx";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeLeagues: ActiveLeague[];
}

const ALL = "all";

export default function NewsFeedPanel({ collapsed, onToggleCollapse, activeLeagues }: Props) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [activeLeague, setActiveLeague] = useState<number | typeof ALL>(ALL);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (collapsed) return;
    if (activeLeagues.length === 0) return;

    let cancelled = false;

    async function fetchNews() {
      setLoading(true);
      try {
        const leagueIds =
          activeLeague === ALL ? activeLeagues.map((l) => l.id) : [activeLeague];
        const res = await fetch(`/api/football/news?leagues=${leagueIds.join(",")}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setItems(data);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNews();
    const interval = setInterval(fetchNews, 300_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeLeague, collapsed, activeLeagues]);

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  return (
    <section className="border-b border-brand-dark-5">
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-brand-dark-3 transition-colors text-left"
      >
        <Newspaper size={14} className="text-brand-accent shrink-0" />
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex-1">
          News Feed
        </span>
        {collapsed ? (
          <ChevronDown size={13} className="text-gray-500" />
        ) : (
          <ChevronUp size={13} className="text-gray-500" />
        )}
      </button>

      {!collapsed && (
        <>
          {/* League switcher — built from whichever leagues currently have a season in progress */}
          {activeLeagues.length > 0 && (
            <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveLeague(ALL)}
                className={clsx(
                  "px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors shrink-0",
                  activeLeague === ALL
                    ? "bg-brand-green text-black"
                    : "bg-brand-dark-4 text-gray-400 hover:text-white"
                )}
              >
                All
              </button>
              {activeLeagues.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveLeague(l.id)}
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors shrink-0",
                    activeLeague === l.id
                      ? "bg-brand-green text-black"
                      : "bg-brand-dark-4 text-gray-400 hover:text-white"
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}

          {/* Items list */}
          <div className="pb-3 space-y-0.5">
            {activeLeagues.length === 0 && (
              <p className="text-center text-gray-500 text-[11px] py-4 px-3">
                No leagues currently in season
              </p>
            )}
            {activeLeagues.length > 0 && loading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {activeLeagues.length > 0 && !loading && items.length === 0 && (
              <p className="text-center text-gray-500 text-[11px] py-4 px-3">
                No news available right now
              </p>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="px-4 py-2 hover:bg-brand-dark-3 transition-colors"
              >
                <p className="text-[11px] text-gray-300 leading-relaxed">{item.text}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {activeLeague === ALL && item.leagueName ? `${item.leagueName} · ` : ""}
                  {formatTime(item.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
