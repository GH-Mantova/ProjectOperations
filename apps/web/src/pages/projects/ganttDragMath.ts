const DAY_MS = 24 * 60 * 60 * 1000;

export function daysFromPx(deltaPx: number, pxPerDay: number): number {
  if (pxPerDay <= 0) return 0;
  return Math.round(deltaPx / pxPerDay);
}

export function shiftDatesByDays(
  startISO: string,
  endISO: string,
  days: number
): { startDate: string; endDate: string } {
  const start = new Date(new Date(startISO).getTime() + days * DAY_MS);
  const end = new Date(new Date(endISO).getTime() + days * DAY_MS);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
