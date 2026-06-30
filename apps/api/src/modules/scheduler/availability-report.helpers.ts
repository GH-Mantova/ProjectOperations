// PR-454 — Availability heatmap helpers (pure, dependency-free for testing).
//
// Builds a month-long calendar grid, normalises worker keys for the
// unique-by-name TOTAL AVAILABLE counter, escapes RFC 4180 CSV.

export interface DayMeta {
  date: string; // YYYY-MM-DD
  weekday: number; // 0=Sun..6=Sat (UTC)
  isWeekend: boolean;
  isHoliday: boolean;
  skipped: boolean; // weekend or holiday AND skip flag on
}

// Lowercased + trimmed full name. The Resource Allocator considered two
// records with the same display name as one person — this keeps that
// behaviour for the TOTAL AVAILABLE row.
export function normaliseName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}

// Validate YYYY-MM and return UTC first-of-month + last-of-month.
export function monthBounds(month: string): { start: Date; endExclusive: Date } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("month must be YYYY-MM");
  }
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr) - 1; // 0-indexed
  const start = new Date(Date.UTC(y, m, 1));
  const endExclusive = new Date(Date.UTC(y, m + 1, 1));
  return { start, endExclusive };
}

export function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildMonthDays(
  month: string,
  holidayDates: ReadonlySet<string>,
  skipNonWorkingDays: boolean
): DayMeta[] {
  const { start, endExclusive } = monthBounds(month);
  const out: DayMeta[] = [];
  for (
    let cursor = new Date(start);
    cursor < endExclusive;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const iso = formatIsoDate(cursor);
    const weekday = cursor.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isHoliday = holidayDates.has(iso);
    const skipped = skipNonWorkingDays && (isWeekend || isHoliday);
    out.push({ date: iso, weekday, isWeekend, isHoliday, skipped });
  }
  return out;
}

// RFC 4180 escape.
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export interface CsvGroup {
  group: string;
  total: number;
  perDayAvailable: Map<string, number>;
}

export interface CsvReport {
  month: string;
  days: DayMeta[];
  groups: CsvGroup[];
  uniqueAvailablePerDay: Map<string, number>;
}

export function renderReportCsv(report: CsvReport): string {
  const dayCols = report.days.map((d) => d.date);
  const header = ["group", "total", ...dayCols];
  const lines: string[] = [header.map(escapeCsvField).join(",")];
  for (const g of report.groups) {
    const row = [g.group, String(g.total)];
    for (const d of dayCols) {
      row.push(String(g.perDayAvailable.get(d) ?? 0));
    }
    lines.push(row.map(escapeCsvField).join(","));
  }
  const totalRow = ["TOTAL AVAILABLE (unique by name)", ""];
  for (const d of dayCols) {
    totalRow.push(String(report.uniqueAvailablePerDay.get(d) ?? 0));
  }
  lines.push(totalRow.map(escapeCsvField).join(","));
  return lines.join("\r\n") + "\r\n";
}
