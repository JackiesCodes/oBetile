"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { selectionLabel } from "@/lib/markets";
import { useAuth } from "@/context/AuthContext";
import { usePredictions } from "@/context/PredictionContext";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { Check, Pencil } from "lucide-react";

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface Stats {
  picks: number;
  favourites: number;
  /** Settled picks only — an accuracy including undecided matches is meaningless. */
  settled: number;
  correct: number;
}

interface RecentPick {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  /** Market id from lib/markets.ts. */
  market: string;
  pick: string;
  created_at: string;
  /** Written by the prediction provider once the match finishes. */
  result: "correct" | "wrong" | "push" | null;
  /** Which saved prediction this selection belongs to. */
  slipTitle: string;
}

// Colour reads the side of the fixture, which only a match-result-shaped
// selection has. Anything else — a total, both teams to score — is not a side,
// so it stays neutral rather than being forced into one.
const PICK_COLOR: Record<string, string> = {
  home: "text-brand-accent",
  draw: "text-gray-400",
  away: "text-red-400",
};

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Selections live in slips now. Reading them from the provider that already
  // loads and settles them keeps this page from drifting out of step with the
  // slip panel — which is exactly what happened when it read the old
  // user_picks table directly: that table stopped being written to when slips
  // arrived, so every figure here froze at the migration and never moved again.
  const { slips, slipsLoading } = usePredictions();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [favourites, setFavourites] = useState(0);
  const [username, setUsername] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Permanent account deletion. Removing the auth user cascades to the
   * profile, picks, favourites, votes, posts and likes, so one call clears
   * everything the privacy policy says it clears.
   */
  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      setDeleting(false);
      setDeleteError("Could not delete your account. Please try again or contact support.");
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  // Load profile + stats
  useEffect(() => {
    if (!user || !hasSupabaseConfig()) return;
    const supabase = createClient();

    async function load() {
      const [{ data: prof }, { count: favCount }] = await Promise.all([
        supabase.from("profiles").select("username, avatar_url, created_at").eq("id", user!.id).single(),
        supabase.from("favourites").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);

      if (prof) { setProfile(prof); setUsername(prof.username ?? ""); }
      setFavourites(favCount ?? 0);
    }

    load();
  }, [user]);

  // Every selection across every slip, newest first.
  const allPicks = slips
    .flatMap((slip) =>
      slip.picks.map((p) => ({
        id: `${slip.id}:${p.fixtureId}`,
        fixture_id: Number(p.fixtureId),
        home_team: p.home,
        away_team: p.away,
        market: p.market,
        pick: p.pick,
        created_at: slip.createdAt,
        result: p.result,
        slipTitle: slip.title,
      }))
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const settledPicks = allPicks.filter((p) => p.result === "correct" || p.result === "wrong");
  const stats: Stats = {
    picks: allPicks.length,
    favourites,
    settled: settledPicks.length,
    correct: settledPicks.filter((p) => p.result === "correct").length,
  };
  const recentPicks: RecentPick[] = allPicks.slice(0, 5);

  const saveUsername = async () => {
    if (!user || !hasSupabaseConfig()) return;
    setSaveLoading(true);
    setSaveMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ username: username.trim() || null }).eq("id", user.id);
    setSaveLoading(false);
    if (error) {
      setSaveMsg(error.message.includes("unique") ? "That username is already taken." : error.message);
    } else {
      setProfile((p) => p ? { ...p, username: username.trim() || null } : p);
      setEditingUsername(false);
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(null), 2000);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-brand-dark-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = profile?.username || user.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-brand-dark-1 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Profile header card */}
        <div className="bg-brand-dark-2 rounded-2xl border border-brand-dark-5 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-green flex items-center justify-center text-black text-xl font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-lg truncate">{displayName}</p>
              <p className="text-gray-500 text-sm truncate">{user.email}</p>
              {memberSince && <p className="text-gray-600 text-xs mt-0.5">Member since {memberSince}</p>}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Picks", value: stats.picks, icon: "🔮" },
            {
              // Accuracy over settled picks only. Counting undecided matches as
              // misses would drag it down for no reason.
              label: stats.settled > 0 ? `Correct of ${stats.settled}` : "No results yet",
              value: stats.settled > 0 ? `${Math.round((stats.correct / stats.settled) * 100)}%` : "—",
              icon: "🎯",
            },
            { label: "Favourites", value: stats.favourites, icon: "⭐" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-brand-dark-2 rounded-xl border border-brand-dark-5 p-4 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-white font-bold text-2xl">{value}</div>
              <div className="text-gray-500 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Edit username */}
        <div className="bg-brand-dark-2 rounded-2xl border border-brand-dark-5 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-300">Username</p>
            {!editingUsername && (
              <button
                onClick={() => setEditingUsername(true)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-accent transition-colors"
              >
                <Pencil size={11} /> Edit
              </button>
            )}
          </div>

          {editingUsername ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                maxLength={30}
                className="flex-1 bg-brand-dark-4 text-white rounded-lg px-3 py-2 text-sm outline-none border border-brand-dark-5 focus:border-brand-accent transition-colors"
              />
              <button
                onClick={saveUsername}
                disabled={saveLoading}
                className="bg-brand-green hover:bg-brand-green-hover text-black font-bold px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center gap-1"
              >
                <Check size={14} />
                {saveLoading ? "…" : "Save"}
              </button>
              <button
                onClick={() => { setEditingUsername(false); setUsername(profile?.username ?? ""); setSaveMsg(null); }}
                className="text-gray-500 hover:text-white text-sm px-2 py-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-white text-sm">{profile?.username || <span className="text-gray-600 italic">Not set</span>}</p>
          )}
          {saveMsg && (
            <p className={`text-xs mt-2 ${saveMsg === "Saved!" ? "text-brand-accent" : "text-red-400"}`}>{saveMsg}</p>
          )}
        </div>

        {/* Recent picks */}
        <div className="bg-brand-dark-2 rounded-2xl border border-brand-dark-5 p-5">
          <p className="text-sm font-semibold text-gray-300 mb-3">Recent Picks</p>
          {slipsLoading ? (
            // Without this, the empty state flashed before the slips arrived and
            // told people with a full history that they had never picked.
            <p className="text-gray-600 text-sm text-center py-4">Loading…</p>
          ) : recentPicks.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">No picks yet. Start picking matches!</p>
          ) : (
            <div className="space-y-2">
              {recentPicks.map((pick) => (
                <Link
                  key={pick.id}
                  href={`/match/${pick.fixture_id}`}
                  className="flex items-center gap-3 bg-brand-dark-3 rounded-lg px-3 py-2.5 border border-transparent hover:border-brand-accent/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">{pick.home_team} vs {pick.away_team}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${PICK_COLOR[pick.pick] ?? "text-gray-300"}`}>{selectionLabel(pick.market, pick.pick, pick.home_team, pick.away_team)}</p>
                    {/* A selection belongs to a saved prediction now, not to
                        nothing in particular. */}
                    <p className="text-[10px] text-gray-600 truncate mt-0.5">{pick.slipTitle}</p>
                  </div>

                  {/* Verdict, or a note that the match has not settled yet —
                      showing nothing made a decided pick look identical to one
                      still waiting. */}
                  {pick.result === "correct" || pick.result === "wrong" ? (
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        pick.result === "correct"
                          ? "bg-brand-green/15 text-brand-accent"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {pick.result === "correct" ? "Correct" : "Wrong"}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-gray-600 uppercase tracking-wide">Pending</span>
                  )}

                  <p className="text-[11px] text-gray-600 shrink-0">
                    {new Date(pick.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Account deletion — the privacy policy promises this, so it has to work */}
        <div className="bg-brand-dark-2 rounded-xl border border-red-500/20 p-4">
          <h2 className="text-sm font-bold text-white mb-1">Delete account</h2>
          <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
            Permanently removes your account, profile, saved predictions, favourites, votes,
            posts and likes. This cannot be undone and we keep no copy.
          </p>

          {deleteError && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-3 py-2 mb-3">
              {deleteError}
            </p>
          )}

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-semibold text-red-400 border border-red-400/40 rounded-lg px-3 py-2 hover:bg-red-400/10 transition-colors"
            >
              Delete my account
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-300">Are you sure?</span>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="text-xs font-bold bg-red-500 text-white rounded-lg px-3 py-2 hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="text-xs font-semibold text-gray-400 px-3 py-2 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
