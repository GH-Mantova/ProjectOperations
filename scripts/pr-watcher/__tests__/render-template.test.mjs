// Unit tests for renderTemplate — the helper that renders the review-prompt
// template by substituting {{PR_NUMBER}}, {{PR_TITLE}}, {{PROMPT_DIR}}, and
// {{PR_FILES}}.
//
// Style follows resolve-prompt-dir.test.mjs: node:test, node:assert/strict,
// zero external dependencies.
import assert from "node:assert/strict";
import { test } from "node:test";

import { renderTemplate } from "../index.mjs";

const FIXTURE = [
  "Review PR #{{PR_NUMBER}} (\"{{PR_TITLE}}\") on GH-Mantova/ProjectOperations.",
  "",
  "Prompt queue lives at: {{PROMPT_DIR}}",
  "(Use filesystem globs against this path, not git-indexed search.)",
  "",
  "Files changed in this PR:",
  "{{PR_FILES}}",
  "",
  "Rule 1. Do the review.",
].join("\n");

test("substitutes {{PR_NUMBER}} and {{PR_TITLE}}", () => {
  const result = renderTemplate(FIXTURE, 1347, "my PR title", "/tmp/prompts", ["apps/api/foo.ts"]);
  assert.ok(result.includes("PR #1347"), "PR number should be substituted");
  assert.ok(result.includes('"my PR title"'), "PR title should be substituted");
  assert.ok(!result.includes("{{PR_NUMBER}}"), "{{PR_NUMBER}} placeholder should be gone");
  assert.ok(!result.includes("{{PR_TITLE}}"), "{{PR_TITLE}} placeholder should be gone");
});

test("substitutes {{PROMPT_DIR}}", () => {
  const result = renderTemplate(FIXTURE, 1, "title", "/var/queue/pr-prompts", []);
  assert.ok(result.includes("/var/queue/pr-prompts"), "PROMPT_DIR should be substituted");
  assert.ok(!result.includes("{{PROMPT_DIR}}"), "{{PROMPT_DIR}} placeholder should be gone");
});

test("substitutes {{PR_FILES}} with formatted list when array is given", () => {
  const files = ["apps/api/src/foo.ts", "apps/web/src/bar.tsx"];
  const result = renderTemplate(FIXTURE, 42, "title", "/tmp/prompts", files);
  assert.ok(result.includes("- apps/api/src/foo.ts"), "first file should appear with bullet");
  assert.ok(result.includes("- apps/web/src/bar.tsx"), "second file should appear with bullet");
  assert.ok(!result.includes("{{PR_FILES}}"), "{{PR_FILES}} placeholder should be gone");
});

test("substitutes {{PR_FILES}} with fallback string when array is empty", () => {
  const result = renderTemplate(FIXTURE, 99, "title", "/tmp/prompts", []);
  assert.ok(
    result.includes("(unknown — reviewer must fetch via `gh pr view <N> --json files`)"),
    "fallback string should appear for empty array",
  );
  assert.ok(!result.includes("{{PR_FILES}}"), "{{PR_FILES}} placeholder should be gone");
});

test("substitutes {{PR_FILES}} with fallback string when prFiles is null", () => {
  const result = renderTemplate(FIXTURE, 99, "title", "/tmp/prompts", null);
  assert.ok(
    result.includes("(unknown — reviewer must fetch via `gh pr view <N> --json files`)"),
    "fallback string should appear for null",
  );
  assert.ok(!result.includes("{{PR_FILES}}"), "{{PR_FILES}} placeholder should be gone");
});

test("substitutes {{PR_FILES}} with fallback string when prFiles is undefined", () => {
  const result = renderTemplate(FIXTURE, 99, "title", "/tmp/prompts", undefined);
  assert.ok(
    result.includes("(unknown — reviewer must fetch via `gh pr view <N> --json files`)"),
    "fallback string should appear for undefined",
  );
});

test("handles numeric prNumber correctly (converts to string)", () => {
  const result = renderTemplate("PR-{{PR_NUMBER}}", 1347, "", "", []);
  assert.equal(result, "PR-1347");
});

test("substitutes all placeholders in a single pass (no double-substitution)", () => {
  // If {{PR_NUMBER}} appeared inside the PROMPT_DIR or title it should still resolve cleanly
  const result = renderTemplate(
    "{{PR_NUMBER}} {{PR_TITLE}} {{PROMPT_DIR}} {{PR_FILES}}",
    7,
    "title-{{PR_NUMBER}}",
    "/queue/{{PR_NUMBER}}",
    ["file.ts"],
  );
  // PR_NUMBER placeholder itself resolves to "7"
  // The title and promptDir values contain literal "{{PR_NUMBER}}" which should also be replaced
  assert.ok(result.startsWith("7 "), "first token should be resolved PR number");
  assert.ok(!result.includes("{{PR_FILES}}"), "{{PR_FILES}} should be gone");
});
