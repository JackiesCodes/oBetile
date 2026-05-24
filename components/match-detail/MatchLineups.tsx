interface Player {
  player: { id: number; name: string; number: number; pos: string; grid: string | null };
}

interface LineupTeam {
  team: { id: number; name: string; logo: string };
  coach: { id: number; name: string; photo: string };
  formation: string;
  startXI: Player[];
  substitutes: Player[];
}

interface Props {
  lineups: LineupTeam[];
  fixtureStatus?: string;
}

const POS_COLOR: Record<string, string> = {
  G: "bg-yellow-500/20 text-yellow-400",
  D: "bg-blue-500/20 text-blue-400",
  M: "bg-green-500/20 text-brand-green",
  F: "bg-red-500/20 text-red-400",
};

const UPCOMING = new Set(["NS", "TBD", "PST"]);

export default function MatchLineups({ lineups, fixtureStatus }: Props) {
  if (!lineups.length) {
    const isUpcoming = !fixtureStatus || UPCOMING.has(fixtureStatus);
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2 text-center px-6">
        <span className="text-3xl">📋</span>
        <p className="font-medium text-gray-400">
          {isUpcoming ? "Lineups not announced yet" : "Lineups not available"}
        </p>
        <p className="text-xs text-gray-600">
          {isUpcoming
            ? "Starting XI will be published closer to kick-off."
            : "Lineup data is not available for this competition."}
        </p>
      </div>
    );
  }

  const [home, away] = lineups;

  return (
    <div className="p-4 space-y-6">
      {/* Formation display */}
      <div className="grid grid-cols-2 gap-4">
        {[home, away].map((lineup, idx) => (
          <div key={lineup.team.id} className="bg-brand-dark-3 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              {lineup.team.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lineup.team.logo} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-bold text-white">{lineup.team.name}</span>
              <span className="ml-auto text-[10px] bg-brand-dark-4 text-gray-400 px-1.5 py-0.5 rounded font-semibold">
                {lineup.formation}
              </span>
            </div>

            {/* Starting XI */}
            <div className="space-y-1">
              {lineup.startXI.map(({ player }) => (
                <div key={player.id} className="flex items-center gap-2 py-0.5">
                  <span className="text-[10px] text-gray-600 w-4 text-center">{player.number}</span>
                  <span className={`text-[9px] font-bold px-1 rounded ${POS_COLOR[player.pos] ?? "bg-brand-dark-4 text-gray-400"}`}>
                    {player.pos}
                  </span>
                  <span className="text-xs text-gray-200 truncate">{player.name}</span>
                </div>
              ))}
            </div>

            {/* Coach */}
            <div className="mt-2 pt-2 border-t border-brand-dark-5 text-[10px] text-gray-500">
              👤 {lineup.coach.name}
            </div>
          </div>
        ))}
      </div>

      {/* Substitutes */}
      {(home?.substitutes.length > 0 || away?.substitutes.length > 0) && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase font-semibold mb-2">Substitutes</p>
          <div className="grid grid-cols-2 gap-4">
            {[home, away].map((lineup) => (
              <div key={lineup.team.id} className="space-y-1">
                {lineup.substitutes.map(({ player }) => (
                  <div key={player.id} className="flex items-center gap-2 py-0.5">
                    <span className="text-[10px] text-gray-600 w-4 text-center">{player.number}</span>
                    <span className={`text-[9px] font-bold px-1 rounded ${POS_COLOR[player.pos] ?? "bg-brand-dark-4 text-gray-400"}`}>
                      {player.pos}
                    </span>
                    <span className="text-xs text-gray-400 truncate">{player.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
