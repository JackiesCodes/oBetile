"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import { TOP_LEAGUES } from "@/lib/api-football";
import clsx from "clsx";

interface NewsItem {
  id: string;
  type: "injury" | "result";
  text: string;
  timestamp: string;
}

const LEAGUE_OPTIONS = [
  { id: TOP_LEAGUES.premierLeague, label: "PL" },
  { id: TOP_LEAGUES.laLiga, label: "LaLiga" },
  { id: TOP_LEAGUES.bundesliga, label: "Bundesliga" },
];

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function NewsFeedPanel({ collapsed, onToggleCollapse }: Props) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [activeLeague, setActiveLeague] = useState(TOP_LEAGUES.premierLeague);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (collapsed) return;

    let cancelled = false;

    async function fetchNews() {
      setLoading(true);
      try {
        const res = await fetch(`/api/football/news?league=${activeLeague}`);
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
  }, [activeLeague, collapsed]);

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
        <Newspaper size={14} className="text-brand-green shrink-0" />
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
          {/* League switcher */}
          <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
            {LEAGUE_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveLeague(id)}
                className={clsx(
                  "px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors shrink-0",
                  activeLeague === id
                    ? "bg-brand-green text-black"
                    : "bg-brand-dark-4 text-gray-400 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Items list */}
          <div className="pb-3 space-y-0.5">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loading && items.length === 0 && (
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
                <p className="text-[10px] text-gray-600 mt-0.5">{formatTime(item.timestamp)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
