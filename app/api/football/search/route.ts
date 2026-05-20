import { NextRequest, NextResponse } from "next/server";
import { apiFetch, CURRENT_SEASON } from "@/lib/api-football";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q || q.length < 2) return NextResponse.json({ teams: [], leagues: [], players: [] });

  try {
    const [teams, leagues, players] = await Promise.allSettled([
      apiFetch("/teams", { search: q }, 300),
      apiFetch("/leagues", { search: q }, 300),
      apiFetch("/players", { search: q, season: CURRENT_SEASON }, 300),
    ]);

    return NextResponse.json({
      teams: teams.status === "fulfilled" ? teams.value : [],
      leagues: leagues.status === "fulfilled" ? leagues.value : [],
      players: players.status === "fulfilled" ? players.value : [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
