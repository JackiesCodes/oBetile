import { NextRequest, NextResponse } from "next/server";
import { hasAdminConfig } from "@/lib/supabase/admin";
import { recordRun, syncFixtureResults, syncTeamStatistics, type SyncOutcome } from "@/lib/sync";
import { serverErrorResponse } from "@/lib/api-error";

/**
 * Populate the local copy of the football data.
 *
 * GET /api/sync                      -> everything (what the daily cron calls)
 * GET /api/sync?job=results&days=3   -> just finished fixtures
 * GET /api/sync?job=stats&league=39  -> just one competition's team records
 *
 * Serves as both the scheduled job and the manual refresh, because they are the
 * same work and keeping one code path means the button and the cron cannot
 * drift apart.
 *
 * Authorisation is the shared CRON_SECRET. Vercel sends it as a bearer token on
 * scheduled invocations; a person triggering a refresh passes the same value.
 * Without that check this endpoint would let anyone on the internet spend the
 * upstream request allowance at will.
 */

export const maxDuration = 60;

/**
 * Wall clock the sync may use, leaving the rest of maxDuration to finish the
 * league in hand and write its rows. The team sweep is paced to the upstream's
 * rate limit and a full pass is close to a minute of calls, so it can genuinely
 * run out — better it stop and say which leagues it missed than be killed
 * partway and record nothing at all.
 */
const TIME_BUDGET_MS = 45_000;
/** Never cached: a sync that returned a stored answer would do nothing at all. */
export const dynamic = "force-dynamic";

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured means no sync. Failing closed matters more than
  // convenience here: the open version hands the request budget to strangers.
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(req.url).searchParams.get("secret") ?? "";
  return bearer === secret || query === secret;
}

export async function GET(req: NextRequest) {
  if (!hasAdminConfig()) {
    return NextResponse.json(
      {
        error: "Sync is not configured.",
        needs: ["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"],
        // Said plainly because this is the expected state until the keys are
        // added, and everything else in the app works regardless.
        note: "The app reads live from API-Football without this; the local copy stays empty.",
      },
      { status: 503 }
    );
  }
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const job = searchParams.get("job") ?? "all";
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + TIME_BUDGET_MS;

  try {
    const outcomes: SyncOutcome[] = [];

    if (job === "all" || job === "results") {
      const days = Math.min(Math.max(Number(searchParams.get("days") ?? 2), 1), 14);
      const out = await syncFixtureResults(days);
      outcomes.push(out);
      await recordRun(out, startedAt);
    }

    if (job === "all" || job === "stats") {
      const league = Number(searchParams.get("league"));
      const leagues = Number.isInteger(league) && league > 0 ? [league] : undefined;
      const out = await syncTeamStatistics(leagues, deadline);
      outcomes.push(out);
      await recordRun(out, startedAt);
    }

    if (outcomes.length === 0) {
      return NextResponse.json(
        { error: `Unknown job "${job}". Use all, results or stats.` },
        { status: 400 }
      );
    }

    // 207 when some part fell short: the caller gets the detail rather than a
    // flat success that hides a half-finished run.
    const allOk = outcomes.every((o) => o.ok);
    return NextResponse.json(
      { ok: allOk, startedAt, finishedAt: new Date().toISOString(), outcomes },
      { status: allOk ? 200 : 207 }
    );
  } catch (e) {
    return serverErrorResponse("sync", e);
  }
}
