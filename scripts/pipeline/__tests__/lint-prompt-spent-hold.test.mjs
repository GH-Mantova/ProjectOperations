/**
 * Tests for SPENT_HOLD_PR_OPEN: lint-prompt.mjs rejects a HOLD whose own work
 * is already in an open PR.
 *
 * TWO LAYERS, DELIBERATELY — mirroring lint-prompt.requires-merged-gate.test.mjs.
 *
 *   1. Unit tests drive the exported checkSpentHoldPrOpen directly with stub data.
 *      Deterministic, no gh, no network.
 *   2. CLI tests spawn lint-prompt.mjs with LINT_GH_BIN pointed at a stub `gh`.
 *      These are the load-bearing ones: a checker that exists but is not WIRED IN
 *      passes unit tests and fails this layer. That is the exact defect shape.
 *
 * TRAP: do NOT assert on the word "ADMIT" in stdout. The REJECT message for
 * SPENT_HOLD_PR_OPEN contains the word "ADMIT" in its explanation. Assert on the
 * exit CODE and the code string. (Prompt body §"A trap in this very file's subject
 * matter" — DOCTRINE 9.6 generalised.)
 *
 * Runs with: node --test scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs
 *        or: node --test scripts/pipeline/__tests__/
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  mkdtempSync, writeFileSync, rmSync, chmodSync, mkdirSync, existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { checkSpentHoldPrOpen } from "../lint-prompt.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const LINT = join(HERE, "..", "lint-prompt.mjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Standard front-matter fields that always-pass all other checks.
 * premise: 'true' means the premise is always satisfied (work is still needed).
 * scope names the three paths from the canonical HOLD template:
 *   [0] a scripts/pipeline path (non-prompt work entry)
 *   [1] a test file (non-prompt work entry)
 *   [2] the superseded/ retirement path (prompt's own path)
 */
const BASE_FM_FIELDS =
  "premise: 'true'\n" +
  "premise_means: always-true sentinel\n" +
  "scope:\n" +
  "  - scripts/pipeline/some-script.mjs\n" +
  "  - scripts/pipeline/__tests__/some-script.test.mjs\n" +
  "  - docs/pr-prompts/superseded/pr-some-script-HOLD.md\n" +
  "done_when: pnpm build\n" +
  "size: 3\n" +
  "gate_allow: none\n" +
  "module: pipeline";

const GOOD_BODY =
  "# Test prompt\n\n" +
  "## STANDING AUTHORITY\n\n" +
  "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

/**
 * A prompt whose premise always holds (work is still needed).
 * Used for all SPENT_HOLD_PR_OPEN tests so no other gate fires first.
 */
function makePromptText(fmOverride) {
  const fm = fmOverride || BASE_FM_FIELDS;
  return "---\n" + fm + "\n---\n\n" + GOOD_BODY;
}

/**
 * Open PRs stub: one PR that contains the superseded path.
 */
const PR_WITH_SUPERSEDED = [
  {
    number: 2294,
    files: [
      { path: "scripts/pipeline/some-script.mjs" },
      { path: "scripts/pipeline/__tests__/some-script.test.mjs" },
      { path: "docs/pr-prompts/superseded/pr-some-script-HOLD.md" },
    ],
  },
];

/**
 * Open PRs stub: one PR that contains only the work entries (not the superseded path).
 */
const PR_WITH_WORK_ONLY = [
  {
    number: 9999,
    files: [
      { path: "scripts/pipeline/some-script.mjs" },
      { path: "scripts/pipeline/__tests__/some-script.test.mjs" },
    ],
  },
];

/**
 * Open PRs stub: one PR with unrelated files.
 */
const PR_WITH_UNRELATED = [
  {
    number: 1001,
    files: [
      { path: "apps/api/src/modules/crm/crm.service.ts" },
      { path: "apps/web/src/pages/crm/CrmPage.tsx" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Unit: exported checkSpentHoldPrOpen — direct
// ---------------------------------------------------------------------------

describe("checkSpentHoldPrOpen — superseded path present in open PR", () => {
  test("PR contains superseded/ path → SPENT_HOLD_PR_OPEN naming the PR number", () => {
    const r = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "scripts/pipeline/__tests__/some-script.test.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => PR_WITH_SUPERSEDED,
      name: "pr-some-script-HOLD.md",
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, "SPENT_HOLD_PR_OPEN");
    assert.match(r.msg, /2294/, "message must name the PR number; got: " + r.msg);
  });

  test("PR contains all work entries (no superseded) → SPENT_HOLD_PR_OPEN naming the PR number", () => {
    const r = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "scripts/pipeline/__tests__/some-script.test.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => PR_WITH_WORK_ONLY,
      name: "pr-some-script-HOLD.md",
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, "SPENT_HOLD_PR_OPEN");
    assert.match(r.msg, /9999/, "message must name the PR number; got: " + r.msg);
  });
});

describe("checkSpentHoldPrOpen — POSITIVE CONTROL: live premise, no matching open PR", () => {
  test("non-HOLD prompt is never SPENT — fetchOpenPrs is never called", () => {
    // Gate: if name does not end in -HOLD.md, return { ok: true } immediately without
    // calling fetchOpenPrs. This test proves the short-circuit: the injected
    // fetchOpenPrs THROWS, yet the result is { ok: true }.
    const r = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "docs/pr-prompts/superseded/pr-foo-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-foo-ready.md",
      fetchOpenPrs: () => { throw new Error("fetchOpenPrs must not be called for non-HOLD prompts"); },
      name: "pr-foo-ready.md",
    });
    assert.deepStrictEqual(r, { ok: true },
      "a non-HOLD prompt must be { ok: true } without calling fetchOpenPrs; got: " + JSON.stringify(r));
  });

  test("PR with unrelated files → ok (prompt still ADMITs)", () => {
    const r = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "scripts/pipeline/__tests__/some-script.test.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => PR_WITH_UNRELATED,
      name: "pr-some-script-HOLD.md",
    });
    assert.deepStrictEqual(r, { ok: true },
      "a HOLD with no matching open PR must ADMIT (positive control); got: " + JSON.stringify(r));
  });

  test("PR contains only one work entry (not all) → ok (partial match is not SPENT)", () => {
    const r = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "scripts/pipeline/__tests__/some-script.test.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => [
        {
          number: 1002,
          files: [{ path: "scripts/pipeline/some-script.mjs" }],
        },
      ],
      name: "pr-some-script-HOLD.md",
    });
    assert.deepStrictEqual(r, { ok: true },
      "partial file-set match must not trigger SPENT_HOLD_PR_OPEN; got: " + JSON.stringify(r));
  });

  test("no open PRs at all → GH_OPEN_PRS_UNAVAILABLE (FAIL LOUD — not silent ADMIT)", () => {
    const r = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => [],
      name: "pr-some-script-HOLD.md",
    });
    assert.strictEqual(r.ok, false,
      "empty open-PR list must FAIL LOUD (not silent ADMIT); DOCTRINE 9.6");
    assert.strictEqual(r.code, "GH_OPEN_PRS_UNAVAILABLE");
  });
});

describe("checkSpentHoldPrOpen — FAIL LOUD on gh down / empty", () => {
  test("fetchOpenPrs throws → GH_OPEN_PRS_UNAVAILABLE (FAIL LOUD)", () => {
    const r = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => { throw new Error("spawnSync gh ENOENT"); },
      name: "pr-some-script-HOLD.md",
    });
    assert.strictEqual(r.ok, false,
      "a broken gh must FAIL LOUD, never silently ADMIT; got: " + JSON.stringify(r));
    assert.strictEqual(r.code, "GH_OPEN_PRS_UNAVAILABLE");
    assert.match(r.msg, /ENOENT/, "error message text should appear in the rejection; got: " + r.msg);
  });

  test("fetchOpenPrs returns non-array → GH_OPEN_PRS_UNAVAILABLE (FAIL LOUD)", () => {
    const r = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => null,
      name: "pr-some-script-HOLD.md",
    });
    assert.strictEqual(r.ok, false,
      "null return from fetchOpenPrs must FAIL LOUD; got: " + JSON.stringify(r));
    assert.strictEqual(r.code, "GH_OPEN_PRS_UNAVAILABLE");
  });

  test("code string is SPENT_HOLD_PR_OPEN, not a word-in-message check (trap guard)", () => {
    // This test exists specifically to verify we assert on the CODE, not on the presence
    // of the word "ADMIT" or any other prose in the message. The REJECT message for
    // SPENT_HOLD_PR_OPEN contains the word "ADMIT" in its explanation — checking stdout
    // for "ADMIT" would give a false positive (DOCTRINE 9.6 generalised, the TRAP this
    // very prompt body names). Asserting on r.code ensures the test is immune to that.
    const reject = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => PR_WITH_SUPERSEDED,
      name: "pr-some-script-HOLD.md",
    });
    assert.strictEqual(reject.code, "SPENT_HOLD_PR_OPEN",
      "must assert on code string, not on word presence; got: " + JSON.stringify(reject));

    const admit = checkSpentHoldPrOpen({
      scope: [
        "scripts/pipeline/some-script.mjs",
        "docs/pr-prompts/superseded/pr-some-script-HOLD.md",
      ],
      promptPath: "docs/pr-prompts/pr-some-script-HOLD.md",
      fetchOpenPrs: () => PR_WITH_UNRELATED,
      name: "pr-some-script-HOLD.md",
    });
    assert.strictEqual(admit.ok, true,
      "must assert on ok:true, not on absence of 'ADMIT' in stdout; got: " + JSON.stringify(admit));
  });
});

// ---------------------------------------------------------------------------
// CLI: the checker is actually WIRED IN
//
// These are the load-bearing tests. A checker that exists but is not called in
// lint() passes unit tests and fails here — exactly the defect shape.
// ---------------------------------------------------------------------------

/**
 * Write a fake `gh pr list` stub that echoes a JSON array of open PRs.
 * On Windows: a .cmd file that delegates to a .js helper.
 * On POSIX: a shell script that delegates to the same .js helper.
 *
 * Using a .js helper avoids all shell quoting issues with embedded JSON strings
 * — the path to the data file is written inside the .js source where no quoting
 * escaping is needed.
 */
function makeGhStubWithPrs(dir, prs, name) {
  const stubName = name || "gh-stub";
  // Write the JSON payload to a .json sidecar.
  const dataFile = join(dir, stubName + ".json");
  writeFileSync(dataFile, JSON.stringify(prs), "utf8");

  // Write a plain .js helper that reads the sidecar and prints it.
  // The path is embedded as a JS string literal using JSON.stringify so backslashes
  // on Windows are properly escaped without any shell interpolation.
  const jsHelper = join(dir, stubName + ".js");
  writeFileSync(
    jsHelper,
    "process.stdout.write(require('fs').readFileSync(" + JSON.stringify(dataFile) + ", 'utf8'));\n",
    "utf8"
  );

  if (process.platform === "win32") {
    const cmd = join(dir, stubName + ".cmd");
    // Delegate to the .js helper. No quoting needed for the path here because
    // the path appears only in the .js source, not in the cmd.exe argument list.
    writeFileSync(cmd, "@node " + JSON.stringify(jsHelper).replace(/\//g, "\\") + "\r\n", "utf8");
    return cmd;
  }
  const sh = join(dir, stubName + ".sh");
  writeFileSync(sh, "#!/bin/sh\nnode " + JSON.stringify(jsHelper) + "\n", { encoding: "utf8", mode: 0o755 });
  chmodSync(sh, 0o755);
  return sh;
}

/**
 * Run the lint CLI against a synthetic HOLD prompt with custom gh output.
 * Returns { code, stdout, stderr }.
 */
function runLintWithGh({ fmOverride, prs, ghBin }) {
  const isoDir = mkdtempSync(join(tmpdir(), "lint-spent-"));
  const file = join(isoDir, "pr-some-script-HOLD.md");
  writeFileSync(file, makePromptText(fmOverride), "utf8");

  const resolvedGhBin = ghBin !== undefined
    ? ghBin
    : makeGhStubWithPrs(isoDir, prs, "gh-stub");

  // Use LINT_GH_OPEN_PRS_BIN to avoid interfering with LINT_GH_BIN stubs used by
  // requires-merged-gate tests, which stub `gh pr view` via LINT_GH_BIN. The
  // ghFetchOpenPrs function checks LINT_GH_OPEN_PRS_BIN first, then LINT_GH_BIN.
  const env = Object.assign({}, process.env, {
    LINT_GH_OPEN_PRS_BIN: resolvedGhBin,
    // Also set LINT_GH_BIN to a non-existent binary so any requires_merged check
    // (which uses ghFetchPrState via LINT_GH_BIN) fails safely rather than calling
    // the real gh. The prompt body sets premise:'true' and has no requires_merged,
    // so ghFetchPrState is never called and this value is never used.
    LINT_GH_BIN: "this-gh-pr-view-stub-not-needed-for-spent-hold-tests",
  });
  const res = spawnSync("node", [LINT, file], { cwd: REPO_ROOT, encoding: "utf8", env });
  const out = {
    code: res.status != null ? res.status : 1,
    stdout: String(res.stdout || ""),
    stderr: String(res.stderr || ""),
  };
  rmSync(isoDir, { recursive: true, force: true });
  return out;
}

describe("lint CLI — SPENT_HOLD_PR_OPEN is wired in", () => {
  test("HOLD with superseded/ path in an open PR → exit 1, code SPENT_HOLD_PR_OPEN (the regression)", () => {
    const r = runLintWithGh({ prs: PR_WITH_SUPERSEDED });
    assert.strictEqual(r.code, 1, "must exit 1 (REJECT); got stdout: " + r.stdout + r.stderr);
    // Assert on the code string, NOT on the word "ADMIT" (see the TRAP note above).
    assert.ok(
      r.stdout.includes("SPENT_HOLD_PR_OPEN"),
      "must include SPENT_HOLD_PR_OPEN in output; got: " + r.stdout
    );
    assert.ok(
      r.stdout.includes("2294"),
      "must name the PR number; got: " + r.stdout
    );
  });

  test("HOLD with all work entries in an open PR → exit 1, code SPENT_HOLD_PR_OPEN", () => {
    const r = runLintWithGh({ prs: PR_WITH_WORK_ONLY });
    assert.strictEqual(r.code, 1, "must exit 1 (REJECT); got stdout: " + r.stdout + r.stderr);
    assert.ok(
      r.stdout.includes("SPENT_HOLD_PR_OPEN"),
      "must include SPENT_HOLD_PR_OPEN in output; got: " + r.stdout
    );
  });

  test("HOLD with live premise and NO matching open PR → exit 0 (positive control)", () => {
    // This is the reading the whole gate depends on: a live-premise HOLD with no matching
    // open PR must still ADMIT. DOCTRINE 7: prove the check CAN pass before believing it fails.
    const r = runLintWithGh({ prs: PR_WITH_UNRELATED });
    assert.strictEqual(r.code, 0,
      "live-premise HOLD with no matching open PR must ADMIT (positive control); got stdout: " + r.stdout + r.stderr);
    // Do NOT assert on "ADMIT" being absent — the REJECT message contains the word "ADMIT".
    // Assert on exit code only.
    assert.ok(
      !r.stdout.includes("SPENT_HOLD_PR_OPEN"),
      "must NOT include SPENT_HOLD_PR_OPEN when no match; got: " + r.stdout
    );
  });

  test("gh binary absent → exit 1, GH_OPEN_PRS_UNAVAILABLE (FAIL LOUD, not silent ADMIT)", () => {
    const r = runLintWithGh({
      prs: null,
      ghBin: "this-gh-binary-does-not-exist-spent-9876543210",
    });
    // FAIL LOUD: a broken gh must never silently ADMIT.
    assert.strictEqual(r.code, 1,
      "unreachable gh must FAIL LOUD (exit 1), not silently ADMIT; got stdout: " + r.stdout + r.stderr);
    assert.ok(
      r.stdout.includes("GH_OPEN_PRS_UNAVAILABLE"),
      "must include GH_OPEN_PRS_UNAVAILABLE when gh is down; got: " + r.stdout
    );
  });
});
