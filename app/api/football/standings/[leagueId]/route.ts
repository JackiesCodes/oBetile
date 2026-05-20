import { NextRequest, NextResponse } from "next/server";
import { apiFetch, CURRENT_SEASON } from "@/lib/api-football";

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const season = new URL(req.url).searchParams.get("season") ?? CURRENT_SEASON;
  try {
    const data = await apiFetch("/standings", { league: params.leagueId, season }, 3600);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
