// Inline rate-edit save helpers (PR fix/estimate-rates-save-race).
//
// Two concerns extracted from `EstimateRatesAdminPage.tsx` so the race fix is
// testable without jsdom:
//
//  1. `buildPatchBody` — PATCH only the fields the user actually changed.
//     The previous handler PATCHed the full row from a single `draft`
//     snapshot, so a stale draft for a sibling field could overwrite a
//     concurrent edit (and made the focus-stealing class of bug from LL-27
//     land in the wrong column instead of just no-op'ing).
//
//  2. `createSaveSerializer` — serialize commits per row. If a second commit
//     fires while the first is in flight (Enter pressed twice, blur-then-Enter,
//     rapid cell-to-cell save races), it is coalesced: when the runner picks
//     it up, the caller's `run` re-reads the latest snapshot via refs — so the
//     last edit of any given cell wins and stale closures cannot overtake a
//     newer write.

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
    if (draftValue !== rowValue) {
      dirtyKeys.push(key);
      body[key] = draftValue;
    }
  }
  if (dirtyKeys.length > 0) body.isActive = true;
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
