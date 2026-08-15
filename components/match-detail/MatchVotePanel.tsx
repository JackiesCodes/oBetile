"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, TrendingUp } from "lucide-react";
import clsx from "clsx";
import PremiumGate from "@/components/PremiumGate";
import { useAuth } from "@/context/AuthContext";
import { isVoteCounts, totalVotes, votePercent } from "@/lib/vote-counts";
import { FREE_MARKETS, PREMIUM_MARKETS, type MarketConfig } from "@/lib/vote-markets";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

import type { VoteCounts } from "@/lib/vote-counts";

interface PredictionData {
  winner: { id: number | null; name: string | null; comment: string } | null;
  advice: string;
  percent: { home: string; draw: string; away: string };
  teams: {
    home: { id: number; name: string; logo: string; last_5: { win: number; draw: number; lose: number } };
    away: { id: number; name: string; logo: string; last_5: { win: number; draw: number; lose: number } };
  };
}

interface Props {
  fixtureId: number;
  prediction: PredictionData | null;
  homeTeamName: string;
  awayTeamName: string;
}

function MarketCard({
  market,
  voteCounts,
  userVote,
  onVote,
  homeTeamName,
  awayTeamName,
}: {
  market: MarketConfig;
  voteCounts: Record<string, number>;
  userVote: string | null;
  onVote: (market: string, selection: string) => void;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const total = totalVotes(voteCounts);

  const labelFor = (choiceId: string, choiceLabel: string) => {
    if (market.id === "1x2") {
      if (choiceId === "home") return homeTeamName;
      if (choiceId === "away") return awayTeamName;
    }
    return choiceLabel;
  };

  return (
    <div className="bg-brand-dark-3 rounded-xl p-4 border border-brand-dark-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-white">{market.label}</span>
        {total > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Users size={10} />
            {total} vote{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-3">{market.description}</p>

      <div className="space-y-2">
        {market.choices.map((choice) => {
          const pct = votePercent(voteCounts, choice.id);
          const isVoted = userVote === choice.id;

          return (
            <button
              key={choice.id}
              onClick={() => onVote(market.id, choice.id)}
              className={clsx(
                "w-full rounded-lg overflow-hidden text-left transition-all border",
                isVoted
                  ? "border-brand-accent"
                  : "border-brand-dark-5 hover:border-brand-accent/40"
              )}
            >
              <div className="relative px-3 py-2 flex items-center justify-between">
                {/* Progress bar fill */}
                {total > 0 && (
                  <div
                    className={clsx(
                      "absolute inset-0 transition-all",
                      isVoted ? "bg-brand-green/20" : "bg-brand-dark-4"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}
                {total === 0 && (
                  <div className="absolute inset-0 bg-brand-dark-4" />
                )}
                <span className={clsx("relative text-xs font-semibold z-10", isVoted ? "text-white" : "text-gray-300")}>
                  {labelFor(choice.id, choice.label)}
                </span>
                <span className={clsx("relative text-xs font-bold z-10", isVoted ? "text-brand-accent" : "text-gray-400")}>
                  {total > 0 ? `${pct}%` : "—"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MatchVotePanel({ fixtureId, prediction, homeTeamName, awayTeamName }: Props) {
  const { user, openAuthModal } = useAuth();
  const [votes, setVotes] = useState<VoteCounts>({});
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Load existing votes + user's votes
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/community/votes?fixture=${fixtureId}`);
        const data = res.ok ? await res.json() : null;
        setVotes(isVoteCounts(data) ? data : {});
      } catch { /* ignore */ }

      if (user && hasSupabaseConfig()) {
        const supabase = createClient();
        const { data } = await supabase
          .from("match_market_votes")
          .select("market, selection")
          .eq("fixture_id", fixtureId)
          .eq("user_id", user.id);
        const uv: Record<string, string> = {};
        for (const row of data ?? []) uv[row.market] = row.selection;
        setUserVotes(uv);
      }

      setLoading(false);
    }
    load();
  }, [fixtureId, user]);

  const handleVote = useCallback(async (market: string, selection: string) => {
    if (!user) { openAuthModal("login"); return; }

    const prevVote = userVotes[market];
    const prevCounts = votes[market] ?? {};

    // Optimistic update
    const newCounts = { ...prevCounts };
    if (prevVote) newCounts[prevVote] = Math.max((newCounts[prevVote] ?? 1) - 1, 0);
    if (prevVote !== selection) newCounts[selection] = (newCounts[selection] ?? 0) + 1;

    setVotes((prev) => ({ ...prev, [market]: newCounts }));
    setUserVotes((prev) => {
      const next = { ...prev };
      if (prevVote === selection) delete next[market];
      else next[market] = selection;
      return next;
    });

    // Persist. The optimistic update above only exists to make the tap feel
    // instant; if the write does not land it has to be taken back, or the
    // visitor is looking at a vote the database never recorded.
    const revert = () => {
      setVotes((prev) => ({ ...prev, [market]: prevCounts }));
      setUserVotes((prev) => {
        const next = { ...prev };
        if (prevVote) next[market] = prevVote;
        else delete next[market];
        return next;
      });
    };

    try {
      const res = await fetch("/api/community/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixture_id: fixtureId, market, selection }),
      });
      // fetch resolves for 401, 429 and 503 alike, so the status has to be read.
      if (!res.ok) {
        revert();
        if (res.status === 401) openAuthModal("login");
        return;
      }
      const updated = await res.json();
      if (isVoteCounts(updated)) setVotes(updated);
      else revert();
    } catch {
      revert();
    }
  }, [user, userVotes, votes, fixtureId, openAuthModal]);

  const homeVal = parseFloat(prediction?.percent.home ?? "0") || 0;
  const drawVal = parseFloat(prediction?.percent.draw ?? "0") || 0;
  const awayVal = parseFloat(prediction?.percent.away ?? "0") || 0;

  return (
    <div className="p-4 space-y-4">
      {/* AI Prediction block */}
      {prediction && (
        <div className="bg-brand-dark-3 rounded-xl p-4 border border-brand-accent/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">AI Prediction</span>
          </div>
          {prediction.winner && (
            <p className="text-white font-bold text-sm mb-1">
              {prediction.winner.name ?? "Draw"}{prediction.winner.name ? " to win" : ""}
            </p>
          )}
          {prediction.winner?.comment && (
            <p className="text-gray-400 text-xs mb-2">{prediction.winner.comment}</p>
          )}
          <p className="text-brand-accent text-xs italic mb-3">{prediction.advice}</p>

          {/* Win probability bars */}
          <div className="space-y-2">
            {[
              { label: homeTeamName, pct: homeVal, color: "bg-brand-green" },
              { label: "Draw", pct: drawVal, color: "bg-gray-500" },
              { label: awayTeamName, pct: awayVal, color: "bg-red-500" },
            ].map(({ label, pct, color }) => (
              <div key={label}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-gray-400 truncate max-w-[65%]">{label}</span>
                  <span className="font-bold text-white">{pct}%</span>
                </div>
                <div className="h-1.5 bg-brand-dark-4 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Community voting section */}
      <div className="flex items-center gap-2">
        <TrendingUp size={13} className="text-brand-accent" />
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Community Vote</span>
        {!user && (
          <button onClick={() => openAuthModal("login")} className="ml-auto text-[10px] text-brand-accent hover:underline">
            Log in to vote
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-24 bg-brand-dark-3 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Free markets */}
          {FREE_MARKETS.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              voteCounts={votes[market.id] ?? {}}
              userVote={userVotes[market.id] ?? null}
              onVote={handleVote}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
            />
          ))}

          {/* Premium markets */}
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mt-2">Advanced Markets</p>
          {PREMIUM_MARKETS.map((market) => (
            <PremiumGate key={market.id} feature={market.id}>
              <MarketCard
                market={market}
                voteCounts={votes[market.id] ?? {}}
                userVote={userVotes[market.id] ?? null}
                onVote={handleVote}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
              />
            </PremiumGate>
          ))}
        </>
      )}
    </div>
  );
}
