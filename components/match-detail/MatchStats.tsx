interface StatTeam {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: string | number | null }>;
}

interface Props {
  stats: StatTeam[];
  fixtureStatus?: string;
}

function parseVal(v: string | number | null): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(v.replace("%", "")) || 0;
}

const STAT_KEYS = [
  "Ball Possession",
  "Total Shots",
  "Shots on Goal",
  "Shots off Goal",
  "Blocked Shots",
  "Corner Kicks",
  "Fouls",
  "Yellow Cards",
  "Red Cards",
  "Offsides",
  "Goalkeeper Saves",
  "Total passes",
  "Passes accurate",
];

const UPCOMING = new Set(["NS", "TBD", "PST"]);

export default function MatchStats({ stats, fixtureStatus }: Props) {
  if (!stats.length || stats.length < 2) {
    const isUpcoming = !fixtureStatus || UPCOMING.has(fixtureStatus);
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2 text-center px-6">
        <span className="text-3xl">📊</span>
        <p className="font-medium text-gray-400">
          {isUpcoming ? "Match hasn't started yet" : "Statistics not available"}
        </p>
        <p className="text-xs text-gray-600">
          {isUpcoming
            ? "Stats like possession, shots and passes will appear here once the match begins."
            : "Match statistics are not available for this competition."}
        </p>
      </div>
    );
  }

  const [home, away] = stats;
  const homeMap = Object.fromEntries(home.statistics.map((s) => [s.type, s.value]));
  const awayMap = Object.fromEntries(away.statistics.map((s) => [s.type, s.value]));

  const allKeys = [...new Set([...Object.keys(homeMap), ...Object.keys(awayMap)])]
    .filter((k) => STAT_KEYS.includes(k) || homeMap[k] !== null);

  return (
    <div className="p-4 space-y-3">
      {/* Team names header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-white">{home.team.name}</span>
        <span className="text-[10px] text-gray-500 uppercase font-semibold">Stats</span>
        <span className="text-xs font-bold text-white">{away.team.name}</span>
      </div>

      {allKeys.map((key) => {
        const hVal = parseVal(homeMap[key]);
        const aVal = parseVal(awayMap[key]);
        const total = hVal + aVal;
        const hPct = total > 0 ? (hVal / total) * 100 : 50;
        const aPct = total > 0 ? (aVal / total) * 100 : 50;
        const isPossession = key === "Ball Possession";

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white min-w-[30px] text-left">
                {isPossession ? `${homeMap[key] ?? "—"}` : `${homeMap[key] ?? "—"}`}
              </span>
              <span className="text-[10px] text-gray-500 text-center flex-1 px-2">{key}</span>
              <span className="text-sm font-semibold text-white min-w-[30px] text-right">
                {isPossession ? `${awayMap[key] ?? "—"}` : `${awayMap[key] ?? "—"}`}
              </span>
            </div>
            {/* Bar */}
            <div className="flex h-1.5 rounded-full overflow-hidden bg-brand-dark-4">
              <div
                className="bg-brand-green transition-all"
                style={{ width: `${isPossession ? hVal : hPct}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${isPossession ? aVal : aPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
