import type { TenderRateEntry, TenderRateGroup, TenderRateSet } from "./RatesTab";

export type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

// Read a JSON body safely: 204/empty responses would otherwise crash
// `res.json()` with "Unexpected end of JSON input". Callers accept a
// nullable payload, so treat empty as `null`.
async function readJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  if (!text) return null as unknown as T;
  return JSON.parse(text) as T;
}

export async function getRateSet(authFetch: AuthFetch, tenderId: string) {
  const res = await authFetch(`/tenders/${tenderId}/rate-set`);
  return readJsonOrThrow<TenderRateSet | null>(res);
}

export async function lockRateSet(
  authFetch: AuthFetch,
  tenderId: string,
  sourceLabel?: string
) {
  const body: Record<string, unknown> = {};
  if (sourceLabel && sourceLabel.trim()) body.sourceLabel = sourceLabel.trim();
  const res = await authFetch(`/tenders/${tenderId}/rate-set/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<TenderRateSet | null>(res);
}

export async function unlockRateSet(authFetch: AuthFetch, tenderId: string) {
  const res = await authFetch(`/tenders/${tenderId}/rate-set`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return (text ? JSON.parse(text) : { unlocked: false }) as { unlocked: boolean };
}

/**
 * Set an override value on a rate entry, or clear it (pass `null`).
 * The revert control is a call to this function with `null`.
 */
export async function patchRateEntry(
  authFetch: AuthFetch,
  tenderId: string,
  entryId: string,
  overrideValue: number | null
) {
  const res = await authFetch(`/tenders/${tenderId}/rate-set/entries/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrideValue })
  });
  return readJsonOrThrow<TenderRateEntry>(res);
}

/**
 * Which tab is currently selected based on the URL path. Extracted so
 * the tab-routing logic can be unit-tested without mounting the page.
 */
export function tabFromPath(pathname: string): "overview" | "scope" | "rates" | "quote" {
  if (pathname.endsWith("/scope")) return "scope";
  if (pathname.endsWith("/rates")) return "rates";
  if (pathname.endsWith("/quote")) return "quote";
  return "overview";
}

/**
 * Format a key-column header. Appends " (unit)" only when the column
 * name doesn't already contain the unit — otherwise a projected column
 * whose name is "Diameter (mm)" with unit "mm" would render as
 * "Diameter (mm) (mm)".
 */
export function formatKeyColumnHeader(name: string, unit: string | null): string {
  if (!unit) return name;
  if (name.toLowerCase().includes(unit.toLowerCase())) return name;
  return `${name} (${unit})`;
}

/**
 * Stable per-group key used by both the master rail and the detail
 * pane so selection state and render keys stay in lockstep.
 */
export function rateGroupKey(group: TenderRateGroup): string {
  return group.rateTableId ?? group.rateTableSlug ?? "other";
}

/**
 * Pick the first-group key on load, or fall back to it when the
 * previously-selected key is no longer present in the snapshot (e.g.
 * after Refresh drops a table). Returns null when there are no groups.
 */
export function selectDefaultRatesTableKey(
  groups: TenderRateGroup[],
  current: string | null
): string | null {
  if (groups.length === 0) return null;
  const keys = groups.map(rateGroupKey);
  if (current && keys.includes(current)) return current;
  return keys[0];
}

/**
 * Describe the columnar layout of a rate group so the render logic can
 * be tested without mounting the page. A group with `keyColumns` renders
 * one leading cell per key column (matching the Rates & Lists admin
 * table); groups without key columns fall back to the flat
 * `Rate | Unit` pair keyed off the legacy label.
 */
export function describeRateGroup(group: TenderRateGroup): {
  headers: string[];
  rowKeyCells: string[][];
} {
  const hasKeys = group.keyColumns.length > 0;
  const leadingHeaders = hasKeys
    ? group.keyColumns.map((c) => formatKeyColumnHeader(c.name, c.unit))
    : ["Rate", "Unit"];
  const headers = [...leadingHeaders, "Original", "Override"];
  const rowKeyCells = group.entries.map((entry) =>
    hasKeys
      ? group.keyColumns.map((_c, i) => entry.keyValues[i] || "—")
      : [entry.label, entry.unit ?? "—"]
  );
  return { headers, rowKeyCells };
}
