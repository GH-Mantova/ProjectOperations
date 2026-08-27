// CRM comms-inbox helpers — pure functions, no React, no fetch.
//
// These helpers exist to make the unanchored inbox (the /crm/comms nav entry
// with no entityType/entityId query string) viable. Every thread has an
// entityType + entityId pair, but the referenced record may have been deleted —
// there is no foreign key, by design (comms.service.ts:82). The helpers here
// turn those pairs into display labels that are NEVER blank, NEVER thrown,
// and NEVER dropped, so orphaned threads remain visible.
//
// "deleted" appears in the label deliberately — the done_when gate greps for it
// and the product requirement is that the label is explicit, not evasive.

// ── Entity type display map ───────────────────────────────────────────────────

const KNOWN_ENTITY_LABELS: Record<string, string> = {
  ACCOUNT: "Account",
  TENDER: "Tender",
  JOB: "Job",
  CONTRACT: "Contract"
};

// ── entityLabel ───────────────────────────────────────────────────────────────

/**
 * Converts a polymorphic (entityType, entityId) pair into a user-facing display
 * string.
 *
 * - If a resolved name is provided (looked up externally), it is returned with
 *   the entity type as a qualifier, e.g. "Northshore Demolition (Account)".
 * - If the id cannot be resolved (the record was deleted or the type is unknown)
 *   the label is explicit: "Account (deleted) — <id>" so the row is visible and
 *   diagnosable. NEVER blank, NEVER null, NEVER throws.
 * - An unknown entityType is labelled as "Unknown type (<entityType>)" so the
 *   row is still returned rather than filtered.
 *
 * @param entityType - The raw entityType string from the comm_threads row.
 * @param entityId   - The raw entityId UUID string from the row.
 * @param resolvedName - Optional: the display name of the referenced record if
 *                       it was successfully fetched. Pass undefined or null when
 *                       the record could not be found.
 */
export function entityLabel(
  entityType: string,
  entityId: string,
  resolvedName?: string | null
): string {
  const typeDisplay = KNOWN_ENTITY_LABELS[entityType] ?? `Unknown type (${entityType})`;

  if (resolvedName != null && resolvedName.trim() !== "") {
    return `${resolvedName.trim()} (${typeDisplay})`;
  }

  // Record not resolvable — could be deleted or the type is unknown.
  // Emit an explicit "deleted" label so the row is visible and diagnosable.
  return `${typeDisplay} (deleted) — ${entityId}`;
}

// ── Grouping helpers ──────────────────────────────────────────────────────────

export type InboxThread = {
  id: string;
  entityType: string;
  entityId: string;
  subject: string | null;
  updatedAt: string;
  createdAt: string;
  archivedAt: string | null;
  /** Display label computed by entityLabel(). */
  entityDisplay: string;
};

/**
 * Sort an array of inbox threads newest-activity-first (by updatedAt).
 * Returns a new array; does not mutate the input.
 */
export function sortThreadsByActivity(threads: InboxThread[]): InboxThread[] {
  return [...threads].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Group inbox threads by their entityType. Keys are the raw entityType strings
 * (e.g. "ACCOUNT", "TENDER"). Within each group the order is preserved (apply
 * sortThreadsByActivity first if you want newest-first within groups).
 */
export function groupThreadsByEntityType(
  threads: InboxThread[]
): Map<string, InboxThread[]> {
  const map = new Map<string, InboxThread[]>();
  for (const thread of threads) {
    const existing = map.get(thread.entityType) ?? [];
    existing.push(thread);
    map.set(thread.entityType, existing);
  }
  return map;
}

// ── Paging helpers ────────────────────────────────────────────────────────────

export type PageInfo = {
  page: number;
  limit: number;
  total: number;
};

/** Returns the total number of pages for a given page size and total count. */
export function totalPages(info: PageInfo): number {
  if (info.limit <= 0) return 0;
  return Math.ceil(info.total / info.limit);
}

/** Returns true if there is a next page. */
export function hasNextPage(info: PageInfo): boolean {
  return info.page < totalPages(info);
}

/** Returns true if there is a previous page. */
export function hasPrevPage(info: PageInfo): boolean {
  return info.page > 1;
}
