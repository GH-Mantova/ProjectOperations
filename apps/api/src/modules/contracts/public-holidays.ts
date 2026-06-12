// Static Queensland public holidays for the current year. The claim cut-off
// reminder uses this to roll a due date back to the immediately preceding
// work day when the calculated date lands on a weekend or public holiday.
//
// Includes the national holidays plus Queensland-specific dates (Labour Day
// first Monday of May, King's Birthday second Monday of October in QLD).
// When the year rolls over, extend this table.

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Easter calculation (Meeus/Jones/Butcher). Returns { month: 3|4, day }.
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  // month is 1-based; weekday: 0=Sun..6=Sat. n: 1=first, 2=second, etc.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = first.getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

/**
 * Compute the set of Queensland public holidays for a year as ISO
 * `YYYY-MM-DD` strings.
 *
 * Covers New Year's Day, Australia Day, Good Friday / Easter Saturday /
 * Easter Monday (Meeus/Jones/Butcher Easter algorithm, UTC arithmetic),
 * Anzac Day, QLD Labour Day (first Monday of May), King's Birthday (first
 * Monday of October), Christmas Day, and Boxing Day. Fixed-date holidays
 * are not substituted when they fall on a weekend.
 *
 * @param year - calendar year to compute holidays for
 * @returns a Set of ISO date strings for that year's QLD public holidays
 */
export function qldPublicHolidays(year: number): Set<string> {
  const set = new Set<string>();
  set.add(isoDate(year, 1, 1)); // New Year's Day
  set.add(isoDate(year, 1, 26)); // Australia Day

  const easter = easterSunday(year);
  const easterDate = new Date(Date.UTC(year, easter.month - 1, easter.day));
  const goodFri = new Date(easterDate);
  goodFri.setUTCDate(easterDate.getUTCDate() - 2);
  const easterSat = new Date(easterDate);
  easterSat.setUTCDate(easterDate.getUTCDate() - 1);
  const easterMon = new Date(easterDate);
  easterMon.setUTCDate(easterDate.getUTCDate() + 1);
  for (const d of [goodFri, easterSat, easterMon]) {
    set.add(isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  }

  set.add(isoDate(year, 4, 25)); // Anzac Day
  set.add(isoDate(year, 5, nthWeekdayOfMonth(year, 5, 1, 1))); // QLD Labour Day — 1st Mon May
  set.add(isoDate(year, 10, nthWeekdayOfMonth(year, 10, 1, 1))); // QLD King's Birthday — 1st Mon Oct
  set.add(isoDate(year, 12, 25)); // Christmas Day
  set.add(isoDate(year, 12, 26)); // Boxing Day
  return set;
}

/**
 * Check whether a date is a Queensland public holiday.
 *
 * Despite the name, only the QLD holiday table is consulted; other
 * states' holidays are not considered. The comparison uses the date's
 * UTC year/month/day components.
 *
 * @param date - the date to test
 * @returns true when the date's UTC calendar day is in the QLD holiday set
 */
export function isAustralianPublicHoliday(date: Date): boolean {
  const set = qldPublicHolidays(date.getUTCFullYear());
  const iso = isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  return set.has(iso);
}

/**
 * Given a due date, roll it back to the immediately preceding work day if
 * it falls on a weekend (Sat/Sun) or Australian public holiday. Iterates
 * day-by-day, capped at 14 iterations as a safety bound.
 */
export function adjustToPrecedingWorkday(date: Date): Date {
  const d = new Date(date);
  for (let i = 0; i < 14; i += 1) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !isAustralianPublicHoliday(d)) return d;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}
