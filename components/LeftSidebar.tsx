"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Zap, Calendar, X, Trash2, ChevronDown, ChevronUp, Star } from "lucide-react";
import clsx from "clsx";
import { usePredictions } from "@/context/BetSlipContext";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";

const topLeagues = [
  { name: "Premier League", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "UEFA Champions League", country: "International Clubs", flag: "🌍" },
  { name: "Serie A", country: "Italy", flag: "🇮🇹" },
  { name: "LaLiga", country: "Spain", flag: "🇪🇸" },
  { name: "Bundesliga", country: "Germany", flag: "🇩🇪" },
  { name: "Ligue 1", country: "France", flag: "🇫🇷" },
  { name: "Eredivisie", country: "Netherlands", flag: "🇳🇱" },
];

export default function LeftSidebar() {
  const pathname = usePathname();
  const { items, removeBet, clearAll } = usePredictions();
  const { user, openAuthModal } = useAuth();
  const { favourites } = useFavourites();
  const [topLeaguesOpen, setTopLeaguesOpen] = useState(false);
  const [myLeaguesOpen, setMyLeaguesOpen] = useState(true);
  const starredLeagues = favourites.filter((f) => f.type === "league");

  return (
    <aside className="w-56 shrink-0 bg-brand-dark-2 border-r border-brand-dark-5 overflow-y-auto hidden lg:flex flex-col">

      {/* ── Quick Links ─────────────────────────────────────── */}
      <div className="p-3 border-b border-brand-dark-5">
        {[
          { icon: <Zap size={14} />, label: "Live Predictions", href: "/live", badge: "LIVE" },
          { icon: <Trophy size={14} />, label: "Season Picks", href: "/?tab=Season+Picks" },
          { icon: <Calendar size={14} />, label: "Upcoming", href: "/?tab=Upcoming" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center justify-between px-2 py-2 rounded text-sm transition-colors mb-0.5",
              pathname === item.href
                ? "bg-brand-dark-4 text-white"
                : "text-gray-400 hover:bg-brand-dark-4 hover:text-white"
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-brand-green">{item.icon}</span>
              {item.label}
            </span>
            {item.badge && (
              <span className="bg-brand-green text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── My Leagues (starred) ────────────────────────────── */}
      <div className="border-b border-brand-dark-5">
        <button
          onClick={() => setMyLeaguesOpen((p) => !p)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-brand-dark-3 transition-colors"
        >
          <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <Star size={11} className="text-yellow-400" />
            My Leagues
          </span>
          {myLeaguesOpen ? (
            <ChevronUp size={13} className="text-gray-500" />
          ) : (
            <ChevronDown size={13} className="text-gray-500" />
          )}
        </button>

        {myLeaguesOpen && (
          <div className="pb-1">
            {starredLeagues.length === 0 ? (
              <p className="px-3 pb-2 text-[11px] text-gray-600">
                Star a league to save it here
              </p>
            ) : (
              starredLeagues.map((fav) => (
                <Link
                  key={fav.external_id}
                  href={`/?tab=Highlights`}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-brand-dark-4 hover:text-white transition-colors"
                >
                  <Star size={10} className="text-yellow-400 shrink-0" />
                  <span className="truncate">{fav.name}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Top Leagues (collapsible, default collapsed) ────── */}
      <div className="border-b border-brand-dark-5">
        <button
          onClick={() => setTopLeaguesOpen((p) => !p)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-brand-dark-3 transition-colors"
        >
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Top Leagues
          </span>
          {topLeaguesOpen ? (
            <ChevronUp size={13} className="text-gray-500" />
          ) : (
            <ChevronDown size={13} className="text-gray-500" />
          )}
        </button>

        {topLeaguesOpen && (
          <div className="pb-1">
            {topLeagues.map((league) => (
              <Link
                key={league.name}
                href={`/sport/soccer?league=${encodeURIComponent(league.name)}`}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-brand-dark-4 hover:text-white transition-colors"
              >
                <span className="text-base">{league.flag}</span>
                <div>
                  <div className="font-medium leading-tight text-xs">{league.name}</div>
                  <div className="text-[10px] text-gray-500">{league.country}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── My Picks Panel ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col border-b border-brand-dark-5">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">My Picks</span>
          {items.length > 0 && (
            <span className="bg-brand-green text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {items.length}
            </span>
          )}
        </div>

        {!user ? (
          <div className="px-3 pb-3 text-center">
            <p className="text-gray-500 text-[11px] mb-2">Log in to save your picks</p>
            <button
              onClick={() => openAuthModal("login")}
              className="w-full text-[11px] font-semibold bg-brand-green text-black py-1.5 rounded transition-colors hover:bg-brand-green-hover"
            >
              Log In
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 pb-3 text-center">
            <span className="text-2xl block mb-1">🔮</span>
            <p className="text-gray-500 text-[11px]">Click a match to add picks</p>
          </div>
        ) : (
          <div className="px-2 pb-2 space-y-1.5 max-h-56 overflow-y-auto">
            {items.map((item) => (
              <div
                key={`${item.matchId}-${item.market}`}
                className="flex items-start gap-1.5 bg-brand-dark-3 rounded-lg px-2 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-brand-green font-semibold truncate">{item.selection}</div>
                  <div className="text-[9px] text-gray-500 truncate">{item.home} v {item.away}</div>
                </div>
                <button
                  onClick={() => removeBet(item.matchId, item.market)}
                  className="text-gray-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button
              onClick={clearAll}
              className="flex items-center justify-center gap-1 w-full text-gray-500 hover:text-red-400 text-[10px] py-1 transition-colors"
            >
              <Trash2 size={10} />
              Clear All
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
