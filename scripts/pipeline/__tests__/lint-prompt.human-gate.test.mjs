/**
 * Tests for the human-gate detector, code-context normalizer, and GATE_NOT_RELEASED.
 *
 * Runs with: node --test scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs
 *
 * All functions under test (checkHumanGate, stripCodeContext) are pure exports —
 * no filesystem, no git, no platform dependency. The GATE_NOT_RELEASED tests
 * exercise the full lint() pipeline via the CLI, with git controlled via LINT_GIT_BIN.
 *
 * ci.yml:174 runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu.
 * checkHumanGate and stripCodeContext are pure, so nothing here is Windows-only.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { checkHumanGate, stripCodeContext } from "../lint-prompt.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const LINT = join(HERE, "..", "lint-prompt.mjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";

/**
 * Run the lint CLI against a synthetic file. Returns { code, stdout, stderr }.
 * Uses spawnSync so stderr is always captured regardless of exit code.
 */
function runLint(fileText, opts) {
  opts = opts || {};
  const isoDir = mkdtempSync(join(tmpdir(), "lint-hg-"));
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

/** Minimal well-formed front-matter (always-true premise, no gates). */
const GOOD_FM =
  "premise: 'true'\n" +
  "premise_means: always-true sentinel\n" +
  "scope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\n" +
  "size: 3\n" +
  "gate_allow: none";

function makePrompt(bodyLines, fm) {
  return "---\n" + (fm || GOOD_FM) + "\n---\n\n" + bodyLines + "\n";
}

// ---------------------------------------------------------------------------
// stripCodeContext — unit tests
// ---------------------------------------------------------------------------

describe("stripCodeContext", () => {
  test("removes fenced code block content", () => {
    const text = "before\n```\nDO NOT ARM\n```\nafter";
    const result = stripCodeContext(text);
    assert.ok(!result.includes("DO NOT ARM"), "DO NOT ARM should be stripped");
    assert.ok(result.includes("before"), "text before fence should remain");
    assert.ok(result.includes("after"), "text after fence should remain");
  });

  test("removes inline code span content", () => {
    const text = "Run `DO NOT ARM` command";
    const result = stripCodeContext(text);
    assert.ok(!result.includes("DO NOT ARM"), "DO NOT ARM in inline code should be stripped");
    assert.ok(result.includes("Run"), "surrounding text should remain");
  });

  test("preserves text outside code contexts", () => {
    const text = "DO NOT ARM this prompt because it needs review";
    const result = stripCodeContext(text);
    assert.ok(result.includes("DO NOT ARM"), "plain-text DO NOT ARM should be preserved");
  });

  test("removes backtick-quoted destructive filename", () => {
    const text = "See `drop-legacy-tables.sql` for the schema change";
    const result = stripCodeContext(text);
    assert.ok(!result.includes("drop-legacy-tables"), "backtick-quoted filename should be stripped");
  });
});

// ---------------------------------------------------------------------------
// checkHumanGate — unit tests
// ---------------------------------------------------------------------------

describe("checkHumanGate markers", () => {
  test("do-not-arm HTML comment causes HUMAN_GATE_PRESENT", () => {
    const body = "Some intro\n<!-- watcher: do-not-arm -->\nMore text\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "HUMAN_GATE_PRESENT");
    assert.ok(result.msg.includes("do-not-arm"), "message should mention the marker");
    assert.ok(result.msg.includes("2"), "message should include line number 2");
  });

  test("DO NOT ARM on a line causes HUMAN_GATE_PRESENT", () => {
    const body = "# Title\n\nSTATUS: DO NOT ARM YET\n\n## Details\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "HUMAN_GATE_PRESENT");
    assert.ok(result.msg.includes("DO NOT ARM"), "message should name the matched marker");
    assert.ok(result.msg.includes("3"), "message should include line number 3");
  });

  test("Arm ONLY on a line causes HUMAN_GATE_PRESENT", () => {
    const body = "# Title\n\nArm ONLY when the predecessor merges.\n\n## Details\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "HUMAN_GATE_PRESENT");
    assert.ok(result.msg.includes("Arm ONLY"), "message should name the matched marker");
    assert.ok(result.msg.includes("3"), "message should include line number 3");
  });

  test("ordinary prompt body with no marker passes (ok: true)", () => {
    const body = "# Normal prompt\n\nThis is a description of work to be done.\n\n## What to build\n\nBuild the thing.\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, true, "should pass with no marker");
  });

  test("DO NOT ARM inside a fenced code block does NOT trigger rejection", () => {
    const body =
      "# Prompt\n\n" +
      "```\n" +
      "<!-- watcher: do-not-arm -->\n" +
      "DO NOT ARM\n" +
      "Arm ONLY when ...\n" +
      "```\n\n" +
      "Normal prose here.\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, true, "markers inside fenced code block should not trigger rejection");
  });

  test("do-not-arm inside inline backticks does NOT trigger rejection", () => {
    const body = "Use the `<!-- watcher: do-not-arm -->` marker to block arming.\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, true, "marker inside inline code should not trigger rejection");
  });

  test("docs/approvals/ reference alone does NOT cause rejection", () => {
    const body = "Requires docs/approvals/siteid-backfill-approved-by-marco.md to exist.\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, true, "approvals reference alone should not reject");
  });

  test("message includes line number of matched marker", () => {
    const body = "Line 1\nLine 2\nLine 3\nDO NOT ARM\nLine 5\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, false);
    assert.ok(result.msg.includes("4"), "message should report line 4");
  });

  test("do NOT arm (mixed case) is NOT a gate (case-sensitive rule)", () => {
    // The prompt text says "The DO NOT ARM match MUST be case-sensitive."
    // "do NOT arm" in lowercase is prose instruction, not a gate.
    const body = "You must do NOT arm this accidentally.\n";
    const result = checkHumanGate(body);
    assert.strictEqual(result.ok, true, "mixed-case 'do NOT arm' should not be a gate");
  });
});

// ---------------------------------------------------------------------------
// checkHumanGate integration — full lint() pipeline
// ---------------------------------------------------------------------------

describe("checkHumanGate full lint integration", () => {
  test("prompt with do-not-arm comment rejects with exit 1", () => {
    const prompt = makePrompt(
      "# A staged prompt\n\n<!-- watcher: do-not-arm -->\n\nDo the work.\n\n" +
      "## STANDING AUTHORITY\n\n> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n"
    );
    const r = runLint(prompt);
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT)");
    assert.ok(r.stdout.includes("HUMAN_GATE_PRESENT"), "should include HUMAN_GATE_PRESENT code");
  });

  test("prompt with DO NOT ARM line rejects with exit 1", () => {
    const prompt = makePrompt(
      "# HOLD\n\nSTATUS: DO NOT ARM YET — waiting for approval.\n\n" +
      "## STANDING AUTHORITY\n\n> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n"
    );
    const r = runLint(prompt);
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT)");
    assert.ok(r.stdout.includes("HUMAN_GATE_PRESENT"), "should include HUMAN_GATE_PRESENT code");
  });

  test("prompt with Arm ONLY line rejects with exit 1", () => {
    const prompt = makePrompt(
      "# HOLD\n\nArm ONLY when slice 1 has merged to main.\n\n" +
      "## STANDING AUTHORITY\n\n> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n"
    );
    const r = runLint(prompt);
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT)");
    assert.ok(r.stdout.includes("HUMAN_GATE_PRESENT"), "should include HUMAN_GATE_PRESENT code");
  });

  test("ordinary prompt without any marker admits (exit 0)", () => {
    const prompt = makePrompt(
      "# Normal work item\n\nThis is a description.\n\n" +
      "## STANDING AUTHORITY\n\n> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n"
    );
    const r = runLint(prompt);
    assert.strictEqual(r.code, 0, "ordinary prompt should admit (exit 0)");
  });
});

// ---------------------------------------------------------------------------
// GATE_NOT_RELEASED — HOLD with absent requires_on_main needle
// ---------------------------------------------------------------------------

describe("GATE_NOT_RELEASED", () => {
  // A needle we KNOW is NOT on origin/main — deliberately obscure.
  const ABSENT_NEEDLE = "NEEDLE_DEFINITELY_NOT_ON_MAIN_HG_XYZ_9876543210_ABSENT";
  // A needle we KNOW IS on origin/main — HUMAN_GATE has been in lint-prompt.mjs since this PR.
  // Use UNKNOWN_KEY which has been there since cluster-chaining SLICE 1.
  const PRESENT_NEEDLE = "UNKNOWN_KEY";

  const holdFmWithAbsentNeedle =
    "premise: 'true'\n" +
    "premise_means: always-true sentinel\n" +
    "scope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: none\n" +
    "cluster: gate-not-released-test\n" +
    "cluster_order: 2\n" +
    "requires_on_main: scripts/pipeline/lint-prompt.mjs :: " + ABSENT_NEEDLE;

  const holdFmWithPresentNeedle =
    "premise: 'true'\n" +
    "premise_means: always-true sentinel\n" +
    "scope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: none\n" +
    "cluster: gate-released-test\n" +
    "cluster_order: 2\n" +
    "requires_on_main: scripts/pipeline/lint-prompt.mjs :: " + PRESENT_NEEDLE;

  const GOOD_BODY =
    "# Hold prompt\n\n" +
    "## STANDING AUTHORITY\n\n" +
    "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

  test("HOLD with absent requires_on_main needle does NOT return bare ADMIT — carries GATE_NOT_RELEASED", () => {
    const prompt = "---\n" + holdFmWithAbsentNeedle + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: true, name: "gate-not-released" });
    // Must NOT be a bare ADMIT (exit 0 without GATE_NOT_RELEASED/GATE_RELEASED code)
    const isBareAdmit = r.code === 0 && !r.stdout.includes("GATE_NOT_RELEASED") && !r.stdout.includes("GATE_RELEASED");
    assert.ok(!isBareAdmit, "bare ADMIT must not be returned when needle is absent; got: " + r.stdout);
    // Should carry GATE_NOT_RELEASED code (we chose REJECT)
    assert.ok(r.stdout.includes("GATE_NOT_RELEASED"), "output should include GATE_NOT_RELEASED; got: " + r.stdout);
    assert.strictEqual(r.code, 1, "should exit 1 when needle is absent");
  });

  test("HOLD whose needle IS present still admits (GATE_RELEASED)", () => {
    const prompt = "---\n" + holdFmWithPresentNeedle + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: true, name: "gate-released" });
    assert.strictEqual(r.code, 0, "HOLD with present needle should admit (exit 0)");
    assert.ok(r.stdout.includes("GATE_RELEASED"), "should emit GATE_RELEASED; got: " + r.stdout);
  });

  test("GATE_NOT_RELEASED fail-safe: git probe failure → warn-and-skip, NOT false gate absent", () => {
    const prompt = "---\n" + holdFmWithAbsentNeedle + "\n---\n\n" + GOOD_BODY;
    // Provide a non-existent git binary so readFromOriginMain() returns null → warn and skip
    const r = runLint(prompt, {
      hold: true,
      name: "gate-not-released-failsafe",
      env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-hg-1234567890" },
    });
    // Must NOT reject with GATE_NOT_RELEASED when the probe fails
    assert.ok(!r.stdout.includes("GATE_NOT_RELEASED"), "should not report GATE_NOT_RELEASED when probe fails; got: " + r.stdout);
    // Should warn to stderr
    const combined = r.stdout + r.stderr;
    assert.ok(combined.includes("WARN"), "should emit a WARN when probe fails; got: " + combined);
  });
});

// ---------------------------------------------------------------------------
// TIER-1 destructive detector with stripCodeContext (Defect 2)
// ---------------------------------------------------------------------------

describe("TIER-1 destructive check with code-context stripping", () => {
  const MIGRATION_FM =
    "premise: 'true'\n" +
    "premise_means: always-true sentinel\n" +
    "scope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: none\n" +
    "escalates: false";

  const GOOD_BODY =
    "## STANDING AUTHORITY\n\n" +
    "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

  test("destructive-sounding filename in backticks does NOT force escalates (Defect 2 fix)", () => {
    // A prompt that merely NAMES the file `drop-legacy-tables.sql` in backticks
    // should NOT trigger DESTRUCTIVE_MUST_ESCALATE. The term is a quotation, not an instruction.
    const body =
      "# Retire old rate tables\n\n" +
      "Run `drop-legacy-tables.sql` to clean up the schema.\n\n" +
      GOOD_BODY;
    const prompt = "---\n" + MIGRATION_FM + "\n---\n\n" + body;
    const r = runLint(prompt);
    assert.ok(
      !r.stdout.includes("DESTRUCTIVE_MUST_ESCALATE"),
      "backtick-quoted destructive filename should NOT trigger DESTRUCTIVE_MUST_ESCALATE; got: " + r.stdout
    );
    assert.strictEqual(r.code, 0, "should admit (exit 0)");
  });

  test("real unquoted destructive DDL statement in prose DOES force escalates", () => {
    // A literal DROP TABLE statement (not in backticks, not in a fence) IS a real instruction
    // and must still trigger DESTRUCTIVE_MUST_ESCALATE.
    // Writing it directly here in the test, NOT in a prompt body, to avoid the linter rejecting this file.
    const destructiveDDL = ["DROP", "TABLE", "legacy_rates"].join(" ");
    const body =
      "# Schema cleanup\n\n" +
      "The migration executes: " + destructiveDDL + " to remove stale data.\n\n" +
      GOOD_BODY;
    const prompt = "---\n" + MIGRATION_FM + "\n---\n\n" + body;
    const r = runLint(prompt);
    assert.ok(
      r.stdout.includes("DESTRUCTIVE_MUST_ESCALATE"),
      "un-quoted DROP TABLE should still trigger DESTRUCTIVE_MUST_ESCALATE; got: " + r.stdout
    );
    assert.strictEqual(r.code, 1, "should reject (exit 1)");
  });
});
