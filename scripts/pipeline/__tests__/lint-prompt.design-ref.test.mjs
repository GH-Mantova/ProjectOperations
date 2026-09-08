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
    // `module` added by MODULE_PROVENANCE_S1. `apps/web/src/**` names no module — it is the
    // linter's own documented negative control (a glob segment is not a module name), so this
    // fixture is MODULE_AMBIGUOUS without a declared value. Declaring it keeps these tests
    // testing design_ref, which is what they were written for, instead of silently becoming
    // module-gate tests. No assertion below is relaxed.
    "module: crm\n" +
    (extraFmLines ? extraFmLines + "\n" : "") +
    "---\n\n" +
    GOOD_BODY
  );
}

/**
 * Base fields for a prompt with an ARBITRARY scope list — used by the no-screen
 * exemption tests, which turn entirely on which paths are in `scope`.
 *
 * `module: crm` is declared for the same reason as in webPrompt() above: none of these
 * scopes resolves to a module (apps/web/src/lib/… and App.tsx name none), so without it
 * these would silently become MODULE_AMBIGUOUS tests instead of design_ref tests.
 */
function scopedPrompt(scopeEntries, extraFmLines) {
  return (
    "---\n" +
    "premise: 'true'\n" +
    "premise_means: always-true sentinel\n" +
    "scope:\n" + scopeEntries.map((s) => "  - " + s + "\n").join("") +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: none\n" +
    "module: crm\n" +
    (extraFmLines ? extraFmLines + "\n" : "") +
    "---\n\n" +
    GOOD_BODY
  );
}

/** The measured shape this exemption exists to unblock (pr-brandtheme-s1). */
const NO_SCREEN_SCOPE = [
  "apps/web/src/lib/brand-scheme.ts",
  "apps/web/src/lib/__tests__/brand-scheme.test.ts",
  "apps/web/src/App.tsx",
];

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
// The no-screen exemption: an apps/web/ scope that renders nothing
//
// The gate's own stated purpose is that a reviewer can compare the PR against the
// mock-up. A slice scoped to apps/web/src/lib/*.ts plus App.tsx routing changes no
// screen, so no mock-up exists and no design_ref can be honestly cited. It is exempt —
// and ONLY it: one page, one component, or one wildcard anywhere in scope kills it.
// ---------------------------------------------------------------------------

describe("design_ref — no-screen exemption", () => {
  test("lib + lib __tests__ + App.tsx, no design_ref → admits (pr-brandtheme-s1 shape)", () => {
    const prompt = scopedPrompt(NO_SCREEN_SCOPE, null);
    const r = runLint(prompt, { name: "dref-no-screen" });
    assert.ok(
      !r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "no-screen scope must not trip the design_ref gate; got: " + r.stdout,
    );
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(r.stdout.includes("ADMIT"), "should print ADMIT; got: " + r.stdout);
  });

  test("negative control — one page file forfeits the exemption", () => {
    const prompt = scopedPrompt(NO_SCREEN_SCOPE.concat(["apps/web/src/pages/Foo.tsx"]), null);
    const r = runLint(prompt, { name: "dref-no-screen-plus-page" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "a page IS a screen — must still be rejected; got: " + r.stdout,
    );
  });

  // Pins the COMPONENT-FILE reason, in isolation: every other entry here is exempt, so
  // only apps/web/src/components/SettingsShell.tsx can be doing the rejecting.
  test("negative control — one component file forfeits the exemption", () => {
    const prompt = scopedPrompt(
      [
        "apps/web/src/App.tsx",
        "apps/web/src/components/SettingsShell.tsx",
        "apps/web/src/lib/__tests__/brand-scheme.test.ts",
      ],
      null,
    );
    const r = runLint(prompt, { name: "dref-no-screen-plus-component" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "a component renders UI — must still be rejected; got: " + r.stdout,
    );
  });

  // The REAL pr-company-manage-s2-retire-adminonly scope, verbatim. Since the __tests__
  // branch was narrowed to lib/, this prompt is now red for TWO independent reasons:
  // components/SettingsShell.tsx AND components/__tests__/route-guards.authz.test.ts.
  // The isolated pins for each live either side of this test; this one pins the whole
  // real-world shape, which must never admit for any combination of reasons.
  test("negative control — the real pr-company-manage-s2 scope stays rejected", () => {
    const prompt = scopedPrompt(
      [
        "apps/web/src/App.tsx",
        "apps/web/src/components/SettingsShell.tsx",
        "apps/web/src/components/__tests__/route-guards.authz.test.ts",
      ],
      null,
    );
    const r = runLint(prompt, { name: "dref-company-manage-s2-shape" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "the measured company-manage-s2 shape must stay blocked; got: " + r.stdout,
    );
  });

  // Pins the NARROWED __tests__ boundary, in isolation: App.tsx is exempt, so only the
  // component test can be doing the rejecting. A component test is the one place a slice
  // could change what is asserted ABOUT a screen without citing the design.
  test("negative control — a component __tests__ file is NOT exempt (only lib/__tests__ is)", () => {
    const prompt = scopedPrompt(
      [
        "apps/web/src/App.tsx",
        "apps/web/src/components/__tests__/Foo.test.tsx",
      ],
      null,
    );
    const r = runLint(prompt, { name: "dref-component-test" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "__tests__ outside lib/ must still be rejected; got: " + r.stdout,
    );
  });

  // The positive half of the same boundary: under lib/, a test file IS exempt — it
  // qualifies via the lib/ rule, not via a general __tests__ rule.
  test("a lib/__tests__ file is exempt (via the lib/ rule)", () => {
    const prompt = scopedPrompt(["apps/web/src/lib/__tests__/brand-scheme.test.ts"], null);
    const r = runLint(prompt, { name: "dref-lib-test-only" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(
      !r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "a lib test renders no screen; got: " + r.stdout,
    );
  });

  test("negative control — a bare wildcard scope is never exempt", () => {
    const prompt = scopedPrompt(["apps/web/src/**"], null);
    const r = runLint(prompt, { name: "dref-wildcard" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "apps/web/src/** must still be rejected; got: " + r.stdout,
    );
  });

  // The load-bearing case: a glob whose literal prefix LOOKS exempt. A wildcard is a
  // promise about files that do not exist yet, so it can never be proven screenless.
  test("negative control — a lib-shaped wildcard is never exempt", () => {
    const prompt = scopedPrompt(["apps/web/src/lib/**"], null);
    const r = runLint(prompt, { name: "dref-lib-wildcard" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "apps/web/src/lib/** contains a glob — must still be rejected; got: " + r.stdout,
    );
  });

  // Under lib/, so the ONLY thing disqualifying it is the asterisk.
  test("negative control — a lib/__tests__ wildcard is never exempt", () => {
    const prompt = scopedPrompt(["apps/web/src/lib/__tests__/**"], null);
    const r = runLint(prompt, { name: "dref-tests-wildcard" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "a __tests__ glob must still be rejected; got: " + r.stdout,
    );
  });

  // The exemption is about a MISSING ref, never a licence to write a broken one.
  test("exempt scope with a malformed design_ref → still DESIGN_REF_MALFORMED", () => {
    const prompt = scopedPrompt(NO_SCREEN_SCOPE, "design_ref: not-a-url-not-a-path");
    const r = runLint(prompt, { name: "dref-no-screen-malformed" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("DESIGN_REF_MALFORMED"),
      "a set-but-broken design_ref must still be rejected; got: " + r.stdout,
    );
  });

  test("exempt scope with a well-formed design_ref → admits", () => {
    const prompt = scopedPrompt(
      NO_SCREEN_SCOPE,
      "design_ref: Claude Design/proposed/scope-card-v3.html",
    );
    const r = runLint(prompt, { name: "dref-no-screen-with-ref" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(r.stdout.includes("ADMIT"), "should print ADMIT; got: " + r.stdout);
  });

  test("App.tsx alone, no design_ref → admits (routing-only slice)", () => {
    const prompt = scopedPrompt(["apps/web/src/App.tsx"], null);
    const r = runLint(prompt, { name: "dref-app-only" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(
      !r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "App.tsx is the router, not a screen; got: " + r.stdout,
    );
  });

  test("a bare lib DIRECTORY entry is not exempt (only named files are)", () => {
    const prompt = scopedPrompt(["apps/web/src/lib"], null);
    const r = runLint(prompt, { name: "dref-lib-dir" });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(
      r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "a directory is a glob without the asterisk; got: " + r.stdout,
    );
  });

  test("a non-web path alongside an exempt web scope does not disturb the exemption", () => {
    const prompt = scopedPrompt(
      NO_SCREEN_SCOPE.concat(["docs/pipeline/DOCTRINE.md"]),
      null,
    );
    const r = runLint(prompt, { name: "dref-no-screen-plus-docs" });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(
      !r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "only apps/web/ entries are judged; got: " + r.stdout,
    );
  });

  test("fixes_pr exemption is unaffected by the new rule", () => {
    // Same fixture as the fix-forward test above, but with a scope that is NOT
    // no-screen — so only fixes_pr can be suppressing the gate.
    const prompt = scopedPrompt(
      ["apps/web/src/components/SettingsShell.tsx"],
      "fixes_pr: 999999",
    );
    const r = runLint(prompt, {
      name: "dref-fixes-pr-still-exempt",
      env: { LINT_GH_BIN: "no-such-gh-binary-vs-s3-9876" },
    });
    assert.ok(
      !r.stdout.includes("UI_PROMPT_NEEDS_DESIGN_REF"),
      "fixes_pr exception must still suppress the gate; got: " + r.stdout,
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
