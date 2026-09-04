/**
 * Tests for Pipeline Guard 3: FILE_GATE_NOT_RELEASED.
 *
 * Covers the two defect cases fixed in this PR:
 *   1. HOLD with requires_file_on_main pointing at an ABSENT path was previously
 *      admitted as a bare ADMIT (indistinguishable from a satisfied gate).
 *   2. HOLD with needle-less requires_on_main pointing at an ABSENT path was
 *      silently skipped by checkGateNotReleased (only content gates were checked).
 *
 * Runs with: node --test scripts/pipeline/__tests__/*.mjs
 *
 * All tests drive the full lint() CLI via spawnSync (same pattern as
 * lint-prompt.human-gate.test.mjs). Git probing is controlled via LINT_GIT_BIN.
 *
 * ci.yml:174 runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu.
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

/**
 * Run the lint CLI against a synthetic file. Returns { code, stdout, stderr }.
 * Uses spawnSync so stderr is always captured regardless of exit code.
 */
function runLint(fileText, opts) {
  opts = opts || {};
  const isoDir = mkdtempSync(join(tmpdir(), "lint-fgnr-"));
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

/** Minimal well-formed front-matter base fields (no gate keys). */
const BASE_FM_FIELDS =
  "premise: 'true'\n" +
  "premise_means: always-true sentinel\n" +
  "scope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\n" +
  "size: 3\n" +
  "gate_allow: none";

/** A well-formed prompt body with standing authority grant. */
const GOOD_BODY =
  "# Hold prompt\n\n" +
  "## STANDING AUTHORITY\n\n" +
  "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

/** A path guaranteed to be ABSENT from origin/main. */
const ABSENT_PATH = "docs/approvals/definitely-not-a-real-file-fgnr-9876543210.md";

/** A path guaranteed to be PRESENT on origin/main (lint-prompt.mjs itself). */
const PRESENT_PATH = "scripts/pipeline/lint-prompt.mjs";

/**
 * A path PRESENT on origin/main whose name CONTAINS A SPACE. Landed in #1573
 * (CD-S1) on 2026-09-04. Previously, readFromOriginMain() passed shell:true on
 * Windows, so this path was re-split at the space and reported ABSENT even
 * though it is on main — silently turning GATE_RELEASED into
 * FILE_GATE_NOT_RELEASED.
 */
const PRESENT_PATH_WITH_SPACE = "Claude Design/docs/01-commercial.md";

function makeHoldPrompt(extraFmLines) {
  return "---\n" + BASE_FM_FIELDS + "\n" + extraFmLines + "\n---\n\n" + GOOD_BODY;
}

function makeReadyPrompt(extraFmLines) {
  return "---\n" + BASE_FM_FIELDS + "\n" + extraFmLines + "\n---\n\n" + GOOD_BODY;
}

// ---------------------------------------------------------------------------
// Test 1: HOLD with requires_file_on_main pointing at absent path → FILE_GATE_NOT_RELEASED
// This is the primary regression: previously admitted as a bare ADMIT.
// ---------------------------------------------------------------------------

describe("FILE_GATE_NOT_RELEASED — requires_file_on_main", () => {
  test("HOLD with requires_file_on_main pointing at absent path → exit 1, FILE_GATE_NOT_RELEASED (regression)", () => {
    const prompt = makeHoldPrompt("requires_file_on_main: " + ABSENT_PATH);
    const r = runLint(prompt, { hold: true, name: "fgnr-rfom-absent" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got stdout: " + r.stdout);
    assert.ok(
      r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should include FILE_GATE_NOT_RELEASED; got: " + r.stdout
    );
  });

  // Test 2: negative control — HOLD with requires_file_on_main pointing at present path → GATE_RELEASED
  test("HOLD with requires_file_on_main pointing at present path → exit 0, GATE_RELEASED (negative control)", () => {
    const prompt = makeHoldPrompt("requires_file_on_main: " + PRESENT_PATH);
    const r = runLint(prompt, { hold: true, name: "fgnr-rfom-present" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got stdout: " + r.stdout);
    assert.ok(
      r.stdout.includes("GATE_RELEASED"),
      "should include GATE_RELEASED; got: " + r.stdout
    );
  });

  // Regression: a gate path containing a space that IS on origin/main must NOT be
  // reported as FILE_GATE_NOT_RELEASED. Pre-fix, readFromOriginMain() ran with
  // shell:true on Windows and Node's argv concatenation (DEP0190) split the path
  // at the space, making git report "does not exist" — which the catch reads as
  // absent. The originating prompt greps for the exact phrase in this test name.
  test("HOLD with requires_file_on_main gate path containing a space that is on main → GATE_RELEASED (regression)", () => {
    const prompt = makeHoldPrompt("requires_file_on_main: \"" + PRESENT_PATH_WITH_SPACE + "\"");
    const r = runLint(prompt, { hold: true, name: "fgnr-rfom-space-present" });
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "spaced path present on main must NOT report FILE_GATE_NOT_RELEASED; got: " + r.stdout
    );
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got stdout: " + r.stdout);
    assert.ok(
      r.stdout.includes("GATE_RELEASED"),
      "should include GATE_RELEASED; got: " + r.stdout
    );
  });

  // Test 3: non-HOLD with requires_file_on_main pointing at absent path → REJECT
  // Post-ARMED_GATE_STILL_CHECKED (this PR): the check runs regardless of the -HOLD.md vs
  // -ready.md filename. An armed prompt whose existence gate is unmet REJECTS with
  // FILE_GATE_NOT_RELEASED for the same reason a HOLD would — a bare ADMIT must mean the
  // gate IS satisfied. The previous behavior admitted this case; that was the defect.
  test("non-HOLD with requires_file_on_main pointing at absent path → exit 1, FILE_GATE_NOT_RELEASED (ARMED_GATE_STILL_CHECKED)", () => {
    const prompt = makeReadyPrompt("requires_file_on_main: " + ABSENT_PATH);
    const r = runLint(prompt, { hold: false, name: "fgnr-rfom-nonhold" });
    assert.strictEqual(r.code, 1, "non-HOLD with unmet gate should reject (exit 1); got stdout: " + r.stdout);
    assert.ok(
      r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "non-HOLD should now get FILE_GATE_NOT_RELEASED; got: " + r.stdout
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4: HOLD with needle-less requires_on_main (existence-only gate)
// ---------------------------------------------------------------------------

describe("FILE_GATE_NOT_RELEASED — needle-less requires_on_main", () => {
  test("HOLD with needle-less requires_on_main pointing at absent path → exit 1, FILE_GATE_NOT_RELEASED", () => {
    // No `::` separator — existence-only gate. Previously skipped with `continue` in checkGateNotReleased.
    const prompt = makeHoldPrompt(
      "cluster: fgnr-needleless-test\n" +
      "cluster_order: 2\n" +
      "requires_on_main: " + ABSENT_PATH
    );
    const r = runLint(prompt, { hold: true, name: "fgnr-needleless-absent" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got stdout: " + r.stdout);
    assert.ok(
      r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should include FILE_GATE_NOT_RELEASED; got: " + r.stdout
    );
  });

  test("HOLD with needle-less requires_on_main pointing at present path → exit 0 admit", () => {
    // File exists on origin/main: existence gate is satisfied, no gate code should fire.
    const prompt = makeHoldPrompt(
      "cluster: fgnr-needleless-present-test\n" +
      "cluster_order: 2\n" +
      "requires_on_main: " + PRESENT_PATH
    );
    const r = runLint(prompt, { hold: true, name: "fgnr-needleless-present" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got stdout: " + r.stdout);
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should NOT include FILE_GATE_NOT_RELEASED; got: " + r.stdout
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: Probe failure (LINT_GIT_BIN points at nonexistent binary) → fail-safe
// Applies to both requires_file_on_main and needle-less requires_on_main.
// ---------------------------------------------------------------------------

describe("FILE_GATE_NOT_RELEASED — fail-safe on probe failure", () => {
  const BROKEN_GIT = "this-git-binary-does-not-exist-fgnr-9876543210";

  test("requires_file_on_main: probe failure → WARN emitted, no FILE_GATE_NOT_RELEASED, admits", () => {
    const prompt = makeHoldPrompt("requires_file_on_main: " + ABSENT_PATH);
    const r = runLint(prompt, {
      hold: true,
      name: "fgnr-rfom-failsafe",
      env: { LINT_GIT_BIN: BROKEN_GIT },
    });
    // Must NOT reject with FILE_GATE_NOT_RELEASED when the probe fails
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should not report FILE_GATE_NOT_RELEASED when probe fails; got: " + r.stdout
    );
    // Should warn to stderr
    const combined = r.stdout + r.stderr;
    assert.ok(combined.includes("WARN"), "should emit a WARN when probe fails; got: " + combined);
  });

  test("needle-less requires_on_main: probe failure → WARN emitted, no FILE_GATE_NOT_RELEASED, admits", () => {
    const prompt = makeHoldPrompt(
      "cluster: fgnr-failsafe-test\n" +
      "cluster_order: 2\n" +
      "requires_on_main: " + ABSENT_PATH
    );
    const r = runLint(prompt, {
      hold: true,
      name: "fgnr-needleless-failsafe",
      env: { LINT_GIT_BIN: BROKEN_GIT },
    });
    // Must NOT reject with FILE_GATE_NOT_RELEASED when the probe fails
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should not report FILE_GATE_NOT_RELEASED when probe fails; got: " + r.stdout
    );
    // Should warn to stderr
    const combined = r.stdout + r.stderr;
    assert.ok(combined.includes("WARN"), "should emit a WARN when probe fails; got: " + combined);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Prompt with no gate key → admits, unchanged
// Regression guard: ensure adding the new check does not affect gate-free prompts.
// ---------------------------------------------------------------------------

describe("FILE_GATE_NOT_RELEASED — no gate key", () => {
  test("HOLD prompt with no gate key at all → admits, no FILE_GATE_NOT_RELEASED", () => {
    // No requires_file_on_main, no requires_on_main — simple HOLD with no gate.
    const prompt = "---\n" + BASE_FM_FIELDS + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: true, name: "fgnr-no-gate" });
    assert.strictEqual(r.code, 0, "gate-free HOLD should admit (exit 0); got stdout: " + r.stdout);
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should NOT include FILE_GATE_NOT_RELEASED; got: " + r.stdout
    );
  });

  test("non-HOLD prompt with no gate key → admits, unchanged", () => {
    const prompt = "---\n" + BASE_FM_FIELDS + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: false, name: "fgnr-nogate-ready" });
    assert.strictEqual(r.code, 0, "gate-free non-HOLD should admit (exit 0); got stdout: " + r.stdout);
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should NOT include FILE_GATE_NOT_RELEASED; got: " + r.stdout
    );
  });
});
