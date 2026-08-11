/**
 * AR-1 — shared archive/unarchive helpers for the Directory.
 *
 * Design: archive is the everyday, non-destructive action available to all
 * manage-rights users. Delete is a separate super-admin decommission program
 * (later). No new status values or API routes are added here; these helpers
 * reuse the existing status-update endpoints the edit modals already use.
 *
 * Clients   → PATCH /master-data/clients/:id  { status: "ARCHIVED" | "ACTIVE" }
 * Subcontractors → PATCH /directory/:id        { isActive: false | true }
 */

/** The canonical archived status value for the Client status enum. */
export const ARCHIVED_STATUS = "ARCHIVED" as const;

/** The canonical active status value for the Client status enum. */
export const ACTIVE_STATUS = "ACTIVE" as const;

/**
 * Returns true if the given client status string is the archived value.
 * Accepts the raw string from the API so callers never hard-code the literal.
 */
export function isArchived(status: string): boolean {
  return status === ARCHIVED_STATUS;
}

/**
 * The set of client statuses shown by default when no explicit status filter
 * is chosen. Excludes ARCHIVED so archived clients are hidden from the default
 * list but remain reachable via the "Archived" filter option.
 */
export const DEFAULT_VISIBLE_STATUSES: ReadonlySet<string> = new Set([
  "ACTIVE",
  "INACTIVE"
]);

/**
 * The default status filter string used by the Subcontractors list when no
 * explicit filter is chosen. Mirrors the existing `statusFilter` default of
 * "active" in SubcontractorsPage (which maps to `isActive = true` server-side).
 */
export const DEFAULT_SUB_STATUS_FILTER = "active" as const;

type AuthFetchFn = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

/**
 * Archive or unarchive a directory record using the existing status-update
 * endpoint for each kind. No new routes are added.
 *
 * - "client":        PATCH /master-data/clients/:id   { status: "ARCHIVED" | "ACTIVE" }
 * - "subcontractor": PATCH /directory/:id              { isActive: false | true }
 *
 * Throws if the response is not ok.
 */
export async function setArchived(
  authFetch: AuthFetchFn,
  kind: "client" | "subcontractor",
  id: string,
  archived: boolean
): Promise<void> {
  const url =
    kind === "client"
      ? `/master-data/clients/${id}`
      : `/directory/${id}`;

  const body =
    kind === "client"
      ? JSON.stringify({ status: archived ? ARCHIVED_STATUS : ACTIVE_STATUS })
      : JSON.stringify({ isActive: !archived });

  const response = await authFetch(url, { method: "PATCH", body });
  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Archive action failed.");
  }
}
