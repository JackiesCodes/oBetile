"use client";

import clsx from "clsx";

/**
 * Per-player performance for a fixture.
 *
 * The route behind this — /api/football/players/[fixtureId] — has existed and
 * worked for months with nothing rendering it. This is what it was for.
 *
 * These figures only exist once a match is under way: before kick-off the
 * upstream returns an empty list, which is a different thing from a competition
 * that never publishes them. Both cases are said plainly rather than shown as
 * an identical blank.
 */

interface PlayerStatistics {
  games?: {
    minutes?: number | null;
    number?: number | null;
    position?: string | null;
    rating?: string | null;
    captain?: boolean | null;
    substitute?: boolean | null;
  };
  goals?: {
    total?: number | null;
    conceded?: number | null;
    assists?: number | null;
    saves?: number | null;
  };
  shots?: { total?: number | null; on?: number | null };
  passes?: { total?: number | null; key?: number | null; accuracy?: string | number | null };
  cards?: { yellow?: number | null; red?: number | null };
}

interface FixturePlayer {
  player: { id: number; name: string; photo?: string };
  statistics?: PlayerStatistics[];
}

interface TeamPlayers {
  team: { id: number; name: string; logo?: string };
  players?: FixturePlayer[];
}

interface Props {
  teams: TeamPlayers[];
  fixtureStatus?: string;
}

const UPCOMING = new Set(["NS", "TBD", "PST"]);

const POS_COLOR: Record<string, string> = {
  G: "bg-yellow-500/20 text-yellow-400",
  D: "bg-blue-500/20 text-blue-400",
  M: "bg-green-500/20 text-brand-accent",
  F: "bg-red-500/20 text-red-400",
};

/**
 * Rating bands.
 *
 * API-Football rates out of 10 and almost everything lands between 6 and 8, so
 * the thresholds are set where the distribution actually sits — a flat
 * red/amber/green split at 5 would paint an entire team green and say nothing.
 */
function ratingTone(rating: number): string {
  if (rating >= 7.5) return "bg-brand-green text-black";
  if (rating >= 7) return "bg-brand-green/25 text-brand-accent";
  if (rating >= 6.5) return "bg-brand-dark-5 text-gray-200";
  return "bg-red-500/20 text-red-400";
}

const num = (v: number | null | undefined): number => (typeof v === "number" ? v : 0);

/** A short line of what the player actually did, omitting the zeroes. */
function contributions(s: PlayerStatistics): string[] {
  const out: string[] = [];
  const goals = num(s.goals?.total);
  const assists = num(s.goals?.assists);
  const saves = num(s.goals?.saves);
  const keyPasses = num(s.passes?.key);
  const shotsOn = num(s.shots?.on);

  if (goals > 0) out.push(`${goals} goal${goals === 1 ? "" : "s"}`);
  if (assists > 0) out.push(`${assists} assist${assists === 1 ? "" : "s"}`);
  if (saves > 0) out.push(`${saves} save${saves === 1 ? "" : "s"}`);
  if (keyPasses > 0) out.push(`${keyPasses} key pass${keyPasses === 1 ? "" : "es"}`);
  // Only worth mentioning when nothing more decisive happened.
  if (out.length === 0 && shotsOn > 0) out.push(`${shotsOn} on target`);
  return out;
}

function PlayerRow({ entry }: { entry: FixturePlayer }) {
  const s = entry.statistics?.[0] ?? {};
  const minutes = num(s.games?.minutes);
  const rating = s.games?.rating ? Number(s.games.rating) : null;
  const position = s.games?.position ?? "";
  const yellow = num(s.cards?.yellow);
  const red = num(s.cards?.red);
  const did = contributions(s);

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <span
        className={clsx(
          "w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center shrink-0",
          POS_COLOR[position] ?? "bg-brand-dark-5 text-gray-400"
        )}
      >
        {position || "–"}
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-sm text-white truncate">{entry.player.name}</span>
          {s.games?.captain && (
            <span
              title="Captain"
              className="text-[8px] font-bold bg-brand-dark-5 text-gray-300 px-1 rounded shrink-0"
            >
              C
            </span>
          )}
          {yellow > 0 && <span className="w-1.5 h-2.5 bg-yellow-400 rounded-[1px] shrink-0" title="Yellow card" />}
          {red > 0 && <span className="w-1.5 h-2.5 bg-red-500 rounded-[1px] shrink-0" title="Red card" />}
        </span>
        <span className="block text-[11px] text-gray-500 truncate">
          {minutes > 0 ? `${minutes}'` : "Unused"}
          {did.length > 0 && ` · ${did.join(" · ")}`}
        </span>
      </span>

      {rating !== null && Number.isFinite(rating) ? (
        <span
          className={clsx(
            "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded shrink-0",
            ratingTone(rating)
          )}
        >
          {rating.toFixed(1)}
        </span>
      ) : (
        // A dash, not a zero: an unrated player has no rating, and 0.0 would
        // read as the worst performance on the pitch.
        <span className="text-xs text-gray-600 tabular-nums shrink-0">—</span>
      )}
    </li>
  );
}

function TeamBlock({ side }: { side: TeamPlayers }) {
  const all = side.players ?? [];

  // Anyone who took the field, best rated first. Unused substitutes are held
  // back below rather than mixed in, where their blank ratings would sit at the
  // bottom of the list looking like poor performances.
  const played = all
    .filter((p) => num(p.statistics?.[0]?.games?.minutes) > 0)
    .sort((a, b) => {
      const ra = Number(a.statistics?.[0]?.games?.rating ?? 0);
      const rb = Number(b.statistics?.[0]?.games?.rating ?? 0);
      if (rb !== ra) return rb - ra;
      return num(b.statistics?.[0]?.games?.minutes) - num(a.statistics?.[0]?.games?.minutes);
    });
  const unused = all.length - played.length;

  return (
    <div className="border border-brand-dark-5 rounded-xl bg-brand-dark-3 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-brand-dark-5 bg-brand-dark-4">
        {side.team.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={side.team.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
        )}
        <span className="text-sm font-bold text-white truncate">{side.team.name}</span>
        <span className="ml-auto text-[11px] text-gray-500 shrink-0">
          {played.length} played
        </span>
      </div>

      {played.length === 0 ? (
        <p className="px-3 py-4 text-xs text-gray-500 text-center">
          No player data recorded for this side.
        </p>
      ) : (
        <ul className="divide-y divide-brand-dark-5">
          {played.map((p) => (
            <PlayerRow key={p.player.id} entry={p} />
          ))}
        </ul>
      )}

      {unused > 0 && (
        <p className="px-3 py-2 border-t border-brand-dark-5 text-[11px] text-gray-600">
          {unused} unused substitute{unused === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

export default function MatchPlayerRatings({ teams, fixtureStatus }: Props) {
  const hasAny = teams.some((t) => (t.players ?? []).length > 0);

  if (!hasAny) {
    const isUpcoming = !fixtureStatus || UPCOMING.has(fixtureStatus);
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2 text-center px-6">
        <span className="text-3xl">📊</span>
        <p className="font-medium text-gray-400">
          {isUpcoming ? "No player ratings yet" : "Player ratings not available"}
        </p>
        <p className="text-xs text-gray-600">
          {isUpcoming
            ? "Ratings appear once the match kicks off."
            : "This competition does not publish per-player data."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {teams.map((side) => (
        <TeamBlock key={side.team.id} side={side} />
      ))}
      <p className="text-[11px] text-gray-600 text-center pt-1">
        Ratings are the data provider&apos;s own, out of 10.
      </p>
    </div>
  );
}
