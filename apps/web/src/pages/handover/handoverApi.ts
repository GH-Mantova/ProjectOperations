/**
 * Typed client wrapping the B-HW-6 handover API endpoints.
 * Routes: POST /handovers, GET /handovers/:id, PATCH /handovers/:id/values
 *
 * All routes require JWT + `tenderconversion.manage` permission — the caller
 * must supply an `authFetch` from `useAuth()`.
 */
import { throwIfApiError } from "../../lib/api-errors";

// ─── Field / section shapes (mirrors B-HW-3 template API) ────────────────────

export type FieldType = "text" | "money" | "date" | "list" | "attachment" | "contact";
export type SourceType = "auto" | "capture" | "attach" | "derived";

export type HandoverField = {
  id: string;
  sectionId: string;
  key: string;
  label: string;
  type: FieldType;
  sourceType: SourceType;
  autoBinding: string | null;
  listId: string | null;
  required: boolean;
  sortOrder: number;
  retiredAt: string | null;
};

export type HandoverSection = {
  id: string;
  templateId: string;
  key: string;
  label: string;
  sortOrder: number;
  fields: HandoverField[];
};

export type HandoverTemplateVersion = {
  id: string;
  version: number;
  isActive: boolean;
  publishedAt: string | null;
  sections: HandoverSection[];
};

// ─── Handover value shape ─────────────────────────────────────────────────────

export type HandoverValue = {
  id: string;
  handoverId: string;
  fieldKey: string;
  value: unknown;
  sourceValue: unknown | null;
  isOverridden: boolean;
  sectionDone: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── Full handover shape ──────────────────────────────────────────────────────

export type HandoverStatus = "draft" | "finalised";

export type Handover = {
  id: string;
  contractId: string;
  tenderId: string;
  templateVersionId: string;
  status: HandoverStatus;
  completionPct: number;
  createdById: string;
  finalisedAt: string | null;
  createdAt: string;
  updatedAt: string;
  values: HandoverValue[];
  templateVersion: HandoverTemplateVersion;
};

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type CreateHandoverDto = {
  contractId: string;
  templateVersionId?: string;
};

export type PatchValueItem = {
  fieldKey: string;
  value: unknown;
  sectionDone?: boolean;
};

// ─── AuthFetch type ───────────────────────────────────────────────────────────

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

// ─── Client ──────────────────────────────────────────────────────────────────

const BASE = "/handovers";

/**
 * Create a handover for a contract.
 * Pins the currently-active HandoverTemplate version and prefills from the
 * awarded ClientQuote. Returns the created handover with all initial values.
 */
export async function hwCreate(
  authFetch: AuthFetch,
  dto: CreateHandoverDto
): Promise<Handover> {
  const res = await authFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  await throwIfApiError(res);
  return res.json() as Promise<Handover>;
}

/**
 * Get a handover by id, including all HandoverValue rows and the pinned
 * template version (sections + non-retired fields).
 */
export async function hwGet(authFetch: AuthFetch, id: string): Promise<Handover> {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}`);
  await throwIfApiError(res);
  return res.json() as Promise<Handover>;
}

/**
 * Get the handover for a specific contract, or null if none exists yet.
 * Uses GET /handovers?contractId= — falls back to null on 404.
 */
export async function hwGetByContract(
  authFetch: AuthFetch,
  contractId: string
): Promise<Handover | null> {
  const res = await authFetch(`${BASE}?contractId=${encodeURIComponent(contractId)}`);
  if (res.status === 404) return null;
  await throwIfApiError(res);
  const body = (await res.json()) as { items?: Handover[] } | Handover;
  // The endpoint may return a list or a single item — handle both.
  if ("items" in body && Array.isArray(body.items)) {
    return body.items.find((h) => h.contractId === contractId) ?? null;
  }
  return body as Handover;
}

/**
 * Upsert a batch of field values for a handover.
 * Also persists sectionDone when supplied.
 * Returns the updated handover with recomputed completionPct.
 */
export async function hwPatchValues(
  authFetch: AuthFetch,
  handoverId: string,
  values: PatchValueItem[]
): Promise<Handover> {
  const res = await authFetch(`${BASE}/${encodeURIComponent(handoverId)}/values`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });
  await throwIfApiError(res);
  return res.json() as Promise<Handover>;
}
