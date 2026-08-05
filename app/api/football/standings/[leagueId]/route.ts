import { NextRequest, NextResponse } from "next/server";
import { apiFetch, resolveSeason } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

interface StandingsRow {
  all?: { played?: number };
}

interface StandingsEntry {
  league?: { season?: number; standings?: StandingsRow[][] };
}

/**
 * Whether a table reflects matches actually played.
 *
 * Presence of rows is not enough: before a season's first round API-Football
 * returns a full placeholder table with every team on played 0, points 0 and
 * form null, ordered alphabetically. Rendering that as a title race puts
 * whoever is first alphabetically top of the league, so it has to count as
 * "no table yet".
 */
function hasPlayedTable(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  const groups = (data[0] as StandingsEntry)?.league?.standings;
  if (!Array.isArray(groups)) return false;
  return groups.some(
    (g) => Array.isArray(g) && g.some((row) => (row?.all?.played ?? 0) > 0)
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const explicitSeason = new URL(req.url).searchParams.get("season");

  try {
    // An explicit ?season= wins; otherwise ask the API which season this league
    // is actually in, so calendar-year competitions aren't given a European one.
    let season = explicitSeason ?? (await resolveSeason(leagueId));
    let data = await apiFetch("/standings", { league: leagueId, season }, 3600);
    let isFinal = false;

    // Before a season's first round there is nothing meaningful to show — only
    // an all-zero placeholder table. Fall back to the last completed season and
    // flag it, so the client can label the table rather than pass off either
    // finished results or an empty grid as a live race.
    if (!explicitSeason && !hasPlayedTable(data)) {
      const previous = String(Number(season) - 1);
      const previousData = await apiFetch(
        "/standings",
        { league: leagueId, season: previous },
        3600
      );
      if (hasPlayedTable(previousData)) {
        data = previousData;
        season = previous;
        isFinal = true;
      }
    }

    return NextResponse.json(data, {
      headers: {
        "x-season": String(season),
        // "1" means the table is a completed season, not one in progress.
        "x-season-final": isFinal ? "1" : "0",
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
