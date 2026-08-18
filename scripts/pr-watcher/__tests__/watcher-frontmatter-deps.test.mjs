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

import { parseWatcherFrontMatter, splitRequiresOnMainValue, checkRequiresOnMain } from "../index.mjs";

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

// escalates (2026-08-17). The watcher previously had no concept of this flag and ran
// `gh pr merge --auto --squash` on every PR it opened. It now withholds auto-merge and labels
// the PR do-not-merge, which CP-26 fails on. Default MUST be false — a prompt that omits the
// key must keep the ordinary auto-merge path.
test("escalates: true is parsed", () => {
  const body = ["---", "premise: 'true'", "escalates: true", "---", "", "# body"].join("\n");
  assert.equal(parseWatcherFrontMatter(body).escalates, true);
});

test("escalates: True is parsed case-insensitively", () => {
  const body = ["---", "premise: 'true'", "escalates: True", "---", "", "# body"].join("\n");
  assert.equal(parseWatcherFrontMatter(body).escalates, true);
});

test("escalates: false stays false", () => {
  const body = ["---", "premise: 'true'", "escalates: false", "---", "", "# body"].join("\n");
  assert.equal(parseWatcherFrontMatter(body).escalates, false);
});

test("a prompt with no escalates key defaults to false", () => {
  const body = ["---", "premise: 'true'", "size: 3", "---", "", "# body"].join("\n");
  assert.equal(parseWatcherFrontMatter(body).escalates, false);
});

// ---------------------------------------------------------------------------
// requires_on_main — parser tests (pure; no git calls)
// ---------------------------------------------------------------------------

test("requires_on_main inline scalar (path-only form) is parsed", () => {
  const body = [
    "---",
    "premise: 'true'",
    "requires_on_main: scripts/pipeline/lint-prompt.mjs",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresOnMain, ["scripts/pipeline/lint-prompt.mjs"]);
});

test("requires_on_main indented list with path-only and path::needle entries", () => {
  const body = [
    "---",
    "requires_on_main:",
    "  - scripts/pipeline/lint-prompt.mjs",
    "  - scripts/pr-watcher/index.mjs :: requires_on_main",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresOnMain, [
    "scripts/pipeline/lint-prompt.mjs",
    "scripts/pr-watcher/index.mjs :: requires_on_main",
  ]);
});

test("requires_on_main is empty when key is absent", () => {
  const body = [
    "---",
    "premise: 'true'",
    "size: 3",
    "---",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresOnMain, []);
});

test("a prompt with NO dependency keys has all dep arrays empty (regression: no new deferral)", () => {
  const body = [
    "---",
    "premise: 'true'",
    "premise_means: always",
    "scope:",
    "  - apps/web/src/**",
    "done_when: pnpm build",
    "size: 3",
    "gate_allow: none",
    "---",
    "",
    "# body",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.deepEqual(deps.requiresMerged, []);
  assert.deepEqual(deps.requiresFilesOnMain, []);
  assert.deepEqual(deps.requiresOnMain, []);
  assert.equal(deps.escalates, false);
});

// ---------------------------------------------------------------------------
// splitRequiresOnMainValue — pure unit tests
// ---------------------------------------------------------------------------

test("splitRequiresOnMainValue: path-only form returns filePath and null needle", () => {
  const result = splitRequiresOnMainValue("path/to/file.mjs");
  assert.equal(result.filePath, "path/to/file.mjs");
  assert.equal(result.needle, null);
  assert.ok(!result.malformed);
});

test("splitRequiresOnMainValue: path::needle form splits on first ' :: '", () => {
  const result = splitRequiresOnMainValue("path/to/file.mjs :: some fixed string");
  assert.equal(result.filePath, "path/to/file.mjs");
  assert.equal(result.needle, "some fixed string");
  assert.ok(!result.malformed);
});

test("splitRequiresOnMainValue: needle keeps interior colons", () => {
  const result = splitRequiresOnMainValue("path/to/file.mjs :: foo :: bar");
  assert.equal(result.filePath, "path/to/file.mjs");
  // needle is everything after the FIRST ' :: '
  assert.equal(result.needle, "foo :: bar");
});

test("splitRequiresOnMainValue: needle keeps interior spaces", () => {
  const result = splitRequiresOnMainValue("path/to/file.mjs :: hello world test");
  assert.equal(result.needle, "hello world test");
});

test("splitRequiresOnMainValue: empty path → malformed", () => {
  const result = splitRequiresOnMainValue("   ");
  assert.ok(result.malformed);
});

test("splitRequiresOnMainValue: empty needle after separator → malformed", () => {
  const result = splitRequiresOnMainValue("path/to/file.mjs :: ");
  assert.ok(result.malformed);
  assert.ok(result.reason.includes("empty needle"));
});

// ---------------------------------------------------------------------------
// checkRequiresOnMain — pure MET/UNMET decision tests
// ---------------------------------------------------------------------------

test("checkRequiresOnMain: missing file → UNMET", () => {
  const result = checkRequiresOnMain("path/to/file.mjs", null);
  assert.equal(result.met, false);
  assert.ok(result.reason.includes("not on origin/main"));
});

test("checkRequiresOnMain: path-only, file present → MET", () => {
  const result = checkRequiresOnMain("path/to/file.mjs", "file contents here");
  assert.equal(result.met, true);
});

test("checkRequiresOnMain: path::needle, file present, needle absent → UNMET", () => {
  const result = checkRequiresOnMain("path/to/file.mjs :: MISSING_STRING", "file contents here without the string");
  assert.equal(result.met, false);
  assert.ok(result.reason.includes("MISSING_STRING"));
});

test("checkRequiresOnMain: path::needle, file present, needle present → MET", () => {
  const result = checkRequiresOnMain("path/to/file.mjs :: UNKNOWN_KEY", "some content\nUNKNOWN_KEY\nmore content");
  assert.equal(result.met, true);
});

test("checkRequiresOnMain: regex metacharacters matched literally (a.*b does NOT match aXXb)", () => {
  // Needle is 'a.*b' — a regex would match 'aXXb', but fixed-string must not.
  const resultNotMet = checkRequiresOnMain("path/to/file.mjs :: a.*b", "file containing aXXb");
  assert.equal(resultNotMet.met, false, "a.*b as regex would match aXXb; as fixed-string it must not");

  // A file that literally contains 'a.*b' IS met.
  const resultMet = checkRequiresOnMain("path/to/file.mjs :: a.*b", "file containing a.*b literally");
  assert.equal(resultMet.met, true, "file containing the literal string a.*b should be MET");
});

test("checkRequiresOnMain: catastrophic regex input matched literally (((((", () => {
  // A needle that would cause catastrophic backtracking if used as regex must not throw.
  const result = checkRequiresOnMain("path/to/file.mjs :: (((((", "file without parens");
  assert.equal(result.met, false);
  // Also verify it does not throw for a matching file.
  const resultMet = checkRequiresOnMain("path/to/file.mjs :: (((((", "file with ((((( inside");
  assert.equal(resultMet.met, true);
});

test("checkRequiresOnMain: malformed value (empty path) → UNMET, no throw", () => {
  const result = checkRequiresOnMain("   ", "any content");
  assert.equal(result.met, false);
  assert.ok(result.reason.includes("malformed"));
});

test("checkRequiresOnMain: malformed value (empty needle) → UNMET, no throw", () => {
  const result = checkRequiresOnMain("path/to/file.mjs :: ", "any content");
  assert.equal(result.met, false);
  assert.ok(result.reason.includes("malformed"));
});
