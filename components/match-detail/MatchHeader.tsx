import clsx from "clsx";

interface MatchHeaderProps {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    referee: string | null;
    venue: { name: string | null; city: string | null };
  };
  league: { name: string; logo: string; country: string; round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
}

export default function MatchHeader({ fixture, league, teams, goals, score }: MatchHeaderProps) {
  const isLive = ["1H", "2H", "ET", "BT", "HT", "P"].includes(fixture.status.short);
  const isFinished = fixture.status.short === "FT";
  const kickoffTime = new Date(fixture.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const matchDate = new Date(fixture.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="bg-brand-dark-2 border-b border-brand-dark-5">
      {/* League info */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-brand-dark-5">
        {league.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={league.logo} alt="" className="w-5 h-5 object-contain" />
        )}
        <span className="text-xs text-gray-400 font-medium">{league.name}</span>
        <span className="text-gray-600 text-xs">·</span>
        <span className="text-xs text-gray-500">{league.round}</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">{matchDate}</span>
      </div>

      {/* Score block */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {teams.home.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teams.home.logo} alt={teams.home.name} className="w-14 h-14 object-contain" />
            ) : (
              <div className="w-14 h-14 bg-brand-dark-4 rounded-full" />
            )}
            <span className="text-sm font-bold text-white text-center leading-tight max-w-[120px]">
              {teams.home.name}
            </span>
          </div>

          {/* Score / Time */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {isLive || isFinished ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-white">{goals.home ?? 0}</span>
                  <span className="text-2xl text-gray-500">–</span>
                  <span className="text-4xl font-bold text-white">{goals.away ?? 0}</span>
                </div>
                {isLive ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                    <span className="text-brand-green text-xs font-bold">
                      {fixture.status.short === "HT" ? "Half Time" : `${fixture.status.elapsed}'`}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">Full Time</span>
                )}
                {score.halftime.home !== null && (
                  <span className="text-[10px] text-gray-600">
                    HT {score.halftime.home}–{score.halftime.away}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-gray-400">vs</span>
                <span className="text-sm font-semibold text-white">{kickoffTime}</span>
                <span className={clsx(
                  "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                  fixture.status.short === "PST" ? "bg-yellow-500/20 text-yellow-400" :
                  fixture.status.short === "CANC" ? "bg-red-500/20 text-red-400" :
                  "bg-brand-dark-4 text-gray-400"
                )}>
                  {fixture.status.short === "NS" ? "Scheduled" :
                   fixture.status.short === "PST" ? "Postponed" :
                   fixture.status.short === "CANC" ? "Cancelled" :
                   fixture.status.short}
                </span>
              </>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {teams.away.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teams.away.logo} alt={teams.away.name} className="w-14 h-14 object-contain" />
            ) : (
              <div className="w-14 h-14 bg-brand-dark-4 rounded-full" />
            )}
            <span className="text-sm font-bold text-white text-center leading-tight max-w-[120px]">
              {teams.away.name}
            </span>
          </div>
        </div>

        {/* Venue + Referee */}
        {(fixture.venue.name || fixture.referee) && (
          <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-gray-600">
            {fixture.venue.name && <span>📍 {fixture.venue.name}{fixture.venue.city ? `, ${fixture.venue.city}` : ""}</span>}
            {fixture.referee && <span>👤 {fixture.referee}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
