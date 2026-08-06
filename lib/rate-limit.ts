import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Windows used only to populate Retry-After. The allowances themselves are
 * defined inside check_rate_limit() in the database, deliberately not passed
 * from here: the function is reachable over /rest/v1/rpc, so a caller that
 * could supply its own limit could also widen it.
 */
const RETRY_AFTER_SECONDS = { post: 60, vote: 60, like: 60 } as const;

export type RateLimitAction = keyof typeof RETRY_AFTER_SECONDS;

/**
 * Count one action against the caller's allowance.
 *
 * The database derives the identity from auth.uid(), so this cannot be pointed
 * at another account — an earlier version took the bucket as an argument, which
 * let any signed-in user exhaust someone else's quota.
 *
 * Fails open. The counter lives in the same database as the write it guards, so
 * if it is unreachable the write cannot succeed either — refusing here would
 * turn a database blip into a confusing 429 instead of the real error.
 */
export async function checkRateLimit(
  supabase: SupabaseServerClient,
  action: RateLimitAction
): Promise<{ allowed: boolean; retryAfter: number }> {
  const windowSeconds = RETRY_AFTER_SECONDS[action];

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_action: action,
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
