"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { usePredictions } from "@/context/PredictionContext";
import { OFFERED_MARKETS, priceFromOutcomes, selectionLabel } from "@/lib/markets";
import { isPickable, MAX_SELECTIONS } from "@/lib/slips";

/**
 * The markets beyond the match result, on the page that has room for them.
 *
 * Only two: double chance and draw no bet. Both are functions of the match
 * result and nothing else, which is why they are here and both teams to score
 * is not — scripts/backtest.ts --markets measured every derived market against
 * quoting its own base rate, and these were the ones that beat it. See the
 * `offered` flag in lib/markets.ts for the numbers.
 *
 * Because they are functions of the 1X2, they need no scoreline grid and no
 * second model call: the three percentages this already fetches are the whole
 * input, and the figures cannot drift from the match result shown elsewhere.
 */

interface Props {
  fixtureId: number;
  homeTeamName: string;
  awayTeamName: string;
  kickoff: string | null;
  status: string;
}

interface ModelResponse {
  [fixtureId: string]: { home: number; draw: number; away: number };
}

export default function MatchDerivedMarkets({
  fixtureId,
  homeTeamName,
  awayTeamName,
  kickoff,
  status,
}: Props) {
  const { select, deselect, isSelected, isStaged, canStage } = usePredictions();
  const [outcomes, setOutcomes] = useState<{ home: number; draw: number; away: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/football/model?fixture=${fixtureId}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: ModelResponse) => {
        if (!cancelled) setOutcomes(data?.[String(fixtureId)] ?? null);
      })
      .catch(() => {
        if (!cancelled) setOutcomes(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  // The match result is on the fixture row already; repeating it here would be
  // a second place to tap the same prediction.
  const markets = OFFERED_MARKETS.filter((m) => m.id !== "1x2");

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-3">
        {markets.map((m) => (
          <div key={m.id} className="animate-pulse space-y-2">
            <div className="h-2.5 w-32 bg-brand-dark-4 rounded" />
            <div className="flex gap-2">
              {m.choices.map((c) => (
                <div key={c.id} className="h-12 flex-1 bg-brand-dark-4 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // The model declines a fixture it has too little history for, and says so by
  // returning nothing. Showing empty tiles would imply a number is coming.
  if (!outcomes) return null;

  const over = !isPickable({ status, kickoff });

  return (
    <div className="px-4 py-4 space-y-4 border-t border-brand-dark-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">More markets</h3>
        <span className="text-[10px] text-gray-600">from our model</span>
      </div>

      {markets.map((market) => {
        const priced = priceFromOutcomes(market, outcomes);
        if (!priced) return null;

        return (
          <div key={market.id}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-xs font-semibold text-gray-200">{market.label}</span>
              <span className="text-[10px] text-gray-600 truncate">{market.description}</span>
            </div>

            <div className="flex gap-2">
              {market.choices.map((choice) => {
                const pct = Math.round(priced[choice.id] * 100);
                const selected = isSelected(String(fixtureId), choice.id);
                // One selection per fixture, so a second market on the same
                // match replaces the first rather than adding to it. The size
                // cap can only be reached by a fixture not already staged.
                const full = !selected && !isStaged(String(fixtureId)) && !canStage(String(fixtureId));
                const blocked = over || full;

                return (
                  <button
                    key={choice.id}
                    onClick={() => {
                      if (selected) {
                        deselect(String(fixtureId));
                        return;
                      }
                      if (blocked) return;
                      select({
                        fixtureId: String(fixtureId),
                        home: homeTeamName,
                        away: awayTeamName,
                        market: market.id,
                        pick: choice.id,
                        confidence: pct,
                        kickoff,
                      });
                    }}
                    disabled={blocked && !selected}
                    aria-pressed={selected}
                    aria-label={`${selectionLabel(market.id, choice.id, homeTeamName, awayTeamName)} ${pct}%`}
                    title={
                      over
                        ? "This match has already kicked off"
                        : full
                        ? `Slip is full — ${MAX_SELECTIONS} selections maximum.`
                        : undefined
                    }
                    className={clsx(
                      "flex-1 min-w-0 rounded px-2 py-2 flex flex-col items-center gap-0.5 border transition-all",
                      selected
                        ? "bg-brand-green text-black border-brand-accent"
                        : blocked
                        ? "bg-brand-dark-4 border-transparent opacity-40 cursor-not-allowed"
                        : "bg-brand-dark-4 border-transparent hover:border-brand-accent"
                    )}
                  >
                    <span
                      className={clsx(
                        "text-[10px] leading-tight truncate max-w-full",
                        selected ? "text-black/60" : "text-gray-500"
                      )}
                    >
                      {selectionLabel(market.id, choice.id, homeTeamName, awayTeamName)}
                    </span>
                    <span
                      className={clsx(
                        "text-sm font-bold leading-none",
                        selected ? "text-black" : "text-brand-accent"
                      )}
                    >
                      {pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* A draw no bet pick that ends level is returned, not lost. Saying so
          where the choice is made rather than in a help page. */}
      <p className="text-[10px] text-gray-600 leading-relaxed">
        Draw no bet is voided if the match ends level — it counts neither for nor against the slip.
        Only one selection per match can be saved, so picking here replaces a match-result pick on
        the same fixture.
      </p>
    </div>
  );
}
