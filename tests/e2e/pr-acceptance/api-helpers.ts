import { expect, type APIRequestContext } from "@playwright/test";
import { ADMIN } from "./helpers";

/**
 * Batch 3 — thin API fixture layer. The Scope of Works tables render many
 * unlabeled numeric inputs (no <label>/aria-label, per-cell, table-scoped),
 * which the selector conventions (getByRole/getByLabel/getByPlaceholder/
 * getByText only) cannot reach. Fixture rows are therefore created and
 * cleaned up through the same REST API the UI itself calls, while every
 * behavioural assertion stays in the browser.
 */

export const API_BASE = "http://127.0.0.1:3000/api/v1";

/** Deterministic seed IDs for the IS-T100 template tender (apps/api/prisma/seed.ts). */
export const TEMPLATE_TENDER_ID = "seed-tender-template-100";
export const TEMPLATE_CARD_DEM = `${TEMPLATE_TENDER_ID}-card-DEM`;
export const TEMPLATE_CARD_CIV = `${TEMPLATE_TENDER_ID}-card-CIV`;

export async function apiToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password }
  });
  expect(res.ok(), `POST /auth/login → ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}

export async function apiFetch<T = unknown>(
  request: APIRequestContext,
  token: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  data?: unknown
): Promise<T> {
  const res = await request.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data
  });
  expect(res.ok(), `${method} ${path} → ${res.status()}`).toBeTruthy();
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Creates a scope item inside a card, then PATCHes extra fields (the
 * per-card create DTO only accepts description + rowType). Returns the id.
 */
export async function createScopeItem(
  request: APIRequestContext,
  token: string,
  cardId: string,
  description: string,
  fields: Record<string, unknown> = {}
): Promise<string> {
  const created = await apiFetch<{ id: string }>(
    request,
    token,
    "POST",
    `/tenders/${TEMPLATE_TENDER_ID}/scope/cards/${cardId}/items`,
    { description, rowType: "demolition" }
  );
  if (Object.keys(fields).length > 0) {
    await apiFetch(
      request,
      token,
      "PATCH",
      `/tenders/${TEMPLATE_TENDER_ID}/scope/items/${created.id}`,
      fields
    );
  }
  return created.id;
}

/**
 * Deletes scope items whose description starts with `prefix` — clears
 * orphans left by a previous CRASHED run (a normal run cleans up in its
 * finally blocks). Each spec file purges only its OWN prefixes so it can
 * never delete a concurrently running spec file's live fixtures.
 */
export async function purgeScopeItemsByPrefix(
  request: APIRequestContext,
  token: string,
  ...prefixes: string[]
): Promise<void> {
  const body = await apiFetch<{ items: Array<{ id: string; description: string }> }>(
    request,
    token,
    "GET",
    `/tenders/${TEMPLATE_TENDER_ID}/scope/items`
  );
  for (const item of body.items) {
    if (prefixes.some((p) => item.description.startsWith(p))) {
      await apiDeleteQuiet(request, token, `/tenders/${TEMPLATE_TENDER_ID}/scope/items/${item.id}`);
    }
  }
}

export async function deleteScopeItem(
  request: APIRequestContext,
  token: string,
  itemId: string
): Promise<void> {
  await apiFetch(request, token, "DELETE", `/tenders/${TEMPLATE_TENDER_ID}/scope/items/${itemId}`);
}

export type WasteRow = {
  id: string;
  autoSummed: boolean;
  wasteGroup: string | null;
  wasteType: string | null;
  wasteFacility: string | null;
  unit: string | null;
  wasteTonnes: string | null;
  m3: string | null;
  ratePerTonne: string | null;
  lineTotal: string | null;
};

export async function listWasteRows(
  request: APIRequestContext,
  token: string,
  cardId: string
): Promise<WasteRow[]> {
  return apiFetch<WasteRow[]>(
    request,
    token,
    "GET",
    `/tenders/${TEMPLATE_TENDER_ID}/scope/waste?cardId=${encodeURIComponent(cardId)}`
  );
}

/** Best-effort DELETE — tolerates rows that vanish between list and delete
 * (e.g. an in-flight aggregator regeneration rebuilding AUTO rows). */
async function apiDeleteQuiet(
  request: APIRequestContext,
  token: string,
  path: string
): Promise<void> {
  await request.fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
}

/** Removes every waste row on a card so waste tests stay re-runnable after a crashed run. */
export async function purgeWasteRows(
  request: APIRequestContext,
  token: string,
  cardId: string
): Promise<void> {
  for (const row of await listWasteRows(request, token, cardId)) {
    await apiDeleteQuiet(request, token, `/tenders/${TEMPLATE_TENDER_ID}/scope/waste/${row.id}`);
  }
}

export async function createCuttingItem(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>
): Promise<string> {
  const created = await apiFetch<{ id: string }>(
    request,
    token,
    "POST",
    `/tenders/${TEMPLATE_TENDER_ID}/scope/cutting-items`,
    body
  );
  return created.id;
}

/** Removes every cutting row on a card so cutting tests stay re-runnable after a crashed run. */
export async function purgeCuttingItems(
  request: APIRequestContext,
  token: string,
  cardId: string
): Promise<void> {
  const rows = await apiFetch<Array<{ id: string }>>(
    request,
    token,
    "GET",
    `/tenders/${TEMPLATE_TENDER_ID}/scope/cutting-items?cardId=${encodeURIComponent(cardId)}`
  );
  for (const row of rows) {
    await apiDeleteQuiet(
      request,
      token,
      `/tenders/${TEMPLATE_TENDER_ID}/scope/cutting-items/${row.id}`
    );
  }
}

export async function listCuttingItems(
  request: APIRequestContext,
  token: string,
  cardId: string
): Promise<Array<{ id: string }>> {
  return apiFetch<Array<{ id: string }>>(
    request,
    token,
    "GET",
    `/tenders/${TEMPLATE_TENDER_ID}/scope/cutting-items?cardId=${encodeURIComponent(cardId)}`
  );
}

/** Parses the LAST dollar amount in a text blob (line totals render after rates). */
export function lastMoney(text: string | null): number {
  const all = [...(text ?? "").matchAll(/\$([\d,]+(?:\.\d+)?)/g)];
  expect(all.length, `no $ amount in "${text}"`).toBeGreaterThan(0);
  return Number(all[all.length - 1][1].replace(/,/g, ""));
}
