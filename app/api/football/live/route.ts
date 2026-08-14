import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");
  const params: Record<string, string> = { live: league ?? "all" };
  try {
    const data = await apiFetch("/fixtures", params, 30);
    // Shorter than the fixtures list because scores are the point, but still
    // enough that several visitors polling at once share one response.
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
