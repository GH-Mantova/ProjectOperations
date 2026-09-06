/**
 * Tests for PR_GATE_EVALUATED_V1: the `requires_merged` PR gate.
 *
 * THE DEFECT. `requires_merged` was validated for FORMAT (positive integer) and
 * then never evaluated. Of the three legal dependency keys, `requires_on_main`
 * and `requires_file_on_main` were probed against origin/main by
 * checkGateNotReleased; the third was not probed at all. A HOLD gated on a PR
 * that was still OPEN — or on a PR number that did not exist — returned a bare
 * ADMIT, indistinguishable from a HOLD whose gate was genuinely satisfied.
 *
 * TWO LAYERS, DELIBERATELY.
 *   1. Unit tests drive the exported checkPrGateNotReleased directly with a stub
 *      fetchState. Deterministic, no gh, no network.
 *   2. CLI tests spawn lint-prompt.mjs with LINT_GH_BIN pointed at a stub `gh`.
 *      These are the ones that fail if the checker exists but nothing CALLS it —
 *      which is the shape of this whole defect, and the shape a unit-only suite
 *      would happily green-light.
 *
 * Runs with: node --test scripts/pipeline/__tests__/*.mjs
 * ci.yml:174 runs that on Ubuntu.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { checkPrGateNotReleased } from "../lint-prompt.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const LINT = join(HERE, "..", "lint-prompt.mjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run `fn` with process.stderr.write captured. Returns { result, stderr }.
 * The fail-safe path writes its WARN straight to stderr, exactly as the three
 * readFromOriginMain(...) === null branches in checkGateNotReleased do, so the
 * "a WARN was emitted" control has to read it from there.
 */
function captureStderr(fn) {
  const original = process.stderr.write;
  let captured = "";
  process.stderr.write = (chunk) => {
    captured += String(chunk);
    return true;
  };
  try {
    const result = fn();
    return { result, stderr: captured };
  } finally {
    process.stderr.write = original;
  }
}

/** A stub fetchState that answers with one fixed state for every PR number. */
const always = (state) => () => state;

/**
 * Write a fake `gh` that prints one fixed PR state, and return its path for
 * LINT_GH_BIN. Cross-platform: ghFetchPrState runs execFileSync with shell:true
 * only on win32, so POSIX needs a real executable and Windows needs a .cmd.
 */
function makeGhStub(dir, state) {
  if (process.platform === "win32") {
    const cmd = join(dir, "gh-stub-" + state + ".cmd");
    writeFileSync(cmd, '@echo {"state":"' + state + '"}\r\n', "utf8");
    return cmd;
  }
  const sh = join(dir, "gh-stub-" + state + ".sh");
  writeFileSync(sh, '#!/bin/sh\necho \'{"state":"' + state + '"}\'\n', { encoding: "utf8", mode: 0o755 });
  chmodSync(sh, 0o755);
  return sh;
}

const BASE_FM_FIELDS =
  "premise: 'true'\n" +
  "premise_means: always-true sentinel\n" +
  "scope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\n" +
  "size: 3\n" +
  "gate_allow: none";

const GOOD_BODY =
  "# Gate prompt\n\n" +
  "## STANDING AUTHORITY\n\n" +
  "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

/**
 * Run the lint CLI against a synthetic prompt. Returns { code, stdout, stderr }.
 * `ghState` (when given) pins the stub gh's answer; omit it to leave LINT_GH_BIN
 * pointing at a binary that does not exist, which exercises the fail-safe.
 */
function runLint({ fmExtra, hold, name, ghState, ghBin }) {
  const isoDir = mkdtempSync(join(tmpdir(), "lint-prgate-"));
  const suffix = hold ? "-HOLD.md" : "-ready.md";
  const file = join(isoDir, (name || "test") + suffix);
  writeFileSync(file, "---\n" + BASE_FM_FIELDS + "\n" + fmExtra + "\n---\n\n" + GOOD_BODY, "utf8");

  const bin = ghBin !== undefined ? ghBin : makeGhStub(isoDir, ghState);
  const env = Object.assign({}, process.env, { LINT_GH_BIN: bin });
  const res = spawnSync("node", [LINT, file], { cwd: REPO_ROOT, encoding: "utf8", env });
  const out = {
    code: res.status != null ? res.status : 1,
    stdout: String(res.stdout || ""),
    stderr: String(res.stderr || ""),
  };
  rmSync(isoDir, { recursive: true, force: true });
  return out;
}

// ---------------------------------------------------------------------------
// Unit: the exported checker
// ---------------------------------------------------------------------------

describe("checkPrGateNotReleased — states", () => {
  test("MERGED → ok (POSITIVE CONTROL: the gate can pass, and today's board prompts still admit)", () => {
    const { result, stderr } = captureStderr(() =>
      checkPrGateNotReleased({ requiresMerged: 1317, fetchState: always("MERGED"), name: "p-HOLD.md", isHold: true })
    );
    assert.deepStrictEqual(result, { ok: true });
    assert.strictEqual(stderr, "", "a satisfied gate must not warn; got: " + stderr);
  });

  test("OPEN → PR_GATE_NOT_RELEASED naming the PR and the state actually seen", () => {
    const r = checkPrGateNotReleased({
      requiresMerged: 1543, fetchState: always("OPEN"), name: "p-HOLD.md", isHold: true,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, "PR_GATE_NOT_RELEASED");
    assert.match(r.msg, /1543/, "message must name the PR; got: " + r.msg);
    assert.match(r.msg, /OPEN/, "message must name the state actually seen; got: " + r.msg);
  });

  test("CLOSED → PR_GATE_NOT_RELEASED", () => {
    const r = checkPrGateNotReleased({
      requiresMerged: 1543, fetchState: always("CLOSED"), name: "p-HOLD.md", isHold: true,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, "PR_GATE_NOT_RELEASED");
    assert.match(r.msg, /CLOSED/, "message must name the state actually seen; got: " + r.msg);
  });

  test("HOLD and armed get the same verdict, different stateLine (ARMED_GATE_STILL_CHECKED)", () => {
    const held = checkPrGateNotReleased({
      requiresMerged: 7, fetchState: always("OPEN"), name: "p-HOLD.md", isHold: true,
    });
    const armed = checkPrGateNotReleased({
      requiresMerged: 7, fetchState: always("OPEN"), name: "p-ready.md", isHold: false,
    });
    assert.strictEqual(held.code, "PR_GATE_NOT_RELEASED");
    assert.strictEqual(armed.code, "PR_GATE_NOT_RELEASED", "arming a prompt must not strip the gate");
    assert.match(held.msg, /This HOLD is parked/);
    assert.match(armed.msg, /This armed prompt cannot run yet/);
  });

  test("no requires_merged key → ok, no probe call at all", () => {
    let calls = 0;
    const r = checkPrGateNotReleased({
      requiresMerged: undefined, fetchState: () => { calls++; return "OPEN"; }, name: "p-HOLD.md", isHold: true,
    });
    assert.deepStrictEqual(r, { ok: true });
    assert.strictEqual(calls, 0, "a gate-free prompt must not touch GitHub");
  });
});

// ---------------------------------------------------------------------------
// Unit: list form
// ---------------------------------------------------------------------------

describe("checkPrGateNotReleased — list form", () => {
  test("[MERGED, OPEN] → rejected on the OPEN one (one unmet entry is an unmet gate)", () => {
    const states = { 100: "MERGED", 200: "OPEN" };
    const r = checkPrGateNotReleased({
      requiresMerged: [100, 200], fetchState: (n) => states[n], name: "p-HOLD.md", isHold: true,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, "PR_GATE_NOT_RELEASED");
    assert.match(r.msg, /200/, "must name the UNMET entry, not the satisfied one; got: " + r.msg);
  });

  test("[MERGED, MERGED] → ok", () => {
    const r = checkPrGateNotReleased({
      requiresMerged: [100, 200], fetchState: always("MERGED"), name: "p-HOLD.md", isHold: true,
    });
    assert.deepStrictEqual(r, { ok: true });
  });
});

// ---------------------------------------------------------------------------
// Unit: FAIL SAFE — the instrument cannot answer
// ---------------------------------------------------------------------------

describe("checkPrGateNotReleased — fail-safe when GitHub is unreachable", () => {
  test("fetcher throws → ok AND a WARN was emitted (the fail-safe control)", () => {
    const { result, stderr } = captureStderr(() =>
      checkPrGateNotReleased({
        requiresMerged: 1317,
        fetchState: () => { throw new Error("spawnSync gh ENOENT"); },
        name: "p-HOLD.md",
        isHold: true,
      })
    );
    assert.deepStrictEqual(result, { ok: true }, "a broken probe must NEVER report the gate as absent (DOCTRINE section 7)");
    assert.match(stderr, /WARN/, "the skip must be loud; got: " + JSON.stringify(stderr));
    assert.match(stderr, /1317/, "the WARN must name the PR it could not read; got: " + JSON.stringify(stderr));
    assert.match(stderr, /NOT evaluated/, "the WARN must say the gate went unevaluated; got: " + JSON.stringify(stderr));
  });

  test("fetcher returns nothing usable → treated as unreachable, not as 'not merged'", () => {
    const { result, stderr } = captureStderr(() =>
      checkPrGateNotReleased({ requiresMerged: 1317, fetchState: () => undefined, name: "p-HOLD.md", isHold: true })
    );
    assert.deepStrictEqual(result, { ok: true });
    assert.match(stderr, /WARN/);
  });

  test("one entry unreadable, another OPEN → still rejects on the OPEN one", () => {
    const { result } = captureStderr(() =>
      checkPrGateNotReleased({
        requiresMerged: [100, 200],
        fetchState: (n) => { if (n === 100) throw new Error("network down"); return "OPEN"; },
        name: "p-HOLD.md",
        isHold: true,
      })
    );
    assert.strictEqual(result.ok, false, "an unreadable entry must not suppress a provably unmet one");
    assert.strictEqual(result.code, "PR_GATE_NOT_RELEASED");
  });
});

// ---------------------------------------------------------------------------
// CLI: the checker is actually WIRED IN
//
// These are the load-bearing ones. The defect being fixed is precisely "the
// code to evaluate this gate is not reached", so a suite that only exercises
// the exported function would pass with the call site missing.
// ---------------------------------------------------------------------------

describe("lint CLI — requires_merged is evaluated end to end", () => {
  test("HOLD with requires_merged on an OPEN PR → exit 1, PR_GATE_NOT_RELEASED (the regression)", () => {
    const r = runLint({ fmExtra: "requires_merged: 1543", hold: true, name: "prgate-open", ghState: "OPEN" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got stdout: " + r.stdout + r.stderr);
    assert.ok(r.stdout.includes("PR_GATE_NOT_RELEASED"), "should include PR_GATE_NOT_RELEASED; got: " + r.stdout);
  });

  test("HOLD with requires_merged on a MERGED PR → exit 0 ADMIT (positive control)", () => {
    const r = runLint({ fmExtra: "requires_merged: 1317", hold: true, name: "prgate-merged", ghState: "MERGED" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got stdout: " + r.stdout + r.stderr);
    assert.ok(!r.stdout.includes("PR_GATE_NOT_RELEASED"), "should NOT include PR_GATE_NOT_RELEASED; got: " + r.stdout);
  });

  test("ARMED prompt with requires_merged on an OPEN PR → exit 1 (arming does not strip the gate)", () => {
    const r = runLint({ fmExtra: "requires_merged: 1543", hold: false, name: "prgate-armed-open", ghState: "OPEN" });
    assert.strictEqual(r.code, 1, "armed prompt with unmet gate should reject; got stdout: " + r.stdout + r.stderr);
    assert.ok(r.stdout.includes("PR_GATE_NOT_RELEASED"), "should include PR_GATE_NOT_RELEASED; got: " + r.stdout);
  });

  test("gh binary absent → exit 0 ADMIT with a WARN (fail-safe; a broken instrument bins nothing)", () => {
    const r = runLint({
      fmExtra: "requires_merged: 1543",
      hold: true,
      name: "prgate-failsafe",
      ghBin: "this-gh-binary-does-not-exist-prgate-9876543210",
    });
    assert.strictEqual(r.code, 0, "unreachable GitHub must not reject; got stdout: " + r.stdout + r.stderr);
    assert.ok(!r.stdout.includes("PR_GATE_NOT_RELEASED"), "must not report the gate as absent; got: " + r.stdout);
    const combined = r.stdout + r.stderr;
    assert.ok(combined.includes("WARN"), "should emit a WARN; got: " + combined);
    assert.ok(combined.includes("NOT evaluated"), "the WARN must say the gate went unevaluated; got: " + combined);
  });

  test("no requires_merged key → admits unchanged, and never invokes gh", () => {
    // gh points at a stub that would answer OPEN. If the key is absent the stub
    // must never be consulted, so the prompt still admits.
    const r = runLint({ fmExtra: "backfill: false", hold: true, name: "prgate-nokey", ghState: "OPEN" });
    assert.strictEqual(r.code, 0, "gate-free HOLD should admit; got stdout: " + r.stdout + r.stderr);
    assert.ok(!r.stdout.includes("PR_GATE_NOT_RELEASED"), "should NOT include PR_GATE_NOT_RELEASED; got: " + r.stdout);
  });

  test("malformed requires_merged still answers REQUIRES_MERGED_INVALID, not the new code", () => {
    const r = runLint({ fmExtra: "requires_merged: abc", hold: true, name: "prgate-invalid", ghState: "MERGED" });
    assert.strictEqual(r.code, 1);
    assert.ok(
      r.stdout.includes("REQUIRES_MERGED_INVALID"),
      "shape errors keep their own code — this PR renames nothing; got: " + r.stdout
    );
    assert.ok(!r.stdout.includes("PR_GATE_NOT_RELEASED"), "got: " + r.stdout);
  });
});
