import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { serverErrorResponse, unconfiguredResponse } from "@/lib/api-error";

// GET ?fixtures=123,456,789
// Returns { "123": { "1x2": { home: 5, draw: 2, away: 3 } }, "456": { ... } }

/** A page shows a day of fixtures; well above anything the UI asks for. */
const MAX_FIXTURES = 200;
export async function GET(req: NextRequest) {
  if (!hasSupabaseConfig()) return unconfiguredResponse();
  const raw = new URL(req.url).searchParams.get("fixtures");
  if (!raw) return NextResponse.json({});

  // Bounded and positive-only, matching every other id-taking route. This one
  // accepted negatives, zero and an unlimited count, so a single request could
  // ask the database for an arbitrarily large `in` list.
  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  ).slice(0, MAX_FIXTURES);

  if (ids.length === 0) return NextResponse.json({});

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("match_market_votes")
      .select("fixture_id, market, selection")
      .in("fixture_id", ids);

    // Logged, but answered as an empty tally rather than a 500. These counts
    // are decoration on the match list — the same chips render empty when
    // nobody has voted — so failing the request gains the visitor nothing and
    // turns a cosmetic gap into an error in their console. Writes are held to
    // the opposite standard: they report every failure.
    if (error) {
      console.error("community.votes.batch failed", error);
      return NextResponse.json({});
    }

    const result: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of data ?? []) {
      const fid = String(row.fixture_id);
      if (!result[fid]) result[fid] = {};
      if (!result[fid][row.market]) result[fid][row.market] = {};
      result[fid][row.market][row.selection] = (result[fid][row.market][row.selection] ?? 0) + 1;
    }
    return NextResponse.json(result);
  } catch (e) {
    return serverErrorResponse("community.votes.batch", e);
  }
}
