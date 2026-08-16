import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A client that can write the football tables.
 *
 * Those tables grant select to everyone and insert to nobody — no policy exists
 * for writes at all — so only the service role, which bypasses row level
 * security, can populate them. That is the point: the sync job writes, and
 * nothing reaching the browser can.
 *
 * The key is server-only and must never be prefixed NEXT_PUBLIC_. It is not
 * required for the app to run: without it the sync endpoints report themselves
 * unconfigured and every existing feature carries on reading live from
 * API-Football exactly as before.
 */
export const hasAdminConfig = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The sync job cannot write without it; " +
        "add it to the deployment's environment variables (server-side only)."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
