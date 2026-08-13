"use client";

import clsx from "clsx";

/**
 * Who is unavailable for a fixture, and why.
 *
 * Called team news rather than injuries on purpose: the provider's list mixes
 * genuine injuries with international duty and suspensions, so labelling the
 * whole thing "injuries" would misdescribe half of it.
 *
 * It is presentation only. The same data was measured twice as a prediction
 * input and rejected both times — see docs/model-experiments.md — so nothing
 * here feeds a percentage.
 */

export interface InjuryRow {
  player?: { id?: number; name?: string; photo?: string; type?: string; reason?: string };
  team?: { id?: number; name?: string };
}

interface Props {
  injuries: InjuryRow[];
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  fixtureStatus?: string;
  /** Sidebar version: tighter padding, and never two columns. */
  compact?: boolean;
}

/** The provider reports two states; anything else is treated as doubtful. */
const DEFINITELY_OUT = "Missing Fixture";

const FINISHED = new Set(["FT", "AET", "PEN"]);

function forTeam(injuries: InjuryRow[], teamId: number) {
  const rows = injuries.filter((i) => i?.team?.id === teamId && i?.player?.name);
  // Definite absences first — a reader scanning for "who is missing" wants the
  // certainties before the maybes.
  const out = rows.filter((r) => r.player?.type === DEFINITELY_OUT);
  const doubtful = rows.filter((r) => r.player?.type !== DEFINITELY_OUT);
  return { out, doubtful, total: rows.length };
}

function PlayerRow({ row }: { row: InjuryRow }) {
  const out = row.player?.type === DEFINITELY_OUT;
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full shrink-0 mt-1.5",
          out ? "bg-red-400" : "bg-yellow-400"
        )}
        aria-hidden="true"
      />
      {/* The name gets the width and the reason sits beneath it. Side by side
          they competed, and on a 390px screen the name was the one that lost —
          "C. Wood" rendered as "C. …", which is the one thing a reader needs. */}
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-gray-200 truncate">{row.player?.name}</span>
        {row.player?.reason && (
          <span className="block text-[11px] text-gray-500 truncate">{row.player.reason}</span>
        )}
      </span>
      <span
        className={clsx(
          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5",
          out ? "bg-red-500/15 text-red-400" : "bg-yellow-500/20 text-yellow-400"
        )}
      >
        {out ? "Out" : "Doubt"}
      </span>
    </li>
  );
}

function TeamColumn({
  name,
  rows,
}: {
  name: string;
  rows: ReturnType<typeof forTeam>;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <h4 className="text-sm font-bold text-white truncate">{name}</h4>
        <span className="text-[11px] text-gray-500 shrink-0">
          {rows.total === 0 ? "none" : `${rows.total} out`}
        </span>
      </div>

      {rows.total === 0 ? (
        <p className="text-xs text-gray-600 py-1.5">No reported absences.</p>
      ) : (
        <ul className="divide-y divide-brand-dark-5">
          {[...rows.out, ...rows.doubtful].map((row, i) => (
            <PlayerRow key={row.player?.id ?? `${name}-${i}`} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MatchTeamNews({
  injuries,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  fixtureStatus,
  compact,
}: Props) {
  const home = forTeam(injuries ?? [], homeTeamId);
  const away = forTeam(injuries ?? [], awayTeamId);

  if (home.total === 0 && away.total === 0) {
    // Distinguish "nobody is out" from "we were never told" — after a match has
    // been played the list stops being meaningful either way.
    const played = fixtureStatus ? FINISHED.has(fixtureStatus) : false;
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-gray-500">
          {played ? "No team news recorded for this match." : "No absences reported yet."}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Most competitions outside the major leagues publish none.
        </p>
      </div>
    );
  }

  return (
    <div className={clsx(compact ? "px-3 py-2" : "px-4 py-4")}>
      {/* Stacked until there is genuinely room for two columns. Two columns at
          phone width left every name ellipsised. */}
      <div className={clsx("flex flex-col gap-4", !compact && "sm:flex-row sm:gap-5")}>
        <TeamColumn name={homeTeamName} rows={home} />
        {!compact && <div className="hidden sm:block w-px bg-brand-dark-5 shrink-0" />}
        <TeamColumn name={awayTeamName} rows={away} />
      </div>
      <p className="text-[11px] text-gray-600 mt-3 pt-2 border-t border-brand-dark-5">
        Reported availability from our data provider. It can be incomplete, and it
        does not affect the win percentages.
      </p>
    </div>
  );
}
