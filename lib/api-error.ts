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

  return NextResponse.json(
    { error: e instanceof Error ? e.message : String(e), kind },
    { status }
  );
}
