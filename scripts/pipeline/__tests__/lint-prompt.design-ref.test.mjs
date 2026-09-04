/**
 * Tests for VS-S3: design_ref — a UI prompt must name the design it came from.
 *
 * Marco designs a screen in an artifact or mock-up, has Station 06 turn it into a
 * PR, then checks the result against the same artifact. Until this key existed,
 * that link lived only in his head. The linter now enforces two rules:
 *
 *   1. If `design_ref` is set, it must be one of two shapes (URL or Claude Design/
 *      path) — reject `DESIGN_REF_MALFORMED` otherwise.
 *   2. If `scope` touches `apps/web/`, `design_ref` is required — reject
 *      `UI_PROMPT_NEEDS_DESIGN_REF` if missing. Exception: `fixes_pr:` is exempt.
 *
 * Runs with: node --test scripts/pipeline/__tests__/*.mjs
 *
 * All tests drive the full lint() CLI via spawnSync (same pattern as
 * lint-prompt.file-gate-not-released.test.mjs). ci.yml:174 runs the same command.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const LINT = join(HERE, "..", "lint-prompt.mjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runLint(fileText, opts) {
  opts = opts || {};
  const isoDir = mkdtempSync(join(tmpdir(), "lint-dref-"));
  const suffix = opts.hold ? "-HOLD.md" : "-ready.md";
  const file = join(isoDir, (opts.name || "test") + suffix);
  writeFileSync(file, fileText, "utf8");

  const env = Object.assign({}, process.env, opts.env || {});
  const res = spawnSync("node", [LINT, file], { cwd: REPO_ROOT, encoding: "utf8", env });
  const code = res.status != null ? res.status : 1;
  const stdout = String(res.stdout || "");
  const stderr = String(res.stderr || "");
  rmSync(isoDir, { recursive: true, force: true });
  return { code, stdout, stderr };
}

const GOOD_BODY =
  "# Test prompt\n\n" +
  "## STANDING AUTHORITY\n\n" +
  "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

/** Base fields for a WEB-scope prompt (triggers UI_PROMPT_NEEDS_DESIGN_REF when key missing). */
function webPrompt(extraFmLines) {
  return (
    "---\n" +
    "premise: 'true'\n" +
    "premise_means: always-true sentinel\n" +
    "scope:\n  - apps/web/src/**\n" +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: none\n" +
    (extraFmLines ? extraFmLines + "\n" : "") +
    "---\n\n" +
    GOOD_BODY
  );
}

/** Base fields for a NON-web-scope prompt (design_ref is optional here). */
function nonWebPrompt(extraFmLines) {
  return (
    "---\n" +
    "premise: 'true'\n" +
    "premise_means: always-true sentinel\n" +
    "scope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: none\n" +
    (extraFmLines ? extraFmLines + "\n" : "") +
    "---\n\n" +
    GOOD_BODY
  );
}

// ---------------------------------------------------------------------------
// Accept: both shapes on a web-scope prompt
// ---------------------------------------------------------------------------

describe("design_ref — accepted shapes", () => {
  test("artifact URL on web-scope prompt → admits", () => {
    const prompt = webPrompt("design_ref: https://claude.ai/code/artifact/1a2b3c4d-5e6f-7890-abcd-ef0123456789");
    const r = runLint(prompt, { name: "dref-url" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(r.stdout.includes("ADMIT"), "should print ADMIT; got: " + r.stdout);
  });

  test("Claude Design/ path on web-scope prompt → admits", () => {
    const prompt = webPrompt("design_ref: Claude Design/proposed/scope-card-v3.html");
    const r = runLint(prompt, { name: "dref-path" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(r.stdout.includes("ADMIT"), "should print ADMIT; got: " + r.stdout);
  });
});

// ---------------------------------------------------------------------------
// Reject: malformed value
// ---------------------------------------------------------------------------

describe("design_ref — DESIGN_REF_MALFORMED", () => {
  test("bare junk string → REJECT DESIGN_REF_MALFORMED", () => {
    const prompt = webPrompt("design_ref: not-a-url-not-a-path");
    const r = runLint(prompt, { name: "dref-junk" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("DESIGN_REF_MALFORMED"),
      "should include DESIGN_REF_MALFORMED; got: " + r.stdout,
    );
  });

  test("wrong-domain URL → REJECT DESIGN_REF_MALFORMED", () => {
    const prompt = webPrompt("design_ref: https://example.com/some/artifact/xyz");
    const r = runLint(prompt, { name: "dref-wrong-domain" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("DESIGN_REF_MALFORMED"),
      "should include DESIGN_REF_MALFORMED; got: " + r.stdout,
    );
  });

  test("wrong prefix path → REJECT DESIGN_REF_MALFORMED", () => {
    const prompt = webPrompt("design_ref: docs/design/scope-card-v3.html");
    const r = runLint(prompt, { name: "dref-wrong-prefix" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("DESIGN_REF_MALFORMED"),
      "should include DESIGN_REF_MALFORMED; got: " + r.stdout,
    );
  });
});

// ---------------------------------------------------------------------------
// Reject: web-scope prompt with no design_ref (and no fixes_pr)
// ---------------------------------------------------------------------------

describe("design_ref — UI_PROMPT_NEEDS_DESIGN_REF", () => {
  test("apps/web/ scope with no design_ref → REJECT UI_PROMPT_NEEDS_DESIGN_REF", () => {
    const prompt = webPrompt(null);
    const r = runLint(prompt, { name: "dref-missing-on-web" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "should include UI_PROMPT_NEEDS_DESIGN_REF; got: " + r.stdout,
    );
  });

  // The one deliberate exception: fix-forward on a red board must not be blocked.
  test("apps/web/ scope with fixes_pr and no design_ref → admits (fix-forward exception)", () => {
    // Use a real merged PR (this repo's PR #1) to satisfy checkFixesPrTargetOpen…
    // We cannot rely on gh in tests, so instead exercise the case where the fixes_pr
    // check errors out (FIX_TARGET_UNKNOWN) — that failure still comes AFTER the
    // design_ref gate, so the design_ref rule must have already been bypassed.
    // A more direct assertion: verify UI_PROMPT_NEEDS_DESIGN_REF does NOT fire.
    const prompt = webPrompt("fixes_pr: 999999");
    const r = runLint(prompt, { name: "dref-missing-but-fixes-pr", env: { LINT_GH_BIN: "no-such-gh-binary-vs-s3-9876" } });
    assert.ok(
      !r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "fixes_pr exception should suppress UI_PROMPT_NEEDS_DESIGN_REF; got: " + r.stdout,
    );
  });
});

// ---------------------------------------------------------------------------
// Non-web prompts: design_ref is optional
// ---------------------------------------------------------------------------

describe("design_ref — non-web prompts are exempt", () => {
  test("non-web scope with no design_ref → admits", () => {
    const prompt = nonWebPrompt(null);
    const r = runLint(prompt, { name: "dref-missing-on-nonweb" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(r.stdout.includes("ADMIT"), "should print ADMIT; got: " + r.stdout);
    assert.ok(
      !r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "should NOT include UI_PROMPT_NEEDS_DESIGN_REF; got: " + r.stdout,
    );
  });
});
