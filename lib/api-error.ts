import { NextResponse } from "next/server";
import { ApiFootballError } from "@/lib/api-football";

/**
 * Maps an upstream failure onto an honest HTTP status so the client can tell a
 * missing key from a burnt quota from a genuine outage — all three used to come
 * back as an indistinguishable 500.
 */
export function apiErrorResponse(e: unknown) {
  const kind = e instanceof ApiFootballError ? e.kind : "http";
  const status =
    kind === "auth" ? 401 : kind === "quota" ? 429 : kind === "plan" ? 403 : 502;

  // Only ApiFootballError messages are safe to echo — they are written here and
  // describe an actionable upstream condition. Anything else could carry stack
  // or infrastructure detail, so log it and return something generic.
  if (!(e instanceof ApiFootballError)) {
    console.error("upstream request failed", e);
    return NextResponse.json(
      { error: "Upstream request failed", kind },
      { status }
    );
  }

  return NextResponse.json({ error: e.message, kind }, { status });
}

/**
 * Generic 500 for our own backend failures.
 *
 * Supabase error messages and raw exceptions name tables, columns and
 * constraints, so they are logged server-side rather than returned to callers.
 */
export function serverErrorResponse(context: string, e: unknown, status = 500) {
  console.error(`${context} failed`, e);
  return NextResponse.json({ error: "Something went wrong" }, { status });
}

/**
 * The database is not configured on this deployment.
 *
 * Distinct from a 500: nothing has crashed and retrying will not help until
 * the keys are set. The browser client already degrades quietly when its
 * config is absent; without this the server half threw an opaque error from
 * inside the Supabase SDK for the same condition.
 */
export function unconfiguredResponse() {
  return NextResponse.json(
    { error: "Community features are not configured." },
    { status: 503 }
  );
}
