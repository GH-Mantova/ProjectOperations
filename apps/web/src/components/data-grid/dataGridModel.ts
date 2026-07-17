/**
 * Pure logic for the generic <DataGrid /> — no React, no DOM.
 * Filtering, sorting and column-state math are all here so vitest can
 * exercise them without mounting anything.
 *
 * Modeled on the same shape as FilterableRateGrid's rateGridModel, so it's
 * familiar and can absorb the rates grid later without a rewrite.
 */
import type { ReactNode } from "react";

export type DataGridColumnKind = "text" | "number" | "currency" | "date";

export type DataGridColumn<Row extends Record<string, unknown> = Record<string, unknown>> = {
  key: string;
  label: string;
  kind: DataGridColumnKind;
  align?: "left" | "right";
  editable?: boolean;
  hideable?: boolean;
  minWidth?: number;
  render?: (row: Row) => ReactNode;
};

export type DataGridSort = { key: string; dir: "asc" | "desc" } | null;

/** Personalisation state a user can save as a "view". */
export type DataGridColumnState = {
  key: string;
  visible: boolean;
  width: number | null;
};

export type DataGridViewState = {
  filters: Record<string, string>;
  columns: DataGridColumnState[];
  sort: DataGridSort;
};

export function defaultColumnState<R extends Record<string, unknown>>(
  columns: DataGridColumn<R>[]
): DataGridColumnState[] {
  return columns.map((col) => ({
    key: col.key,
    visible: true,
    width: col.minWidth ?? null
  }));
}

/**
 * Reconcile a persisted columns array (from a saved view) against the
 * component's live column definitions: preserve saved ordering, drop keys
 * that no longer exist, and append any new columns as visible-at-default.
 */
export function reconcileColumnState<R extends Record<string, unknown>>(
  columns: DataGridColumn<R>[],
  saved: DataGridColumnState[] | undefined | null
): DataGridColumnState[] {
  if (!saved || saved.length === 0) return defaultColumnState(columns);
  const defs = new Map(columns.map((c) => [c.key, c]));
  const seen = new Set<string>();
  const out: DataGridColumnState[] = [];
  for (const s of saved) {
    if (!defs.has(s.key)) continue;
    seen.add(s.key);
    out.push({
      key: s.key,
      visible: s.visible !== false,
      width: typeof s.width === "number" && Number.isFinite(s.width) ? s.width : null
    });
  }
  for (const col of columns) {
    if (seen.has(col.key)) continue;
    out.push({ key: col.key, visible: true, width: col.minWidth ?? null });
  }
  return out;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * A row matches the query when EVERY whitespace-separated token appears in
 * at least one visible column's stringified value. Case-insensitive.
 */
export function matchesQuery<R extends Record<string, unknown>>(
  row: R,
  columns: DataGridColumn<R>[],
  query: string
): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = columns
    .map((c) => stringifyValue(row[c.key]))
    .join("  ")
    .toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

/**
 * A row passes a per-column string filter when the row's stringified value
 * for that column contains the filter substring (case-insensitive). Empty
 * or missing filter values are ignored.
 */
export function passesColumnFilters<R extends Record<string, unknown>>(
  row: R,
  filters: Record<string, string>
): boolean {
  for (const key of Object.keys(filters)) {
    const needle = (filters[key] ?? "").trim().toLowerCase();
    if (needle === "") continue;
    if (!stringifyValue(row[key]).toLowerCase().includes(needle)) return false;
  }
  return true;
}

export function compareRows<R extends Record<string, unknown>>(
  a: R,
  b: R,
  column: DataGridColumn<R>,
  dir: "asc" | "desc"
): number {
  const mult = dir === "asc" ? 1 : -1;
  const av = a[column.key];
  const bv = b[column.key];
  if (column.kind === "number" || column.kind === "currency") {
    const an = av === null || av === undefined || av === "" ? Number.NaN : Number(av);
    const bn = bv === null || bv === undefined || bv === "" ? Number.NaN : Number(bv);
    const aBad = !Number.isFinite(an);
    const bBad = !Number.isFinite(bn);
    if (aBad && bBad) return 0;
    if (aBad) return 1;
    if (bBad) return -1;
    return (an - bn) * mult;
  }
  return stringifyValue(av).localeCompare(stringifyValue(bv)) * mult;
}

export function applyView<R extends Record<string, unknown>>(
  rows: R[],
  columns: DataGridColumn<R>[],
  view: DataGridViewState
): R[] {
  const out = rows
    .filter((r) => passesColumnFilters(r, view.filters));
  if (view.sort) {
    const col = columns.find((c) => c.key === view.sort!.key);
    if (col) {
      const sorted = out.slice();
      sorted.sort((a, b) => compareRows(a, b, col, view.sort!.dir));
      return sorted;
    }
  }
  return out;
}

/** Move an item within an array immutably; used for column re-ordering. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= arr.length) return arr;
  const clamped = Math.max(0, Math.min(to, arr.length - 1));
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(clamped, 0, item);
  return next;
}
