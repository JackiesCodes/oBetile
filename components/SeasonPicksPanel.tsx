"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";

interface Standing {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  all: { played: number; win: number; draw: number; lose: number };
  form: string;
}

interface LeagueConfig {
  id: number;
  name: string;
  flag: string;
  season: string;
}

interface LeagueData extends LeagueConfig {
  standings: Standing[];
}

type Region = "Europe" | "Americas" | "Other";

const REGIONS: { id: Region; label: string }[] = [
  { id: "Europe", label: "🌍 Europe" },
  { id: "Americas", label: "🌎 Americas" },
  { id: "Other", label: "🌐 Other" },
];

const LEAGUE_CONFIG: Record<Region, LeagueConfig[]> = {
  Europe: [
    { id: 39,  name: "Premier League",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", season: "2025" },
    { id: 140, name: "LaLiga",           flag: "🇪🇸", season: "2025" },
    { id: 78,  name: "Bundesliga",       flag: "🇩🇪", season: "2025" },
    { id: 135, name: "Serie A",          flag: "🇮🇹", season: "2025" },
    { id: 61,  name: "Ligue 1",          flag: "🇫🇷", season: "2025" },
    { id: 88,  name: "Eredivisie",       flag: "🇳🇱", season: "2025" },
    { id: 94,  name: "Primeira Liga",    flag: "🇵🇹", season: "2025" },
    { id: 40,  name: "Championship",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", season: "2025" },
  ],
  Americas: [
    { id: 253, name: "MLS",             flag: "🇺🇸", season: "2026" },
    { id: 71,  name: "Brasileirão",     flag: "🇧🇷", season: "2026" },
    { id: 262, name: "Liga MX",         flag: "🇲🇽", season: "2026" },
  ],
  Other: [
    { id: 307, name: "Saudi Pro League", flag: "🇸🇦", season: "2025" },
  ],
};

function FormDots({ form }: { form: string }) {
  return (
    <div className="flex gap-0.5">
      {(form ?? "").split("").slice(-5).map((r, i) => (
        <span
          key={i}
          className={clsx(
            "w-3 h-3 rounded-full text-[7px] flex items-center justify-center font-bold",
            r === "W" ? "bg-brand-green text-black" :
            r === "L" ? "bg-red-500 text-white" :
            "bg-gray-600 text-white"
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

export default function SeasonPicksPanel() {
  const [activeRegion, setActiveRegion] = useState<Region>("Europe");
  const [cache, setCache] = useState<Record<Region, LeagueData[] | null>>({ Europe: null, Americas: null, Other: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cache[activeRegion] !== null) return;
    setLoading(true);

    const configs = LEAGUE_CONFIG[activeRegion];
    Promise.all(
      configs.map(async (l) => {
        try {
          const res = await fetch(`/api/football/standings/${l.id}?season=${l.season}`);
          const data = await res.json();
          const standings: Standing[] =
            Array.isArray(data) && data[0]?.league?.standings?.[0]
              ? data[0].league.standings[0]
              : [];
          return { ...l, standings };
        } catch {
          return { ...l, standings: [] };
        }
      })
    ).then((results) => {
      setCache((prev) => ({ ...prev, [activeRegion]: results }));
      setLoading(false);
    });
  }, [activeRegion, cache]);

  const leagues = cache[activeRegion] ?? [];

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-dark-5 bg-brand-dark-2 sticky top-0 z-10">
        <Trophy size={15} className="text-brand-green" />
        <span className="text-sm font-bold text-white">Season Picks</span>
        <span className="text-xs text-gray-500 ml-1">— title contenders &amp; relegation</span>
      </div>

      {/* Region tabs */}
      <div className="flex border-b border-brand-dark-5 bg-brand-dark-2">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRegion(r.id)}
            className={clsx(
              "flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2",
              activeRegion === r.id
                ? "text-white border-brand-green"
                : "text-gray-500 border-transparent hover:text-gray-300"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* League list */}
      {!loading && (
        <div className="flex-1 overflow-y-auto">
          {leagues.map((league) => {
            if (!league.standings.length) return null;
            const top4 = league.standings.slice(0, 4);
            const relegation = league.standings.slice(-3);
            const played = league.standings[0]?.all?.played ?? 0;

            return (
              <div key={league.id} className="border-b border-brand-dark-5">
                {/* League header */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-brand-dark-3">
                  <span className="text-lg">{league.flag}</span>
                  <span className="text-sm font-semibold text-gray-200">{league.name}</span>
                  <span className="text-[10px] text-gray-500 ml-auto">{played} played</span>
                </div>

                {/* Title race */}
                <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1">
                  <TrendingUp size={11} className="text-brand-green shrink-0" />
                  <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Title Race</span>
                </div>
                {top4.map((row, idx) => (
                  <div
                    key={row.team.id}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 text-xs border-l-2 hover:bg-brand-dark-3 transition-colors",
                      idx === 0 ? "border-l-brand-green" : "border-l-blue-500/40"
                    )}
                  >
                    <span className={clsx("w-4 shrink-0 font-bold", idx === 0 ? "text-brand-green" : "text-gray-500")}>
                      {row.rank}
                    </span>
                    <span className="flex-1 truncate font-medium text-gray-200">{row.team.name}</span>
                    <FormDots form={row.form} />
                    <span className={clsx("w-12 text-right font-bold", idx === 0 ? "text-brand-green" : "text-white")}>
                      {row.points}pts
                    </span>
                  </div>
                ))}

                {/* Relegation zone */}
                <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1">
                  <TrendingDown size={11} className="text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Relegation Zone</span>
                </div>
                {relegation.map((row) => (
                  <div
                    key={row.team.id}
                    className="flex items-center gap-2 px-4 py-2 text-xs border-l-2 border-l-red-500/50 hover:bg-brand-dark-3 transition-colors"
                  >
                    <span className="w-4 shrink-0 font-bold text-red-400">{row.rank}</span>
                    <span className="flex-1 truncate font-medium text-gray-400">{row.team.name}</span>
                    <FormDots form={row.form} />
                    <span className="w-12 text-right font-bold text-gray-400">{row.points}pts</span>
                  </div>
                ))}

                <div className="px-4 py-2">
                  <span className="text-[10px] text-gray-600">{league.standings.length} teams</span>
                </div>
              </div>
            );
          })}

          {leagues.length > 0 && leagues.every((l) => !l.standings.length) && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
              <Trophy size={32} />
              <p className="text-sm">Season standings not available yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
