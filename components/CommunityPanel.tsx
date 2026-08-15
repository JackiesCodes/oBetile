"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";
import {
  combinedConfidence,
  formatConfidence,
  labelFor,
  slipOutcome,
  tally,
  type Outcome,
  type SavedPick,
} from "@/lib/slips";

interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  likes_count: number;
  created_at: string;
  /** Whether the signed-in caller has liked this post. */
  liked?: boolean;
  profiles: { username: string | null; avatar_url: string | null } | null;
  /** Present when the post is a shared prediction rather than plain text. */
  prediction_slips?: {
    id: string;
    title: string;
    shared_at: string | null;
    slip_picks: {
      fixture_id: number;
      home_team: string;
      away_team: string;
      pick: Outcome;
      confidence: number | null;
      result: SavedPick["result"];
    }[];
  } | null;
}

/**
 * A shared prediction inside the feed.
 *
 * Shows every selection rather than a summary: the point of sharing a slip is
 * that someone else can see what was actually called, and a headline figure
 * alone would let a long shot read like a strong one.
 */
function SharedSlip({ slip }: { slip: NonNullable<CommunityPost["prediction_slips"]> }) {
  const picks: SavedPick[] = (slip.slip_picks ?? []).map((p) => ({
    fixtureId: String(p.fixture_id),
    home: p.home_team,
    away: p.away_team,
    pick: p.pick,
    confidence: p.confidence ?? 0,
    result: p.result,
  }));
  if (picks.length === 0) return null;

  const outcome = slipOutcome(picks);
  const t = tally(picks);

  return (
    <div className="mt-2 border border-brand-dark-5 rounded-xl overflow-hidden bg-brand-dark-3">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-brand-dark-5">
        <span className="flex-1 min-w-0 text-xs font-bold text-white truncate">{slip.title}</span>
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
      </div>
      <ul className="divide-y divide-brand-dark-5">
        {picks.map((p) => (
          <li key={p.fixtureId} className="flex items-center gap-2 px-3 py-1.5">
            <span
              className={clsx(
                "w-1.5 h-1.5 rounded-full shrink-0",
                p.result === "correct" && "bg-brand-green",
                p.result === "wrong" && "bg-red-400",
                (p.result === null || p.result === "push") && "bg-gray-600"
              )}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] text-gray-500 truncate">
                {p.home} v {p.away}
              </span>
              <span className="block text-xs text-gray-200 truncate">
                {labelFor(p.pick, p.home, p.away)}
              </span>
            </span>
            <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
              {p.confidence}%
            </span>
          </li>
        ))}
      </ul>
      <div className="px-3 py-1.5 border-t border-brand-dark-5 text-[10px] text-gray-500">
        All correct: {formatConfidence(combinedConfidence(picks))}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ username }: { username: string | null }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : "?";
  return (
    <div className="w-8 h-8 rounded-full bg-brand-dark-4 border border-brand-dark-5 flex items-center justify-center text-[11px] font-bold text-gray-300 shrink-0">
      {initials}
    </div>
  );
}

export default function CommunityPanel() {
  const { user, openAuthModal } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reloads on sign-in and sign-out: which posts are liked is answered per
  // caller, so the feed fetched while signed out has every heart empty.
  useEffect(() => {
    loadPosts(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadPosts(pageNum: number, reset = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/posts?page=${pageNum}`);
      if (!res.ok) return;
      const data: CommunityPost[] = await res.json();
      const list = Array.isArray(data) ? data : [];

      if (reset) {
        setPosts(list);
        // The counter has to go back with the list, or Load more resumes from
        // wherever the previous session had got to and skips everything between.
        setPage(pageNum);
        setLikedIds(new Set(list.filter((p) => p.liked).map((p) => p.id)));
      } else {
        setPosts((prev) => [...prev, ...list]);
        setLikedIds((prev) => {
          const next = new Set(prev);
          for (const p of list) if (p.liked) next.add(p.id);
          return next;
        });
      }
      setHasMore(list.length === 20);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    // Optimistic post
    const optimistic: CommunityPost = {
      id: `optimistic-${Date.now()}`,
      user_id: user?.id ?? "",
      content: content.trim(),
      likes_count: 0,
      created_at: new Date().toISOString(),
      profiles: { username: user?.email?.split("@")[0] ?? "You", avatar_url: null },
    };
    setPosts((prev) => [optimistic, ...prev]);
    setContent("");

    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: optimistic.content }),
      });

      if (res.ok) {
        const saved: CommunityPost = await res.json();
        // Replace optimistic with real post
        setPosts((prev) =>
          prev.map((p) => (p.id === optimistic.id ? saved : p))
        );
      } else {
        // Remove optimistic on failure
        setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
      }
    } catch {
      setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(postId: string) {
    if (!user) {
      openAuthModal("login");
      return;
    }

    const wasLiked = likedIds.has(postId);
    // Optimistic update
    setLikedIds((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes_count: p.likes_count + (wasLiked ? -1 : 1) }
          : p
      )
    );

    // fetch only rejects on a network failure, so an unauthorised, rate-limited
    // or unconfigured reply used to leave the optimistic like standing forever.
    const revert = () => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(postId) : next.delete(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likes_count: p.likes_count + (wasLiked ? 1 : -1) }
            : p
        )
      );
    };

    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, { method: "POST" });
      if (!res.ok) {
        revert();
        if (res.status === 401) openAuthModal("login");
        return;
      }

      // The server says what actually happened; the guess above only had to
      // make the tap feel instant.
      const { liked } = (await res.json()) as { liked: boolean };
      if (liked === wasLiked) revert();
    } catch {
      revert();
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-brand-dark">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-dark-5 bg-brand-dark-2 shrink-0">
        <MessageCircle size={16} className="text-brand-accent" />
        <span className="text-sm font-bold text-white">Community</span>
        <span className="text-xs text-gray-500 ml-1">— Share your thoughts on today&apos;s matches</span>
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-b border-brand-dark-5 bg-brand-dark-2 shrink-0">
        {user ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              maxLength={500}
              rows={3}
              placeholder="What's your take on today's matches? Share your picks…"
              className="w-full bg-brand-dark-3 border border-brand-dark-5 focus:border-brand-accent rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none outline-none transition-colors"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-600">
                {content.length}/500 · Ctrl+Enter to post
              </span>
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green text-black text-xs font-bold rounded-lg hover:bg-brand-green-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={12} />
                Post
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Log in to join the discussion</p>
            <button
              onClick={() => openAuthModal("login")}
              className="px-3 py-1.5 bg-brand-green text-black text-xs font-bold rounded-lg hover:bg-brand-green-hover transition-colors"
            >
              Log In
            </button>
          </div>
        )}
      </div>

      {/* Posts feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && posts.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
            <MessageCircle size={32} />
            <p className="text-sm">Be the first to post something!</p>
          </div>
        )}

        <div className="divide-y divide-brand-dark-5">
          {posts.map((post) => (
            <div key={post.id} className="px-4 py-3 hover:bg-brand-dark-2 transition-colors">
              <div className="flex gap-3">
                <Avatar username={post.profiles?.username ?? null} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">
                      {post.profiles?.username ?? "Anonymous"}
                    </span>
                    <span className="text-[10px] text-gray-600">{timeAgo(post.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed break-words">
                    {post.content}
                  </p>
                  {post.prediction_slips && <SharedSlip slip={post.prediction_slips} />}
                  <button
                    onClick={() => handleLike(post.id)}
                    className={clsx(
                      "flex items-center gap-1.5 mt-2 text-[11px] transition-colors",
                      likedIds.has(post.id)
                        ? "text-brand-accent"
                        : "text-gray-600 hover:text-brand-accent"
                    )}
                  >
                    <Heart
                      size={13}
                      className={likedIds.has(post.id) ? "fill-brand-accent" : ""}
                    />
                    {post.likes_count > 0 && <span>{post.likes_count}</span>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load more */}
        {hasMore && !loading && posts.length > 0 && (
          <div className="p-4 text-center">
            <button
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                loadPosts(nextPage);
              }}
              className="text-brand-accent text-xs font-semibold hover:underline"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
