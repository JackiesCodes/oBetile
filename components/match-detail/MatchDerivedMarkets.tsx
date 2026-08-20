"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import clsx from "clsx";
import { usePredictions } from "@/context/PredictionContext";
import {
  CATEGORY_LABELS,
  OFFERED_MARKETS,
  categoryOf,
  selectionLabel,
  type Market,
  type MarketCategory,
} from "@/lib/markets";
import { isPickable, MAX_SELECTIONS } from "@/lib/slips";

/**
 * Every market for one fixture, one card apiece.
 *
 * Laid out the way a sportsbook lays this out, because that is the shape people
 * already know how to read: a titled card per market, the selections as a grid
 * of buttons inside it, label on the left and the figure right-aligned. What is
 * in the figure is a probability rather than a price — this is a predictions
 * site, and nothing here can be staked.
 *
 * Prices come from the model route, computed there rather than here: every
 * market beyond the match result needs the scoreline grid, and the grid needs
 * the league table. The route fits that grid to the same percentages it
 * publishes, so no market can drift from the match result shown beside it.
 *
 * Each card carries what measurement says about its own numbers, on the card
 * rather than in a footnote. Of the forty-six markets here, thirteen were shown
 * to beat quoting the season average and the rest were not — and a number that
 * looks exactly as authoritative as a good one, while not being one, is the
 * thing worth guarding against.
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
    markets?: Record<string, Record<string, number>>;
  };
}

/** How reliable this market's percentages were found to be. */
function EvidenceNote({ market }: { market: Market }) {
  const good = market.evidence === "beats-base-rate";
  return (
    <span
      className={clsx(
        "shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
        good
          ? "text-brand-accent border-brand-accent/40 bg-brand-accent/10"
          : "text-gray-500 border-brand-dark-5 bg-brand-dark-4"
      )}
      title={
        good
          ? "Backtested over three league seasons: these percentages beat simply quoting how often the outcome happens."
          : "Backtested over three league seasons: these percentages were no more accurate than quoting how often the outcome happens in general. Read them as indicative, not informative."
      }
    >
      {good ? "measured" : "indicative"}
    </span>
  );
}

/**
 * How many columns a market's buttons sit in.
 *
 * Follows the shape of the market rather than the count: three results go in
 * three columns whatever else is on the card, two-way markets in two, and a
 * long list of scorelines in two so the labels stay readable on a phone.
 */
function columnsFor(market: Market): string {
  if (market.id === "correct_score") return "grid-cols-3";
  if (market.id === "ht_ft") return "grid-cols-3";
  if (market.choices.length === 3) return "grid-cols-3";
  if (market.choices.length >= 5) return "grid-cols-2";
  return "grid-cols-2";
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
  const [filter, setFilter] = useState<MarketCategory | "all">("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
  const markets = useMemo(() => {
    const all = OFFERED_MARKETS.filter((m) => m.id !== "1x2");
    // The ones whose numbers were shown to be worth something come first.
    return [...all].sort((a, b) => {
      const rank = (m: Market) => (m.evidence === "beats-base-rate" ? 0 : 1);
      return rank(a) - rank(b);
    });
  }, []);

  const categories = useMemo(() => {
    const present = new Set(markets.map(categoryOf));
    return (Object.keys(CATEGORY_LABELS) as MarketCategory[]).filter((c) => present.has(c));
  }, [markets]);

  const shown = filter === "all" ? markets : markets.filter((m) => categoryOf(m) === filter);

  if (loading) {
    return (
      <div className="px-3 py-4 space-y-2 border-t border-brand-dark-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg overflow-hidden">
            <div className="h-9 bg-brand-dark-4" />
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-brand-dark-3">
              <div className="h-10 bg-brand-dark-4 rounded" />
              <div className="h-10 bg-brand-dark-4 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // The model declines a fixture it has too little history for, and says so by
  // returning nothing. Showing empty cards would imply a number is coming.
  if (!priced) return null;

  const prices = priced;
  const over = !isPickable({ status, kickoff });

  return (
    <div className="border-t border-brand-dark-5">
      {/* Filter row, in the manner of a sportsbook's market tabs. */}
      <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide sticky top-0 bg-brand-dark-2 z-10 border-b border-brand-dark-5">
        {(["all", ...categories] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c as MarketCategory | "all")}
            className={clsx(
              "px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors",
              filter === c
                ? "bg-brand-green text-black"
                : "bg-brand-dark-4 text-gray-400 hover:text-white"
            )}
          >
            {c === "all" ? "All" : CATEGORY_LABELS[c as MarketCategory]}
          </button>
        ))}
      </div>

      <div className="px-3 py-3 space-y-2">
        {shown.map((market) => {
          const marketPrices = prices[market.id];
          if (!marketPrices) return null;
          const isCollapsed = collapsed[market.id];

          return (
            <div key={market.id} className="rounded-lg overflow-hidden border border-brand-dark-5">
              {/* Header */}
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [market.id]: !c[market.id] }))}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-brand-dark-4 hover:bg-brand-dark-5 transition-colors text-left"
              >
                <span className="text-xs font-bold text-white flex-1 truncate">{market.label}</span>
                <EvidenceNote market={market} />
                <Info size={13} className="text-gray-500 shrink-0" aria-hidden />
                {isCollapsed ? (
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronUp size={14} className="text-gray-400 shrink-0" />
                )}
              </button>

              {!isCollapsed && (
                <div className="bg-brand-dark-3 p-1.5">
                  <div className={clsx("grid gap-1.5", columnsFor(market))}>
                    {market.choices.map((choice) => {
                      const raw = marketPrices[choice.id];
                      const pct = Math.round((raw ?? 0) * 100);
                      const label = selectionLabel(
                        market.id,
                        choice.id,
                        homeTeamName,
                        awayTeamName
                      );
                      const selected = isSelected(String(fixtureId), choice.id);
                      // One selection per fixture, so a second market on the
                      // same match replaces the first rather than adding to it.
                      const full =
                        !selected &&
                        !isStaged(String(fixtureId)) &&
                        !canStage(String(fixtureId));
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
                          aria-label={`${label} ${pct} percent`}
                          title={
                            over
                              ? "This match has already kicked off"
                              : full
                              ? `Slip is full — ${MAX_SELECTIONS} selections maximum.`
                              : undefined
                          }
                          className={clsx(
                            "flex items-center justify-between gap-1.5 px-2.5 py-2.5 rounded border transition-all min-w-0",
                            selected
                              ? "bg-brand-green border-brand-accent"
                              : blocked
                              ? "bg-brand-dark-4 border-transparent opacity-40 cursor-not-allowed"
                              : "bg-brand-dark-4 border-transparent hover:border-brand-accent"
                          )}
                        >
                          <span
                            className={clsx(
                              "text-[11px] leading-tight truncate text-left",
                              selected ? "text-black/70" : "text-gray-300"
                            )}
                          >
                            {label}
                          </span>
                          <span
                            className={clsx(
                              "text-sm font-bold tabular-nums shrink-0",
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
              )}
            </div>
          );
        })}
      </div>

      <p className="px-3 pb-4 text-[10px] text-gray-600 leading-relaxed">
        Percentages are this model&apos;s estimate of how likely each outcome is, not prices —
        nothing here can be staked. Cards marked <span className="text-gray-400">indicative</span>{" "}
        were backtested and found no more accurate than quoting how often the outcome happens in
        general. Only one selection per match can be saved, so picking here replaces an existing
        pick on the same fixture. A draw no bet selection is voided if the match ends level.
      </p>
    </div>
  );
}
