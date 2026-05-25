interface H2HFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { name: string; season: number };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
}

interface Props {
  fixtures: H2HFixture[];
  homeTeamId: number;
  awayTeamId: number;
}

export default function MatchH2H({ fixtures, homeTeamId, awayTeamId }: Props) {
  if (!fixtures.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2">
        <span className="text-3xl">🤝</span>
        <p>No head-to-head history found.</p>
        <p className="text-xs text-gray-600 text-center max-w-[200px]">
          H2H records are available for major competitions. Smaller leagues may not have data.
        </p>
      </div>
    );
  }

  // Summary
  let homeWins = 0, draws = 0, awayWins = 0;
  fixtures.forEach((f) => {
    if (f.teams.home.winner === null) draws++;
    else if ((f.teams.home.id === homeTeamId && f.teams.home.winner) ||
             (f.teams.away.id === homeTeamId && f.teams.away.winner)) homeWins++;
    else awayWins++;
  });

  const homeTeam = fixtures[0].teams.home.id === homeTeamId
    ? fixtures[0].teams.home.name
    : fixtures[0].teams.away.name;
  const awayTeam = fixtures[0].teams.home.id === awayTeamId
    ? fixtures[0].teams.home.name
    : fixtures[0].teams.away.name;

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-center bg-brand-dark-3 rounded-xl p-3">
        <div>
          <div className="text-xl font-bold text-brand-green">{homeWins}</div>
          <div className="text-[10px] text-gray-500 mt-0.5 truncate">{homeTeam} wins</div>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-300">{draws}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Draws</div>
        </div>
        <div>
          <div className="text-xl font-bold text-red-400">{awayWins}</div>
          <div className="text-[10px] text-gray-500 mt-0.5 truncate">{awayTeam} wins</div>
        </div>
      </div>

      {/* Match list */}
      <div className="space-y-1.5">
        {fixtures.slice(0, 10).map((f) => {
          const date = new Date(f.fixture.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
          const isHomeWin = f.teams.home.winner === true;
          const isAwayWin = f.teams.away.winner === true;
          return (
            <div key={f.fixture.id} className="flex items-center gap-2 bg-brand-dark-3 rounded-lg px-3 py-2.5 text-xs">
              <span className="text-gray-600 w-20 shrink-0 text-[10px]">{date}</span>
              <span className="flex-1 text-right text-gray-200 truncate font-medium">{f.teams.home.name}</span>
              <span className={`font-bold px-2 py-0.5 rounded text-sm tabular-nums ${
                isHomeWin ? "text-brand-green" : isAwayWin ? "text-red-400" : "text-gray-300"
              }`}>
                {f.goals.home ?? "–"} – {f.goals.away ?? "–"}
              </span>
              <span className="flex-1 text-left text-gray-200 truncate font-medium">{f.teams.away.name}</span>
              <span className="text-[9px] text-gray-600 w-20 text-right shrink-0 truncate">{f.league.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
