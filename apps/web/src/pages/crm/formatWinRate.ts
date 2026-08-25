/**
 * formatWinRate — CRM win-rate display helper.
 *
 * The server stores win_rate as a percentage already
 * (computed as ((win_count + delta) * 100) / (tender_count + delta)).
 * Do NOT multiply by 100 here.
 *
 * Accepts number (summary route) or string (360 route sends Decimal-as-string).
 */
export function formatWinRate(val: number | string | null | undefined): string {
  if (val == null) return "—"; // em dash
  const num = Number(val);
  if (!Number.isFinite(num)) return "—";
  if (num > 100) return "100.0%+";
  return `${num.toFixed(1)}%`;
}
