import { NextRequest, NextResponse } from "next/server";
import { apiFetch, CURRENT_SEASON, MAJOR_LEAGUES } from "@/lib/api-football";
import type { NewsItem } from "@/types";

interface APIInjury {
  player: { id: number; name: string; type: string; reason: string | null };
  team: { id: number; name: string };
  fixture: { date: string } | null;
}

interface APIFixtureBasic {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
}

async function fetchLeagueNews(leagueId: number, leagueName: string): Promise<NewsItem[]> {
  const now = new Date();
  const toDate = now.toISOString().split("T")[0];
  const fromDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [injuries, recentFixtures] = await Promise.all([
    apiFetch<APIInjury[]>(
      "/injuries",
      { league: String(leagueId), season: CURRENT_SEASON },
      300
    ).catch(() => [] as APIInjury[]),

    apiFetch<APIFixtureBasic[]>(
      "/fixtures",
      {
        league: String(leagueId),
        season: CURRENT_SEASON,
        from: fromDate,
        to: toDate,
        status: "FT",
      },
      300
    ).catch(() => [] as APIFixtureBasic[]),
  ]);

  const items: NewsItem[] = [];

  // Injury news items
  injuries.slice(0, 5).forEach((inj, i) => {
    items.push({
      id: `inj-${leagueId}-${inj.player.id}-${i}`,
      type: "injury",
      text: `🤕 ${inj.player.name} (${inj.team.name}) — ${inj.player.reason ?? inj.player.type}`,
      timestamp: inj.fixture?.date ?? now.toISOString(),
      leagueId,
      leagueName,
    });
  });

  // Recent result items
  recentFixtures.slice(0, 5).forEach((f) => {
    if (f.goals.home === null || f.goals.away === null) return;
    items.push({
      id: `res-${f.fixture.id}`,
      type: "result",
      text: `⚽ ${f.teams.home.name} ${f.goals.home}–${f.goals.away} ${f.teams.away.name}`,
      timestamp: f.fixture.date,
      leagueId,
      leagueName,
    });
  });

  return items;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leaguesParam = searchParams.get("leagues");
  const singleLeague = searchParams.get("league");

  // `leagues=39,140,78` merges news across multiple leagues (used for the "All" feed view).
  // Falls back to the legacy single `league` param, then Premier League.
  const leagueIds = leaguesParam
    ? leaguesParam.split(",").map((s) => Number(s.trim())).filter(Boolean)
    : [Number(singleLeague ?? 39)];

  const nameFor = (id: number) => MAJOR_LEAGUES.find((l) => l.id === id)?.name ?? "";

  try {
    const perLeague = await Promise.all(
      leagueIds.map((id) => fetchLeagueNews(id, nameFor(id)).catch(() => [] as NewsItem[]))
    );

    const items = perLeague.flat();

    // Sort newest-first
    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json(items.slice(0, 15), {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
