"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { usePredictions } from "@/context/PredictionContext";
import { OFFERED_MARKETS, selectionLabel } from "@/lib/markets";
import { isPickable, MAX_SELECTIONS } from "@/lib/slips";

/**
 * The markets beyond the match result, on the page that has room for them.
 *
 * Split in two, and the split is the honest part. scripts/backtest.ts --markets
 * scored every one of these over three league seasons against the only bar that
 * means anything — whether the percentage beats simply quoting how often the
 * outcome happens. Those that cleared it are shown outright. Those that did not
 * are behind a disclosure that says so plainly, because a number that looks
 * exactly as authoritative as a good one and is not is the thing worth guarding
 * against.
 *
 * The pattern is not arbitrary: the markets that work ask about the MARGIN
 * between the sides, and the ones that do not ask about the TOTAL they combine
 * for. That is what the model is. It pins the difference between two
 * expected-goal figures and leaves their sum to the league average.
 *
 * Prices come from the model route, computed there rather than here: every
 * market beyond the match result needs the scoreline grid, and the grid needs
 * the league table. The route fits that grid to the same three percentages it
 * publishes, so no market can drift from the match result shown beside it.
 */

interface Props {
  fixtureId: number;
  homeTeamName: string;
  awayTeamName: string;
  kickoff: string | null;
  status: string;
}

interface ModelResponse {
  [fixtureId: string]: {
    home: number;
    draw: number;
    away: number;
    /** Every offered market, priced server-side off the fitted scoreline grid. */
    markets?: Record<string, Record<string, number>>;
  };
}

export default function MatchDerivedMarkets({
  fixtureId,
  homeTeamName,
  awayTeamName,
  kickoff,
  status,
}: Props) {
  const { select, deselect, isSelected, isStaged, canStage } = usePredictions();
  const [priced, setPriced] = useState<Record<string, Record<string, number>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/football/model?fixture=${fixtureId}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: ModelResponse) => {
        if (!cancelled) setPriced(data?.[String(fixtureId)]?.markets ?? null);
      })
      .catch(() => {
        if (!cancelled) setPriced(null);
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
  const measured = markets.filter((m) => m.evidence === "beats-base-rate");
  const weak = markets.filter((m) => m.evidence === "no-better-than-base-rate");
  const unmeasured = markets.filter((m) => m.evidence === "unmeasured");

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
  if (!priced) return null;

  const over = !isPickable({ status, kickoff });
  // Captured once the guard above has run: the narrowing does not reach inside
  // a closure.
  const prices = priced;

  function renderMarket(market: (typeof markets)[number]) {
          const marketPrices = prices[market.id];
          if (!marketPrices) return null;

          return (
            <div key={market.id}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-xs font-semibold text-gray-200">{market.label}</span>
                <span className="text-[10px] text-gray-600 truncate">{market.description}</span>
              </div>

              <div className="flex gap-2">
                {market.choices.map((choice) => {
                  const pct = Math.round((marketPrices[choice.id] ?? 0) * 100);
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
  }

  return (
    <div className="px-4 py-4 space-y-4 border-t border-brand-dark-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">More markets</h3>
        <span className="text-[10px] text-gray-600">from our model</span>
      </div>

      {measured.length > 0 && (
        <div className="space-y-4">{measured.map(renderMarket)}</div>
      )}

      {unmeasured.length > 0 && (
        <details className="border-t border-brand-dark-5 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-gray-300 hover:text-white">
            More markets ({unmeasured.length}) — percentages not shown to beat the season average
          </summary>
          <p className="text-[10px] text-gray-500 leading-relaxed mt-2 mb-3">
            These settle correctly and the maths is right, but backtesting over three league
            seasons found their percentages no more accurate than simply quoting how often the
            outcome happens in general. The model knows the gap between two sides, not how many
            goals they will combine for. Treat the numbers as decoration, not information.
          </p>
          <div className="space-y-4">{weak.map(renderMarket)}</div>
        </details>
      )}

      {unmeasured.length > 0 && (
        <details className="border-t border-brand-dark-5 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-gray-300 hover:text-white">
            Half markets ({unmeasured.length}) — not yet measured
          </summary>
          <p className="text-[10px] text-gray-500 leading-relaxed mt-2 mb-3">
            Each half is modelled from the same expected goals, split by the share actually
            observed — 43% of goals arrive before the break, not half — and the two halves are
            then treated as independent, which a match two goals down at half time plainly is
            not. These have not been through the backtest yet, so unlike the markets above there
            is no claim here either way about how accurate the percentages are.
          </p>
          <div className="space-y-4">{unmeasured.map(renderMarket)}</div>
        </details>
      )}

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
