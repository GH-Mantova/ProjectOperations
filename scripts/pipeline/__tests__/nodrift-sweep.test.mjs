/**
 * Tests for the NO-DRIFT slice:
 *   - .githooks/pre-commit          (branch guard + the pre-existing doc stamper)
 *   - scripts/pipeline/sweep-breadcrumbs.ps1
 *
 * Runs with: node --test scripts/pipeline/__tests__/nodrift-sweep.test.mjs
 *
 * ---------------------------------------------------------------------------
 * WHY NOTHING HERE SKIPS
 *
 * ci.yml's `pipeline-tests-windows` job asserts `skipped == 0` on this very
 * glob, because a suite that silently skips is how arm-prompt.ps1 shipped a
 * PowerShell 5.1 parse bug behind a green CI. So every test in this file runs
 * on both Ubuntu and Windows. The hook is POSIX `sh`, which git supplies on
 * both platforms, so its behaviour is tested for real: a temp repo, a real
 * `git commit`, and an assertion on whether a commit object was created.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS *NOT* COVERED HERE, AND WHY
 *
 * `sweep-breadcrumbs.ps1` is NOT executed. It is PowerShell, and neither the
 * Ubuntu container this slice was authored in nor this suite has a pwsh to run
 * it in. Executing it would require the Windows+pwsh skip pattern that
 * `skipped == 0` forbids. So the sweep tests below are SOURCE-LEVEL: they
 * assert the safety invariants that would be catastrophic to lose in a later
 * edit (never `git add -A`, never stage an arming file, untracked-only, and
 * ASCII-clean for PowerShell 5.1). They are a regression guard, NOT a proof
 * that the script runs. Its runtime behaviour is unverified - see the PR body.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const HOOK_SRC = join(REPO_ROOT, ".githooks", "pre-commit");
const SWEEP = join(REPO_ROOT, "scripts", "pipeline", "sweep-breadcrumbs.ps1");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a temp repo whose core.hooksPath points at a copy of the REAL hook. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "nodrift-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

  git("init", "-b", "main");
  git("config", "user.email", "test@test.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");

  mkdirSync(join(dir, ".githooks"), { recursive: true });
  const hookDst = join(dir, ".githooks", "pre-commit");
  copyFileSync(HOOK_SRC, hookDst);
  chmodSync(hookDst, 0o755);

  writeFileSync(join(dir, "seed.txt"), "seed\n");
  git("add", "seed.txt", ".githooks/pre-commit");
  // --no-verify on the seed commit: the guard is not armed until hooksPath is set,
  // but being explicit keeps the seed independent of hook behaviour.
  git("commit", "--no-verify", "-m", "init");

  git("config", "core.hooksPath", ".githooks");
  return dir;
}

/** Attempt a commit. Returns { status, stderr, commits }. Never throws. */
function tryCommit(dir, message, extraArgs = []) {
  const before = countCommits(dir);
  const r = spawnSync("git", ["commit", "--allow-empty", ...extraArgs, "-m", message], {
    cwd: dir,
    encoding: "utf8",
  });
  const after = countCommits(dir);
  return { status: r.status, stderr: r.stderr || "", created: after - before };
}

function countCommits(dir) {
  const r = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: dir, encoding: "utf8" });
  return r.status === 0 ? Number(r.stdout.trim()) : 0;
}

function git(dir, ...args) {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

// ---------------------------------------------------------------------------
// The branch guard
// ---------------------------------------------------------------------------

describe(".githooks/pre-commit - NO-DRIFT branch guard", () => {
  test("is committed EXECUTABLE, or POSIX git ignores it entirely", () => {
    // Measured on this branch's first commit attempt: git printed
    //   "The '.githooks/pre-commit' hook was ignored because it's not set as executable"
    // and committed anyway. The file had been mode 100644 on origin/main all along,
    // so on Linux and macOS the stamper had never run and this guard would never
    // have run either. Windows hides the bug: Git for Windows ignores the mode bit.
    // The index mode is platform-independent, so this assertion is sound on both.
    const mode = execFileSync("git", ["ls-files", "-s", "--", ".githooks/pre-commit"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim().split(/\s+/)[0];
    assert.equal(mode, "100755", "a hook git will not execute is not a guard");
  });

  test("REFUSES a commit on main, and creates no commit", () => {
    const dir = makeRepo();
    try {
      const r = tryCommit(dir, "hook test");
      assert.notEqual(r.status, 0, "commit on main must be refused");
      assert.equal(r.created, 0, "no commit object may be created on main");
      assert.match(r.stderr, /NO-DRIFT/, "the refusal must name the rule so the agent can look it up");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("REFUSES a commit on master too", () => {
    const dir = makeRepo();
    try {
      git(dir, "branch", "-m", "main", "master");
      const r = tryCommit(dir, "hook test");
      assert.notEqual(r.status, 0);
      assert.equal(r.created, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ALLOWS a commit on a feature branch", () => {
    const dir = makeRepo();
    try {
      git(dir, "switch", "-c", "tmp/hook-test");
      const r = tryCommit(dir, "hook test");
      assert.equal(r.status, 0, `commit on a branch must succeed; stderr: ${r.stderr}`);
      assert.equal(r.created, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ALLOWS a commit on a detached HEAD (it is not main)", () => {
    const dir = makeRepo();
    try {
      git(dir, "checkout", "--detach");
      const r = tryCommit(dir, "detached");
      assert.equal(r.status, 0, `detached HEAD must not be refused; stderr: ${r.stderr}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--no-verify remains the human escape hatch on main", () => {
    const dir = makeRepo();
    try {
      const r = tryCommit(dir, "escape", ["--no-verify"]);
      assert.equal(r.status, 0, `--no-verify must still work; stderr: ${r.stderr}`);
      assert.equal(r.created, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the guard runs BEFORE the doc stamper, so a refused commit rewrites nothing", () => {
    // The stamper rewrites progress.md and re-stages it. If the guard ran after it,
    // a refused commit would still have mutated the working tree - a silent edit
    // nobody asked for, on the branch the agent was told not to touch.
    const dir = makeRepo();
    try {
      const original = "# Progress\n\nLast updated: NEVER\n";
      writeFileSync(join(dir, "progress.md"), original);
      git(dir, "add", "progress.md");
      const r = tryCommit(dir, "stamp test");
      assert.notEqual(r.status, 0, "still on main, so still refused");
      assert.equal(
        readFileSync(join(dir, "progress.md"), "utf8"),
        original,
        "a refused commit must leave progress.md byte-identical"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the pre-existing doc stamper still runs on a branch (guard did not replace it)", () => {
    // Regression guard: the slice inserts the branch guard into the EXISTING hook.
    // Overwriting the file would destroy the stamper silently.
    const dir = makeRepo();
    try {
      git(dir, "switch", "-c", "docs/stamp");
      writeFileSync(join(dir, "progress.md"), "# Progress\n\nLast updated: NEVER\n");
      git(dir, "add", "progress.md");
      const r = tryCommit(dir, "stamp test");
      assert.equal(r.status, 0, `commit on a branch must succeed; stderr: ${r.stderr}`);
      const after = readFileSync(join(dir, "progress.md"), "utf8");
      assert.doesNotMatch(after, /Last updated: NEVER/, "the stamper must have replaced the placeholder");
      assert.match(after, /^Last updated: .+$/m, "a Last updated line must remain");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// sweep-breadcrumbs.ps1 - SOURCE LEVEL ONLY (see the header note)
// ---------------------------------------------------------------------------

describe("sweep-breadcrumbs.ps1 - source level (runtime NOT covered)", () => {
  const src = () => readFileSync(SWEEP, "utf8");

  /**
   * The script's own comments quote the things it refuses to do ("It never uses
   * `git add -A`"), so a naive grep over the whole file matches its own prose.
   * Strip the comment-based help block and every `#` comment line first, and the
   * remaining text is the code that actually runs.
   */
  const code = () =>
    src()
      .replace(/<#[\s\S]*?#>/g, "")
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");

  test("is ASCII-only with no BOM, so PowerShell 5.1 can parse it", () => {
    // arm-prompt.ps1 shipped unparseable under Windows PowerShell 5.1 because
    // BOM-less UTF-8 em dashes were decoded as Windows-1252. ASCII-only sidesteps
    // the whole class without depending on a BOM surviving an editor round-trip.
    const bytes = readFileSync(SWEEP);
    const offenders = [];
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] > 0x7f) offenders.push(i);
    }
    assert.equal(offenders.length, 0, `non-ASCII byte(s) at offset(s) ${offenders.slice(0, 5).join(", ")}`);
  });

  test("never uses `git add -A` in executable code", () => {
    const c = code();
    assert.doesNotMatch(c, /git\s+add\s+-A\b/, "-A stages the whole tree, including things nobody swept");
    assert.doesNotMatch(c, /"add",\s*"-A"/, "-A must not reach the git argument array either");
    // Positive control: the explicit form IS present, so this test cannot pass
    // by the code having no `git add` at all.
    assert.match(c, /"add",\s*"--"/, "staging must go through the explicit `add --  <paths>` form");
  });

  test("stages untracked paths only, which is why a deletion cannot enter the commit", () => {
    const s = src();
    assert.match(s, /--others/, "must enumerate with git ls-files --others");
    assert.match(s, /--exclude-standard/, "must honour .gitignore");
  });

  test("refuses -ready.md and -HOLD.md by name", () => {
    const s = src();
    assert.match(s, /\*-ready\.md/, "arming files are never swept");
    assert.match(s, /\*-HOLD\.md/, "HOLD staging is Station 00's call, not a sweep's");
  });

  test("asserts no deletion is staged before it commits", () => {
    const s = src();
    assert.match(s, /--name-status/, "must read the staged name-status to see deletions");
    assert.match(s, /deletions/, "must track deletions explicitly");
  });

  test("-WhatIf exits before any branch is created", () => {
    const s = src();
    const whatIfExit = s.indexOf('if ($WhatIf)');
    const branchCreate = s.indexOf('"switch", "-c"');
    assert.ok(whatIfExit > 0, "must have a -WhatIf early exit");
    assert.ok(branchCreate > 0, "must create a branch somewhere");
    assert.ok(
      whatIfExit < branchCreate,
      "-WhatIf must return before the branch is created, or it would not be a dry run"
    );
  });

  test("an empty sweep is exit 0, not a failure", () => {
    const s = src();
    const idx = s.indexOf("nothing to sweep");
    assert.ok(idx > 0, "must say when there is nothing to sweep");
    assert.match(s.slice(idx, idx + 200), /exit 0/, "an empty sweep is a no-op success");
  });
});
