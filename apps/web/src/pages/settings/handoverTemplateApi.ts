/**
 * Typed client wrapping the B-HW-2 handover-templates API endpoints.
 * All routes require the `handovertemplate.manage` permission — the caller
 * must supply an `authFetch` function from `useAuth()`.
 */
import { throwIfApiError } from "../../lib/api-errors";

// ─── Response shapes ─────────────────────────────────────────────────────────

export type FieldType = "text" | "money" | "date" | "list" | "attachment" | "contact";
export type SourceType = "auto" | "capture" | "attach" | "derived";

export type HtField = {
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

export type HtSection = {
  id: string;
  templateId: string;
  key: string;
  label: string;
  sortOrder: number;
  fields: HtField[];
};

export type HtTemplate = {
  id: string;
  version: number;
  isActive: boolean;
  publishedAt: string | null;
  publishedById: string | null;
  sections: HtSection[];
};

// ─── DTOs ────────────────────────────────────────────────────────────────────

export type AddSectionDto = { label: string; sortOrder?: number };
export type UpdateSectionDto = { label?: string; sortOrder?: number };

export type AddFieldDto = {
  label: string;
  type: FieldType;
  sourceType: SourceType;
  autoBinding?: string;
  listId?: string;
  required?: boolean;
  sortOrder?: number;
};

export type UpdateFieldDto = {
  label?: string;
  sortOrder?: number;
  required?: boolean;
  autoBinding?: string | null;
  listId?: string | null;
};

// ─── AuthFetch type (matches useAuth's return) ───────────────────────────────

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

// ─── Client ──────────────────────────────────────────────────────────────────

const BASE = "/handover-templates";

export async function htGetActive(authFetch: AuthFetch): Promise<HtTemplate> {
  const res = await authFetch(`${BASE}/active`);
  await throwIfApiError(res);
  return res.json() as Promise<HtTemplate>;
}

/**
 * Returns the current draft, or null if 404 (no draft exists yet).
 * All other errors are rethrown.
 */
export async function htGetDraft(authFetch: AuthFetch): Promise<HtTemplate | null> {
  const res = await authFetch(`${BASE}/draft`);
  if (res.status === 404) return null;
  await throwIfApiError(res);
  return res.json() as Promise<HtTemplate>;
}

export async function htCreateDraft(authFetch: AuthFetch): Promise<HtTemplate> {
  const res = await authFetch(`${BASE}/draft`, { method: "POST" });
  await throwIfApiError(res);
  return res.json() as Promise<HtTemplate>;
}

export async function htAddSection(
  authFetch: AuthFetch,
  dto: AddSectionDto
): Promise<HtSection> {
  const res = await authFetch(`${BASE}/draft/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  await throwIfApiError(res);
  return res.json() as Promise<HtSection>;
}

export async function htUpdateSection(
  authFetch: AuthFetch,
  sectionId: string,
  dto: UpdateSectionDto
): Promise<HtSection> {
  const res = await authFetch(`${BASE}/draft/sections/${encodeURIComponent(sectionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  await throwIfApiError(res);
  return res.json() as Promise<HtSection>;
}

export async function htDeleteSection(
  authFetch: AuthFetch,
  sectionId: string
): Promise<{ deleted: boolean; id: string }> {
  const res = await authFetch(`${BASE}/draft/sections/${encodeURIComponent(sectionId)}`, {
    method: "DELETE"
  });
  await throwIfApiError(res);
  return res.json() as Promise<{ deleted: boolean; id: string }>;
}

export async function htAddField(
  authFetch: AuthFetch,
  sectionId: string,
  dto: AddFieldDto
): Promise<HtField> {
  const res = await authFetch(
    `${BASE}/draft/sections/${encodeURIComponent(sectionId)}/fields`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto)
    }
  );
  await throwIfApiError(res);
  return res.json() as Promise<HtField>;
}

export async function htUpdateField(
  authFetch: AuthFetch,
  fieldId: string,
  dto: UpdateFieldDto
): Promise<HtField> {
  const res = await authFetch(`${BASE}/draft/fields/${encodeURIComponent(fieldId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  await throwIfApiError(res);
  return res.json() as Promise<HtField>;
}

export async function htRetireField(
  authFetch: AuthFetch,
  fieldId: string
): Promise<HtField> {
  const res = await authFetch(`${BASE}/draft/fields/${encodeURIComponent(fieldId)}`, {
    method: "DELETE"
  });
  await throwIfApiError(res);
  return res.json() as Promise<HtField>;
}

export async function htPublishDraft(authFetch: AuthFetch): Promise<HtTemplate> {
  const res = await authFetch(`${BASE}/draft/publish`, { method: "POST" });
  await throwIfApiError(res);
  return res.json() as Promise<HtTemplate>;
}
