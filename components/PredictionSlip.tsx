"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Share2, Trash2, X } from "lucide-react";
import { usePredictions } from "@/context/PredictionContext";
import { useAuth } from "@/context/AuthContext";
import {
  combinedConfidence,
  defaultTitle,
  formatConfidence,
  isPickable,
  labelFor,
  slipOutcome,
  summariseSlips,
  tally,
  MAX_NOTE,
  MAX_SELECTIONS,
  MAX_TITLE,
  type Slip,
} from "@/lib/slips";

/**
 * The slip: selections being built, and the slips already saved.
 *
 * Modelled on how a betslip works — pick outcomes across several matches, see
 * them collect, then commit the set in one action — with the crucial difference
 * that nothing is staked. Saving records a prediction; it does not place a bet.
 */

type Tab = "slip" | "saved";

function ResultDot({ result }: { result: "correct" | "wrong" | "push" | null }) {
  return (
    <span
      className={clsx(
        "w-1.5 h-1.5 rounded-full shrink-0",
        result === "correct" && "bg-brand-green",
        result === "wrong" && "bg-red-400",
        result === "push" && "bg-gray-500",
        result === null && "bg-gray-600"
      )}
      aria-hidden="true"
    />
  );
}

function SavedSlipCard({ slip }: { slip: Slip }) {
  const { shareSlip, unshareSlip, deleteSlip } = usePredictions();
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const t = tally(slip.picks);
  const outcome = slipOutcome(slip.picks);
  const combined = combinedConfidence(slip.picks);

  return (
    <div className="border border-brand-dark-5 rounded-xl bg-brand-dark-3 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-brand-dark-4 transition-colors"
        aria-expanded={open}
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-white truncate">{slip.title}</span>
          <span className="block text-[11px] text-gray-500">
            {slip.picks.length} selection{slip.picks.length === 1 ? "" : "s"} ·{" "}
            {formatConfidence(combined)} combined
            {slip.sharedAt && " · shared"}
          </span>
        </span>
        <span
          className={clsx(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
            outcome === "won" && "bg-brand-green/20 text-brand-accent",
            outcome === "lost" && "bg-red-500/15 text-red-400",
            outcome === "pending" && "bg-brand-dark-5 text-gray-400"
          )}
        >
          {outcome === "pending" ? `${t.settled}/${t.total}` : outcome}
        </span>
        <ChevronDown
          size={14}
          className={clsx("text-gray-500 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-brand-dark-5">
          <ul className="divide-y divide-brand-dark-5">
            {slip.picks.map((p) => (
              <li key={p.fixtureId} className="flex items-center gap-2 px-3 py-2">
                <ResultDot result={p.result} />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-gray-400 truncate">
                    {p.home} v {p.away}
                  </span>
                  <span className="block text-sm text-white truncate">
                    {labelFor(p.pick, p.home, p.away)}
                  </span>
                </span>
                <span className="text-xs text-gray-500 tabular-nums shrink-0">{p.confidence}%</span>
              </li>
            ))}
          </ul>

          <div className="px-3 py-2.5 border-t border-brand-dark-5 flex flex-wrap gap-2">
            {slip.sharedAt ? (
              <button
                onClick={async () => {
                  setBusy(true);
                  await unshareSlip(slip.id);
                  setBusy(false);
                }}
                disabled={busy}
                className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Remove from community
              </button>
            ) : (
              <button
                onClick={() => setSharing((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-brand-accent hover:underline"
              >
                <Share2 size={12} />
                Share to community
              </button>
            )}
            <button
              onClick={async () => {
                setBusy(true);
                await deleteSlip(slip.id);
                setBusy(false);
              }}
              disabled={busy}
              className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>

          {sharing && !slip.sharedAt && (
            <div className="px-3 pb-3 space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                rows={2}
                placeholder="Say something about these picks (optional)"
                className="w-full bg-brand-dark-2 border border-brand-dark-5 focus:border-brand-accent rounded-lg px-2.5 py-2 text-sm text-white placeholder-gray-600 resize-none outline-none transition-colors"
              />
              <p className="text-[11px] text-gray-500">
                Sharing posts this prediction to the public community feed, where anyone
                can read it. You can remove it again at any time.
              </p>
              <button
                onClick={async () => {
                  setBusy(true);
                  const ok = await shareSlip(slip.id, note);
                  setBusy(false);
                  if (ok) setSharing(false);
                }}
                disabled={busy}
                className="w-full bg-brand-green hover:bg-brand-green-hover text-black text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {busy ? "Sharing…" : "Share prediction"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SlipBody() {
  const { staged, deselect, clearStaged, saveSlip, saving } = usePredictions();
  const { user, openAuthModal } = useAuth();
  const [title, setTitle] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // A panel left open outlives its fixtures. Anything that has kicked off since
  // it was staged is no longer a prediction, so it is called out and left out
  // of the save rather than quietly written and settled on arrival.
  const expired = staged.filter((s) => !isPickable(s));
  const live = staged.filter((s) => isPickable(s));
  const combined = combinedConfidence(live);

  if (staged.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
        <div className="w-16 h-16 rounded-full bg-brand-dark-4 flex items-center justify-center">
          <span className="text-3xl">🔮</span>
        </div>
        <p className="text-gray-400 text-sm">
          Tap win percentages to build a prediction. Selections collect here, then you
          save them together as one.
        </p>
        {justSaved && (
          <p className="text-brand-accent text-sm font-semibold">Prediction saved.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-brand-dark-5">
          {staged.map((s) => {
            const gone = !isPickable(s);
            return (
            <li
              key={s.fixtureId}
              className={clsx("flex items-center gap-2 px-3 py-2.5", gone && "opacity-50")}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] text-gray-500 truncate">
                  {gone ? "Kicked off — remove to save" : `${s.home} v ${s.away}`}
                </span>
                <span className="block text-sm font-semibold text-white truncate">
                  {labelFor(s.pick, s.home, s.away)}
                </span>
              </span>
              <span className="text-sm text-brand-accent font-bold tabular-nums shrink-0">
                {s.confidence}%
              </span>
              <button
                onClick={() => deselect(s.fixtureId)}
                aria-label={`Remove ${s.home} v ${s.away}`}
                className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-brand-dark-5 p-3 space-y-2.5 shrink-0">
        {expired.length > 0 && (
          <p className="text-[11px] text-amber-400">
            {expired.length} selection{expired.length === 1 ? " has" : "s have"} already
            kicked off and will not be saved.
          </p>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {live.length} of {MAX_SELECTIONS} selections
          </span>
          <span className="text-gray-400">
            All correct: <span className="text-white font-bold">{formatConfidence(combined)}</span>
          </span>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          placeholder={defaultTitle(live.length)}
          aria-label="Prediction name"
          className="w-full bg-brand-dark-3 border border-brand-dark-5 focus:border-brand-accent rounded-lg px-2.5 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
        />

        {user ? (
          <button
            onClick={async () => {
              const id = await saveSlip(title);
              if (id) {
                setTitle("");
                setJustSaved(true);
              }
            }}
            disabled={saving || live.length === 0}
            className="w-full bg-brand-green hover:bg-brand-green-hover text-black text-sm font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check size={15} />
            {saving ? "Saving…" : live.length === 0 ? "Nothing left to save" : "Save prediction"}
          </button>
        ) : (
          <button
            onClick={() => openAuthModal()}
            className="w-full bg-brand-green hover:bg-brand-green-hover text-black text-sm font-bold py-2.5 rounded-lg transition-colors"
          >
            Sign in to save
          </button>
        )}

        <button
          onClick={clearStaged}
          className="w-full text-xs text-gray-500 hover:text-white transition-colors py-1"
        >
          Clear selections
        </button>
      </div>
    </div>
  );
}

/**
 * How the saved slips are doing, at a glance.
 *
 * "Still running" is the number that can still land — the figure worth showing
 * first, because a slip dies the moment one selection is wrong and there is
 * otherwise no way to see how many are still in play without opening each one.
 */
function SavedSummary({ slips }: { slips: Slip[] }) {
  const s = summariseSlips(slips);

  return (
    <div className="flex items-center gap-2 px-3 pt-3 shrink-0">
      {[
        { label: "Still running", value: s.running, tone: "text-white" },
        { label: "Won", value: s.won, tone: "text-brand-accent" },
        { label: "Lost", value: s.lost, tone: "text-red-400" },
      ].map(({ label, value, tone }) => (
        <div
          key={label}
          className="flex-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 px-2 py-1.5 text-center"
        >
          <div className={clsx("text-base font-bold leading-none tabular-nums", tone)}>{value}</div>
          <div className="text-[10px] text-gray-500 leading-tight mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

function SavedBody() {
  const { slips, slipsLoading } = usePredictions();
  const { user } = useAuth();

  if (!user) {
    return (
      <p className="text-center text-gray-500 text-sm px-6 py-12">
        Sign in to keep your predictions.
      </p>
    );
  }
  if (slipsLoading) {
    return <p className="text-center text-gray-500 text-sm px-6 py-12">Loading…</p>;
  }
  if (slips.length === 0) {
    return (
      <p className="text-center text-gray-500 text-sm px-6 py-12">
        Nothing saved yet. Build a slip and save it to see it here.
      </p>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SavedSummary slips={slips} />
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {slips.map((slip) => (
          <SavedSlipCard key={slip.id} slip={slip} />
        ))}
      </div>
    </div>
  );
}

export default function PredictionSlip() {
  const [tab, setTab] = useState<Tab>("slip");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { staged, slips } = usePredictions();

  // Slips that have not lost — won, or still with selections to play. This is
  // the number people want without opening the tab, so it rides on it.
  const alive = summariseSlips(slips).alive;

  const tabBar = (
    <div className="flex border-b border-brand-dark-5 shrink-0">
      {(["slip", "saved"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={clsx(
            "flex-1 py-3 text-sm font-semibold uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5",
            tab === t
              ? "text-white border-b-2 border-brand-accent"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          {t === "slip" ? `Slip${staged.length ? ` (${staged.length})` : ""}` : "Saved"}
          {t === "saved" && alive > 0 && (
            <span
              title={`${alive} of ${slips.length} predictions have not lost`}
              className="bg-brand-green text-black text-[10px] font-bold min-w-[1.15rem] h-[1.15rem] px-1 rounded-full flex items-center justify-center tabular-nums"
            >
              {alive}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  const body = tab === "slip" ? <SlipBody /> : <SavedBody />;

  return (
    <>
      <aside className="w-72 shrink-0 bg-brand-dark-2 border-l border-brand-dark-5 flex-col hidden 2xl:flex">
        {tabBar}
        <div className="flex-1 flex flex-col overflow-hidden">{body}</div>
      </aside>

      {/* Below 2xl the panel has no room, so it becomes a sheet. */}
      <div className="2xl:hidden fixed bottom-6 right-5 z-50">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 bg-brand-green text-black font-bold px-4 py-3 rounded-full shadow-lg hover:bg-brand-green-hover transition-colors"
        >
          <span>🔮</span>
          <span>My Picks</span>
          {staged.length > 0 && (
            <span className="bg-black/25 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {staged.length}
            </span>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="2xl:hidden fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[82vh] bg-brand-dark-2 rounded-t-2xl border-t border-brand-dark-5 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-dark-5 shrink-0">
              <span className="text-sm font-bold text-white">
                My Picks {slips.length > 0 && <span className="text-gray-500">· {slips.length} saved</span>}
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {tabBar}
            <div className="flex-1 flex flex-col overflow-hidden">{body}</div>
          </div>
        </div>
      )}
    </>
  );
}
