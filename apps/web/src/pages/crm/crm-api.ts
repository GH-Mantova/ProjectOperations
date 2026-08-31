// Typed fetch helpers for the unified CRM API (S3 backend surface).
// Kept intentionally narrow — only the shapes the S4 triage list & modals need.

import { readApiErrorMessage } from "../../lib/api-errors";

export type CrmStage = "open" | "not_pursued" | "archived" | "new" | "qualified" | "quoting" | "won" | "lost";

export type EntryOwner = { id: string; firstName: string; lastName: string };
export type EntryClient = { id: string; name: string };
export type EntryContact = { id: string; firstName: string; lastName: string; email: string | null };

export type Entry = {
  id: string;
  title: string;
  description: string | null;
  stage: CrmStage;
  isLead: boolean;
  probability: number;
  estimatedValue: string | null;
  source: string;
  client: EntryClient | null;
  contact: EntryContact | null;
  owner: EntryOwner | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  convertedTenderId: string | null;
  convertedTender: { id: string; tenderNumber: string; status: string } | null;
  dropReason: { id: string; label: string } | null;
  dropReasonDetail: string | null;
  createdAt: string;
};

export type DropReason = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export type CreateEntryBody = {
  title: string;
  isLead: boolean;
  source?: string;
  estimatedValue?: number;
  clientId?: string;
  contactId?: string;
  ownerId?: string;
  notes?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
};

export type UpdateEntryBody = Partial<CreateEntryBody> & { stage?: CrmStage };

// ── Account verb types (CRM-S5) ───────────────────────────────────────────────

export type AccountLifecycleStatus = "PROSPECT" | "ACTIVE" | "PAST";
export type AccountType = "CLIENT" | "PROSPECT" | "HEAD_CONTRACTOR" | "SUBCONTRACTOR" | "PARTNER" | "OTHER";
export type AccountSource = "REFERRAL" | "DIRECT" | "TENDER_PORTAL" | "COLD_OUTREACH" | "REPEAT_BUSINESS" | "OTHER";

/**
 * Body for POST /crm/accounts.
 *
 * The Account model has no standalone `name` column — the display name
 * is derived from the linked Client (or "Unnamed" when unlinked).
 * All fields are optional at the API level; the form enforces clientId
 * to ensure a meaningful name is always visible in the list.
 */
export type CreateAccountBody = {
  clientId?: string | null;
  lifecycleStatus?: AccountLifecycleStatus;
  accountType?: AccountType;
  source?: AccountSource;
  ownerId?: string | null;
  notes?: string | null;
};

/**
 * Body for PATCH /crm/accounts/:id.
 *
 * Only send changed fields — unchanged fields must be absent (not null).
 * Never send clientId unless explicitly re-linking — silently re-linking
 * is the dangerous mistake.
 *
 * NOTE: clientId is intentionally omitted from this type. Re-linking an
 * account to a different client is a destructive operation that must be
 * an explicit, separate action. Using PatchAccountBody can never
 * accidentally emit clientId.
 */
export type PatchAccountBody = {
  lifecycleStatus?: AccountLifecycleStatus;
  accountType?: AccountType;
  source?: AccountSource;
  ownerId?: string | null;
  notes?: string | null;
};

/**
 * Builds a PATCH body that contains ONLY the fields that changed.
 * Unchanged fields are absent — not null, not undefined.
 *
 * Fields omitted from this builder (e.g. clientId) can never be
 * accidentally emitted, closing the silent re-link risk.
 */
export function buildPatchAccountBody(
  current: {
    lifecycleStatus: AccountLifecycleStatus;
    accountType: AccountType;
    source: AccountSource;
    notes: string | null;
  },
  next: {
    lifecycleStatus?: AccountLifecycleStatus;
    accountType?: AccountType;
    source?: AccountSource;
    notes?: string | null;
  }
): PatchAccountBody {
  const body: PatchAccountBody = {};
  if (next.lifecycleStatus !== undefined && next.lifecycleStatus !== current.lifecycleStatus) {
    body.lifecycleStatus = next.lifecycleStatus;
  }
  if (next.accountType !== undefined && next.accountType !== current.accountType) {
    body.accountType = next.accountType;
  }
  if (next.source !== undefined && next.source !== current.source) {
    body.source = next.source;
  }
  if (next.notes !== undefined && next.notes !== current.notes) {
    body.notes = next.notes;
  }
  return body;
}

/**
 * Validates a create-account form. Returns null when valid, or an error
 * message string when invalid.
 *
 * The form requires a clientId so that the account has a meaningful name
 * in the list (the Account model has no standalone name column).
 */
export function validateCreateAccountForm(fields: { clientId?: string | null }): string | null {
  if (!fields.clientId?.trim()) {
    return "A client link is required to give the account a name.";
  }
  return null;
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  return (await res.json()) as T;
}

export async function listEntries(
  authFetch: AuthFetch,
  params: { stage?: CrmStage } = {}
): Promise<Entry[]> {
  const q = new URLSearchParams({ limit: "200" });
  if (params.stage) q.set("stage", params.stage);
  const res = await authFetch(`/crm/opportunities?${q.toString()}`);
  const data = await jsonOrThrow<{ items: Entry[] }>(res);
  return data.items;
}

export async function createEntry(authFetch: AuthFetch, dto: CreateEntryBody): Promise<Entry> {
  const res = await authFetch("/crm/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  return jsonOrThrow<Entry>(res);
}

export async function updateEntry(
  authFetch: AuthFetch,
  id: string,
  dto: UpdateEntryBody
): Promise<Entry> {
  const res = await authFetch(`/crm/entries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  return jsonOrThrow<Entry>(res);
}

export async function dontPursue(
  authFetch: AuthFetch,
  id: string,
  dto: { dropReasonId: string; detail?: string }
): Promise<Entry> {
  const res = await authFetch(`/crm/entries/${id}/dont-pursue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  return jsonOrThrow<Entry>(res);
}

// "Price it" uses the marquee generateDraftTender path (S3 preserved it unbroken).
// Works on unified entries whether flagged isLead=true or false.
export async function priceIt(
  authFetch: AuthFetch,
  id: string,
  siteId: string,
  title?: string
): Promise<{ tenderId: string; entry: Entry }> {
  const res = await authFetch(`/crm/leads/${id}/generate-draft-tender`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, title })
  });
  const entry = await jsonOrThrow<Entry>(res);
  const tenderId = entry.convertedTender?.id ?? entry.convertedTenderId ?? "";
  return { tenderId, entry };
}

export async function listDropReasons(authFetch: AuthFetch): Promise<DropReason[]> {
  const res = await authFetch("/crm/drop-reasons");
  return jsonOrThrow<DropReason[]>(res);
}

// ── Account verbs (CRM-S5) ────────────────────────────────────────────────────

/** POST /crm/accounts — create a new account. */
export async function createAccount(
  authFetch: AuthFetch,
  dto: CreateAccountBody
): Promise<{ id: string }> {
  const res = await authFetch("/crm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  return jsonOrThrow<{ id: string }>(res);
}

/** PATCH /crm/accounts/:id — update mutable account fields. */
export async function patchAccount(
  authFetch: AuthFetch,
  id: string,
  dto: PatchAccountBody
): Promise<{ id: string }> {
  const res = await authFetch(`/crm/accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  return jsonOrThrow<{ id: string }>(res);
}

/** POST /crm/accounts/:id/archive — soft-archive an account. */
export async function archiveAccount(
  authFetch: AuthFetch,
  id: string
): Promise<{ id: string }> {
  const res = await authFetch(`/crm/accounts/${id}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  return jsonOrThrow<{ id: string }>(res);
}

/** POST /crm/accounts/:id/unarchive — restore a soft-archived account. */
export async function unarchiveAccount(
  authFetch: AuthFetch,
  id: string
): Promise<{ id: string }> {
  const res = await authFetch(`/crm/accounts/${id}/unarchive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  return jsonOrThrow<{ id: string }>(res);
}

// ── Lead intake verbs (CRM-S10) ───────────────────────────────────────────────
//
// These helpers target /crm/intake/*, NOT the legacy /crm/entries or /crm/leads
// paths. The intake module owns captureChannel, captureDetail, and the
// account-auto-create semantics; the legacy paths never set those columns.

export type IntakeCaptureChannel = "email" | "phone" | "portal" | "referral" | "cold_outreach" | "other";

export type IntakeLead = {
  id: string;
  title: string;
  stage: CrmStage;
  captureChannel: IntakeCaptureChannel | null;
  captureDetail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  nextActionAt: string | null;
  nextActionNote: string | null;
  client: EntryClient | null;
  contact: EntryContact | null;
  owner: EntryOwner | null;
  account: { id: string; lifecycleStatus: string } | null;
  dropReason: { id: string; label: string } | null;
  dropReasonDetail: string | null;
};

export type ListOpenLeadsResult = {
  items: IntakeLead[];
  total: number;
  page: number;
  limit: number;
};

export type ListOpenLeadsParams = {
  page?: number;
  limit?: number;
  captureChannel?: IntakeCaptureChannel;
  accountId?: string;
  ownerId?: string;
  search?: string;
};

export type CaptureLeadBody = {
  title: string;
  clientId: string;
  captureChannel?: IntakeCaptureChannel;
  captureDetail?: string | null;
  source?: string;
  contactId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
};

export type TriageLeadBody =
  | { action: "tender"; siteId: string; tenderTitle?: string }
  | { action: "dont_pursue"; dropReasonId: string; dropReasonDetail?: string | null };

/**
 * Builds a triage body for POST /crm/intake/:id/triage.
 * The action discriminant is explicit so callers cannot accidentally emit
 * a legacy stage value.
 */
export function buildTriageBody(input: TriageLeadBody): TriageLeadBody {
  if (input.action === "tender") {
    const body: { action: "tender"; siteId: string; tenderTitle?: string } = {
      action: "tender",
      siteId: input.siteId
    };
    if (input.tenderTitle !== undefined) body.tenderTitle = input.tenderTitle;
    return body;
  }
  const body: { action: "dont_pursue"; dropReasonId: string; dropReasonDetail?: string | null } = {
    action: "dont_pursue",
    dropReasonId: input.dropReasonId
  };
  if (input.dropReasonDetail !== undefined) body.dropReasonDetail = input.dropReasonDetail;
  return body;
}

/** GET /crm/intake/open — paginated list of open leads with intake enrichment. */
export async function listOpenLeads(
  authFetch: AuthFetch,
  params: ListOpenLeadsParams = {}
): Promise<ListOpenLeadsResult> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.captureChannel) qs.set("captureChannel", params.captureChannel);
  if (params.accountId) qs.set("accountId", params.accountId);
  if (params.ownerId) qs.set("ownerId", params.ownerId);
  if (params.search) qs.set("search", params.search);
  const res = await authFetch(`/crm/intake/open?${qs.toString()}`);
  return jsonOrThrow<ListOpenLeadsResult>(res);
}

/** POST /crm/intake — capture a new lead. Returns the created lead row. */
export async function captureLead(
  authFetch: AuthFetch,
  dto: CaptureLeadBody
): Promise<IntakeLead> {
  const res = await authFetch("/crm/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
  return jsonOrThrow<IntakeLead>(res);
}

/**
 * POST /crm/intake/:id/triage — triage an open lead.
 *
 * Targets /crm/intake/:id/triage, NOT /crm/entries/:id. The intake module
 * owns triage: it sets captureChannel and accountId which the legacy path
 * does not touch.
 */
export async function triageLead(
  authFetch: AuthFetch,
  id: string,
  dto: TriageLeadBody
): Promise<IntakeLead> {
  const res = await authFetch(`/crm/intake/${id}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildTriageBody(dto))
  });
  return jsonOrThrow<IntakeLead>(res);
}
