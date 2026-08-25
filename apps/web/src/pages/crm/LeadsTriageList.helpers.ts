// Pure helpers for LeadsTriageList — no React imports, safe to unit-test
// without a jsdom environment.

import type { Entry } from "./crm-api";

export function filterByStage(entries: Entry[], stage: Entry["stage"]): Entry[] {
  return entries.filter((e) => e.stage === stage);
}

/**
 * Returns a handler function that shows a confirm dialog before calling
 * onArchive (or any callback). Designed to be injectable — pass a mock
 * `confirm` in tests.
 *
 * `confirm` mirrors the signature from useConfirm / ConfirmContext:
 *   (options) => Promise<boolean>
 */
export type ArchiveConfirmFn = (options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
}) => Promise<boolean>;

export function makeArchiveHandler(
  id: string,
  onArchive: (id: string) => void,
  confirm: ArchiveConfirmFn
): () => Promise<void> {
  return async () => {
    const ok = await confirm({
      title: "Archive this entry?",
      message: "The entry will be hidden from the Triage list. You can restore it at any time.",
      confirmLabel: "Archive",
      variant: "danger"
    });
    if (ok) {
      onArchive(id);
    }
  };
}
