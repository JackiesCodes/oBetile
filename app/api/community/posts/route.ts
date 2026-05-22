import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "0", 10);
  const limit = 20;
  const offset = page * limit;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("community_posts")
      .select("*, profiles(username, avatar_url)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const content = (body.content ?? "").trim();

    if (!content || content.length > 500) {
      return NextResponse.json({ error: "Content must be 1–500 characters" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("community_posts")
      .insert({
        user_id: user.id,
        content,
        fixture_id: body.fixture_id ?? null,
        league_id: body.league_id ?? null,
        sport: body.sport ?? "soccer",
      })
      .select("*, profiles(username, avatar_url)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
