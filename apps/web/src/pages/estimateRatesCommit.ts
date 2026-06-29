// Inline rate-edit save helpers (PR fix/estimate-rates-save-race).
//
// Two concerns extracted from `EstimateRatesAdminPage.tsx` so the race fix is
// testable without jsdom:
//
//  1. `buildPatchBody` — detect whether anything changed, and emit a body
//     containing every column value from the committed snapshot. The rate
//     library DTOs (UpsertLabourRateDto et al.) mark every column required,
//     so a dirty-only body fails server validation and nothing persists; the
//     fix-forward sends the full committed snapshot, and the protection
//     against stale-sibling overwrites is provided by reading the input
//     values from the DOM at commit time (see EstimateRatesAdminPage).
//
//  2. `createSaveSerializer` — serialize commits per row. If a second commit
//     fires while the first is in flight (Enter pressed twice, blur-then-Enter,
//     rapid cell-to-cell save races), it is coalesced: only the latest queued
//     run executes, and each enqueue captures its own committed snapshot
//     before queueing — so the last edit of any given cell wins and stale
//     closures cannot overtake a newer write.

export type RowSnapshot = Record<string, unknown>;

export type PatchPlan = {
  dirtyKeys: string[];
  body: Record<string, unknown>;
};

export function buildPatchBody(
  draft: Record<string, string>,
  row: RowSnapshot,
  columnKeys: readonly string[]
): PatchPlan {
  const dirtyKeys: string[] = [];
  const body: Record<string, unknown> = {};
  for (const key of columnKeys) {
    const draftValue = draft[key] ?? "";
    const rowValue = String(row[key] ?? "");
    body[key] = draftValue;
    if (draftValue !== rowValue) dirtyKeys.push(key);
  }
  if (dirtyKeys.length === 0) return { dirtyKeys, body: {} };
  body.isActive = true;
  return { dirtyKeys, body };
}

export type Serializer = {
  enqueue: (run: () => Promise<void>) => Promise<void>;
  isRunning: () => boolean;
};

// Single-slot coalescing queue. While a task runs, at most one follow-up may
// wait; further enqueues replace the queued slot so only the freshest snapshot
// (read inside `run()`) is committed. All concurrent callers await the same
// in-flight promise.
export function createSaveSerializer(): Serializer {
  let running = false;
  let chain: Promise<void> = Promise.resolve();
  let queued: (() => Promise<void>) | null = null;

  const enqueue = (run: () => Promise<void>): Promise<void> => {
    if (running) {
      queued = run;
      return chain;
    }
    running = true;
    chain = (async () => {
      try {
        await run();
        while (queued) {
          const next = queued;
          queued = null;
          await next();
        }
      } finally {
        running = false;
      }
    })();
    return chain;
  };

  return { enqueue, isRunning: () => running };
}
