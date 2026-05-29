// PR fix/restore-save-cancel-buttons — restores the PR-252 Phase 5
// Edit ↔ Save+Cancel swap on the Quote versions row after PR #256
// inadvertently removed the Save/Cancel half of the contract.
//
// Pure helper enumerating which action buttons the latest-revision row
// renders for a given (isEditing, canManage) pair. The component reads
// this to drive its conditional render; tests pin the swap behaviour
// without needing jsdom/RTL (which the web workspace doesn't have).

export type QuoteVersionRowAction =
  | "edit"
  | "save"
  | "cancel"
  | "newRevision"
  | "pdf"
  | "send"
  | "delete";

export function quoteVersionRowActions(
  isEditing: boolean,
  canManage: boolean
): QuoteVersionRowAction[] {
  const editGroup: QuoteVersionRowAction[] = isEditing ? ["save", "cancel"] : ["edit"];
  const manageGroup: QuoteVersionRowAction[] = canManage
    ? ["newRevision", "pdf", "send", "delete"]
    : ["pdf"];
  return [...editGroup, ...manageGroup];
}
