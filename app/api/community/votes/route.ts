import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverErrorResponse } from "@/lib/api-error";

/**
 * Votes are counted straight out of these columns, so anything accepted here is
 * permanent, publicly-visible tally data. Restrict both fields to the markets
 * the UI actually offers rather than storing arbitrary caller-supplied strings.
 */
const MARKETS: Record<string, ReadonlySet<string>> = {
  "1x2": new Set(["home", "draw", "away"]),
  btts: new Set(["yes", "no"]),
  ou: new Set(["over", "under"]),
};

/** Fixture ids come from API-Football and are always positive integers. */
function parseFixtureId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET ?fixture=123  →  { "1x2": { home: 12, draw: 5, away: 8 }, "btts": { yes: 10, no: 15 } }
export async function GET(req: NextRequest) {
  const fixtureId = parseFixtureId(new URL(req.url).searchParams.get("fixture"));
  if (fixtureId === null) {
    return NextResponse.json({ error: "valid fixture param required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("match_market_votes")
      .select("market, selection")
      .eq("fixture_id", fixtureId);

    if (error) {
      console.error("votes GET failed", error);
      return NextResponse.json({ error: "Could not load votes" }, { status: 500 });
    }

    const counts: Record<string, Record<string, number>> = {};
    for (const row of data ?? []) {
      if (!counts[row.market]) counts[row.market] = {};
      counts[row.market][row.selection] = (counts[row.market][row.selection] ?? 0) + 1;
    }
    return NextResponse.json(counts);
  } catch (e) {
    return serverErrorResponse("community.votes", e);
  }
}

// POST { fixture_id, market, selection }  →  toggle vote, return updated counts
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const fixture_id = parseFixtureId(body?.fixture_id);
    const market = String(body?.market ?? "");
    const selection = String(body?.selection ?? "");

    if (fixture_id === null) {
      return NextResponse.json({ error: "valid fixture_id required" }, { status: 400 });
    }
    if (!MARKETS[market]?.has(selection)) {
      return NextResponse.json(
        { error: "Unsupported market or selection" },
        { status: 400 }
      );
    }

    // Check if user already voted on this market
    const { data: existing } = await supabase
      .from("match_market_votes")
      .select("selection")
      .eq("fixture_id", fixture_id)
      .eq("market", market)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Delete old vote (toggle off or change)
      await supabase
        .from("match_market_votes")
        .delete()
        .eq("fixture_id", fixture_id)
        .eq("market", market)
        .eq("user_id", user.id);

      // If same selection — just toggled off, don't re-insert
      if (existing.selection === selection) {
        return await getUpdatedCounts(supabase, fixture_id);
      }
    }

    // Insert new vote
    await supabase.from("match_market_votes").insert({
      fixture_id,
      market,
      selection,
      user_id: user.id,
    });

    return await getUpdatedCounts(supabase, fixture_id);
  } catch (e) {
    return serverErrorResponse("community.votes", e);
  }
}

async function getUpdatedCounts(supabase: Awaited<ReturnType<typeof createClient>>, fixtureId: number) {
  const { data } = await supabase
    .from("match_market_votes")
    .select("market, selection")
    .eq("fixture_id", fixtureId);

  const counts: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    if (!counts[row.market]) counts[row.market] = {};
    counts[row.market][row.selection] = (counts[row.market][row.selection] ?? 0) + 1;
  }
  return NextResponse.json(counts);
}
