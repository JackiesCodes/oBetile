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
