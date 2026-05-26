import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET ?fixtures=123,456,789
// Returns { "123": { "1x2": { home: 5, draw: 2, away: 3 } }, "456": { ... } }
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("fixtures");
  if (!raw) return NextResponse.json({});

  const ids = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  if (ids.length === 0) return NextResponse.json({});

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("match_market_votes")
      .select("fixture_id, market, selection")
      .in("fixture_id", ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of data ?? []) {
      const fid = String(row.fixture_id);
      if (!result[fid]) result[fid] = {};
      if (!result[fid][row.market]) result[fid][row.market] = {};
      result[fid][row.market][row.selection] = (result[fid][row.market][row.selection] ?? 0) + 1;
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
