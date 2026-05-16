"use client";

import { useState } from "react";
import clsx from "clsx";

const tabs = ["Live", "Highlights", "Upcoming", "Outrights"];
const markets = ["1X2", "Double Chance", "BTTS (GG/NG)", "Total Goals", "First Team To Score", "Booking 1X2"];

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function SportsTabBar({ activeTab, onTabChange }: Props) {
  const [activeMarket, setActiveMarket] = useState("1X2");

  return (
    <div className="bg-brand-dark-2 border-b border-brand-dark-5 sticky top-0 z-10">
      {/* Main tabs */}
      <div className="flex border-b border-brand-dark-5 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={clsx(
              "px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2",
              activeTab === tab
                ? "text-white border-brand-green"
                : "text-gray-400 border-transparent hover:text-white"
            )}
          >
            {tab}
            {tab === "Live" && (
              <span className="ml-1.5 bg-brand-green text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                111
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Market selector */}
      <div className="flex overflow-x-auto gap-1 px-3 py-2 scrollbar-hide">
        {markets.map((market) => (
          <button
            key={market}
            onClick={() => setActiveMarket(market)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              activeMarket === market
                ? "bg-brand-green text-black"
                : "bg-brand-dark-4 text-gray-400 hover:text-white hover:bg-brand-dark-5"
            )}
          >
            {market}
          </button>
        ))}
      </div>
    </div>
  );
}
