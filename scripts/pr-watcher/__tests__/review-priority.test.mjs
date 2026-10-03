// review-priority.test.mjs — REVIEW_PRIORITY_WATCHER_PRS_V1
// Tests for the priority-review tier in computeQueueInsertIndex and the
// reviewed-state file round-trip (reviewed + watcherOpened keys).

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeQueueInsertIndex,
  readReviewedStateFile,
  writeReviewedStateFile,
  loadWatcherOpenedSet,
} from "../index.mjs";

// ---------------------------------------------------------------------------
// 1. Priority review jumps AHEAD of ordinary reviews, BEHIND fixes
// ---------------------------------------------------------------------------
test("priority review inserts after fix, before ordinary reviews", () => {
  const queueMeta = [
    { name: "pr-812-fix-ready.md", isFix: true,  isReview: false, isPriorityReview: false },
    { name: "rev-100-ready.md",    isFix: false, isReview: true,  isPriorityReview: false },
    { name: "rev-200-ready.md",    isFix: false, isReview: true,  isPriorityReview: false },
  ];
  const idx = computeQueueInsertIndex(queueMeta, {
    isFix: false,
    isReview: true,
    isPriorityReview: true,
    name: "rev-999-ready.md",
  });
  assert.equal(idx, 1, "priority review must land at index 1 (after the fix, before both ordinary reviews)");
});

// ---------------------------------------------------------------------------
// 2. Two priority reviews keep arrival order
// ---------------------------------------------------------------------------
test("second priority review stacks behind the first in arrival order", () => {
  const queueMeta = [
    { name: "rev-300-ready.md", isFix: false, isReview: true, isPriorityReview: true },
  ];
  const idx = computeQueueInsertIndex(queueMeta, {
    isFix: false,
    isReview: true,
    isPriorityReview: true,
    name: "rev-400-ready.md",
  });
  assert.equal(idx, 1, "second priority review must land at index 1, behind the first");
});

// ---------------------------------------------------------------------------
// 3. Ordinary review still lands AFTER all priority reviews
// ---------------------------------------------------------------------------
test("ordinary review lands after priority reviews", () => {
  const queueMeta = [
    { name: "rev-300-ready.md", isFix: false, isReview: true, isPriorityReview: true },
    { name: "rev-400-ready.md", isFix: false, isReview: true, isPriorityReview: true },
  ];
  const idx = computeQueueInsertIndex(queueMeta, {
    isFix: false,
    isReview: true,
    isPriorityReview: false,
    name: "rev-500-ready.md",
  });
  assert.equal(idx, 2, "ordinary review must land at index 2, after both priority reviews");
});

// ---------------------------------------------------------------------------
// 4. State file round-trip: file with only `reviewed` loads; watcherOpened
//    round-trips correctly via readReviewedStateFile / writeReviewedStateFile
// ---------------------------------------------------------------------------
test("state file backward-compat: file with only reviewed key loads cleanly; watcherOpened round-trips", async () => {
  const dir = mkdtempSync(join(tmpdir(), "review-priority-test-"));
  const stateFile = join(dir, ".reviewed-prs.json");
  try {
    // Write a legacy file with ONLY the reviewed key
    writeFileSync(stateFile, JSON.stringify({ reviewed: [1, 2, 3] }, null, 2), "utf-8");

    // Read it back — must not throw
    const data = await readReviewedStateFile(stateFile);
    assert.deepEqual(data.reviewed, [1, 2, 3]);
    assert.equal(data.watcherOpened, undefined, "legacy file has no watcherOpened key");

    // Now write both keys using the pure helper
    const reviewed = new Set([1, 2, 3]);
    const watcherOpened = [100, 200, 300];
    await writeReviewedStateFile(stateFile, reviewed, watcherOpened);

    // Read back and verify both survive
    const data2 = await readReviewedStateFile(stateFile);
    assert.deepEqual(data2.reviewed, [1, 2, 3]);
    assert.deepEqual(data2.watcherOpened, [100, 200, 300]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 5. Negative control: queueMeta without isPriorityReview anywhere, incoming
//    without the field — behaviour is identical to the pre-V1 path.
//    Reuses the same fixture patterns as fix-lane.spec.mjs.
// ---------------------------------------------------------------------------
test("negative control: undefined isPriorityReview falls through to legacy behaviour (fix)", () => {
  const queueMeta = [
    { name: "pr-100-a-ready.md", isFix: false, isReview: false },
    { name: "pr-101-b-ready.md", isFix: false, isReview: false },
  ];
  // Fix job: must jump to index 0 — same as fix-lane.spec.mjs
  const idx = computeQueueInsertIndex(queueMeta, {
    isFix: true,
    isReview: false,
    name: "pr-812-fix-ready.md",
    // no isPriorityReview field
  });
  assert.equal(idx, 0, "fix job still jumps to index 0 (parity with fix-lane.spec.mjs)");
});

test("negative control: undefined isPriorityReview falls through to legacy behaviour (ordinary)", () => {
  const queueMeta = [
    { name: "pr-100-a-ready.md", isFix: false, isReview: false },
    { name: "pr-101-b-ready.md", isFix: false, isReview: false },
  ];
  // lex-smaller name sorts to index 0 of ordinary work
  const idxEarly = computeQueueInsertIndex(queueMeta, {
    isFix: false,
    isReview: false,
    name: "pr-050-early-ready.md",
  });
  assert.equal(idxEarly, 0, "lex-smaller ordinary job goes to front of ordinary tier");

  // lex-larger name sorts to tail
  const idxLate = computeQueueInsertIndex(queueMeta, {
    isFix: false,
    isReview: false,
    name: "pr-200-late-ready.md",
  });
  assert.equal(idxLate, 2, "lex-larger ordinary job goes to tail");
});
