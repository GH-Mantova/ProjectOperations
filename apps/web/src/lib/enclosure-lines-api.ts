/**
 * enclosure-lines-api.ts
 *
 * ASB_ENCLOSURE_LINES_UI_V1 — thin fetch wrappers for the S1 enclosure-line
 * endpoints and the enclosure rate-type list.
 *
 * Routes (from scope-enclosure.controller.ts):
 *   GET    /tenders/:tenderId/scope/items/:itemId/enclosure-lines
 *   POST   /tenders/:tenderId/scope/items/:itemId/enclosure-lines
 *   PATCH  /tenders/:tenderId/scope/items/:itemId/enclosure-lines/:lineId
 *   DELETE /tenders/:tenderId/scope/items/:itemId/enclosure-lines/:lineId
 *
 * Type list: GET /estimate-rates/enclosure — the existing endpoint the Rates
 * admin page already uses. Returns EstimateEnclosureRate rows with
 * { id, enclosureType, unit, rate, isActive, sortOrder }.
 *
 * All functions accept `authFetch` from useAuth() and throw on non-ok responses
 * with the API's error message, matching the pattern in appearance-api.ts.
 */

import { readApiErrorMessage } from "./api-errors";

// ── AuthFetch type alias ────────────────────────────────────────────────────

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

// ── Response shapes ─────────────────────────────────────────────────────────

/**
 * An entry from GET /estimate-rates/enclosure.
 * Mirrors EstimateEnclosureRate as returned by the estimates service.
 */
export type EnclosureRateType = {
  id: string;
  enclosureType: string;
  unit: string;
  rate: string;
  isActive: boolean;
  sortOrder: number;
};

/**
 * A ScopeItemEnclosureLine row as returned by the S1 endpoints.
 * All money fields (lineTotal, effectiveMarkup, lineTotalWithMarkup) are
 * computed server-side — the component must never multiply qty × rate.
 */
export type EnclosureLine = {
  id: string;
  scopeItemId: string;
  enclosureType: string;
  qty: string;
  unit: string;
  /** Snapshotted rate at time of creation. Comes back as a Decimal serialised to string. */
  rate: string;
  /** Per-line override. null = use the snapshotted rate. 0 = free line. */
  rateOverride: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Server-computed: qty × effectiveRate (before markup). */
  lineTotal: number;
  effectiveMarkup: number;
  /** Server-computed: lineTotal × (1 + effectiveMarkup / 100). */
  lineTotalWithMarkup: number;
};

// ── Enclosure type list ─────────────────────────────────────────────────────

/**
 * Fetch the full list of enclosure rate types from the existing
 * GET /estimate-rates/enclosure endpoint.
 *
 * Returns all rows; callers should filter to isActive === true for
 * the add-line picker.
 *
 * @throws Error with the API's message on non-ok response.
 */
export async function listEnclosureRateTypes(
  authFetch: AuthFetch
): Promise<EnclosureRateType[]> {
  const res = await authFetch("/estimate-rates/enclosure");
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new Error(message);
  }
  return res.json() as Promise<EnclosureRateType[]>;
}

// ── Enclosure line CRUD ─────────────────────────────────────────────────────

function itemPath(tenderId: string, itemId: string): string {
  return `/tenders/${tenderId}/scope/items/${itemId}/enclosure-lines`;
}

/**
 * List the enclosure lines on an ASB scope item.
 *
 * @throws NotFoundException (404) when the item is missing or on another tender.
 * @throws BadRequestException (400) when the item is not an ASB item.
 */
export async function listEnclosureLines(
  authFetch: AuthFetch,
  tenderId: string,
  itemId: string
): Promise<EnclosureLine[]> {
  const res = await authFetch(itemPath(tenderId, itemId));
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new Error(message);
  }
  return res.json() as Promise<EnclosureLine[]>;
}

/**
 * Create an enclosure line on an ASB scope item.
 * The server resolves unit and rate from the enclosure rate table and
 * snapshots them on the line.
 *
 * @param dto - { enclosureType, qty } — type is the string key from the
 *   rate table; qty is a number.
 */
export async function createEnclosureLine(
  authFetch: AuthFetch,
  tenderId: string,
  itemId: string,
  dto: { enclosureType: string; qty: number }
): Promise<EnclosureLine> {
  const res = await authFetch(itemPath(tenderId, itemId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new Error(message);
  }
  return res.json() as Promise<EnclosureLine>;
}

/**
 * Partially update an enclosure line.
 * - `qty`: change the quantity.
 * - `rateOverride`: set a per-line rate. null clears the override (reverts to
 *   the snapshotted rate).  0 is a real value (free line).
 *
 * Changing the enclosure type is not supported; delete and re-add instead.
 */
export async function patchEnclosureLine(
  authFetch: AuthFetch,
  tenderId: string,
  itemId: string,
  lineId: string,
  patch: { qty?: number; rateOverride?: number | null; sortOrder?: number }
): Promise<EnclosureLine> {
  const res = await authFetch(`${itemPath(tenderId, itemId)}/${lineId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new Error(message);
  }
  return res.json() as Promise<EnclosureLine>;
}

/**
 * Hard-delete an enclosure line.
 *
 * @returns `{ deleted: true }` on success.
 */
export async function deleteEnclosureLine(
  authFetch: AuthFetch,
  tenderId: string,
  itemId: string,
  lineId: string
): Promise<{ deleted: true }> {
  const res = await authFetch(`${itemPath(tenderId, itemId)}/${lineId}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new Error(message);
  }
  return res.json() as Promise<{ deleted: true }>;
}
