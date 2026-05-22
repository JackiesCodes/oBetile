import { NextRequest, NextResponse } from "next/server";
import { apiFetch, CURRENT_SEASON } from "@/lib/api-football";

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

interface NewsItem {
  id: string;
  type: "injury" | "result";
  text: string;
  timestamp: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueParam = searchParams.get("league") ?? "39";

  const now = new Date();
  const toDate = now.toISOString().split("T")[0];
  const fromDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  try {
    const [injuries, recentFixtures] = await Promise.all([
      apiFetch<APIInjury[]>(
        "/injuries",
        { league: leagueParam, season: CURRENT_SEASON },
        300
      ).catch(() => [] as APIInjury[]),

      apiFetch<APIFixtureBasic[]>(
        "/fixtures",
        {
          league: leagueParam,
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
        id: `inj-${inj.player.id}-${i}`,
        type: "injury",
        text: `🤕 ${inj.player.name} (${inj.team.name}) — ${inj.player.reason ?? inj.player.type}`,
        timestamp: inj.fixture?.date ?? now.toISOString(),
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
      });
    });

    // Sort newest-first
    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json(items.slice(0, 8), {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
