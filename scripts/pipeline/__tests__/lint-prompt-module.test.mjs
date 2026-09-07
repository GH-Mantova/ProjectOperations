/**
 * Tests for MODULE_PROVENANCE_S1: every prompt should say which module it belongs to,
 * and 72% can already answer without being asked.
 *
 * WHY THIS EXISTS. [MEASURED 2026-09-01, origin/main b30e166a] across the last 40 merged PRs
 * there are 24 distinct conventional-commit scopes and SIX of them mean "crm". The scope is
 * invented by the build agent at `gh pr create` time; nothing derives it, nothing checks it, and
 * the arming log cannot supply it either (every entry reads `by=Marco@`). `deriveModule` reads
 * the answer out of the prompt's own `scope` list, and the `module:` front-matter key overrides
 * it when the scope genuinely spans two modules.
 *
 * Two halves are load-bearing and each has its own describe block:
 *
 *   THE DERIVATION must not invent module names. `apps/web/src/**` has to resolve to null, NOT
 *   to a module called `**` — that bug was produced by the first measurement pass and is how it
 *   would have shipped: a glob rendered as a conventional-commit scope.
 *
 *   THE RATCHET must not break staged work. 30 of the 107 tracked prompts cannot self-resolve.
 *   Hard-failing them would reject them at ARM time — burning an arm each, with a human present
 *   expecting a build. A baselined prompt WARNS and still admits; a new one is rejected.
 *
 * Runs with: node --test scripts/pipeline/__tests__/*.mjs   (ci.yml runs the same command)
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import {
  deriveModule,
  resolveScopePathToModule,
  moduleVocabulary,
  promptSlug,
} from "../lint-prompt.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const LINT = join(HERE, "..", "lint-prompt.mjs");
const REAL_BASELINE = join(HERE, "..", "module-baseline.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Drive the full CLI via spawnSync, same pattern as lint-prompt.design-ref.test.mjs.
 * `baseline` (an array of entries) is written to a temp file and pinned with
 * LINT_MODULE_BASELINE so a test never depends on the shipped baseline's contents.
 */
function runLint(fileText, opts) {
  opts = opts || {};
  const isoDir = mkdtempSync(join(tmpdir(), "lint-module-"));
  const suffix = opts.hold ? "-HOLD.md" : "-ready.md";
  const file = join(isoDir, (opts.name || "pr-test-module") + suffix);
  writeFileSync(file, fileText, "utf8");

  const env = Object.assign({}, process.env, opts.env || {});
  if (opts.baseline !== undefined) {
    if (opts.baseline === null) {
      // Point at a path that does not exist — exercises the fail-safe read.
      env.LINT_MODULE_BASELINE = join(isoDir, "no-such-baseline.json");
    } else {
      const bl = join(isoDir, "baseline.json");
      writeFileSync(bl, JSON.stringify({ _readme: "test", entries: opts.baseline }), "utf8");
      env.LINT_MODULE_BASELINE = bl;
    }
  }

  const res = spawnSync("node", [LINT, file], { cwd: REPO_ROOT, encoding: "utf8", env });
  const code = res.status != null ? res.status : 1;
  const stdout = String(res.stdout || "");
  rmSync(isoDir, { recursive: true, force: true });
  return { code, stdout };
}

const GOOD_BODY =
  "# Test prompt\n\n" +
  "## STANDING AUTHORITY\n\n" +
  "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

/** A prompt with an arbitrary scope list and optional extra front-matter lines. */
function prompt(scopeLines, extraFm, body) {
  return (
    "---\n" +
    "premise: 'true'\n" +
    "premise_means: always-true sentinel\n" +
    "scope:\n" + scopeLines.map((s) => "  - " + s + "\n").join("") +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: none\n" +
    (extraFm ? extraFm + "\n" : "") +
    "---\n\n" +
    (body === undefined ? GOOD_BODY : body)
  );
}

// ---------------------------------------------------------------------------
// deriveModule — the pure function
// ---------------------------------------------------------------------------

describe("deriveModule — path resolution", () => {
  test("POSITIVE CONTROL: a scope of only apps/api/src/modules/crm/** derives crm", () => {
    const r = deriveModule(["apps/api/src/modules/crm/**"]);
    assert.strictEqual(r.module, "crm");
    assert.strictEqual(r.source, "derived");
    assert.deepStrictEqual(r.candidates, ["crm"]);
  });

  test("NEGATIVE CONTROL: a scope of only apps/web/src/** derives null, NOT '**'", () => {
    const r = deriveModule(["apps/web/src/**"]);
    assert.strictEqual(r.module, null, "a glob segment must never become a module name");
    assert.strictEqual(r.source, "unresolvable");
    assert.deepStrictEqual(r.candidates, []);
    assert.ok(!JSON.stringify(r).includes("**"), "'**' must not appear anywhere in the result");
  });

  test("a wildcard directly under a module root resolves to null, not to the glob", () => {
    assert.strictEqual(resolveScopePathToModule("apps/api/src/modules/**"), null);
    assert.strictEqual(resolveScopePathToModule("apps/web/src/pages/*/index.tsx"), null);
  });

  test("a FILE under a module root is not a module — pages/AdminSettingsPage.tsx is null", () => {
    // Same defect class as '**': the vocabulary is the DIRECTORY names under the two roots.
    // Admitting a file name invents a module called "AdminSettingsPage.tsx".
    assert.strictEqual(resolveScopePathToModule("apps/web/src/pages/AdminSettingsPage.tsx"), null);
    assert.strictEqual(resolveScopePathToModule("apps/web/src/pages/crm/List.tsx"), "crm");
  });

  test("web pages resolve the same way as api modules", () => {
    assert.strictEqual(resolveScopePathToModule("apps/web/src/pages/jobs/JobsList.tsx"), "jobs");
  });

  test("first match wins: the specific prefix beats the general one", () => {
    assert.strictEqual(resolveScopePathToModule("scripts/pr-watcher/watch.ps1"), "watcher");
    assert.strictEqual(resolveScopePathToModule("scripts/pipeline/lint-prompt.mjs"), "pipeline");
    assert.strictEqual(resolveScopePathToModule("docs/pr-prompts/pr-x-HOLD.md"), "board");
    assert.strictEqual(resolveScopePathToModule("docs/plans/whatever.md"), "docs");
    assert.strictEqual(resolveScopePathToModule("apps/api/prisma/schema.prisma"), "prisma");
    assert.strictEqual(resolveScopePathToModule(".github/workflows/ci.yml"), "ci");
    assert.strictEqual(resolveScopePathToModule("tests/e2e/smoke.spec.ts"), "e2e");
    assert.strictEqual(resolveScopePathToModule("sot/README.md"), "sot");
  });

  test("an unrecognised path resolves to null", () => {
    assert.strictEqual(resolveScopePathToModule("packages/shared/index.ts"), null);
    assert.strictEqual(resolveScopePathToModule(""), null);
    assert.strictEqual(resolveScopePathToModule(undefined), null);
  });

  test("backslashes and leading ./ are normalised before matching", () => {
    assert.strictEqual(resolveScopePathToModule("apps\\api\\src\\modules\\rates\\rates.service.ts"), "rates");
    assert.strictEqual(resolveScopePathToModule("./apps/api/src/modules/rates/**"), "rates");
  });
});

describe("deriveModule — ranking and ambiguity", () => {
  test("THE WHOLE INSIGHT: incidental paths are ranked out, not counted", () => {
    // Nearly every feature slice touches prisma and its own docs. Without demoting them, this
    // resolves to three candidates and needs the author. With them demoted it resolves to `crm`.
    const r = deriveModule([
      "apps/api/src/modules/crm/crm.service.ts",
      "apps/api/prisma/schema.prisma",
      "docs/plans/crm-plan.md",
    ]);
    assert.strictEqual(r.module, "crm");
    assert.strictEqual(r.source, "derived");
  });

  test("two product modules is genuinely ambiguous — the machine must not pick", () => {
    const r = deriveModule([
      "apps/api/src/modules/procurement/**",
      "apps/api/src/modules/projects/**",
    ]);
    assert.strictEqual(r.module, null);
    assert.strictEqual(r.source, "ambiguous");
    assert.deepStrictEqual(r.candidates, ["procurement", "projects"]);
  });

  test("a sole incidental IS the module — a genuinely docs-only prompt", () => {
    const r = deriveModule(["docs/plans/a.md", "docs/plans/b.md"]);
    assert.strictEqual(r.module, "docs");
    assert.strictEqual(r.source, "incidental");
  });

  test("several incidentals rank deterministically, whatever order they were typed in", () => {
    const a = deriveModule(["apps/api/prisma/schema.prisma", "docs/x.md"]);
    const b = deriveModule(["docs/x.md", "apps/api/prisma/schema.prisma"]);
    assert.strictEqual(a.module, "prisma");
    assert.strictEqual(b.module, "prisma", "rank is a fixed list, not scope order");
  });

  test("pipeline and watcher are PRODUCT destinations, not incidentals", () => {
    // A scripts-only prompt must resolve to `pipeline` rather than being demoted and losing to
    // its own docs entry.
    const r = deriveModule(["scripts/pipeline/lint-prompt.mjs", "docs/pr-prompts/PROMPT-SCHEMA.md"]);
    assert.strictEqual(r.module, "pipeline");
    assert.strictEqual(r.source, "derived");
  });

  test("duplicates collapse — the same module named twice is still one module", () => {
    const r = deriveModule(["apps/api/src/modules/rates/a.ts", "apps/api/src/modules/rates/b.ts"]);
    assert.strictEqual(r.module, "rates");
    assert.deepStrictEqual(r.candidates, ["rates"]);
  });

  test("a bare string scope (not a list) is accepted", () => {
    assert.strictEqual(deriveModule("apps/api/src/modules/crm/**").module, "crm");
  });

  test("an empty scope is unresolvable, not a crash", () => {
    assert.strictEqual(deriveModule([]).source, "unresolvable");
  });
});

describe("moduleVocabulary — DERIVED from the repo, never hand-listed", () => {
  test("reads real directory names off disk", () => {
    const v = moduleVocabulary(REPO_ROOT);
    assert.ok(v.has("crm"), "crm is a directory under apps/api/src/modules/");
    assert.ok(v.has("rates"));
    assert.ok(v.size > 50, "a hand-list would go stale; this should be the whole tree");
  });

  test("the pipeline destinations are in the vocabulary too", () => {
    const v = moduleVocabulary(REPO_ROOT);
    for (const m of ["prisma", "docs", "board", "ci", "e2e", "sot", "pipeline", "watcher"]) {
      assert.ok(v.has(m), m + " must be a legal module value");
    }
  });

  test("does not admit file names or globs from the pages root", () => {
    const v = moduleVocabulary(REPO_ROOT);
    assert.ok(!v.has("AdminSettingsPage.tsx"), "files under pages/ are not modules");
    assert.ok(!v.has("**"));
  });

  test("FAIL-SAFE: an unreadable repo root yields the pipeline destinations, not a throw", () => {
    const v = moduleVocabulary(join(tmpdir(), "definitely-not-a-repo-" + Date.now()));
    assert.ok(v.has("pipeline"), "must not throw and must not come back empty");
  });
});

describe("promptSlug — the baseline key survives arming", () => {
  test("HOLD and ready forms of one prompt share a key", () => {
    // arm-prompt.ps1 renames <slug>-HOLD.md to <slug>-ready.md. A baseline keyed by the HOLD
    // filename would stop matching at the exact moment of arming — turning an ADMIT into a
    // REJECT during the arm it exists to protect.
    assert.strictEqual(promptSlug("pr-foo-HOLD.md"), "pr-foo");
    assert.strictEqual(promptSlug("pr-foo-ready.md"), "pr-foo");
    assert.strictEqual(promptSlug("pr-foo"), "pr-foo");
  });

  test("does not eat a slug that merely ends in the word", () => {
    assert.strictEqual(promptSlug("pr-already-HOLD.md"), "pr-already");
    assert.strictEqual(promptSlug("pr-on-hold-HOLD.md"), "pr-on-hold");
  });
});

// ---------------------------------------------------------------------------
// End-to-end through the CLI
// ---------------------------------------------------------------------------

describe("lint — derivation admits without the author", () => {
  test("unambiguous scope admits with no module: key at all", () => {
    const r = runLint(prompt(["apps/api/src/modules/crm/**"]), { baseline: [] });
    assert.strictEqual(r.code, 0, r.stdout);
    assert.ok(r.stdout.includes("ADMIT"), r.stdout);
    assert.ok(!r.stdout.includes("MODULE_AMBIGUOUS"), r.stdout);
  });

  test("a scripts-only prompt admits (resolves to pipeline)", () => {
    const r = runLint(prompt(["scripts/pipeline/**"]), { baseline: [] });
    assert.strictEqual(r.code, 0, r.stdout);
  });

  test("a prisma+docs prompt admits on the incidental rank", () => {
    const r = runLint(
      prompt(["apps/api/prisma/schema.prisma", "docs/plans/x.md"], "escalates: false"),
      { baseline: [] },
    );
    assert.strictEqual(r.code, 0, r.stdout);
  });
});

describe("lint — MODULE_AMBIGUOUS and THE RATCHET", () => {
  const AMBIGUOUS = ["apps/api/src/modules/rates/**", "apps/api/src/modules/estimates/**"];

  test("RATCHET CONTROL A: a NEW ambiguous prompt is REJECTED", () => {
    const r = runLint(prompt(AMBIGUOUS), { name: "pr-brand-new-slice", baseline: [] });
    assert.strictEqual(r.code, 1, "should exit 1 (REJECT); got: " + r.stdout);
    assert.ok(r.stdout.includes("MODULE_AMBIGUOUS"), r.stdout);
    assert.ok(r.stdout.includes("rates"), "must list the candidates so the author can paste one in");
    assert.ok(r.stdout.includes("estimates"), r.stdout);
  });

  test("RATCHET CONTROL B: a BASELINED ambiguous prompt ADMITS with a warning", () => {
    const r = runLint(prompt(AMBIGUOUS), {
      name: "pr-already-staged",
      baseline: [{ prompt: "pr-already-staged", reason: "ambiguous: rates, estimates" }],
    });
    assert.strictEqual(r.code, 0, "should exit 0 (ADMIT); got: " + r.stdout);
    assert.ok(r.stdout.includes("ADMIT"), r.stdout);
    assert.ok(r.stdout.includes("MODULE_AMBIGUOUS (baselined)"), r.stdout);
  });

  test("the warning prints AFTER the verdict line, never before it", () => {
    // Station scripts and the queue sweep read the FIRST line to learn the verdict
    // (`lint-prompt.mjs "$f" | head -1`). A warning above it would change what every one of
    // them sees for a prompt whose verdict did not change.
    const r = runLint(prompt(AMBIGUOUS), {
      name: "pr-already-staged",
      baseline: [{ prompt: "pr-already-staged", reason: "x" }],
    });
    const first = r.stdout.split("\n")[0];
    assert.ok(first.includes("ADMIT"), "first line must be the verdict; got: " + first);
    assert.ok(!first.includes("MODULE_AMBIGUOUS"), "got: " + first);
  });

  test("a baseline entry written as a bare string works too", () => {
    const r = runLint(prompt(AMBIGUOUS), { name: "pr-str-entry", baseline: ["pr-str-entry"] });
    assert.strictEqual(r.code, 0, r.stdout);
  });

  test("THE ARMING CASE: a HOLD baselined by slug still admits once renamed to -ready", () => {
    const bl = [{ prompt: "pr-arming-case", reason: "ambiguous" }];
    const asHold = runLint(prompt(AMBIGUOUS), { name: "pr-arming-case", hold: true, baseline: bl });
    const asReady = runLint(prompt(AMBIGUOUS), { name: "pr-arming-case", baseline: bl });
    assert.strictEqual(asHold.code, 0, "HOLD form: " + asHold.stdout);
    assert.strictEqual(asReady.code, 0, "armed form must not flip to REJECT: " + asReady.stdout);
  });

  test("a baseline entry for a DIFFERENT prompt does not shelter this one", () => {
    const r = runLint(prompt(AMBIGUOUS), {
      name: "pr-not-me",
      baseline: [{ prompt: "pr-someone-else", reason: "x" }],
    });
    assert.strictEqual(r.code, 1, "the ratchet must be per-prompt; got: " + r.stdout);
    assert.ok(r.stdout.includes("MODULE_AMBIGUOUS"), r.stdout);
  });

  test("an UNRESOLVABLE scope is ambiguous too, and is rejected when not baselined", () => {
    const r = runLint(prompt(["apps/web/src/**"], "design_ref: https://claude.ai/code/artifact/abc"), {
      name: "pr-unresolvable", baseline: [],
    });
    assert.strictEqual(r.code, 1, r.stdout);
    assert.ok(r.stdout.includes("MODULE_AMBIGUOUS"), r.stdout);
  });

  test("FAIL-SAFE: an unreadable baseline warns and admits rather than binning the queue", () => {
    const r = runLint(prompt(AMBIGUOUS), { name: "pr-no-baseline-file", baseline: null });
    assert.strictEqual(r.code, 0, "a missing baseline must not reject everything; got: " + r.stdout);
    assert.ok(r.stdout.includes("could not be read"), r.stdout);
  });
});

describe("lint — module: overrides the derivation", () => {
  test("a declared module admits an otherwise ambiguous prompt with NO baseline entry", () => {
    const r = runLint(
      prompt(["apps/api/src/modules/rates/**", "apps/api/src/modules/estimates/**"], "module: rates"),
      { name: "pr-declared", baseline: [] },
    );
    assert.strictEqual(r.code, 0, r.stdout);
    assert.ok(r.stdout.includes("ADMIT"), r.stdout);
  });

  test("a declared module that AGREES with a confident derivation admits", () => {
    const r = runLint(prompt(["apps/api/src/modules/crm/**"], "module: crm"), { baseline: [] });
    assert.strictEqual(r.code, 0, r.stdout);
  });

  test("MODULE_MISMATCH: a declared module contradicting a confident derivation is REJECTED", () => {
    const r = runLint(prompt(["apps/api/src/modules/crm/**"], "module: rates"), { baseline: [] });
    assert.strictEqual(r.code, 1, r.stdout);
    assert.ok(r.stdout.includes("MODULE_MISMATCH"), r.stdout);
    assert.ok(r.stdout.includes("crm") && r.stdout.includes("rates"), "must name BOTH: " + r.stdout);
  });

  test("MODULE_UNKNOWN: a module outside the derived vocabulary is REJECTED", () => {
    const r = runLint(
      prompt(["apps/api/src/modules/rates/**", "apps/api/src/modules/estimates/**"], "module: crmm"),
      { baseline: [] },
    );
    assert.strictEqual(r.code, 1, r.stdout);
    assert.ok(r.stdout.includes("MODULE_UNKNOWN"), r.stdout);
  });

  test("a module this slice CREATES is legal when its directory is named in scope", () => {
    // The gate must not fail closed on the new work it exists to label.
    const r = runLint(
      prompt(["apps/api/src/modules/brand-new-module/**"], "module: brand-new-module"),
      { baseline: [] },
    );
    assert.strictEqual(r.code, 0, r.stdout);
  });

  test("MODULE_INVALID: a value with a slash or a glob is REJECTED", () => {
    const r = runLint(prompt(["apps/api/src/modules/crm/**"], "module: apps/api/src/modules/crm"), { baseline: [] });
    assert.strictEqual(r.code, 1, r.stdout);
    assert.ok(r.stdout.includes("MODULE_INVALID"), r.stdout);
  });
});

describe("lint — MODULE_KEY_TYPO closes the silent-drop hole", () => {
  test("`moduel:` is REJECTED rather than silently dropped", () => {
    // parseFrontMatter ignores keys it does not know. Without this check the author's line
    // vanishes and the prompt falls through to MODULE_AMBIGUOUS (or, worse, to a derivation
    // that happens to succeed) with no word about the line they actually wrote.
    const r = runLint(prompt(["apps/api/src/modules/crm/**"], "moduel: crm"), { baseline: [] });
    assert.strictEqual(r.code, 1, r.stdout);
    assert.ok(r.stdout.includes("MODULE_KEY_TYPO"), r.stdout);
  });

  test("`modules:` (plural) is caught too", () => {
    const r = runLint(prompt(["apps/api/src/modules/crm/**"], "modules: crm"), { baseline: [] });
    assert.strictEqual(r.code, 1, r.stdout);
    assert.ok(r.stdout.includes("MODULE_KEY_TYPO"), r.stdout);
  });

  test("the correctly spelled key does NOT trip the typo check", () => {
    const r = runLint(prompt(["apps/api/src/modules/crm/**"], "module: crm"), { baseline: [] });
    assert.strictEqual(r.code, 0, r.stdout);
  });

  test("unrelated known keys do NOT trip it", () => {
    const r = runLint(
      prompt(["apps/api/src/modules/crm/**"], "seed_only: false\nescalates: false\ncluster: crm-chain\ncluster_order: 1"),
      { baseline: [] },
    );
    assert.ok(!r.stdout.includes("MODULE_KEY_TYPO"), r.stdout);
  });
});

describe("lint — the new check must not shift any existing verdict", () => {
  test("STALE still beats MODULE_AMBIGUOUS", () => {
    // "The work is already done, BIN IT" is strictly better information than "your front matter
    // is missing a field". The module check is placed after the premise for exactly this.
    const text =
      "---\n" +
      "premise: 'false'\n" +
      "premise_means: this work is already on main\n" +
      "scope:\n  - apps/api/src/modules/rates/**\n  - apps/api/src/modules/estimates/**\n" +
      "done_when: pnpm build\nsize: 3\ngate_allow: none\n---\n\n" + GOOD_BODY;
    const r = runLint(text, { name: "pr-stale-and-ambiguous", baseline: [] });
    assert.strictEqual(r.code, 3, "should exit 3 (STALE); got: " + r.stdout);
    assert.ok(r.stdout.includes("STALE"), r.stdout);
    assert.ok(!r.stdout.includes("MODULE_AMBIGUOUS"), r.stdout);
  });

  test("MISSING_STANDING_AUTHORITY still wins over MODULE_AMBIGUOUS", () => {
    // Every pre-existing rejection code must survive unchanged — other stations parse them.
    const r = runLint(
      prompt(["apps/api/src/modules/rates/**", "apps/api/src/modules/estimates/**"], null, "# body with no grant\n"),
      { name: "pr-no-authority", baseline: [] },
    );
    assert.strictEqual(r.code, 1, r.stdout);
    assert.ok(r.stdout.includes("MISSING_STANDING_AUTHORITY"), r.stdout);
    assert.ok(!r.stdout.includes("MODULE_AMBIGUOUS"), r.stdout);
  });

  test("MISSING_FIELD still wins — a prompt with no scope at all", () => {
    const text =
      "---\npremise: 'true'\npremise_means: x\ndone_when: pnpm build\nsize: 3\ngate_allow: none\n---\n\n" + GOOD_BODY;
    const r = runLint(text, { baseline: [] });
    assert.strictEqual(r.code, 1, r.stdout);
    assert.ok(r.stdout.includes("MISSING_FIELD"), r.stdout);
  });
});

// ---------------------------------------------------------------------------
// The shipped baseline itself
// ---------------------------------------------------------------------------

describe("module-baseline.json — the shipped ratchet", () => {
  const bl = JSON.parse(readFileSync(REAL_BASELINE, "utf8"));

  test("has the same shape as docs/qa/sot-refs-baseline.json", () => {
    assert.ok(typeof bl._readme === "string" && bl._readme.length > 0);
    assert.ok(Array.isArray(bl.entries));
  });

  test("says it is a ratchet, that entries may only be removed, and what to do instead", () => {
    assert.ok(/only SHRINK/i.test(bl._readme), "must state the direction");
    assert.ok(/never ADDED/i.test(bl._readme));
    assert.ok(/module:/.test(bl._readme), "must name the remedy for a new prompt");
  });

  test("every entry is a slug, not a filename — arming renames the file", () => {
    for (const e of bl.entries) {
      assert.ok(typeof e.prompt === "string" && e.prompt.length > 0, JSON.stringify(e));
      assert.ok(!/\.md$/i.test(e.prompt), "entry must not carry .md: " + e.prompt);
      assert.ok(!/-(HOLD|ready)$/i.test(e.prompt), "entry must not carry a queue suffix: " + e.prompt);
      assert.strictEqual(promptSlug(e.prompt), e.prompt);
    }
  });

  test("no duplicate entries", () => {
    const seen = new Set(bl.entries.map((e) => e.prompt));
    assert.strictEqual(seen.size, bl.entries.length);
  });

  test("every entry carries a reason a burn-down can act on", () => {
    for (const e of bl.entries) {
      assert.ok(typeof e.reason === "string" && e.reason.length > 0, JSON.stringify(e));
    }
  });
});
