"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sports } from "@/data/matches";
import { Star, Trophy, Zap, Calendar } from "lucide-react";
import clsx from "clsx";

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

  return (
    <aside className="w-56 shrink-0 bg-brand-dark-2 border-r border-brand-dark-5 overflow-y-auto hidden lg:flex flex-col">
      {/* Quick Links */}
      <div className="p-3 border-b border-brand-dark-5">
        {[
          { icon: <Zap size={14} />, label: "Live Predictions", href: "/live", badge: "111" },
          { icon: <Star size={14} />, label: "My Favourites", href: "/favourites" },
          { icon: <Trophy size={14} />, label: "Season Picks", href: "/outrights" },
          { icon: <Calendar size={14} />, label: "Upcoming", href: "/upcoming" },
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
              <span className="bg-brand-green text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Sports A-Z */}
      <div className="border-b border-brand-dark-5">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">All Sports</span>
        </div>
        <div className="pb-2">
          {sports.map((sport) => (
            <Link
              key={sport.id}
              href={`/sport/${sport.id}`}
              className={clsx(
                "flex items-center justify-between px-3 py-1.5 text-sm transition-colors",
                pathname === `/sport/${sport.id}`
                  ? "bg-brand-dark-4 text-white"
                  : "text-gray-300 hover:bg-brand-dark-4 hover:text-white"
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">{sport.icon}</span>
                <span className="font-medium">{sport.name}</span>
              </span>
              {sport.liveCount && (
                <span className="text-[10px] text-brand-green font-semibold">
                  Live {sport.liveCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Top Leagues */}
      <div>
        <div className="px-3 py-2.5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top Leagues</span>
        </div>
        {topLeagues.map((league) => (
          <Link
            key={league.name}
            href={`/sport/soccer?league=${encodeURIComponent(league.name)}`}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-brand-dark-4 hover:text-white transition-colors"
          >
            <span className="text-base">{league.flag}</span>
            <div>
              <div className="font-medium leading-tight">{league.name}</div>
              <div className="text-[11px] text-gray-500">{league.country}</div>
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}
