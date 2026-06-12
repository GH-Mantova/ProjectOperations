// Pure helpers for TenderEntriesPanel's client-filter sidebar, merged feed,
// and per-entry delete (§5A.3 / PR-63b). Extracted from the component so the
// behaviour can be exercised without jsdom — same pattern as
// tenderEntriesFilters.ts and resetUserPassword.ts.
//
// Two feeds back the Activity & communications panel:
// - TenderEntry rows via /tenders/:id/entries — no client link, soft-deleted
//   (status='cancelled') via DELETE /entries/:entryId.
// - Comm entries (TenderClarificationNote) via /tenders/:id/clarification-notes
//   — client-linkable (PR-63a), hard-deleted via DELETE with a
//   COMM_ENTRY_DELETED audit row, and server-filterable with ?clientId=.

import { matchesChip, type FilterChip, type TenderEntryType } from "./tenderEntriesFilters";

export type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export type CommNoteType = "note" | "call" | "email" | "meeting" | "response";

export type CommEntry = {
  id: string;
  tenderId: string;
  direction: string;
  noteType: string;
  text: string;
  occurredAt: string;
  clientId: string | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
};

type FeedEntryShape = {
  id: string;
  type: TenderEntryType;
  assigneeId: string | null;
  createdAt: string;
};

export type FeedItem<E extends FeedEntryShape = FeedEntryShape> =
  | { kind: "entry"; id: string; sortAt: string; entry: E }
  | { kind: "comm"; id: string; sortAt: string; comm: CommEntry };

/** Entry types that can be logged against a client as a comm entry. */
const COMM_TYPES: ReadonlySet<string> = new Set(["note", "call", "email", "meeting"]);

export function isCommType(type: string): boolean {
  return COMM_TYPES.has(type);
}

const COMM_CORRESPONDENCE: ReadonlySet<string> = new Set(["call", "email", "meeting", "response"]);

/** Chip matching for comm entries — they have no assignee or follow-up semantics. */
export function commMatchesChip(noteType: string, chip: FilterChip): boolean {
  switch (chip) {
    case "all":
      return true;
    case "notes":
      return noteType === "note";
    case "correspondence":
      return COMM_CORRESPONDENCE.has(noteType);
    default:
      return false;
  }
}

export function mergeFeed<E extends FeedEntryShape>(
  entries: readonly E[],
  comms: readonly CommEntry[]
): Array<FeedItem<E>> {
  const items: Array<FeedItem<E>> = [
    ...entries.map((entry) => ({ kind: "entry" as const, id: entry.id, sortAt: entry.createdAt, entry })),
    ...comms.map((comm) => ({ kind: "comm" as const, id: comm.id, sortAt: comm.occurredAt, comm }))
  ];
  return items.sort((a, b) => Date.parse(b.sortAt) - Date.parse(a.sortAt));
}

/**
 * Applies the sidebar client filter plus the chip filter. When a client is
 * selected only comm entries linked to that client survive — TenderEntry rows
 * have no client linkage, so they only appear under "All clients".
 */
export function visibleFeed<E extends FeedEntryShape>(
  feed: ReadonlyArray<FeedItem<E>>,
  options: { chip: FilterChip; currentUserId: string | null; selectedClientId: string | null }
): Array<FeedItem<E>> {
  return feed.filter((item) => {
    if (options.selectedClientId !== null) {
      if (item.kind !== "comm" || item.comm.clientId !== options.selectedClientId) return false;
    }
    return item.kind === "comm"
      ? commMatchesChip(item.comm.noteType, options.chip)
      : matchesChip(item.entry, options.chip, options.currentUserId);
  });
}

/** Per-client comm-entry counts for the sidebar badges. */
export function clientEntryCounts(comms: readonly CommEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const comm of comms) {
    if (!comm.clientId) continue;
    counts[comm.clientId] = (counts[comm.clientId] ?? 0) + 1;
  }
  return counts;
}

export function feedSubtitle(count: number, clientName: string | null): string {
  const noun = count === 1 ? "entry" : "entries";
  return clientName
    ? `Showing ${count} ${noun} for ${clientName}`
    : `Showing ${count} ${noun} (all clients)`;
}

export function commEntriesPath(tenderId: string, clientId?: string | null): string {
  const base = `/tenders/${encodeURIComponent(tenderId)}/clarification-notes`;
  return clientId ? `${base}?clientId=${encodeURIComponent(clientId)}` : base;
}

export function deletePathFor(tenderId: string, item: Pick<FeedItem, "kind" | "id">): string {
  const tender = encodeURIComponent(tenderId);
  return item.kind === "comm"
    ? `/tenders/${tender}/clarification-notes/${encodeURIComponent(item.id)}`
    : `/tenders/${tender}/entries/${encodeURIComponent(item.id)}`;
}

export async function performDeleteFeedItem(
  authFetch: AuthFetch,
  tenderId: string,
  item: Pick<FeedItem, "kind" | "id">
): Promise<void> {
  const response = await authFetch(deletePathFor(tenderId, item), { method: "DELETE" });
  if (!response.ok) {
    throw new Error((await response.text()) || `Delete failed (${response.status}).`);
  }
}

/**
 * Body for logging a client-linked interaction via POST /clarification-notes.
 * Comm entries have a single text field, so an optional subject is folded in.
 */
export function buildCommCreateBody(input: {
  type: string;
  subject: string;
  body: string;
  clientId: string;
}): { direction: "sent"; noteType: string; text: string; clientId: string } {
  const subject = input.subject.trim();
  const body = input.body.trim();
  return {
    direction: "sent",
    noteType: input.type,
    text: subject ? `${subject} — ${body}` : body,
    clientId: input.clientId
  };
}
