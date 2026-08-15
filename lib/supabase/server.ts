import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Whether the server has what it needs to talk to Supabase.
 *
 * Mirrors hasSupabaseConfig() on the browser client. Without it the two halves
 * of the app disagreed about missing configuration: the browser degraded
 * quietly while every route handler threw an opaque 500 from deep inside the
 * Supabase SDK, which is a much harder thing to diagnose than "not configured".
 */
export const hasSupabaseConfig = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * A client carrying no session, for reads that are public anyway.
 *
 * Vote tallies are readable by everyone — the policy is literally
 * `using (true)` — so attaching the caller's cookies adds nothing but a token
 * to validate. That is not free: production returned PGRST303, "JWT issued at
 * future", when a visitor's device clock ran slightly ahead of Supabase's, and
 * PostgREST refused a query that never needed the token at all. Sending no
 * session removes the failure rather than catching it.
 *
 * Only for genuinely public data. Anything scoped to a user must use
 * createClient(), which is what carries the identity RLS reads.
 */
export const createPublicClient = () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );

export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies read-only, safe to ignore
          }
        },
      },
    }
  );
};
