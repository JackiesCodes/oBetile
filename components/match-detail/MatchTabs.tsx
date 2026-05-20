"use client";

import clsx from "clsx";

export type MatchTab = "summary" | "lineups" | "statistics" | "h2h" | "standings" | "ai";

interface Props {
  active: MatchTab;
  onChange: (tab: MatchTab) => void;
}

const TABS: { id: MatchTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "lineups", label: "Lineups" },
  { id: "statistics", label: "Statistics" },
  { id: "h2h", label: "H2H" },
  { id: "standings", label: "Standings" },
  { id: "ai", label: "AI Insight" },
];

export default function MatchTabs({ active, onChange }: Props) {
  return (
    <div className="flex overflow-x-auto scrollbar-hide border-b border-brand-dark-5 bg-brand-dark-2 sticky top-0 z-10">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            "px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 shrink-0",
            active === tab.id
              ? "text-white border-brand-green"
              : "text-gray-500 border-transparent hover:text-gray-300"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
