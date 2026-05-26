import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET ?fixture=123  →  { "1x2": { home: 12, draw: 5, away: 8 }, "btts": { yes: 10, no: 15 } }
export async function GET(req: NextRequest) {
  const fixtureId = new URL(req.url).searchParams.get("fixture");
  if (!fixtureId) return NextResponse.json({ error: "fixture param required" }, { status: 400 });

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("match_market_votes")
      .select("market, selection")
      .eq("fixture_id", parseInt(fixtureId, 10));

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const counts: Record<string, Record<string, number>> = {};
    for (const row of data ?? []) {
      if (!counts[row.market]) counts[row.market] = {};
      counts[row.market][row.selection] = (counts[row.market][row.selection] ?? 0) + 1;
    }
    return NextResponse.json(counts);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST { fixture_id, market, selection }  →  toggle vote, return updated counts
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { fixture_id, market, selection } = body;
    if (!fixture_id || !market || !selection) {
      return NextResponse.json({ error: "fixture_id, market, and selection required" }, { status: 400 });
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
    return NextResponse.json({ error: String(e) }, { status: 500 });
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
