// Decides which optional fields the +Add entry modal in
// TenderEntriesPanel renders for a given entry type. Pure helpers so the
// type-conditional behaviour can be unit-tested without jsdom/RTL.

import type { TenderEntryType } from "./TenderEntriesPanel";

const TYPES_NEEDING_DUE_DATE: ReadonlySet<TenderEntryType> = new Set([
  "follow_up",
  "self_reminder",
  "task"
]);

export function requiresDueDate(type: TenderEntryType | string | null | undefined): boolean {
  if (type == null) return false;
  return TYPES_NEEDING_DUE_DATE.has(type as TenderEntryType);
}

export function requiresAssignee(type: TenderEntryType | string | null | undefined): boolean {
  return type === "task";
}
