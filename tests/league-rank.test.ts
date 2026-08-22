import { describe, it, expect } from "vitest";
import {
  RANKED_LEAGUE_IDS,
  TOP_TIER_COUNT,
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

  it("makes no rule about women's football", () => {
    // A senior women's competition sorts with every other unranked senior
    // league. If it should rank higher that is a decision for the ranked list,
    // not something inferred from its name.
    expect(leagueRank(82, "Frauen Bundesliga")).toBe(leagueRank(undefined, "Some Other League"));
    expect(leagueRank(673, "Liga MX Femenil")).toBe(leagueRank(undefined, "Some Other League"));
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
