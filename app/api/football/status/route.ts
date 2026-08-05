import { NextResponse } from "next/server";
import { apiFetchRaw, ApiFootballError, CURRENT_SEASON } from "@/lib/api-football";

interface APIStatus {
  subscription: { plan: string; end: string; active: boolean };
  requests: { current: number; limit_day: number };
}

/**
 * Health check for the API-Football credentials — hit /api/football/status to
 * confirm the key is live and see how much of the daily quota is left.
 *
 * Deliberately does not echo the `account` block from the upstream response:
 * it carries the key owner's name and email, and this route has no auth in
 * front of it.
 */
export async function GET() {
  try {
    const { response } = await apiFetchRaw<APIStatus>("/status", undefined, 0);

    // A wrong-but-well-formed key returns 200 with an empty response here
    // rather than an `errors` payload, so treat the empty case as a failure.
    if (!response || Array.isArray(response) || !response.subscription) {
      return NextResponse.json(
        { ok: false, kind: "auth", error: "API-Football rejected the key (empty status response)." },
        { status: 502 }
      );
    }

    const { subscription, requests } = response;
    return NextResponse.json(
      {
        ok: subscription.active,
        plan: subscription.plan,
        subscriptionEnds: subscription.end,
        requestsToday: requests.current,
        dailyLimit: requests.limit_day,
        remainingToday: requests.limit_day - requests.current,
        configuredSeason: CURRENT_SEASON,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const kind = e instanceof ApiFootballError ? e.kind : "http";
    const status = kind === "auth" ? 401 : kind === "quota" ? 429 : 502;
    return NextResponse.json(
      { ok: false, kind, error: e instanceof Error ? e.message : String(e) },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
