// Fix-lane tests: a prompt carrying `fixes_pr: N` jumps to the front of the
// queue; an ordinary prompt does not; and the intake linter REJECTs a fix
// prompt whose target PR has already MERGED (or CLOSED).
//
// Covers the three failure modes the lane exists to prevent:
//   1. fix-forward work stuck behind ordinary jobs (queue starvation)
//   2. an ordinary prompt accidentally treated as urgent (false lane insertion)
//   3. a fix prompt carrying a stale pointer at a PR that has already settled
//      (agent boots against a diagnosis that no longer describes reality)

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeQueueInsertIndex,
  parseWatcherFrontMatter,
  readFixesPr,
} from "../index.mjs";

import {
  checkFixesPrTargetOpen,
  lint,
  parseFrontMatter,
} from "../../pipeline/lint-prompt.mjs";

// --- watcher: fix-lane queue insertion --------------------------------------

test("fixes_pr front-matter is parsed as a positive integer", () => {
  const body = [
    "---",
    "fixes_pr: 812",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.equal(deps.fixesPr, 812);
});

test("front-matter without fixes_pr yields null", () => {
  const body = [
    "---",
    "premise: '! grep -q foo bar'",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.equal(deps.fixesPr, null);
});

test("fix prompt inserts at the front of a queue of ordinary work", () => {
  const queueMeta = [
    { name: "pr-100-a-ready.md", isFix: false, isReview: false },
    { name: "pr-101-b-ready.md", isFix: false, isReview: false },
  ];
  const idx = computeQueueInsertIndex(queueMeta, {
    isFix: true,
    isReview: false,
    name: "pr-812-fix-ready.md",
  });
  assert.equal(idx, 0, "a fix prompt must jump to index 0");
});

test("ordinary prompt does NOT jump to the front — lexicographic order behind review/fix", () => {
  const queueMeta = [
    { name: "pr-100-a-ready.md", isFix: false, isReview: false },
    { name: "pr-101-b-ready.md", isFix: false, isReview: false },
  ];
  const idx = computeQueueInsertIndex(queueMeta, {
    isFix: false,
    isReview: false,
    name: "pr-050-early-ready.md",
  });
  assert.equal(idx, 0, "lex-smaller name sorts to the front of ordinary work");

  const idxLate = computeQueueInsertIndex(queueMeta, {
    isFix: false,
    isReview: false,
    name: "pr-200-late-ready.md",
  });
  assert.equal(idxLate, 2, "lex-larger name goes to the tail");
});

test("fix prompt lands BEFORE existing review jobs (fix > review > ordinary)", () => {
  const queueMeta = [
    { name: "rev-500-ready.md", isFix: false, isReview: true },
    { name: "pr-101-b-ready.md", isFix: false, isReview: false },
  ];
  const idx = computeQueueInsertIndex(queueMeta, {
    isFix: true,
    isReview: false,
    name: "pr-812-fix-ready.md",
  });
  assert.equal(idx, 0, "a fix prompt outranks a review job");
});

test("multiple fix prompts stack in arrival order at the front", () => {
  const queueMeta = [
    { name: "pr-812-fix-a-ready.md", isFix: true, isReview: false },
    { name: "rev-500-ready.md", isFix: false, isReview: true },
    { name: "pr-101-b-ready.md", isFix: false, isReview: false },
  ];
  const idx = computeQueueInsertIndex(queueMeta, {
    isFix: true,
    isReview: false,
    name: "pr-813-fix-b-ready.md",
  });
  assert.equal(idx, 1, "second fix job stacks behind the first, still ahead of review/ordinary");
});

test("readFixesPr survives an unreadable file (fs.watch race → null, not throw)", () => {
  const stub = () => { throw new Error("ENOENT"); };
  const result = readFixesPr("/nonexistent/path", { readFileSyncImpl: stub });
  assert.equal(result, null);
});

// --- lint: fixes_pr live-check ---------------------------------------------

test("lint REJECTs fixes_pr pointing at a MERGED PR (FIX_TARGET_SETTLED)", () => {
  const res = checkFixesPrTargetOpen({
    fixesPr: 812,
    fetchState: () => "MERGED",
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, "FIX_TARGET_SETTLED");
  assert.match(res.msg, /MERGED/);
});

test("lint REJECTs fixes_pr pointing at a CLOSED PR", () => {
  const res = checkFixesPrTargetOpen({
    fixesPr: 812,
    fetchState: () => "CLOSED",
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, "FIX_TARGET_SETTLED");
});

test("lint ADMITs fixes_pr pointing at an OPEN PR", () => {
  const res = checkFixesPrTargetOpen({
    fixesPr: 812,
    fetchState: () => "OPEN",
  });
  assert.equal(res.ok, true);
});

test("lint REJECTs FIX_TARGET_UNKNOWN when state fetch throws (fail closed)", () => {
  const res = checkFixesPrTargetOpen({
    fixesPr: 812,
    fetchState: () => { throw new Error("gh not authenticated"); },
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, "FIX_TARGET_UNKNOWN");
});

test("lint is a no-op for prompts without fixes_pr", () => {
  const res = checkFixesPrTargetOpen({
    fixesPr: null,
    fetchState: () => { throw new Error("should never be called"); },
  });
  assert.equal(res.ok, true);
});

// End-to-end through the full lint() function using a fixture-on-disk with a
// stubbed fetchPrState — this proves the fixes_pr check is wired into the
// admission pipeline, not just tested in isolation.
test("lint() end-to-end: fixture with fixes_pr → MERGED rejects with FIX_TARGET_SETTLED", async () => {
  const { writeFileSync, mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const dir = mkdtempSync(join(tmpdir(), "fix-lane-test-"));
  const file = join(dir, "pr-999-fix-ready.md");
  writeFileSync(
    file,
    [
      "---",
      "premise: 'true'",
      "premise_means: 'always needed for this test'",
      "scope:",
      "  - docs/pr-prompts/PROMPT-SCHEMA.md",
      "done_when: 'test'",
      "size: 1",
      "fixes_pr: 812",
      "---",
      "",
      "# body",
    ].join("\n"),
    "utf-8",
  );
  try {
    const result = lint(file, {
      repoRoot: dir,
      fetchPrState: () => "MERGED",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "FIX_TARGET_SETTLED");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
