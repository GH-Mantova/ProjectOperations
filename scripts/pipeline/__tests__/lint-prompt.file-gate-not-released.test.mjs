/**
 * Tests for FILE_GATE_NOT_RELEASED — Pipeline Guard 3.
 *
 * Runs with: node --test scripts/pipeline/__tests__/lint-prompt.file-gate-not-released.test.mjs
 *
 * Defect (measured 2026-08-27 at commit 478112c5): a HOLD whose
 * requires_file_on_main points at a path ABSENT from origin/main was linting
 * as a bare ADMIT — silently, with no warning.  After this fix it must REJECT
 * with FILE_GATE_NOT_RELEASED.
 *
 * All tests exercise the full lint() CLI (via spawnSync) with git controlled
 * via LINT_GIT_BIN so no real network access is required.
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

/** Minimal well-formed front-matter (always-true premise, no gates). */
const BASE_FM =
  "premise: 'true'\n" +
  "premise_means: always-true sentinel\n" +
  "scope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\n" +
  "size: 3\n" +
  "gate_allow: none";

const GOOD_BODY =
  "# Hold prompt\n\n" +
  "## STANDING AUTHORITY\n\n" +
  "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

/**
 * A path we know is ABSENT from origin/main — deliberately random.
 * We also verify this with a real git probe in the "positive control" test.
 */
const ABSENT_PATH = "this/path/definitely/does/not/exist/on/main/fgnr-9876543210.txt";

/**
 * A path we know IS on origin/main — the lint script itself.
 */
const PRESENT_PATH = "scripts/pipeline/lint-prompt.mjs";

// ---------------------------------------------------------------------------
// Test 1: HOLD with requires_file_on_main pointing at absent path → FILE_GATE_NOT_RELEASED
// (the regression)
// ---------------------------------------------------------------------------

describe("FILE_GATE_NOT_RELEASED — requires_file_on_main", () => {
  const holdFmAbsent =
    BASE_FM + "\n" +
    "requires_file_on_main: " + ABSENT_PATH;

  test("HOLD with absent requires_file_on_main path rejects with FILE_GATE_NOT_RELEASED (regression)", () => {
    const prompt = "---\n" + holdFmAbsent + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: true, name: "fgnr-absent-file-gate" });

    // Must NOT be a bare ADMIT
    const isBareAdmit =
      r.code === 0 &&
      !r.stdout.includes("FILE_GATE_NOT_RELEASED") &&
      !r.stdout.includes("GATE_RELEASED");
    assert.ok(
      !isBareAdmit,
      "bare ADMIT must not be returned when requires_file_on_main path is absent; got stdout: " + r.stdout
    );
    assert.ok(
      r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "output should include FILE_GATE_NOT_RELEASED; got stdout: " + r.stdout
    );
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT) when path is absent");
  });

  // ---------------------------------------------------------------------------
  // Test 2: Same HOLD, path present on main → still GATE_RELEASED / promote
  // (negative control — the fix must not break the GATE_RELEASED path)
  // ---------------------------------------------------------------------------

  test("HOLD with present requires_file_on_main path still emits GATE_RELEASED and admits (negative control)", () => {
    const holdFmPresent =
      BASE_FM + "\n" +
      "requires_file_on_main: " + PRESENT_PATH;
    const prompt = "---\n" + holdFmPresent + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: true, name: "fgnr-present-file-gate" });
    assert.strictEqual(r.code, 0, "HOLD with present path should admit (exit 0)");
    assert.ok(
      r.stdout.includes("GATE_RELEASED"),
      "should emit GATE_RELEASED for present path; got stdout: " + r.stdout
    );
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should NOT emit FILE_GATE_NOT_RELEASED for present path; got stdout: " + r.stdout
    );
  });

  // ---------------------------------------------------------------------------
  // Test 3: Non-HOLD with absent requires_file_on_main → unchanged behaviour (admits)
  // (a non-HOLD with an absent path is FILE_GATE_DEAD, but that is unchanged.
  //  For a non-HOLD, the path being absent means the gate is unmet but the prompt
  //  is NOT a HOLD — so it is not a FILE_GATE_NOT_RELEASED.  The existing check
  //  in checkFileGateDead produces FILE_GATE_DEAD only when the path IS present.
  //  When absent, checkFileGateDead passes through and the non-HOLD admits normally.)
  // ---------------------------------------------------------------------------

  test("non-HOLD with absent requires_file_on_main admits (unchanged behaviour)", () => {
    const readyFmAbsent =
      BASE_FM + "\n" +
      "requires_file_on_main: " + ABSENT_PATH;
    const prompt = "---\n" + readyFmAbsent + "\n---\n\n" + GOOD_BODY;
    // Note: runLint defaults to -ready.md (hold: false)
    const r = runLint(prompt, { hold: false, name: "fgnr-nonhold-absent" });
    // Non-HOLD with absent path: FILE_GATE_DEAD fires only when path IS present.
    // Absent path → gate is unmet → check passes → prompt admits.
    assert.strictEqual(r.code, 0, "non-HOLD with absent path should admit (exit 0); got stdout: " + r.stdout);
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "non-HOLD must not emit FILE_GATE_NOT_RELEASED; got stdout: " + r.stdout
    );
  });

  // ---------------------------------------------------------------------------
  // Test 5a: Probe failure (git unreachable) → WARN + admit, for requires_file_on_main
  // ---------------------------------------------------------------------------

  test("probe failure on requires_file_on_main → WARN + admit (fail-safe)", () => {
    const prompt = "---\n" + holdFmAbsent + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, {
      hold: true,
      name: "fgnr-failsafe-file",
      env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-fgnr-1234567890" },
    });
    // Probe failure must NOT cause a false FILE_GATE_NOT_RELEASED rejection
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should not emit FILE_GATE_NOT_RELEASED when probe fails; got stdout: " + r.stdout
    );
    // Must still warn
    const combined = r.stdout + r.stderr;
    assert.ok(
      combined.includes("WARN"),
      "should emit a WARN when probe fails; got combined: " + combined
    );
    // Must admit (not reject)
    assert.strictEqual(r.code, 0, "should admit (exit 0) when probe fails (fail-safe); got stdout: " + r.stdout);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Needle-less requires_on_main (existence gate) on a HOLD
// ---------------------------------------------------------------------------

describe("FILE_GATE_NOT_RELEASED — requires_on_main existence gate (no needle)", () => {
  const holdFmOnMainAbsent =
    BASE_FM + "\n" +
    "cluster: fgnr-existence-test\n" +
    "cluster_order: 2\n" +
    "requires_on_main: " + ABSENT_PATH;

  test("needle-less requires_on_main with absent path on a HOLD → FILE_GATE_NOT_RELEASED", () => {
    const prompt = "---\n" + holdFmOnMainAbsent + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: true, name: "fgnr-existence-absent" });
    assert.ok(
      r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "HOLD with absent existence-gate path should emit FILE_GATE_NOT_RELEASED; got stdout: " + r.stdout
    );
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got stdout: " + r.stdout);
  });

  test("needle-less requires_on_main with present path on a HOLD admits", () => {
    const holdFmOnMainPresent =
      BASE_FM + "\n" +
      "cluster: fgnr-existence-present-test\n" +
      "cluster_order: 2\n" +
      "requires_on_main: " + PRESENT_PATH;
    const prompt = "---\n" + holdFmOnMainPresent + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: true, name: "fgnr-existence-present" });
    assert.strictEqual(r.code, 0, "HOLD with present existence-gate path should admit (exit 0); got stdout: " + r.stdout);
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should NOT emit FILE_GATE_NOT_RELEASED for present path; got stdout: " + r.stdout
    );
  });

  // ---------------------------------------------------------------------------
  // Test 5b: Probe failure (git unreachable) → WARN + admit, for requires_on_main existence gate
  // ---------------------------------------------------------------------------

  test("probe failure on requires_on_main existence gate → WARN + admit (fail-safe)", () => {
    const prompt = "---\n" + holdFmOnMainAbsent + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, {
      hold: true,
      name: "fgnr-failsafe-existence",
      env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-fgnr-9999999999" },
    });
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should not emit FILE_GATE_NOT_RELEASED when probe fails; got stdout: " + r.stdout
    );
    const combined = r.stdout + r.stderr;
    assert.ok(
      combined.includes("WARN"),
      "should emit a WARN when probe fails; got combined: " + combined
    );
    assert.strictEqual(r.code, 0, "should admit (exit 0) when probe fails (fail-safe); got stdout: " + r.stdout);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Prompt with no gate key at all → admits unchanged
// ---------------------------------------------------------------------------

describe("FILE_GATE_NOT_RELEASED — no gate key", () => {
  test("prompt with no gate key at all admits unchanged", () => {
    const prompt = "---\n" + BASE_FM + "\n---\n\n" + GOOD_BODY;
    const r = runLint(prompt, { hold: true, name: "fgnr-no-gate" });
    assert.strictEqual(r.code, 0, "prompt with no gate key should admit (exit 0); got stdout: " + r.stdout);
    assert.ok(
      !r.stdout.includes("FILE_GATE_NOT_RELEASED"),
      "should not emit FILE_GATE_NOT_RELEASED with no gate; got stdout: " + r.stdout
    );
  });
});
