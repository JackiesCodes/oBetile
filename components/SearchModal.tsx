"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Clock, Trophy, Users, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

interface SearchResults {
  teams: Array<{ team: { id: number; name: string; logo: string; country: string } }>;
  leagues: Array<{ league: { id: number; name: string; logo: string; country: string } }>;
  players: Array<{ player: { id: number; name: string; photo: string }; statistics: Array<{ team: { name: string } }> }>;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

const RECENT_KEY = "obetile_recent_searches";

export default function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      try {
        const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
        setRecent(stored.slice(0, 5));
      } catch { /* ignore */ }
    } else {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/football/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const saveRecent = (q: string) => {
    const next = [q, ...recent.filter((r) => r !== q)].slice(0, 5);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const navigate = (href: string, q: string) => {
    saveRecent(q);
    onClose();
    router.push(href);
  };

  if (!open) return null;

  const hasResults = results && (results.leagues.length > 0 || results.teams.length > 0 || results.players.length > 0);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Search panel */}
      <div className="relative w-full max-w-2xl mx-auto mt-8 sm:mt-20 px-4">
        {/* Input */}
        <div className="flex items-center gap-3 bg-brand-dark-2 rounded-2xl px-4 py-3 border border-brand-dark-5 focus-within:border-brand-green transition-colors shadow-2xl">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search leagues, teams, players..."
            className="flex-1 bg-transparent text-white text-base outline-none placeholder-gray-500"
          />
          {loading && <Loader2 size={16} className="text-gray-400 animate-spin shrink-0" />}
          {query && !loading && (
            <button onClick={() => { setQuery(""); setResults(null); }} className="text-gray-500 hover:text-white shrink-0">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Results dropdown */}
        <div className="bg-brand-dark-2 rounded-2xl border border-brand-dark-5 mt-2 overflow-hidden shadow-2xl max-h-[65vh] sm:max-h-[60vh] overflow-y-auto">
          {!query && recent.length > 0 && (
            <div className="p-3">
              <p className="text-[10px] text-gray-500 uppercase font-semibold px-2 mb-2">Recent</p>
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => handleInput(r)}
                  className="flex items-center gap-2.5 w-full px-2 py-2 text-sm text-gray-300 hover:bg-brand-dark-4 rounded-lg transition-colors"
                >
                  <Clock size={13} className="text-gray-500" />
                  {r}
                </button>
              ))}
            </div>
          )}

          {!query && recent.length === 0 && (
            <div className="p-6 text-center text-gray-500 text-sm">
              Search for leagues, teams, or players
            </div>
          )}

          {query && !loading && !hasResults && results && (
            <div className="p-6 text-center text-gray-500 text-sm">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {hasResults && (
            <div className="p-2">
              {/* Leagues */}
              {results!.leagues.length > 0 && (
                <div className="mb-2">
                  <p className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-semibold px-2 py-1.5">
                    <Trophy size={10} /> Leagues
                  </p>
                  {results!.leagues.slice(0, 4).map(({ league }) => (
                    <button
                      key={league.id}
                      onClick={() => navigate(`/sport/soccer?league=${encodeURIComponent(league.name)}`, query)}
                      className="flex items-center gap-3 w-full px-2 py-2 text-sm text-gray-200 hover:bg-brand-dark-4 rounded-lg transition-colors"
                    >
                      {league.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={league.logo} alt="" className="w-5 h-5 object-contain" />
                      )}
                      <span className="flex-1 text-left">{league.name}</span>
                      <span className="text-[10px] text-gray-500">{league.country}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Teams */}
              {results!.teams.length > 0 && (
                <div className="mb-2">
                  <p className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-semibold px-2 py-1.5">
                    <Users size={10} /> Teams
                  </p>
                  {results!.teams.slice(0, 4).map(({ team }) => (
                    <button
                      key={team.id}
                      onClick={() => navigate(`/sport/soccer?team=${team.id}`, query)}
                      className="flex items-center gap-3 w-full px-2 py-2 text-sm text-gray-200 hover:bg-brand-dark-4 rounded-lg transition-colors"
                    >
                      {team.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo} alt="" className="w-5 h-5 object-contain" />
                      )}
                      <span className="flex-1 text-left">{team.name}</span>
                      <span className="text-[10px] text-gray-500">{team.country}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Players */}
              {results!.players.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-semibold px-2 py-1.5">
                    <Users size={10} /> Players
                  </p>
                  {results!.players.slice(0, 3).map(({ player, statistics }) => (
                    <button
                      key={player.id}
                      onClick={() => navigate(`/sport/soccer`, query)}
                      className="flex items-center gap-3 w-full px-2 py-2 text-sm text-gray-200 hover:bg-brand-dark-4 rounded-lg transition-colors"
                    >
                      {player.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.photo} alt="" className="w-5 h-5 rounded-full object-cover" />
                      )}
                      <span className="flex-1 text-left">{player.name}</span>
                      <span className="text-[10px] text-gray-500">{statistics[0]?.team?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-3">
          Press <kbd className="bg-brand-dark-4 px-1.5 py-0.5 rounded text-gray-400">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
