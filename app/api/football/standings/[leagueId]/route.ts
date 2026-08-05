import { NextRequest, NextResponse } from "next/server";
import { apiFetch, resolveSeason } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

interface StandingsEntry {
  league?: { season?: number; standings?: unknown[][] };
}

/** A season can exist and still carry no table before its first round. */
function hasTable(data: unknown): data is StandingsEntry[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const groups = (data[0] as StandingsEntry)?.league?.standings;
  return Array.isArray(groups) && groups.some((g) => Array.isArray(g) && g.length > 0);
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

    // Between seasons the current one exists but has no table yet — a league in
    // the days before kick-off would render as an empty panel. Fall back to the
    // last completed season and flag it, so the client can label the table
    // rather than pass off finished results as a live race.
    if (!explicitSeason && !hasTable(data)) {
      const previous = String(Number(season) - 1);
      const previousData = await apiFetch(
        "/standings",
        { league: leagueId, season: previous },
        3600
      );
      if (hasTable(previousData)) {
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
