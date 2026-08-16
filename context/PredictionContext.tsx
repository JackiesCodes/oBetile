"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { FixtureResult } from "@/app/api/football/results/route";
import {
  canAdd,
  cleanNote,
  cleanTitle,
  isPickable,
  voidedResult,
  withSelection,
  withoutFixture,
  type Outcome,
  type SavedPick,
  type Selection,
  type Slip,
} from "@/lib/slips";

/**
 * Selections are staged, then saved together as one slip.
 *
 * Tapping a percentage no longer writes to the database. It adds to a slip the
 * visitor is building, exactly as a bookmaker's betslip works, and nothing is
 * committed until they choose to save. That is what makes a prediction a single
 * thing with a name, a combined likelihood and something worth sharing.
 */

const STAGED_KEY = "obetile-slip";

interface PredictionContextType {
  /** Selections chosen but not yet saved. */
  staged: Selection[];
  /** Slips this visitor has saved, newest first. */
  slips: Slip[];
  slipsLoading: boolean;
  saving: boolean;

  select: (selection: Selection) => void;
  deselect: (fixtureId: string) => void;
  clearStaged: () => void;
  isSelected: (fixtureId: string, pick: Outcome) => boolean;
  isStaged: (fixtureId: string) => boolean;
  canStage: (fixtureId: string) => boolean;

  /** Commit the staged selections as one slip. Returns its id. */
  saveSlip: (title: string) => Promise<string | null>;
  shareSlip: (slipId: string, note: string) => Promise<boolean>;
  unshareSlip: (slipId: string) => Promise<boolean>;
  deleteSlip: (slipId: string) => Promise<boolean>;
}

const PredictionContext = createContext<PredictionContextType | undefined>(undefined);

interface SlipRow {
  id: string;
  title: string;
  note: string | null;
  created_at: string;
  shared_at: string | null;
  slip_picks: {
    fixture_id: number;
    home_team: string;
    away_team: string;
    pick: Outcome;
    confidence: number | null;
    kickoff: string | null;
    result: SavedPick["result"];
  }[];
}

function toSlip(row: SlipRow): Slip {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    createdAt: row.created_at,
    sharedAt: row.shared_at,
    picks: (row.slip_picks ?? []).map((p) => ({
      fixtureId: String(p.fixture_id),
      home: p.home_team,
      away: p.away_team,
      pick: p.pick,
      confidence: p.confidence ?? 0,
      kickoff: p.kickoff,
      result: p.result,
    })),
  };
}

export function PredictionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [staged, setStaged] = useState<Selection[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Staged selections outlive a refresh. Losing a half-built slip because a
  // page reloaded is the single most annoying thing a betslip can do.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STAGED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // A slip left open overnight comes back full of matches that have since
        // been played. Those are results, not predictions, so they are dropped
        // rather than restored.
        if (Array.isArray(parsed)) setStaged(parsed.filter((s) => isPickable(s)));
      }
    } catch {
      // A corrupted or unavailable store just means starting empty.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STAGED_KEY, JSON.stringify(staged));
    } catch {
      // Private browsing denies storage; the slip still works for this session.
    }
  }, [staged]);

  // Signing out has to clear the half-built slip too. It lives in
  // localStorage, so without this the next person to use a shared phone opens
  // the app and finds someone else's selections already staged.
  const signedIn = Boolean(user);
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (wasSignedIn.current && !signedIn) {
      setStaged([]);
      try {
        localStorage.removeItem(STAGED_KEY);
      } catch {
        // Nothing more to do if storage is unavailable.
      }
    }
    wasSignedIn.current = signedIn;
  }, [signedIn]);

  const select = useCallback((selection: Selection) => {
    // Second line of defence behind the button's own check: whatever route a
    // selection arrives by, a match that is over never enters a slip.
    if (!isPickable(selection)) return;
    setStaged((cur) => withSelection(cur, selection));
  }, []);

  const deselect = useCallback((fixtureId: string) => {
    setStaged((cur) => withoutFixture(cur, fixtureId));
  }, []);

  const clearStaged = useCallback(() => setStaged([]), []);

  const isSelected = useCallback(
    (fixtureId: string, pick: Outcome) =>
      staged.some((s) => s.fixtureId === fixtureId && s.pick === pick),
    [staged]
  );

  const isStaged = useCallback(
    (fixtureId: string) => staged.some((s) => s.fixtureId === fixtureId),
    [staged]
  );

  const canStage = useCallback((fixtureId: string) => canAdd(staged, fixtureId), [staged]);

  /** Pull the visitor's slips, then settle any finished fixtures within them. */
  const loadSlips = useCallback(async () => {
    if (!user || !hasSupabaseConfig()) {
      setSlips([]);
      return;
    }
    setSlipsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("prediction_slips")
        .select("id,title,note,created_at,shared_at,slip_picks(fixture_id,home_team,away_team,pick,confidence,kickoff,result)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error || !data) {
        setSlips([]);
        return;
      }

      const loaded = (data as unknown as SlipRow[]).map(toSlip);
      setSlips(loaded);

      // Anything still unsettled gets checked once, in a single batched call
      // across every slip rather than one request per slip.
      const unsettled = [
        ...new Set(
          loaded.flatMap((s) => s.picks.filter((p) => p.result === null).map((p) => p.fixtureId))
        ),
      ];
      if (unsettled.length === 0) return;

      const results: Record<string, FixtureResult> = await fetch(
        `/api/football/results?ids=${unsettled.join(",")}`
      )
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));

      const settled: { fixtureId: string; slipId: string; result: SavedPick["result"] }[] = [];
      const next = loaded.map((slip) => ({
        ...slip,
        picks: slip.picks.map((p) => {
          if (p.result !== null) return p;
          const r = results[p.fixtureId];
          if (!r) return p;

          // A played match scores normally.
          if (r.finished && r.outcome) {
            const result: SavedPick["result"] = r.outcome === p.pick ? "correct" : "wrong";
            settled.push({ fixtureId: p.fixtureId, slipId: slip.id, result });
            return { ...p, result };
          }

          // A match that will never be played has no outcome to wait for, so
          // the selection is voided rather than left pending forever.
          const voided = voidedResult({ status: r.status, kickoff: r.kickoff });
          if (voided) {
            settled.push({ fixtureId: p.fixtureId, slipId: slip.id, result: voided });
            return { ...p, result: voided };
          }

          return p;
        }),
      }));

      if (settled.length === 0) return;
      setSlips(next);

      // Write the outcome back so it is not recomputed on every visit.
      await Promise.all(
        settled.map((s) =>
          supabase
            .from("slip_picks")
            .update({ result: s.result })
            .eq("slip_id", s.slipId)
            .eq("fixture_id", Number(s.fixtureId))
        )
      );
    } finally {
      setSlipsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSlips();
  }, [loadSlips]);

  const saveSlip = useCallback(
    async (title: string): Promise<string | null> => {
      if (!user || staged.length === 0 || !hasSupabaseConfig()) return null;
      // A panel left open can outlive its own fixtures. Saving what has since
      // kicked off would write selections that settle immediately; the slip
      // panel flags these so this is never a silent drop.
      const fresh = staged.filter((s) => isPickable(s));
      if (fresh.length === 0) return null;
      setSaving(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("prediction_slips")
          .insert({ user_id: user.id, title: cleanTitle(title, fresh.length) })
          .select("id")
          .single();

        if (error || !data) return null;
        const slipId = data.id as string;

        const { error: picksError } = await supabase.from("slip_picks").insert(
          fresh.map((s) => ({
            slip_id: slipId,
            fixture_id: Number(s.fixtureId),
            home_team: s.home,
            away_team: s.away,
            pick: s.pick,
            confidence: Math.round(s.confidence),
            kickoff: s.kickoff ?? null,
          }))
        );

        if (picksError) {
          // A slip with no selections is worse than no slip; take it back out
          // rather than leaving an empty shell in the list.
          await supabase.from("prediction_slips").delete().eq("id", slipId);
          return null;
        }

        setStaged([]);
        await loadSlips();
        return slipId;
      } finally {
        setSaving(false);
      }
    },
    [user, staged, loadSlips]
  );

  const shareSlip = useCallback(
    async (slipId: string, note: string): Promise<boolean> => {
      if (!user || !hasSupabaseConfig()) return false;
      const supabase = createClient();
      const slip = slips.find((s) => s.id === slipId);
      if (!slip) return false;

      const cleaned = cleanNote(note);
      const { error } = await supabase
        .from("prediction_slips")
        .update({ shared_at: new Date().toISOString(), note: cleaned })
        .eq("id", slipId);
      if (error) return false;

      // The post is what makes it appear in the community feed; the slip's
      // shared_at is what makes it readable by anyone else.
      const { error: postError } = await supabase.from("community_posts").insert({
        user_id: user.id,
        content: cleaned ?? `Shared a prediction: ${slip.title}`,
        slip_id: slipId,
        sport: "soccer",
      });
      if (postError) {
        await supabase.from("prediction_slips").update({ shared_at: null }).eq("id", slipId);
        return false;
      }

      await loadSlips();
      return true;
    },
    [user, slips, loadSlips]
  );

  const unshareSlip = useCallback(
    async (slipId: string): Promise<boolean> => {
      if (!user || !hasSupabaseConfig()) return false;
      const supabase = createClient();
      // Removing the post first: leaving a post pointing at a slip nobody may
      // read renders as a broken card in the feed.
      await supabase.from("community_posts").delete().eq("slip_id", slipId).eq("user_id", user.id);
      const { error } = await supabase
        .from("prediction_slips")
        .update({ shared_at: null })
        .eq("id", slipId);
      if (error) return false;
      await loadSlips();
      return true;
    },
    [user, loadSlips]
  );

  const deleteSlip = useCallback(
    async (slipId: string): Promise<boolean> => {
      if (!user || !hasSupabaseConfig()) return false;
      const supabase = createClient();
      const { error } = await supabase.from("prediction_slips").delete().eq("id", slipId);
      if (error) return false;
      setSlips((cur) => cur.filter((s) => s.id !== slipId));
      return true;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      staged,
      slips,
      slipsLoading,
      saving,
      select,
      deselect,
      clearStaged,
      isSelected,
      isStaged,
      canStage,
      saveSlip,
      shareSlip,
      unshareSlip,
      deleteSlip,
    }),
    [
      staged,
      slips,
      slipsLoading,
      saving,
      select,
      deselect,
      clearStaged,
      isSelected,
      isStaged,
      canStage,
      saveSlip,
      shareSlip,
      unshareSlip,
      deleteSlip,
    ]
  );

  return <PredictionContext.Provider value={value}>{children}</PredictionContext.Provider>;
}

export function usePredictions() {
  const ctx = useContext(PredictionContext);
  if (!ctx) throw new Error("usePredictions must be used within a PredictionProvider");
  return ctx;
}
