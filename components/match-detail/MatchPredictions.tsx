interface TeamForm {
  form: string;
  last_5: { win: number; draw: number; lose: number };
  goals: { for: { average: { home: string; away: string; total: string } }; against: { average: { home: string; away: string; total: string } } };
}

interface PredictionData {
  winner: { id: number | null; name: string | null; comment: string } | null;
  win_or_draw: boolean;
  under_over: string | null;
  goals: { home: string; away: string };
  advice: string;
  percent: { home: string; draw: string; away: string };
  teams: {
    home: { id: number; name: string; logo: string; last_5: TeamForm["last_5"]; league: TeamForm };
    away: { id: number; name: string; logo: string; last_5: TeamForm["last_5"]; league: TeamForm };
  };
}

interface Props {
  prediction: PredictionData | null;
}

function FormPill({ f }: { f: string }) {
  const colors: Record<string, string> = {
    W: "bg-brand-green text-black",
    D: "bg-gray-500 text-white",
    L: "bg-red-600 text-white",
  };
  return (
    <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${colors[f] ?? "bg-brand-dark-4 text-gray-400"}`}>
      {f}
    </span>
  );
}

export default function MatchPredictions({ prediction }: Props) {
  if (!prediction) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2">
        <span className="text-3xl">🤖</span>
        <p>AI prediction not available for this match.</p>
      </div>
    );
  }

  const { winner, advice, percent, teams } = prediction;
  const homeVal = parseFloat(percent.home) || 0;
  const drawVal = parseFloat(percent.draw) || 0;
  const awayVal = parseFloat(percent.away) || 0;

  return (
    <div className="p-4 space-y-5">
      {/* Winner prediction */}
      {winner && (
        <div className="bg-brand-dark-3 rounded-xl p-4 border border-brand-green/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🤖</span>
            <span className="text-xs text-gray-400 uppercase font-semibold">AI Prediction</span>
          </div>
          <p className="text-white font-bold text-base">
            {winner.name ?? "Draw"} {winner.name ? "to win" : ""}
          </p>
          {winner.comment && (
            <p className="text-gray-400 text-sm mt-1">{winner.comment}</p>
          )}
          <p className="text-brand-green text-xs mt-2 italic">{advice}</p>
        </div>
      )}

      {/* Win probability bars */}
      <div className="bg-brand-dark-3 rounded-xl p-4 space-y-3">
        <p className="text-xs text-gray-400 uppercase font-semibold">Win Probability</p>
        {[
          { label: teams.home.name, pct: homeVal, color: "bg-brand-green" },
          { label: "Draw", pct: drawVal, color: "bg-gray-500" },
          { label: teams.away.name, pct: awayVal, color: "bg-red-500" },
        ].map(({ label, pct, color }) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-300 truncate max-w-[60%]">{label}</span>
              <span className="font-bold text-white">{pct}%</span>
            </div>
            <div className="h-2 bg-brand-dark-4 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Team form comparison */}
      <div className="grid grid-cols-2 gap-3">
        {[teams.home, teams.away].map((team) => (
          <div key={team.id} className="bg-brand-dark-3 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              {team.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.logo} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-semibold text-white truncate">{team.name}</span>
            </div>

            <div className="flex gap-1 mb-2">
              {(team.last_5 as unknown as { form?: string })?.form
                ? (team.last_5 as unknown as { form: string }).form.split("").slice(-5).map((f: string, i: number) => <FormPill key={i} f={f} />)
                : null}
            </div>

            <div className="grid grid-cols-3 gap-1 text-center">
              <div>
                <div className="text-brand-green font-bold text-sm">{team.last_5.win}</div>
                <div className="text-[9px] text-gray-600">W</div>
              </div>
              <div>
                <div className="text-gray-300 font-bold text-sm">{team.last_5.draw}</div>
                <div className="text-[9px] text-gray-600">D</div>
              </div>
              <div>
                <div className="text-red-400 font-bold text-sm">{team.last_5.lose}</div>
                <div className="text-[9px] text-gray-600">L</div>
              </div>
            </div>

            {team.league?.goals?.for?.average?.total && (
              <div className="mt-2 pt-2 border-t border-brand-dark-5 text-[10px] text-gray-500 flex justify-between">
                <span>Avg Goals For: <span className="text-white">{team.league.goals.for.average.total}</span></span>
                <span>Ag: <span className="text-white">{team.league.goals.against.average.total}</span></span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
