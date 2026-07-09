/**
 * Shape helpers for the New Tender wizard's inline quick-add flow — creating a
 * builder (Client) or a contact from within the wizard without leaving it.
 *
 * The DOM side of the wizard is smoke-tested; the request/response shape lives
 * here so it can be unit-tested without jsdom (matches the reset-password /
 * newTenderWizard.helpers pattern).
 */

export type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Route the "Add full details" escape hatch opens for builders. */
export const QUICK_ADD_CLIENT_FULL_DETAILS_URL = "/tenders/clients";

/** Route the "Add full details" escape hatch opens for contacts. */
export const QUICK_ADD_CONTACT_FULL_DETAILS_URL = "/directory/contacts";

/** Payload accepted by the quick-add builder modal — mirrors `UpsertClientDto` (min fields). */
export type QuickAddClientInput = {
  name: string;
  abn?: string;
  email?: string;
};

/** Payload accepted by the quick-add contact modal — mirrors `UpsertContactDto` (min fields). */
export type QuickAddContactInput = {
  clientId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
};

/** Just what the wizard needs to attach the new builder to the tender + select it. */
export type QuickAddClientResult = {
  id: string;
  name: string;
};

/** Just what the wizard needs to slot the new contact into the per-builder dropdown. */
export type QuickAddContactResult = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
};

/** Error thrown by the quick-add helpers so the modal can render a friendly message. */
export class QuickAddError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "QuickAddError";
  }
}

function trimOrUndef(v: string | undefined): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      if (typeof parsed?.message === "string") return parsed.message;
      if (Array.isArray(parsed?.message)) return parsed.message.filter((m) => typeof m === "string").join(", ");
    } catch {
      return text;
    }
    return text;
  } catch {
    return "";
  }
}

/**
 * POST /master-data/clients with the minimal fields the wizard collects.
 *
 * On 409 (duplicate Client.name — enforced by MasterDataService.ensureUniqueName)
 * throws a friendly QuickAddError so the modal can render a helpful hint rather
 * than the raw "already exists" server text.
 */
export async function quickAddClient(
  authFetch: AuthFetch,
  input: QuickAddClientInput
): Promise<QuickAddClientResult> {
  const name = input.name.trim();
  if (!name) throw new QuickAddError(400, "Name is required.");
  const body: Record<string, unknown> = { name };
  const abn = trimOrUndef(input.abn);
  if (abn) body.abn = abn;
  const email = trimOrUndef(input.email);
  if (email) body.email = email;

  const response = await authFetch("/master-data/clients", {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const raw = await readErrorMessage(response);
    if (response.status === 409) {
      throw new QuickAddError(
        409,
        `A builder named "${name}" already exists. Search for it in the picker instead.`
      );
    }
    throw new QuickAddError(response.status, raw || `Could not create builder (${response.status}).`);
  }

  const parsed = (await response.json()) as { id?: unknown; name?: unknown };
  if (typeof parsed?.id !== "string" || typeof parsed?.name !== "string") {
    throw new QuickAddError(500, "Builder created but the response was malformed. Check server logs.");
  }
  return { id: parsed.id, name: parsed.name };
}

/**
 * POST /master-data/contacts scoped to a specific client.
 *
 * `clientId` is required on create per UpsertContactDto — the caller is
 * responsible for passing the owning builder's id (contacts are polymorphic
 * on the Contact table).
 */
export async function quickAddContact(
  authFetch: AuthFetch,
  input: QuickAddContactInput
): Promise<QuickAddContactResult> {
  const clientId = input.clientId.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!clientId) throw new QuickAddError(400, "Owning builder is required.");
  if (!firstName || !lastName) throw new QuickAddError(400, "First and last name are required.");

  const body: Record<string, unknown> = { clientId, firstName, lastName };
  const email = trimOrUndef(input.email);
  if (email) body.email = email;
  const phone = trimOrUndef(input.phone);
  if (phone) body.phone = phone;
  const mobile = trimOrUndef(input.mobile);
  if (mobile) body.mobile = mobile;

  const response = await authFetch("/master-data/contacts", {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const raw = await readErrorMessage(response);
    throw new QuickAddError(response.status, raw || `Could not create contact (${response.status}).`);
  }

  const parsed = (await response.json()) as {
    id?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    fullName?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  if (typeof parsed?.id !== "string") {
    throw new QuickAddError(500, "Contact created but the response was malformed. Check server logs.");
  }
  const first = typeof parsed.firstName === "string" ? parsed.firstName : firstName;
  const last = typeof parsed.lastName === "string" ? parsed.lastName : lastName;
  const full =
    typeof parsed.fullName === "string" && parsed.fullName.trim().length > 0
      ? parsed.fullName
      : `${first} ${last}`.trim();
  return {
    id: parsed.id,
    firstName: first,
    lastName: last,
    fullName: full,
    email: typeof parsed.email === "string" ? parsed.email : null,
    phone: typeof parsed.phone === "string" ? parsed.phone : null
  };
}

/**
 * Open the master-data page in a new browser tab so the user can fill the full
 * record while the wizard stays open in the original tab. Isolated so tests can
 * assert the exact URL without needing a real window.
 */
export function openFullDetailsTab(url: string): void {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}
