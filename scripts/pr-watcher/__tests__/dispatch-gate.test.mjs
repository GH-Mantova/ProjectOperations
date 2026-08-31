// Unit tests for `hasDeclaredDependencies` — the dispatch-time predicate that
// decides whether a prompt's declared gates must be evaluated before it fires.
//
// Regression: the dispatch loop used to inline this condition and it omitted
// `requiresOnMain`. Both halves of the seam (parseWatcherFrontMatter populates
// the field; unmetDependencies evaluates it) had passing tests. The join point
// did not, and a `requires_on_main`-only prompt was dispatched with no gate
// evaluated at all. See the `requires_on_main alone` case below.
import assert from "node:assert/strict";
import { test } from "node:test";

import { hasDeclaredDependencies, parseWatcherFrontMatter } from "../index.mjs";

test("no dependency keys -> false (ungated prompts still dispatch immediately)", () => {
  const deps = { requiresMerged: [], requiresFilesOnMain: [], requiresOnMain: [] };
  assert.equal(hasDeclaredDependencies(deps), false);
});

test("requires_merged alone -> true", () => {
  const deps = { requiresMerged: [1234], requiresFilesOnMain: [], requiresOnMain: [] };
  assert.equal(hasDeclaredDependencies(deps), true);
});

test("requires_file_on_main alone -> true", () => {
  const deps = { requiresMerged: [], requiresFilesOnMain: ["apps/web/src/foo.ts"], requiresOnMain: [] };
  assert.equal(hasDeclaredDependencies(deps), true);
});

test("REGRESSION: requires_on_main alone -> true (was silently ungated)", () => {
  // The bug this file exists to prevent. Prior to the fix the dispatch-site
  // condition was `requiresMerged.length > 0 || requiresFilesOnMain.length > 0`
  // and this case returned false → the gate never ran → the prompt fired.
  const deps = {
    requiresMerged: [],
    requiresFilesOnMain: [],
    requiresOnMain: ["scripts/pipeline/arm-prompt.ps1 :: ARM_INDEX_RELEASED"],
  };
  assert.equal(hasDeclaredDependencies(deps), true);
});

test("all three dependency keys together -> true", () => {
  const deps = {
    requiresMerged: [42],
    requiresFilesOnMain: ["packages/ui/src/index.ts"],
    requiresOnMain: ["scripts/foo.mjs :: SOME_KEY"],
  };
  assert.equal(hasDeclaredDependencies(deps), true);
});

test("null -> false, no throw (called on hot path; must never throw)", () => {
  assert.equal(hasDeclaredDependencies(null), false);
});

test("undefined -> false, no throw", () => {
  assert.equal(hasDeclaredDependencies(undefined), false);
});

test("partial object {} -> false, no throw", () => {
  assert.equal(hasDeclaredDependencies({}), false);
});

test("partial object with unrelated key -> false, no throw", () => {
  assert.equal(hasDeclaredDependencies({ escalates: true }), false);
});

// End-to-end through the real parser: this is the exact prompt shape that was
// silently dispatched ungated before the fix.
test("end-to-end: parseWatcherFrontMatter + hasDeclaredDependencies for requires_on_main-only prompt", () => {
  const body = [
    "---",
    "premise: 'true'",
    "requires_on_main: scripts/pipeline/arm-prompt.ps1 :: ARM_INDEX_RELEASED",
    "---",
    "",
    "# body",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresMerged, []);
  assert.deepEqual(deps.requiresFilesOnMain, []);
  assert.deepEqual(deps.requiresOnMain, ["scripts/pipeline/arm-prompt.ps1 :: ARM_INDEX_RELEASED"]);
  assert.equal(hasDeclaredDependencies(deps), true);
});

// End-to-end, ungated: a prompt with cluster metadata but no dependency key
// must still dispatch immediately (no regression that would stall the queue).
test("end-to-end: parseWatcherFrontMatter + hasDeclaredDependencies for ungated prompt returns false", () => {
  const body = [
    "---",
    "premise: 'true'",
    "cluster: pipeline-hygiene",
    "cluster_order: 1",
    "size: 2",
    "---",
    "",
    "# body",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.equal(hasDeclaredDependencies(deps), false);
});
