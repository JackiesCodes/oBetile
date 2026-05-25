"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { APIFixture } from "@/types";
import { normalizeFixture } from "@/lib/api-football";

interface Props {
  onClose: () => void;
}

export default function NotificationsPanel({ onClose }: Props) {
  const [liveMatches, setLiveMatches] = useState<ReturnType<typeof normalizeFixture>[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Load live matches + auto-refresh every 30s
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetch("/api/football/live").then((r) => r.json());
        if (!cancelled) {
          const matches = (Array.isArray(data) ? data as APIFixture[] : []).map(normalizeFixture);
          setLiveMatches(matches);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-10 w-80 bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-dark-5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
          <span className="text-sm font-bold text-white">Live Now</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && liveMatches.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-gray-500">
            <span className="text-2xl">📭</span>
            <p className="text-xs">No live matches right now.</p>
          </div>
        )}

        {!loading && liveMatches.map((m) => (
          <Link
            key={m.id}
            href={`/match/${m.id}`}
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 hover:bg-brand-dark-4 transition-colors border-b border-brand-dark-5 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400 truncate mb-0.5">{m.league}</div>
              <div className="text-xs font-semibold text-white truncate">{m.home}</div>
              <div className="text-xs font-semibold text-white truncate">{m.away}</div>
            </div>
            <div className="text-right shrink-0">
              {m.score ? (
                <div className="text-sm font-bold text-brand-green">{m.score.replace("-", " – ")}</div>
              ) : null}
              <div className="text-[10px] text-brand-green font-bold">
                {m.minute === "HT" ? "HT" : `${m.minute}'`}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
