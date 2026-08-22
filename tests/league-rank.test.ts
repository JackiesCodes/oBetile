import { describe, it, expect } from "vitest";
import {
  RANKED_LEAGUE_IDS,
  TOP_TIER_COUNT,
  WOMENS_EQUIVALENT,
  compareLeagues,
  isTopTier,
  leagueRank,
} from "@/lib/league-rank";

/**
 * What order competitions appear in.
 *
 * A typical day carries fixtures from close to three hundred competitions and
 * the provider returns them in no order at all, so this decides what somebody
 * sees first. The ids below are real ones taken from a full day of fixtures,
 * not invented for the test — the point of several of them is that they share a
 * name with a far bigger competition.
 */

const PREMIER_LEAGUE_ENGLAND = 39;
const PREMIER_LEAGUE_BHUTAN = 1031;
const PREMIER_LEAGUE_LESOTHO = 962;
const CHAMPIONS_LEAGUE = 2;
const SERIE_A_ITALY = 135;
const SERIE_A_BRAZIL = 71;
const U18_PREMIER_LEAGUE_NORTH = 695;
const MLS_NEXT_PRO = 909;
const TASMANIA_NORTHERN = 1091;

describe("the elite tier leads", () => {
  it("puts the Champions League first", () => {
    expect(RANKED_LEAGUE_IDS[0]).toBe(CHAMPIONS_LEAGUE);
  });

  it("has eight competitions in the top tier", () => {
    expect(TOP_TIER_COUNT).toBe(8);
    expect(RANKED_LEAGUE_IDS.length).toBeGreaterThan(TOP_TIER_COUNT);
  });

  it("counts the top eight as top tier and the ninth as not", () => {
    for (const id of RANKED_LEAGUE_IDS.slice(0, TOP_TIER_COUNT)) {
      expect(isTopTier(id), String(id)).toBe(true);
    }
    expect(isTopTier(RANKED_LEAGUE_IDS[TOP_TIER_COUNT])).toBe(false);
    expect(isTopTier(PREMIER_LEAGUE_BHUTAN)).toBe(false);
    expect(isTopTier(undefined)).toBe(false);
  });

  it("ranks in the order the list declares", () => {
    const ranks = RANKED_LEAGUE_IDS.map((id) => leagueRank(id, "irrelevant"));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("lists no competition twice", () => {
    expect(new Set(RANKED_LEAGUE_IDS).size).toBe(RANKED_LEAGUE_IDS.length);
  });
});

describe("ranking never keys on the competition's name", () => {
  it("separates leagues that share a name", () => {
    // The whole reason this ranks by id. These three are all called "Premier
    // League" and one of them is the one people opened the app for.
    expect(leagueRank(PREMIER_LEAGUE_ENGLAND, "Premier League")).toBeLessThan(
      leagueRank(PREMIER_LEAGUE_BHUTAN, "Premier League")
    );
    expect(leagueRank(PREMIER_LEAGUE_ENGLAND, "Premier League")).toBeLessThan(
      leagueRank(PREMIER_LEAGUE_LESOTHO, "Premier League")
    );
  });

  it("separates the two Serie A competitions", () => {
    expect(leagueRank(SERIE_A_ITALY, "Serie A")).toBeLessThan(leagueRank(SERIE_A_BRAZIL, "Serie A"));
  });

  it("ranks a known id the same whatever name comes with it", () => {
    // The provider renaming a competition must not move it down the page.
    expect(leagueRank(PREMIER_LEAGUE_ENGLAND, "Premier League")).toBe(
      leagueRank(PREMIER_LEAGUE_ENGLAND, "English Premier League 2026/27")
    );
  });
});

describe("age-grade football sorts below the senior game", () => {
  it.each([
    [U18_PREMIER_LEAGUE_NORTH, "U18 Premier League - North"],
    [MLS_NEXT_PRO, "MLS Next Pro"],
    [488, "U19 Bundesliga"],
    [1200, "Liga MX U21"],
    [1218, "Pro League U23"],
  ])("puts %i (%s) below an unranked senior league", (id, name) => {
    expect(leagueRank(id, name)).toBeGreaterThan(leagueRank(TASMANIA_NORTHERN, "Tasmania Northern Championship"));
  });

  it("does not demote a senior competition for containing a stray number", () => {
    expect(leagueRank(undefined, "Liga Pro Serie B")).toBe(
      leagueRank(undefined, "Jupiler Pro League")
    );
  });

  it("does not treat women's football as age-grade football", () => {
    // The one thing that must never happen: a senior women's competition
    // sorted in with under-19s and reserve sides.
    for (const id of Object.keys(WOMENS_EQUIVALENT).map(Number)) {
      expect(leagueRank(id, "Women"), String(id)).toBeLessThan(
        leagueRank(695, "U18 Premier League - North")
      );
    }
  });
});

describe("men's takes precedence, women's is ranked on the same basis", () => {
  const WOMENS_CHAMPIONS_LEAGUE = 525;
  const WSL = 44;
  const LIGA_F = 142;
  const SERIE_A_WOMEN = 139;
  const FRAUEN_BUNDESLIGA = 82;
  const BUNDESLIGA = 78;
  const EREDIVISIE_WOMEN = 91;
  const EREDIVISIE = 88;
  const NWSL = 254;
  const MLS = 253;

  it("puts every ranked men's competition above the women's block", () => {
    // "Men's supersedes" read as precedence rather than interleaving: the
    // whole men's list first, then the women's competitions.
    const lastMens = Math.max(...RANKED_LEAGUE_IDS.map((id) => leagueRank(id, "")));
    for (const id of Object.keys(WOMENS_EQUIVALENT).map(Number)) {
      expect(leagueRank(id, "Women"), String(id)).toBeGreaterThan(lastMens);
    }
  });

  it("orders the women's block by the same tiering as the men's", () => {
    // Bundesliga outranks Eredivisie outranks MLS, so the women's block runs
    // in exactly that order — "honoured the same" means the same tiering, not
    // an alphabetical afterthought.
    expect(leagueRank(BUNDESLIGA, "")).toBeLessThan(leagueRank(EREDIVISIE, ""));
    expect(leagueRank(EREDIVISIE, "")).toBeLessThan(leagueRank(MLS, ""));

    expect(leagueRank(FRAUEN_BUNDESLIGA, "Frauen Bundesliga")).toBeLessThan(
      leagueRank(EREDIVISIE_WOMEN, "Eredivisie Women")
    );
    expect(leagueRank(EREDIVISIE_WOMEN, "Eredivisie Women")).toBeLessThan(
      leagueRank(NWSL, "NWSL Women")
    );
  });

  it("keeps a women's competition above unranked men's football", () => {
    // The other half of "honoured the same": it is ranked, so it does not fall
    // into the unranked mass with competitions nobody tiered.
    expect(leagueRank(FRAUEN_BUNDESLIGA, "Frauen Bundesliga")).toBeLessThan(
      leagueRank(1031, "Premier League")
    );
    expect(leagueRank(NWSL, "NWSL Women")).toBeLessThan(leagueRank(1091, "Tasmania Northern"));
  });

  it("leaves a women's competition unranked when its men's counterpart is", () => {
    // Damallsvenskan has no men's equivalent in the ranked list, so it sits in
    // the unranked middle — the same place Sweden's men's league sits.
    expect(leagueRank(549, "Damallsvenskan")).toBe(leagueRank(undefined, "Some Other League"));
  });

  it("leads the women's block with the same competitions the men's list leads with", () => {
    // The women's block mirrors the men's tiering exactly, so its first four
    // are the counterparts of the men's first four.
    const order = [WOMENS_CHAMPIONS_LEAGUE, WSL, LIGA_F, SERIE_A_WOMEN, FRAUEN_BUNDESLIGA];
    const ranks = order.map((id) => leagueRank(id, "Women"));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("pairs a league with a league, never with a cup", () => {
    // Italy's entry pointed at Serie A Cup Women, a cup, where the league is
    // Serie A Women. Both exist and the ids are one digit apart in neither
    // direction, so nothing about the number would have given it away.
    expect(WOMENS_EQUIVALENT[139]).toBe(135);
    expect(WOMENS_EQUIVALENT[1198]).toBeUndefined();
  });

  it("maps every entry to a competition that is actually ranked", () => {
    for (const [womens, mens] of Object.entries(WOMENS_EQUIVALENT)) {
      expect(RANKED_LEAGUE_IDS, `${womens} -> ${mens}`).toContain(mens);
    }
  });
});

describe("comparing two competitions", () => {
  const league = (leagueId: number | undefined, name: string, country = "") => ({
    leagueId,
    league: name,
    country,
  });

  it("orders by rank before anything else", () => {
    const ucl = league(CHAMPIONS_LEAGUE, "UEFA Champions League", "World");
    const bhutan = league(PREMIER_LEAGUE_BHUTAN, "Premier League", "Bhutan");
    expect(compareLeagues(ucl, bhutan)).toBeLessThan(0);
    expect(compareLeagues(bhutan, ucl)).toBeGreaterThan(0);
  });

  it("falls back to country then name so unranked leagues hold still", () => {
    // Without this the order past the ranked list changes between loads,
    // because it is whatever sequence the provider happened to return.
    const a = league(9001, "Alpha League", "Andorra");
    const b = league(9002, "Beta League", "Andorra");
    const c = league(9003, "Alpha League", "Belgium");
    expect(compareLeagues(a, b)).toBeLessThan(0);
    expect(compareLeagues(a, c)).toBeLessThan(0);
    expect(compareLeagues(b, c)).toBeLessThan(0);
  });

  it("sorts a realistic day the way somebody would expect", () => {
    const day = [
      league(TASMANIA_NORTHERN, "Tasmania Northern Championship", "Australia"),
      league(U18_PREMIER_LEAGUE_NORTH, "U18 Premier League - North", "England"),
      league(PREMIER_LEAGUE_BHUTAN, "Premier League", "Bhutan"),
      league(SERIE_A_ITALY, "Serie A", "Italy"),
      league(CHAMPIONS_LEAGUE, "UEFA Champions League", "World"),
      league(40, "Championship", "England"),
      league(PREMIER_LEAGUE_ENGLAND, "Premier League", "England"),
    ];
    expect([...day].sort(compareLeagues).map((l) => l.leagueId)).toEqual([
      CHAMPIONS_LEAGUE,
      PREMIER_LEAGUE_ENGLAND,
      SERIE_A_ITALY,
      40,
      // Past the ranked list there is no basis to say a national top flight in
      // Bhutan outranks a regional Australian league, so both fall back to
      // country order — Australia, then Bhutan. Stable rather than clever, and
      // the fix for a specific case is to rank that competition explicitly.
      TASMANIA_NORTHERN,
      PREMIER_LEAGUE_BHUTAN,
      U18_PREMIER_LEAGUE_NORTH,
    ]);
  });
});
