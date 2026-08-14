import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params: Record<string, string> = {};
  ["league", "season", "date", "from", "to", "team", "round", "status"].forEach((k) => {
    const v = searchParams.get(k);
    if (v) params[k] = v;
  });
  try {
    const data = await apiFetch("/fixtures", params, 60);
    return NextResponse.json(data, {
      // A day of fixtures is a large payload and the page polls it every thirty
      // seconds. Without this the browser re-downloads all of it each time —
      // which on a slow mobile connection takes longer than the interval, so
      // the polls pile up and nothing ever finishes arriving. The upstream call
      // was already cached; this makes the response to the phone cheap too.
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
