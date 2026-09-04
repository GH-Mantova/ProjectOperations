// Unit tests for classifyPolicyFiles — the tests-docs auto-merge policy.
// NESTED_TEST_PATHS: this repo keeps tests inside nested __tests__/ folders
// and in .test/.spec files beside their source, so those forms must classify
// as safe to auto-merge alongside the original tests/** and docs/** roots.
import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyPolicyFiles } from "../index.mjs";

// (1) The exact PR #1374 case quoted in the prompt: a nested __tests__ path.
test("allows nested __tests__ path (PR #1374 case)", () => {
  const result = classifyPolicyFiles([
    "scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs",
  ]);
  assert.deepEqual(result, { ok: true });
});

// (2) A nested __tests__ path elsewhere in the tree.
test("allows apps/web nested __tests__ path", () => {
  const result = classifyPolicyFiles([
    "apps/web/src/components/__tests__/ShellLayout.nav.test.ts",
  ]);
  assert.deepEqual(result, { ok: true });
});

// (3) Original tests/** and docs/** roots still work.
test("allows a top-level docs/ path", () => {
  const result = classifyPolicyFiles(["docs/pr-prompts/x.md"]);
  assert.deepEqual(result, { ok: true });
});

// (4) Ordinary production source still refused, path named.
test("refuses ordinary source file and names the path", () => {
  const result = classifyPolicyFiles(["apps/web/src/App.tsx"]);
  assert.deepEqual(result, { ok: false, reason: "outside tests/ or docs/: apps/web/src/App.tsx" });
});

// (5) The substring trap: a production file whose name contains "test".
test("refuses production file containing the substring 'test' in its name", () => {
  const result = classifyPolicyFiles(["apps/api/src/rates/latest-rates.ts"]);
  assert.deepEqual(result, {
    ok: false,
    reason: "outside tests/ or docs/: apps/api/src/rates/latest-rates.ts",
  });
});

// (6) Migration guard still runs first, even when the other file is a test.
test("migration guard runs before the tests/docs check", () => {
  const result = classifyPolicyFiles([
    "apps/api/prisma/migrations/x/migration.sql",
    "scripts/x/__tests__/a.test.mjs",
  ]);
  assert.deepEqual(result, {
    ok: false,
    reason: "migration file: apps/api/prisma/migrations/x/migration.sql",
  });
});

// (7) Empty diff — unchanged behaviour.
test("refuses empty diff", () => {
  const result = classifyPolicyFiles([]);
  assert.deepEqual(result, { ok: false, reason: "empty diff" });
});

// (8) File-object form (path property) — the callsite passes `{ path }` shapes.
test("accepts file objects with a path property", () => {
  const result = classifyPolicyFiles([
    { path: "scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs" },
  ]);
  assert.deepEqual(result, { ok: true });
});
