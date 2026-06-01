// Helpers for the §7 approved-timesheet → payroll CSV export.
//
// Kept dependency-free so it can be unit-tested without spinning up the
// Nest module graph, and so we don't take a hard dep on a csv library
// for a single small output. RFC 4180 escaping only.

export interface PayrollCsvRow {
  workerName: string;
  workerEmployeeId: string;
  date: string;
  jobRef: string;
  regularHours: string;
  notes: string;
}

export const PAYROLL_CSV_COLUMNS = [
  "worker_name",
  "worker_employee_id",
  "date",
  "job_ref",
  "regular_hours",
  "notes"
] as const;

// RFC 4180: quote any field that contains a comma, quote, CR, or LF, and
// double up existing quotes inside it. Plain fields pass through as-is.
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function truncateNotes(value: string | null | undefined, max = 200): string {
  if (!value) return "";
  return value.length > max ? value.slice(0, max) : value;
}

// Formats a Date as the ISO calendar date in UTC (YYYY-MM-DD). Timesheets
// are stored at UTC midnight so this matches what the user entered.
export function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function renderPayrollCsv(rows: PayrollCsvRow[]): string {
  const header = PAYROLL_CSV_COLUMNS.join(",");
  const body = rows.map((row) =>
    [
      row.workerName,
      row.workerEmployeeId,
      row.date,
      row.jobRef,
      row.regularHours,
      row.notes
    ]
      .map(escapeCsvField)
      .join(",")
  );
  // Trailing CRLF is RFC 4180-conformant and Excel-friendly.
  return [header, ...body].join("\r\n") + "\r\n";
}
