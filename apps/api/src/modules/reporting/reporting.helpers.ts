import { Prisma } from "@prisma/client";

// Shared date-window / Decimal helpers for the reporting layer.
//
// These live OUTSIDE reporting.service.ts on purpose. reporting.service.ts
// imports every "*.definitions.ts" file to build REPORT_DEFS, so any
// definitions file that imports a runtime value back out of reporting.service
// closes a require cycle: whichever module is entered first sees the other's
// exports still uninitialised. That is what made
// "TENDER_WINLOSS_REPORT_DEFS is not iterable" fire the moment a spec imported
// tender-winloss-report.definitions.ts directly (PR #1920).
//
// Definitions files import from HERE. reporting.service.ts re-exports these two
// names so every existing importer keeps working unchanged.

function parseFromDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseToDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function dateRangeFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const gte = parseFromDate(from);
  const lte = parseToDate(to);
  if (!gte && !lte) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (gte) filter.gte = gte;
  if (lte) filter.lte = lte;
  return filter;
}

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}
