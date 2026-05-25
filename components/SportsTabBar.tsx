"use client";

import clsx from "clsx";

const tabs = ["Live", "Highlights", "Upcoming", "Season Picks", "Community"];
const DATES = ["Today", "Tomorrow", "This Week"];
const STATUSES = ["All", "Live", "Upcoming", "Finished"];

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  liveCount?: number;
  activeDate: string;
  onDateChange: (date: string) => void;
  activeStatus: string;
  onStatusChange: (status: string) => void;
}

export default function SportsTabBar({
  activeTab,
  onTabChange,
  liveCount = 0,
  activeDate,
  onDateChange,
  activeStatus,
  onStatusChange,
}: Props) {
  return (
    <div className="bg-brand-dark-2 border-b border-brand-dark-5 sticky top-0 z-10">
      {/* Main tabs — scroll hint gradient on right edge */}
      <div className="relative border-b border-brand-dark-5">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={clsx(
                "px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 relative shrink-0",
                activeTab === tab
                  ? "text-white border-brand-green"
                  : "text-gray-400 border-transparent hover:text-white"
              )}
            >
              {tab}
              {tab === "Live" && liveCount > 0 && (
                <span className="ml-1.5 bg-brand-green text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {liveCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-brand-dark-2 to-transparent" />
      </div>

      {/* Filter row: Date + Status (hidden on Community/Season Picks tabs) */}
      {activeTab !== "Community" && activeTab !== "Season Picks" && (
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
          {/* Date filters */}
          <div className="flex gap-1 shrink-0">
            {DATES.map((d) => (
              <button
                key={d}
                onClick={() => onDateChange(d)}
                className={clsx(
                  "px-2.5 py-2 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors",
                  activeDate === d
                    ? "bg-brand-green text-black"
                    : "bg-brand-dark-4 text-gray-400 hover:text-white"
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-brand-dark-5 shrink-0" />

          {/* Status filters */}
          <div className="flex gap-1 shrink-0">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={clsx(
                  "px-2.5 py-2 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors",
                  activeStatus === s
                    ? "bg-white/10 text-white border border-white/20"
                    : "bg-brand-dark-4 text-gray-400 hover:text-white"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
