import clsx from "clsx";

interface Standing {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  all: { played: number; win: number; draw: number; lose: number };
  form: string;
}

interface Props {
  standings: Standing[];
  highlightTeamIds: number[];
}

export default function MatchStandings({ standings, highlightTeamIds }: Props) {
  if (!standings.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2">
        <span className="text-3xl">📈</span>
        <p>Standings not available.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center text-[10px] text-gray-600 font-semibold mb-1 px-1">
        <span className="w-6 shrink-0">#</span>
        <span className="flex-1">Team</span>
        <span className="w-7 text-center">P</span>
        <span className="w-7 text-center">W</span>
        <span className="w-7 text-center">D</span>
        <span className="w-7 text-center">L</span>
        <span className="w-7 text-center">GD</span>
        <span className="w-8 text-center font-bold">Pts</span>
        <span className="w-16 text-center hidden sm:block">Form</span>
      </div>

      <div className="space-y-0.5">
        {standings.map((row) => {
          const isHighlighted = highlightTeamIds.includes(row.team.id);
          return (
            <div
              key={row.team.id}
              className={clsx(
                "flex items-center py-2 px-1 rounded text-xs transition-colors",
                isHighlighted ? "bg-brand-green/10 border border-brand-green/30" : "hover:bg-brand-dark-3"
              )}
            >
              <span className={clsx("w-6 shrink-0 font-semibold", isHighlighted ? "text-brand-green" : "text-gray-500")}>
                {row.rank}
              </span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {row.team.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.team.logo} alt="" className="w-4 h-4 object-contain shrink-0" />
                ) : (
                  <div className="w-4 h-4 bg-brand-dark-4 rounded-full shrink-0" />
                )}
                <span className={clsx("truncate font-medium", isHighlighted ? "text-white" : "text-gray-300")}>
                  {row.team.name}
                </span>
              </div>
              <span className="w-7 text-center text-gray-400">{row.all.played}</span>
              <span className="w-7 text-center text-gray-400">{row.all.win}</span>
              <span className="w-7 text-center text-gray-400">{row.all.draw}</span>
              <span className="w-7 text-center text-gray-400">{row.all.lose}</span>
              <span className={clsx("w-7 text-center", row.goalsDiff > 0 ? "text-brand-green" : row.goalsDiff < 0 ? "text-red-400" : "text-gray-400")}>
                {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
              </span>
              <span className="w-8 text-center font-bold text-white">{row.points}</span>
              <div className="w-16 hidden sm:flex gap-0.5 justify-center">
                {(row.form ?? "").split("").slice(-5).map((f, i) => (
                  <span
                    key={i}
                    className={clsx(
                      "w-3.5 h-3.5 rounded-sm text-[8px] font-bold flex items-center justify-center",
                      f === "W" ? "bg-brand-green text-black" :
                      f === "D" ? "bg-gray-500 text-white" :
                      "bg-red-600 text-white"
                    )}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
