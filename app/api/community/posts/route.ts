import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverErrorResponse } from "@/lib/api-error";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { sports } from "@/data/matches";

const SPORT_IDS = new Set(sports.map((s) => s.id));

/** Optional numeric references — reject anything that isn't a real fixture/league id. */
function positiveIntOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Clamp the page: a NaN or negative value produces an invalid range, and an
  // unbounded one lets a caller walk the whole table a request at a time.
  const rawPage = parseInt(searchParams.get("page") ?? "0", 10);
  const page = Number.isInteger(rawPage) ? Math.min(Math.max(rawPage, 0), 500) : 0;
  const limit = 20;
  const offset = page * limit;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("community_posts")
      .select("*, profiles(username, avatar_url)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return serverErrorResponse("community.posts", error);
    return NextResponse.json(data ?? []);
  } catch (e) {
    return serverErrorResponse("community.posts", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, retryAfter } = await checkRateLimit(supabase, user.id, "post");
    if (!allowed) return tooManyRequests(retryAfter);

    const body = await req.json();
    const content = String(body?.content ?? "").trim();

    if (!content || content.length > 500) {
      return NextResponse.json({ error: "Content must be 1–500 characters" }, { status: 400 });
    }

    const sport = String(body?.sport ?? "soccer");
    if (!SPORT_IDS.has(sport)) {
      return NextResponse.json({ error: "Unknown sport" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("community_posts")
      .insert({
        user_id: user.id,
        content,
        fixture_id: positiveIntOrNull(body?.fixture_id),
        league_id: positiveIntOrNull(body?.league_id),
        sport,
      })
      .select("*, profiles(username, avatar_url)")
      .single();

    if (error) return serverErrorResponse("community.posts", error);
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return serverErrorResponse("community.posts", e);
  }
}
