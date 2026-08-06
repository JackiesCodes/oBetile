import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Per-action allowances. Tuned to be invisible to real use, harsh on scripts. */
export const LIMITS = {
  post: { limit: 5, windowSeconds: 60 },
  vote: { limit: 30, windowSeconds: 60 },
  like: { limit: 60, windowSeconds: 60 },
} as const;

export type RateLimitAction = keyof typeof LIMITS;

/**
 * Count one action against a user's allowance.
 *
 * Keyed by user id rather than IP: every rate-limited route already requires a
 * session, and an IP is both shared (mobile carriers, offices) and spoofable
 * through forwarded headers.
 *
 * Fails open. The counter lives in the same database as the write it guards, so
 * if it is unreachable the write cannot succeed either — refusing here would
 * turn a database blip into a confusing 429 instead of the real error. A missing
 * migration degrades the same way, which is why the deploy checklist calls it
 * out explicitly.
 */
export async function checkRateLimit(
  supabase: SupabaseServerClient,
  userId: string,
  action: RateLimitAction
): Promise<{ allowed: boolean; retryAfter: number }> {
  const { limit, windowSeconds } = LIMITS[action];

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket: `${action}:${userId}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("rate limit check failed, allowing request", {
      action,
      message: error.message,
    });
    return { allowed: true, retryAfter: 0 };
  }

  return { allowed: data !== false, retryAfter: windowSeconds };
}

export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
