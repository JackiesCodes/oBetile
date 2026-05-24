export function oddsToPercent(odds: number): number {
  return Math.round((1 / odds) * 100);
}
