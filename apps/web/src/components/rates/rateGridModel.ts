/**
 * Pure logic for FilterableRateGrid — no React, no DOM. Search, filter,
 * sort, and grouping are all expressed here so vitest can exercise them
 * without mounting anything.
 */
import type { ReactNode } from "react";

export { formatKeyColumnHeader } from "../../pages/tendering/ratesTabApi";

export type RateGridColumnKind = "text" | "number" | "currency";

export type RateGridColumn = {
  key: string;
  label: string;
  labelSuffix?: ReactNode;
  kind: RateGridColumnKind;
  unit?: string | null;
  align?: "left" | "right";
  filterable?: boolean;
  sortable?: boolean;
  groupable?: boolean;
};

export type RateGridRowValue = string | number | null;

export type RateGridRow = {
  id: string;
  values: Record<string, RateGridRowValue>;
  render?: Record<string, ReactNode>;
};

export type NumberRange = { min: number | null; max: number | null };

function stringifyValue(value: RateGridRowValue): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * A row matches the query when EVERY whitespace-separated token appears in
 * at least one column's stringified value. Case-insensitive. An empty
 * query matches every row.
 */
export function matchesQuery(
  row: RateGridRow,
  columns: RateGridColumn[],
  query: string
): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = columns
    .map((c) => stringifyValue(row.values[c.key]))
    .join("  ")
    .toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

/**
 * A row passes column filters when, for every column that has a filter
 * set, the row's stringified value is in the allowed set. A column absent
 * from the map is unrestricted; a column whose set is empty matches
 * nothing (user cleared every checkbox).
 */
export function passesColumnFilters(
  row: RateGridRow,
  filters: Record<string, Set<string>>
): boolean {
  for (const key of Object.keys(filters)) {
    const allowed = filters[key];
    if (!allowed) continue;
    if (allowed.size === 0) return false;
    if (!allowed.has(stringifyValue(row.values[key]))) return false;
  }
  return true;
}

/** Inclusive numeric bounds; null on either side leaves that end open. */
export function passesNumberRange(
  row: RateGridRow,
  key: string,
  min: number | null,
  max: number | null
): boolean {
  if (min === null && max === null) return true;
  const raw = row.values[key];
  if (raw === null || raw === undefined || raw === "") return false;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return false;
  if (min !== null && n < min) return false;
  if (max !== null && n > max) return false;
  return true;
}

/** Sorted, de-duped, string-projected distinct values for a column. */
export function distinctValues(rows: RateGridRow[], key: string): string[] {
  const seen = new Set<string>();
  for (const r of rows) seen.add(stringifyValue(r.values[key]));
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * Compare two rows on a column. Numeric columns use numeric compare (with
 * NaN pushed to the end); text uses localeCompare. `dir` is 1 for asc,
 * -1 for desc.
 */
export function compareRows(
  a: RateGridRow,
  b: RateGridRow,
  column: RateGridColumn,
  dir: 1 | -1
): number {
  const av = a.values[column.key];
  const bv = b.values[column.key];
  if (column.kind === "number" || column.kind === "currency") {
    const an = av === null || av === undefined || av === "" ? Number.NaN : Number(av);
    const bn = bv === null || bv === undefined || bv === "" ? Number.NaN : Number(bv);
    const aBad = !Number.isFinite(an);
    const bBad = !Number.isFinite(bn);
    if (aBad && bBad) return 0;
    if (aBad) return 1;
    if (bBad) return -1;
    return (an - bn) * dir;
  }
  return stringifyValue(av).localeCompare(stringifyValue(bv)) * dir;
}

export type RateGridGroup = { key: string; rows: RateGridRow[] };

/**
 * Group rows by a column key. Groups are emitted in stable alphabetical
 * key order so headers don't jump around between renders. Passing null
 * returns a single synthetic group so the render path can be uniform.
 */
export function groupRows(
  rows: RateGridRow[],
  groupKey: string | null
): RateGridGroup[] {
  if (!groupKey) return [{ key: "__all__", rows }];
  const buckets = new Map<string, RateGridRow[]>();
  for (const r of rows) {
    const k = stringifyValue(r.values[groupKey]);
    const list = buckets.get(k) ?? [];
    list.push(r);
    buckets.set(k, list);
  }
  return Array.from(buckets.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((k) => ({ key: k, rows: buckets.get(k) ?? [] }));
}
