interface APIEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
  comments: string | null;
}

interface Props {
  events: APIEvent[];
  homeTeamId: number;
  awayTeamId: number;
  totalMinutes?: number;
  fixtureStatus?: string; // API-Football short status: NS, 1H, HT, 2H, FT, etc.
}

const EVENT_ICON: Record<string, string> = {
  Goal: "⚽",
  "Own Goal": "⚽",
  Penalty: "⚽",
  "Yellow Card": "🟨",
  "Red Card": "🟥",
  "Yellow Red Card": "🟥",
  subst: "🔄",
  Substitution: "🔄",
  Var: "📺",
};

const UPCOMING = new Set(["NS", "TBD", "PST"]);
const LIVE = new Set(["1H", "HT", "2H", "ET", "P", "BT"]);

export default function MatchSummary({ events, homeTeamId, awayTeamId, totalMinutes = 90, fixtureStatus }: Props) {
  if (!events.length) {
    const isUpcoming = !fixtureStatus || UPCOMING.has(fixtureStatus);
    const isLive = fixtureStatus ? LIVE.has(fixtureStatus) : false;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2 text-center px-6">
        <span className="text-3xl">{isUpcoming ? "🕐" : isLive ? "⏱️" : "📭"}</span>
        <p className="font-medium text-gray-400">
          {isUpcoming
            ? "Match hasn't started yet"
            : isLive
            ? "No events recorded yet"
            : "No event data for this competition"}
        </p>
        <p className="text-xs text-gray-600">
          {isUpcoming
            ? "Goals, cards and key events will appear here once the match kicks off."
            : isLive
            ? "Events will appear as the match progresses."
            : "Detailed match events are not available for this league on the current plan."}
        </p>
      </div>
    );
  }

  const goals = events.filter((e) => e.type === "Goal");

  return (
    <div className="p-4 space-y-6">
      {/* Timeline bar */}
      {goals.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase font-semibold mb-2">Match Timeline</p>
          <div className="relative h-2 bg-brand-dark-4 rounded-full">
            {goals.map((g, i) => {
              const pct = Math.min(((g.time.elapsed + (g.time.extra ?? 0)) / totalMinutes) * 100, 100);
              return (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-brand-dark-2 text-[8px] flex items-center justify-center"
                  style={{
                    left: `${pct}%`,
                    backgroundColor: g.team.id === homeTeamId ? "#16a34a" : "#e63946",
                  }}
                  title={`${g.time.elapsed}' ${g.player.name}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-gray-600">
            <span>0&apos;</span>
            <span>45&apos;</span>
            <span>90&apos;</span>
          </div>
        </div>
      )}

      {/* Events list */}
      <div className="space-y-1.5">
        {events.map((event, i) => {
          const isHome = event.team.id === homeTeamId;
          const minute = `${event.time.elapsed}${event.time.extra ? `+${event.time.extra}` : ""}`;
          const icon = EVENT_ICON[event.type] ?? EVENT_ICON[event.detail] ?? "•";
          return (
            <div
              key={i}
              className={`flex items-center gap-2 py-1.5 px-2 rounded ${isHome ? "flex-row" : "flex-row-reverse"}`}
            >
              <span className="text-[11px] text-gray-500 font-semibold w-8 shrink-0 text-center">
                {minute}&apos;
              </span>
              <span className="text-sm shrink-0">{icon}</span>
              <div className={`flex-1 ${isHome ? "text-left" : "text-right"}`}>
                <span className="text-sm text-white font-medium">{event.player.name}</span>
                {event.assist?.name && (
                  <span className="text-[11px] text-gray-500 ml-1.5">({event.assist.name})</span>
                )}
                {event.detail && event.detail !== event.type && (
                  <span className="text-[10px] text-gray-600 ml-1">· {event.detail}</span>
                )}
              </div>
              <span className="text-[10px] text-gray-600 shrink-0 w-20 truncate text-center">
                {event.team.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
