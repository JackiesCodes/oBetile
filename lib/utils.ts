/**
 * Decimal odds as a whole-number percentage, floored at 1%.
 *
 * The floor matters because each percentage is also a button a visitor can
 * pick. A lopsided fixture can round below a half point, and rendering "0%"
 * would claim an outcome is impossible while still inviting a prediction on
 * it — no football result is impossible, and no odds feed prices one at zero.
 */
export function oddsToPercent(odds: number): number {
  return Math.max(1, Math.round((1 / odds) * 100));
}
