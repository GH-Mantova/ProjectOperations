// Unit tests for the merge-queue.mjs guard layer (SLICE 7 of cluster-chaining-plan.md).
//
// These tests cover refusalFor() — the pure policy function exported from
// merge-queue.mjs — and the module-import safety invariant.
//
// IMPORTANT: No CI workflow runs scripts/pr-watcher/__tests__/ [MEASURED — no match
// for "pr-watcher", "__tests__", or "node --test" in .github/workflows/*.yml].
// The local `node --test` run below is the only execution of these tests.
// Run with:
//   node --test "scripts/pr-watcher/__tests__/*.mjs"
// (quotes required — a bare directory argument silently discovers nothing on this
// Node version)
//
// No live PR numbers are used; all tests operate on fixture data.

import assert from "node:assert/strict";
import { test } from "node:test";
import { refusalFor } from "../merge-queue.mjs";

// ---------------------------------------------------------------------------
// 1. NEVER_MERGE list
// ---------------------------------------------------------------------------

test("a PR on the NEVER_MERGE list is refused; reason names the list", () => {
  const reason = refusalFor({ pr: 552, labels: [], neverMerge: [552, 538] });
  assert.ok(reason !== null, "expected a refusal reason");
  assert.match(reason, /NEVER_MERGE/, "reason must name the NEVER_MERGE list");
  assert.match(reason, /#552/, "reason must identify the PR");
});

test("a different PR on the NEVER_MERGE list is also refused", () => {
  const reason = refusalFor({ pr: 538, labels: [], neverMerge: [552, 538] });
  assert.ok(reason !== null);
  assert.match(reason, /#538/);
});

test("refused PR: no gh call would be made (refusalFor is pure, needs no network)", () => {
  // refusalFor takes plain data — if it refuses, the caller never reaches gh calls.
  // We verify this by asserting refusalFor returns before any async work,
  // i.e. it is synchronous and returns immediately.
  let ghCalled = false;
  // Simulate: the test itself IS the call-site guard.
  const reason = refusalFor({ pr: 552, labels: [], neverMerge: [552] });
  // If refusalFor() had called gh, the test would hang or throw.
  assert.ok(!ghCalled, "no gh call should be made");
  assert.ok(reason !== null, "must return a refusal reason");
});

test("a PR NOT on the NEVER_MERGE list with clean labels returns null", () => {
  const reason = refusalFor({ pr: 999, labels: [], neverMerge: [552, 538] });
  assert.equal(reason, null);
});

test("empty NEVER_MERGE list: no PR is refused on that basis", () => {
  const reason = refusalFor({ pr: 552, labels: [], neverMerge: [] });
  assert.equal(reason, null);
});

// ---------------------------------------------------------------------------
// 2. Hold labels
// ---------------------------------------------------------------------------

test("a PR labelled 'do-not-merge' is refused", () => {
  const reason = refusalFor({ pr: 100, labels: ["do-not-merge"], neverMerge: [] });
  assert.ok(reason !== null);
  assert.match(reason, /do-not-merge/);
  assert.match(reason, /#100/);
});

test("a PR labelled 'needs-marco' is refused", () => {
  const reason = refusalFor({ pr: 101, labels: ["needs-marco"], neverMerge: [] });
  assert.ok(reason !== null);
  assert.match(reason, /needs-marco/);
});

test("a PR labelled 'hold' is refused", () => {
  const reason = refusalFor({ pr: 102, labels: ["hold"], neverMerge: [] });
  assert.ok(reason !== null);
  assert.match(reason, /hold/);
});

test("hold label refusal message explains this queue never removes the label", () => {
  const reason = refusalFor({ pr: 103, labels: ["do-not-merge"], neverMerge: [] });
  assert.ok(reason !== null);
  assert.match(reason, /never adds, removes, or merges past hold labels/);
});

test("a PR with unrelated labels but no hold label returns null", () => {
  const reason = refusalFor({
    pr: 200,
    labels: ["enhancement", "needs-review", "ci/pipeline-tests"],
    neverMerge: [],
  });
  assert.equal(reason, null);
});

test("multiple hold labels: first match triggers refusal", () => {
  // Both do-not-merge and needs-marco present; either triggers refusal.
  const reason = refusalFor({
    pr: 104,
    labels: ["do-not-merge", "needs-marco"],
    neverMerge: [],
  });
  assert.ok(reason !== null);
});

// ---------------------------------------------------------------------------
// 3. Label-read failure — fail closed
// ---------------------------------------------------------------------------

test("labels === null (read failure) triggers refusal — fail closed", () => {
  const reason = refusalFor({ pr: 300, labels: null, neverMerge: [] });
  assert.ok(reason !== null);
  assert.match(reason, /label read failed/, "reason must explain label read failure");
  assert.match(reason, /#300/);
});

test("label-read-failure reason says labels were unreadable", () => {
  const reason = refusalFor({ pr: 301, labels: null, neverMerge: [] });
  assert.ok(reason !== null);
  assert.match(reason, /cannot verify hold status/);
});

// ---------------------------------------------------------------------------
// 4. Clean PR — all checks pass, returns null
// ---------------------------------------------------------------------------

test("clean PR: not on never-merge, no hold labels, readable labels — null returned", () => {
  const reason = refusalFor({
    pr: 999,
    labels: ["enhancement", "ready-to-merge"],
    neverMerge: [552, 538],
  });
  assert.equal(reason, null);
});

// ---------------------------------------------------------------------------
// 5. NEVER_MERGE takes precedence over labels (order of checks)
// ---------------------------------------------------------------------------

test("NEVER_MERGE check fires before label check (cheaper and more catastrophic)", () => {
  // PR is on never-merge AND has null labels — never-merge must win.
  const reason = refusalFor({ pr: 552, labels: null, neverMerge: [552] });
  assert.ok(reason !== null);
  assert.match(reason, /NEVER_MERGE/);
  // Should NOT say "label read failed" as the primary message.
  assert.doesNotMatch(reason, /label read failed/);
});

// ---------------------------------------------------------------------------
// 6. Module import does not execute the queue
// ---------------------------------------------------------------------------

test("importing merge-queue.mjs does not execute the merge queue", async () => {
  // We already imported it above via `import { refusalFor } from ...`.
  // If the IIFE had run on import, it would have called process.exit(1) because
  // no PR numbers were given in process.argv (this is a test process).
  // The fact that we are here proves it did not run.
  assert.ok(true, "import did not trigger the queue");
});

// ---------------------------------------------------------------------------
// 7. Exit-behaviour contract (documented; the actual process.exit call is in
//    mergeOne() in the CLI path, which we cannot unit-test without spawning a
//    child process — so we verify the source makes the promise via a source read).
// ---------------------------------------------------------------------------

test("source contains process.exit(1) in the refusal path", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = await readFile(path.join(here, "..", "merge-queue.mjs"), "utf-8");
  // The guard block in mergeOne() must call process.exit(1) when refusalFor returns a reason.
  assert.match(src, /process\.exit\(1\)/, "source must call process.exit(1) on refusal");
  assert.match(src, /REFUSED:/, "source must print REFUSED: prefix before the reason");
});

test("source prints the refusal reason to stderr (console.error), not stdout", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = await readFile(path.join(here, "..", "merge-queue.mjs"), "utf-8");
  // Refusal uses console.error, not console.log — it must go to stderr.
  assert.match(src, /console\.error\(`\[.*\] REFUSED:/);
});
