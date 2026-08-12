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
}

interface LeagueData extends LeagueConfig {
  standings: Standing[];
  /** Season the table belongs to, as reported by the standings route. */
  season?: number;
  /** True when the table is a completed season rather than one in progress. */
  isFinal?: boolean;
}

/** "2025" -> "2025/26" for split-year competitions. */
function seasonLabel(season: number, calendarYear: boolean) {
  if (calendarYear) return String(season);
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}

type Region = "Europe" | "Americas" | "Other";

const REGIONS: { id: Region; label: string }[] = [
  { id: "Europe", label: "🌍 Europe" },
  { id: "Americas", label: "🌎 Americas" },
  { id: "Other", label: "🌐 Other" },
];

const LEAGUE_CONFIG: Record<Region, LeagueConfig[]> = {
  // No season here — the standings route resolves the season each league is
  // actually in. Hardcoding it meant Europe and the Americas drifted apart
  // every January and the panel silently rendered empty tables.
  Europe: [
    { id: 39,  name: "Premier League",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    { id: 140, name: "LaLiga",           flag: "🇪🇸" },
    { id: 78,  name: "Bundesliga",       flag: "🇩🇪" },
    { id: 135, name: "Serie A",          flag: "🇮🇹" },
    { id: 61,  name: "Ligue 1",          flag: "🇫🇷" },
    { id: 88,  name: "Eredivisie",       flag: "🇳🇱" },
    { id: 94,  name: "Primeira Liga",    flag: "🇵🇹" },
    { id: 40,  name: "Championship",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  ],
  Americas: [
    { id: 253, name: "MLS",             flag: "🇺🇸" },
    { id: 71,  name: "Brasileirão",     flag: "🇧🇷" },
    { id: 262, name: "Liga MX",         flag: "🇲🇽" },
  ],
  Other: [
    { id: 307, name: "Saudi Pro League", flag: "🇸🇦" },
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
          const res = await fetch(`/api/football/standings/${l.id}`);
          const data = await res.json();
          const standings: Standing[] =
            Array.isArray(data) && data[0]?.league?.standings?.[0]
              ? data[0].league.standings[0]
              : [];
          // The route reports which season the table is for, and whether that
          // season is already complete (it falls back between seasons).
          const season = Number(res.headers.get("x-season")) || undefined;
          const isFinal = res.headers.get("x-season-final") === "1";
          return { ...l, standings, season, isFinal };
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
        <Trophy size={15} className="text-brand-accent" />
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
                ? "text-white border-brand-accent"
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
          <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
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
                  {league.isFinal && league.season && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      {seasonLabel(league.season, activeRegion === "Americas")} final
                    </span>
                  )}
                  <span className="text-[10px] text-gray-500 ml-auto">{played} played</span>
                </div>

                {/* Title race */}
                <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1">
                  <TrendingUp size={11} className="text-brand-accent shrink-0" />
                  <span className="text-[10px] text-brand-accent font-bold uppercase tracking-wider">
                    {league.isFinal ? "Final Top 4" : "Title Race"}
                  </span>
                </div>
                {top4.map((row, idx) => (
                  <div
                    key={row.team.id}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 text-xs border-l-2 hover:bg-brand-dark-3 transition-colors",
                      idx === 0 ? "border-l-brand-accent" : "border-l-blue-500/40"
                    )}
                  >
                    <span className={clsx("w-4 shrink-0 font-bold", idx === 0 ? "text-brand-accent" : "text-gray-500")}>
                      {row.rank}
                    </span>
                    <span className="flex-1 truncate font-medium text-gray-200">{row.team.name}</span>
                    <FormDots form={row.form} />
                    <span className={clsx("w-12 text-right font-bold", idx === 0 ? "text-brand-accent" : "text-white")}>
                      {row.points}pts
                    </span>
                  </div>
                ))}

                {/* Relegation zone */}
                <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1">
                  <TrendingDown size={11} className="text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                    {league.isFinal ? "Relegated" : "Relegation Zone"}
                  </span>
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
