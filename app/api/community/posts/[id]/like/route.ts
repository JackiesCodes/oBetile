import { NextRequest, NextResponse } from "next/server";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { serverErrorResponse, unconfiguredResponse } from "@/lib/api-error";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasSupabaseConfig()) return unconfiguredResponse();
  const { id: postId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, retryAfter } = await checkRateLimit(supabase, "like");
    if (!allowed) return tooManyRequests(retryAfter);

    // Check if already liked
    const { data: existing } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    // Both branches report their errors. The likes_count column is maintained
    // by a trigger on this table, so a write that quietly failed would leave
    // the caller showing a count the database never agreed with.
    if (existing) {
      // Unlike
      const { error: deleteError } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (deleteError) return serverErrorResponse("community.like.delete", deleteError);
      return NextResponse.json({ liked: false });
    } else {
      // Like
      const { error: insertError } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });
      if (insertError) return serverErrorResponse("community.like.insert", insertError);
      return NextResponse.json({ liked: true });
    }
  } catch (e) {
    return serverErrorResponse("community.like", e);
  }
}
