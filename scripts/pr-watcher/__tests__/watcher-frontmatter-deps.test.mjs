// Unit tests for parseWatcherFrontMatter — the dependency-directive parser
// that runs before every prompt is dispatched.
//
// Covers both forms:
//   - YAML front-matter keys (`requires_merged`, `requires_file_on_main`) —
//     the only form that co-exists with the intake linter, which REJECTs
//     NO_FRONT_MATTER unless `---` starts at line 1.
//   - Legacy HTML comments (`<!-- watcher: requires-... -->`) — kept working
//     for back-compat.
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseWatcherFrontMatter } from "../index.mjs";

test("front-matter requires_file_on_main indented list is parsed", () => {
  const body = [
    "---",
    "premise: '! grep -q foo bar'",
    "requires_file_on_main:",
    "  - apps/web/src/hooks/useConfirm.tsx",
    "  - packages/ui/src/index.ts",
    "---",
    "",
    "# body",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresFilesOnMain, [
    "apps/web/src/hooks/useConfirm.tsx",
    "packages/ui/src/index.ts",
  ]);
  assert.deepEqual(deps.requiresMerged, []);
});

test("front-matter requires_merged indented list is parsed as integers", () => {
  const body = [
    "---",
    "requires_merged:",
    "  - 380",
    "  - 379",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresMerged, [380, 379]);
  assert.deepEqual(deps.requiresFilesOnMain, []);
});

test("front-matter inline scalar form is parsed", () => {
  const body = [
    "---",
    "requires_file_on_main: path/to/file.ts",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresFilesOnMain, ["path/to/file.ts"]);
});

test("column-0 dash is NOT treated as a list item", () => {
  // Matches lint-prompt.mjs, which only recognises indented (`/^\s+-\s+/`) list
  // items. A column-0 dash inside a scope block would be an authoring mistake
  // and must not smuggle in a dep.
  const body = [
    "---",
    "requires_file_on_main:",
    "- apps/web/src/should-not-be-parsed.ts",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresFilesOnMain, []);
});

test("legacy HTML-comment form is still parsed (regression guard)", () => {
  const body = [
    "<!-- watcher: requires-merged: 380, 379 -->",
    "<!-- watcher: requires-file-on-main: tests/e2e/pr-acceptance/helpers.ts -->",
    "",
    "# body",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresMerged, [380, 379]);
  assert.deepEqual(deps.requiresFilesOnMain, ["tests/e2e/pr-acceptance/helpers.ts"]);
});

test("both forms present: union with no duplicates", () => {
  const body = [
    "<!-- watcher: requires-merged: 380 -->",
    "<!-- watcher: requires-file-on-main: shared/a.ts -->",
    "---",
    "requires_merged:",
    "  - 380",
    "  - 381",
    "requires_file_on_main:",
    "  - shared/a.ts",
    "  - shared/b.ts",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresMerged.slice().sort((a, b) => a - b), [380, 381]);
  assert.deepEqual(deps.requiresFilesOnMain.slice().sort(), ["shared/a.ts", "shared/b.ts"]);
});

test("front-matter with no dependency keys returns empty deps", () => {
  const body = [
    "---",
    "premise: '! grep -q foo bar'",
    "size: 3",
    "scope:",
    "  - apps/web/src/**",
    "---",
    "",
    "# body",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresMerged, []);
  assert.deepEqual(deps.requiresFilesOnMain, []);
});
