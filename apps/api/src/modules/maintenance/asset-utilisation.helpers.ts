// Helpers for the §7 asset utilisation reporting endpoint.
//
// Kept dependency-free so they can be unit-tested without the Nest module
// graph. All date math is UTC because Shift.startAt / endAt and the request
// date range are normalised to UTC at the service boundary.

export const DEFAULT_WORK_HOURS_PER_DAY = 8;
export const MS_PER_HOUR = 60 * 60 * 1000;

// Mon-Fri count between two UTC dates × hoursPerDay. We treat the range as
// closed on both ends (the service rolls `to` to 23:59:59.999 UTC, so the
// last calendar day is included). Public holidays are intentionally not
// considered — see the prompt for §7.
export function workingHoursBetween(
  rangeStart: Date,
  rangeEnd: Date,
  hoursPerDay = DEFAULT_WORK_HOURS_PER_DAY
): number {
  if (rangeEnd < rangeStart) return 0;

  const startDay = Date.UTC(
    rangeStart.getUTCFullYear(),
    rangeStart.getUTCMonth(),
    rangeStart.getUTCDate()
  );
  const endDay = Date.UTC(
    rangeEnd.getUTCFullYear(),
    rangeEnd.getUTCMonth(),
    rangeEnd.getUTCDate()
  );

  let weekdays = 0;
  for (let day = startDay; day <= endDay; day += 24 * MS_PER_HOUR) {
    const dow = new Date(day).getUTCDay();
    if (dow !== 0 && dow !== 6) weekdays += 1;
  }
  return weekdays * hoursPerDay;
}

// Portion of one shift that falls inside the reporting range, in hours.
// Clamps the shift to the range so a shift that starts before / ends after
// only contributes the overlapping window.
export function hoursForShiftInRange(
  shiftStart: Date,
  shiftEnd: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const clampedStart = shiftStart > rangeStart ? shiftStart : rangeStart;
  const clampedEnd = shiftEnd < rangeEnd ? shiftEnd : rangeEnd;
  const ms = clampedEnd.getTime() - clampedStart.getTime();
  return ms > 0 ? ms / MS_PER_HOUR : 0;
}

// utilisationRate = allocated / available, capped at 1.0 (over-allocation
// from overlapping shifts shouldn't read as >100% capacity), rounded to 3
// decimal places. Zero available hours → 0 to avoid division-by-zero
// surprises in the response.
export function computeUtilisationRate(allocated: number, available: number): number {
  if (available <= 0) return 0;
  const raw = allocated / available;
  const capped = raw > 1 ? 1 : raw;
  return Math.round(capped * 1000) / 1000;
}
