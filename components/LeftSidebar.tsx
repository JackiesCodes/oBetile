"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Zap, Calendar, X, Trash2, ChevronDown, ChevronUp, Star } from "lucide-react";
import clsx from "clsx";
import { usePredictions } from "@/context/PredictionContext";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";
import { useMatchDetail } from "@/context/MatchDetailContext";
import MatchLeftPanel from "@/components/match-detail/MatchLeftPanel";

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
  const { matchDetail } = useMatchDetail();

  if (matchDetail?.fixture) {
    return <MatchLeftPanel />;
  }

  return <LeftSidebarDefault />;
}

function LeftSidebarDefault() {
  const pathname = usePathname();
  const { items, removePrediction, clearAll } = usePredictions();
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

      {/* Picks live in PredictionSlip, which carries the tabs, the settled
          history and a drawer that works on phones. A second copy here showed
          only active picks, only on desktop, and could disagree with it. */}
    </aside>
  );
}
