// Typed fetch helpers for the unified CRM API (S3 backend surface).
// Kept intentionally narrow — only the shapes the S4 triage list & modals need.

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

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
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
