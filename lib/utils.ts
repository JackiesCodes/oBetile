import { Match } from "@/types";

export function oddsToPercent(odds: number): number {
  return Math.round((1 / odds) * 100);
}

export function getTopPick(match: Match): { label: string; pct: number } | null {
  const { home, draw, away } = match.odds;
  const candidates: { label: string; odds: number }[] = [];
  if (home !== null) candidates.push({ label: "Home Win", odds: home });
  if (draw !== null) candidates.push({ label: "Draw", odds: draw });
  if (away !== null) candidates.push({ label: "Away Win", odds: away });
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (a.odds < b.odds ? a : b));
  return { label: best.label, pct: oddsToPercent(best.odds) };
}
