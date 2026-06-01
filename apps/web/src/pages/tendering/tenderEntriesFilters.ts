// Pure filter helpers for TenderEntriesPanel's chip / tab filter logic.
// Extracted from the component so behaviour can be exercised without jsdom —
// matches the existing apps/web logic-only test pattern (e.g.
// quoteVersionRowActions.ts). The panel imports `matchesChip` and the chip
// type from here; no behaviour change.

export type TenderEntryType =
  | "note"
  | "rfi"
  | "email"
  | "call"
  | "meeting"
  | "follow_up"
  | "self_reminder"
  | "task";

export type FilterChip = "all" | "notes" | "correspondence" | "followups" | "mytasks";

export const CORRESPONDENCE_TYPES: ReadonlySet<TenderEntryType> = new Set([
  "rfi",
  "email",
  "call",
  "meeting"
]);

export const FOLLOWUP_TYPES: ReadonlySet<TenderEntryType> = new Set([
  "follow_up",
  "self_reminder"
]);

export type FilterableEntry = {
  type: TenderEntryType;
  assigneeId: string | null;
};

export function matchesChip(
  entry: FilterableEntry,
  chip: FilterChip,
  currentUserId: string | null
): boolean {
  switch (chip) {
    case "all":
      return true;
    case "notes":
      return entry.type === "note";
    case "correspondence":
      return CORRESPONDENCE_TYPES.has(entry.type);
    case "followups":
      return FOLLOWUP_TYPES.has(entry.type);
    case "mytasks":
      return entry.type === "task" && !!currentUserId && entry.assigneeId === currentUserId;
    default:
      return true;
  }
}
