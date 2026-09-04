// Unit tests for classifyPolicyFiles — the tests-docs auto-merge predicate.
//
// The pattern used to be anchored at repo root (/^(tests|docs)\//), which
// classified every test-only PR in this repo as "outside" because tests live
// in nested __tests__/ folders and .test/.spec files beside their source.
// NESTED_TEST_PATHS in index.mjs accepts three forms; these tests pin them.
//
// Run with:
//   node --test scripts/pr-watcher/__tests__/classify-policy-files.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPolicyFiles } from "../index.mjs";

// ---------------------------------------------------------------------------
// Accepts: nested __tests__ paths (the exact PR #1374 case)
// ---------------------------------------------------------------------------

test("accepts scripts/pipeline/__tests__/*.test.mjs — the PR #1374 case", () => {
  const result = classifyPolicyFiles([
    "scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs",
  ]);
  assert.deepEqual(result, { ok: true });
});

test("accepts nested __tests__ under apps/web (.test.ts beside source)", () => {
  const result = classifyPolicyFiles([
    "apps/web/src/components/__tests__/ShellLayout.nav.test.ts",
  ]);
  assert.deepEqual(result, { ok: true });
});

// ---------------------------------------------------------------------------
// Accepts: top-level docs/ (unchanged behaviour)
// ---------------------------------------------------------------------------

test("accepts docs/pr-prompts/x.md — unchanged docs behaviour", () => {
  const result = classifyPolicyFiles(["docs/pr-prompts/x.md"]);
  assert.deepEqual(result, { ok: true });
});

// ---------------------------------------------------------------------------
// Refuses: ordinary source files still reach Marco
// ---------------------------------------------------------------------------

test("refuses apps/web/src/App.tsx and names the path", () => {
  const result = classifyPolicyFiles(["apps/web/src/App.tsx"]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /outside tests\/ or docs\//);
  assert.match(result.reason, /apps\/web\/src\/App\.tsx/);
});

test("refuses apps/api/src/rates/latest-rates.ts — substring 'test' must not slip through", () => {
  const result = classifyPolicyFiles(["apps/api/src/rates/latest-rates.ts"]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /outside tests\/ or docs\//);
  assert.match(result.reason, /latest-rates\.ts/);
});

// ---------------------------------------------------------------------------
// Migration guard still runs first, even alongside a nested test path
// ---------------------------------------------------------------------------

test("refuses a migration file even when a nested test path is present; reason names the migration", () => {
  const result = classifyPolicyFiles([
    "apps/api/prisma/migrations/x/migration.sql",
    "scripts/x/__tests__/a.test.mjs",
  ]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /migration file:/);
  assert.match(result.reason, /migrations\/x\/migration\.sql/);
});

// ---------------------------------------------------------------------------
// Empty diff — unchanged behaviour
// ---------------------------------------------------------------------------

test("empty diff is refused with the empty-diff reason", () => {
  const result = classifyPolicyFiles([]);
  assert.deepEqual(result, { ok: false, reason: "empty diff" });
});
