import { NextRequest, NextResponse } from "next/server";
import { apiFetch, resolveSeason } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";
import { normaliseToFairOdds } from "@/lib/odds";
import { fitToOutcomes, predictFixture, predictGrid, type TeamRecord, type HeadToHead } from "@/lib/model";
import { OFFERED_MARKETS, priceMarket } from "@/lib/markets";
import type { APIFixture } from "@/types";

/**
 * Win probabilities computed here rather than taken from a price feed.
 *
 * GET /api/football/model?ids=111,222        -> standings + form
 * GET /api/football/model?fixture=111        -> standings + form + head to head
 *
 * Bookmakers price a minority of fixtures, and the provider's own forecast
 * returns a flat 33/33/33 for anything it lacks history on — both measured
 * against production. This fills the gap from data the app already has.
 *
 * Cost is per league, not per fixture: one call for the batch of fixtures, then
 * one standings call per distinct competition. Twenty fixtures spread over six
 * leagues is seven requests, against twenty for a per-fixture forecast.
 */

interface APIStandingRow {
  team?: { id?: number };
  form?: string | null;
  home?: { played?: number; goals?: { for?: number; against?: number } };
  away?: { played?: number; goals?: { for?: number; against?: number } };
}

interface APIStandingsEntry {
  league?: { standings?: APIStandingRow[][] };
}

const MAX_IDS = 20;
const IDS_PER_REQUEST = 20;

/** Standings move only as matches finish. */
const STANDINGS_TTL = 3600;
const FIXTURES_TTL = 300;
const H2H_TTL = 86400;

function toTeamRecord(row: APIStandingRow): TeamRecord | null {
  const id = row.team?.id;
  if (!id) return null;
  return {
    teamId: id,
    home: {
      played: row.home?.played ?? 0,
      goalsFor: row.home?.goals?.for ?? 0,
      goalsAgainst: row.home?.goals?.against ?? 0,
    },
    away: {
      played: row.away?.played ?? 0,
      goalsFor: row.away?.goals?.for ?? 0,
      goalsAgainst: row.away?.goals?.against ?? 0,
    },
    form: row.form ?? null,
  };
}

/** Every team in a competition, flattened across groups. */
async function leagueTable(leagueId: number, season: string): Promise<TeamRecord[]> {
  const data = await apiFetch<APIStandingsEntry[]>(
    "/standings",
    { league: String(leagueId), season },
    STANDINGS_TTL
  );

  // Group stages nest several tables under one league; a team's strength is
  // still measured against the whole competition.
  const groups = data?.[0]?.league?.standings ?? [];
  return groups.flat().map(toTeamRecord).filter((t): t is TeamRecord => t !== null);
}

async function headToHead(homeId: number, awayId: number): Promise<HeadToHead | null> {
  try {
    const fixtures = await apiFetch<APIFixture[]>(
      "/fixtures/headtohead",
      { h2h: `${homeId}-${awayId}`, last: "10" },
      H2H_TTL
    );

    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;

    for (const f of fixtures ?? []) {
      const h = f.goals?.home;
      const a = f.goals?.away;
      if (h === null || a === null || h === undefined || a === undefined) continue;

      // Counted from the perspective of whichever side is at home in the
      // upcoming fixture, not whoever was at home in the old one.
      const homeTeamWasHome = f.teams?.home?.id === homeId;
      const scoredByHomeTeam = homeTeamWasHome ? h : a;
      const scoredByAwayTeam = homeTeamWasHome ? a : h;

      if (scoredByHomeTeam > scoredByAwayTeam) homeWins++;
      else if (scoredByHomeTeam < scoredByAwayTeam) awayWins++;
      else draws++;
    }

    const played = homeWins + draws + awayWins;
    return played > 0 ? { played, homeWins, draws, awayWins } : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const single = searchParams.get("fixture");
  const raw = single ?? searchParams.get("ids");
  if (!raw) return NextResponse.json({});

  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  ).slice(0, MAX_IDS);

  if (ids.length === 0) return NextResponse.json({});

  try {
    // 1. What are these fixtures, and which competitions are they in?
    const fixtures: APIFixture[] = [];
    for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
      const batch = ids.slice(i, i + IDS_PER_REQUEST);
      const page = await apiFetch<APIFixture[]>(
        "/fixtures",
        { ids: batch.join("-") },
        FIXTURES_TTL
      );
      fixtures.push(...(page ?? []));
    }

    // 2. One standings call per distinct competition, not per fixture.
    //
    // The key is recorded against the fixture rather than rebuilt later. When
    // the upstream omits league.season the key used here came from
    // resolveSeason() while the lookup below rebuilt it from the missing field,
    // so it read `39:undefined`, missed every time, and those fixtures silently
    // got no prediction at all.
    const tables = new Map<string, TeamRecord[]>();
    const keyForFixture = new Map<number, string>();
    for (const f of fixtures) {
      const leagueId = f.league?.id;
      if (!leagueId) continue;
      const season = f.league?.season ? String(f.league.season) : await resolveSeason(leagueId);
      const key = `${leagueId}:${season}`;
      keyForFixture.set(f.fixture.id, key);
      if (tables.has(key)) continue;
      try {
        tables.set(key, await leagueTable(leagueId, season));
      } catch {
        // A competition without a published table simply yields no prediction.
        tables.set(key, []);
      }
    }

    /**
     * Market prices are computed here, not in the browser.
     *
     * Everything beyond the match result needs the scoreline grid, and the grid
     * needs the league table — several hundred numbers the client has no reason
     * to hold. Only the single-fixture form carries them: pricing forty markets
     * for every row of a twenty-fixture feed would be a large response nobody
     * reads.
     */
    const result: Record<
      string,
      { home: number; draw: number; away: number; markets?: Record<string, Record<string, number>> }
    > = {};
    let considered = 0;

    for (const f of fixtures) {
      considered++;
      const leagueId = f.league?.id;
      const homeId = f.teams?.home?.id;
      const awayId = f.teams?.away?.id;
      if (!leagueId || !homeId || !awayId) continue;

      const table = tables.get(keyForFixture.get(f.fixture.id) ?? "") ?? [];
      const home = table.find((t) => t.teamId === homeId);
      const away = table.find((t) => t.teamId === awayId);
      if (!home || !away) continue;

      // Head to head costs a request per fixture, so it is only worth it when
      // the caller asked about one match — the match page, not the feed.
      const h2h = single ? await headToHead(homeId, awayId) : null;

      const probabilities = predictFixture({ home, away, table, h2h });
      if (!probabilities) continue;

      const fair = normaliseToFairOdds({
        home: probabilities.home * 100,
        draw: probabilities.draw * 100,
        away: probabilities.away * 100,
      });
      if (!fair) continue;

      if (!single) {
        result[String(f.fixture.id)] = fair;
        continue;
      }

      // Refitted to the figures actually published rather than to the model's
      // raw output: normaliseToFairOdds is the last thing to touch them, and a
      // market read off an unfitted grid would disagree with the percentage
      // printed beside it.
      const grid = predictGrid({ home, away, table, h2h });
      const markets = grid
        ? Object.fromEntries(
            OFFERED_MARKETS.map((m) => [
              m.id,
              priceMarket(
                m,
                fitToOutcomes(grid, {
                  home: fair.home / 100,
                  draw: fair.draw / 100,
                  away: fair.away / 100,
                })
              ),
            ])
          )
        : undefined;

      result[String(f.fixture.id)] = markets ? { ...fair, markets } : fair;
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `s-maxage=${STANDINGS_TTL}, stale-while-revalidate=300`,
        "x-model-considered": String(considered),
        "x-model-returned": String(Object.keys(result).length),
        "x-model-tables": String(tables.size),
        "x-model-h2h": single ? "1" : "0",
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
