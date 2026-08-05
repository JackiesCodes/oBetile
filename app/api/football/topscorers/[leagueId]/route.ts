import { NextRequest, NextResponse } from "next/server";
import { apiFetch, CURRENT_SEASON } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const season = new URL(req.url).searchParams.get("season") ?? CURRENT_SEASON;
  try {
    const data = await apiFetch(
      "/players/topscorers",
      { league: leagueId, season },
      3600
    );
    return NextResponse.json(data);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
