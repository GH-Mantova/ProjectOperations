import { expect, type APIRequestContext } from "@playwright/test";
import { ADMIN, FIELD_WORKER } from "./helpers";

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

/**
 * Token for the seeded field worker (Sean Lattin / wp-user-admin). The /field
 * timesheet + pre-start endpoints resolve the worker profile from the CALLER,
 * so worker-side fixtures must authenticate as Sean, not ADMIN.
 */
export async function fieldWorkerToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: FIELD_WORKER.email, password: FIELD_WORKER.password }
  });
  expect(res.ok(), `POST /auth/login (field worker) → ${res.status()}`).toBeTruthy();
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

/* ────────────────────────────────────────────────────────────────────────────
 * Batch 6 — delivery fixtures. No projects or contracts exist in seed data
 * (projects are only born by converting a tender), so batch 6 creates its own
 * tender → project fixtures through the same REST API the UI calls and tears
 * them down with the revert-to-tender cascade (which also deletes any
 * contract/allocations via Prisma cascade) followed by a tender hard-delete.
 * ──────────────────────────────────────────────────────────────────────────── */

export const B6_PREFIX = "E2E-B6";

export type B6Fixture = {
  tenderId: string;
  tenderNumber: string;
  projectId: string | null;
  projectNumber: string | null;
};

/** Creates a tender (with an awarded client-001 link) at the given status. */
export async function createFixtureTender(
  request: APIRequestContext,
  token: string,
  status: "AWARDED" | "CONTRACT_ISSUED",
  slug: string
): Promise<{ tenderId: string; tenderNumber: string }> {
  const tenderNumber = `${B6_PREFIX}-${slug}-${Date.now()}`;
  const created = await apiFetch<{ id: string }>(request, token, "POST", "/tenders", {
    tenderNumber,
    title: `${B6_PREFIX} fixture — ${slug}`,
    status,
    tenderClients: [{ clientId: "client-001", isAwarded: true }]
  });
  return { tenderId: created.id, tenderNumber };
}

/** Creates an AWARDED fixture tender and converts it into a project. */
export async function createFixtureProject(
  request: APIRequestContext,
  token: string,
  slug: string
): Promise<B6Fixture> {
  const { tenderId, tenderNumber } = await createFixtureTender(request, token, "AWARDED", slug);
  const project = await apiFetch<{ id: string; projectNumber: string }>(
    request,
    token,
    "POST",
    `/tenders/${tenderId}/convert`
  );
  return { tenderId, tenderNumber, projectId: project.id, projectNumber: project.projectNumber };
}

/**
 * Best-effort teardown: revert the project (cascade-deletes scope, gantt
 * tasks, allocations, and contract; resets the tender), then hard-delete the
 * tender. Tolerates a project that was already reverted by the test itself.
 */
export async function destroyFixture(
  request: APIRequestContext,
  token: string,
  fixture: { tenderId: string; projectId?: string | null }
): Promise<void> {
  if (fixture.projectId) {
    await apiDeleteQuiet(request, token, `/projects/${fixture.projectId}/revert-to-tender`);
  }
  await apiDeleteQuiet(request, token, `/tenders/${fixture.tenderId}`);
}

/**
 * Clears B6 fixtures orphaned by a previous CRASHED run (normal runs clean up
 * in finally blocks). Reverts any leftover fixture projects first so their
 * tenders can be hard-deleted.
 */
export async function purgeB6Fixtures(
  request: APIRequestContext,
  token: string
): Promise<void> {
  const projects = await apiFetch<{ items: Array<{ id: string; name: string }> }>(
    request,
    token,
    "GET",
    `/projects?limit=100&search=${encodeURIComponent(B6_PREFIX)}`
  );
  for (const project of projects.items) {
    if (project.name.startsWith(B6_PREFIX)) {
      await apiDeleteQuiet(request, token, `/projects/${project.id}/revert-to-tender`);
    }
  }
  const tenders = await apiFetch<{ items: Array<{ id: string; tenderNumber: string }> }>(
    request,
    token,
    "GET",
    "/tenders?page=1&pageSize=100"
  );
  for (const tender of tenders.items) {
    if (tender.tenderNumber.startsWith(B6_PREFIX)) {
      await apiDeleteQuiet(request, token, `/tenders/${tender.id}`);
    }
  }
}

/** Resolves a seeded tender's id from its tender number. */
export async function findTenderId(
  request: APIRequestContext,
  token: string,
  tenderNumber: string
): Promise<string> {
  const body = await apiFetch<{ items: Array<{ id: string; tenderNumber: string }> }>(
    request,
    token,
    "GET",
    "/tenders?page=1&pageSize=100"
  );
  const match = body.items.find((t) => t.tenderNumber === tenderNumber);
  expect(match, `tender ${tenderNumber} not found in first 100 rows`).toBeTruthy();
  return match!.id;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Batch 7 — field/mobile fixtures. The seed links admin@projectops.local to
 * WorkerProfile `wp-user-admin` (Sean Lattin) but seeds no project
 * allocations, so the field surface (allocations, pre-starts, timesheets)
 * starts empty. Batch 7 creates its own tender → project fixture (B6 pattern)
 * and allocates the admin's worker profile to it. Timesheets and pre-starts
 * cascade-delete with the project on revert, so teardown is the same
 * revert + tender hard-delete used by batch 6.
 * ──────────────────────────────────────────────────────────────────────────── */

export const B7_PREFIX = "E2E-B7";

/** Seeded worker profile linked to the admin login (Sean Lattin). */
export const WP_ADMIN_ID = "wp-user-admin";

/** Creates an AWARDED B7 fixture tender and converts it into a project. */
export async function createB7FixtureProject(
  request: APIRequestContext,
  token: string,
  slug: string
): Promise<B6Fixture> {
  const tenderNumber = `${B7_PREFIX}-${slug}-${Date.now()}`;
  const created = await apiFetch<{ id: string }>(request, token, "POST", "/tenders", {
    tenderNumber,
    title: `${B7_PREFIX} fixture — ${slug}`,
    status: "AWARDED",
    tenderClients: [{ clientId: "client-001", isAwarded: true }]
  });
  const project = await apiFetch<{ id: string; projectNumber: string }>(
    request,
    token,
    "POST",
    `/tenders/${created.id}/convert`
  );
  return { tenderId: created.id, tenderNumber, projectId: project.id, projectNumber: project.projectNumber };
}

/** Allocates a worker to a project and returns the allocation id. */
export async function createWorkerAllocation(
  request: APIRequestContext,
  token: string,
  projectId: string,
  workerProfileId: string,
  startDate: string
): Promise<string> {
  const body = await apiFetch<{ allocation: { id: string } }>(
    request,
    token,
    "POST",
    `/projects/${projectId}/allocations`,
    { type: "WORKER", workerProfileId, startDate }
  );
  return body.allocation.id;
}

/** Creates a timesheet on an allocation and submits it (status SUBMITTED). */
export async function createSubmittedTimesheet(
  request: APIRequestContext,
  token: string,
  allocationId: string,
  date: string,
  description: string,
  hours = 8
): Promise<string> {
  const created = await apiFetch<{ id: string }>(request, token, "POST", "/field/timesheets", {
    allocationId,
    date,
    hoursWorked: hours,
    breakMinutes: 30,
    description
  });
  await apiFetch(request, token, "POST", `/field/timesheets/${created.id}/submit`);
  return created.id;
}

export async function approveTimesheet(
  request: APIRequestContext,
  token: string,
  timesheetId: string
): Promise<void> {
  await apiFetch(request, token, "POST", `/field/timesheets/${timesheetId}/approve`);
}

/** Clears B7 fixtures orphaned by a previous CRASHED run (mirrors purgeB6Fixtures). */
export async function purgeB7Fixtures(
  request: APIRequestContext,
  token: string
): Promise<void> {
  const projects = await apiFetch<{ items: Array<{ id: string; name: string }> }>(
    request,
    token,
    "GET",
    `/projects?limit=100&search=${encodeURIComponent(B7_PREFIX)}`
  );
  for (const project of projects.items) {
    if (project.name.startsWith(B7_PREFIX)) {
      await apiDeleteQuiet(request, token, `/projects/${project.id}/revert-to-tender`);
    }
  }
  const tenders = await apiFetch<{ items: Array<{ id: string; tenderNumber: string }> }>(
    request,
    token,
    "GET",
    "/tenders?page=1&pageSize=100"
  );
  for (const tender of tenders.items) {
    if (tender.tenderNumber.startsWith(B7_PREFIX)) {
      await apiDeleteQuiet(request, token, `/tenders/${tender.id}`);
    }
  }
}

/** Allocates a worker profile to a project (used to seed the overlap warning). */
export async function allocateWorkerToProject(
  request: APIRequestContext,
  token: string,
  projectId: string,
  workerProfileId: string,
  startDate: string
): Promise<void> {
  await apiFetch(request, token, "POST", `/projects/${projectId}/allocations`, {
    type: "WORKER",
    workerProfileId,
    startDate
  });
}

/** Parses the LAST dollar amount in a text blob (line totals render after rates). */
export function lastMoney(text: string | null): number {
  const all = [...(text ?? "").matchAll(/\$([\d,]+(?:\.\d+)?)/g)];
  expect(all.length, `no $ amount in "${text}"`).toBeGreaterThan(0);
  return Number(all[all.length - 1][1].replace(/,/g, ""));
}
