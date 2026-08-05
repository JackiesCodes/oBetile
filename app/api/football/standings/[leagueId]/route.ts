import { NextRequest, NextResponse } from "next/server";
import { apiFetch, resolveSeason } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  // An explicit ?season= wins; otherwise ask the API which season this league
  // is actually in, so calendar-year competitions aren't given a European one.
  const season =
    new URL(req.url).searchParams.get("season") ?? (await resolveSeason(leagueId));
  try {
    const data = await apiFetch("/standings", { league: leagueId, season }, 3600);
    return NextResponse.json(data);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
