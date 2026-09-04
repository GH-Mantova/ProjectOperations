/**
 * Tests for check-armed-tracked.mjs
 *
 * Each fixture is a self-contained tmpdir git repo. We run `git init`, commit
 * whatever needs to be "on origin/main" (faked with `git update-ref
 * refs/remotes/origin/main HEAD`), then write the working-tree state under
 * test and invoke the checker with --root pointing at the fixture.
 *
 * Polarity under test:
 *   exit 0 = every top-level *-ready.md is tracked OR has a HOLD twin on origin/main
 *   exit 1 = at least one is untracked AND has no HOLD twin
 *
 * The positive control (test 1) is the one that matters: a checker that
 * cannot fail is the thing this PR is replacing. If test 1 stops failing on
 * bad input, the checker has regressed into decoration.
 *
 * Run with:
 *   node --test "scripts/pipeline/__tests__/check-armed-tracked.test.mjs"
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CHECKER = join(__dirname, "..", "check-armed-tracked.mjs");

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "armed-tracked-test-"));
  mkdirSync(join(root, "docs", "pr-prompts"), { recursive: true });
  return {
    root,
    cleanup() {
      try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

function git(root, args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(
      "git " + args.join(" ") + " failed (status " + r.status + "):\n" +
        (r.stdout || "") + (r.stderr || ""),
    );
  }
  return r;
}

// Init a git repo, make one commit, and point refs/remotes/origin/main at it.
// Optionally seed the initial commit with files from `seedFiles`
// ({ "relative/path.md": "contents" }). Any subsequent working-tree edits go
// UNTRACKED unless the caller adds and commits them explicitly.
function initRepoWithSeed(root, seedFiles = {}) {
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  git(root, ["config", "user.name", "test"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  // Ensure at least one file so the initial commit is non-empty (portable
  // across git versions that reject empty root commits without --allow-empty).
  const seedEntries = Object.entries(seedFiles);
  if (seedEntries.length === 0) {
    writeFileSync(join(root, ".seed"), "seed\n");
    git(root, ["add", ".seed"]);
  } else {
    for (const [rel, contents] of seedEntries) {
      const abs = join(root, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, contents);
      git(root, ["add", "--", rel]);
    }
  }
  git(root, ["commit", "-q", "-m", "seed"]);
  // Fake origin/main by pointing the remote-tracking ref at our commit.
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function run(root) {
  const result = spawnSync(
    process.execPath,
    [CHECKER, "--root", root],
    { encoding: "utf8", timeout: 15000 },
  );
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

// ---------------------------------------------------------------------------
// 1. POSITIVE CONTROL — the one that matters.
//    An untracked *-ready.md with no HOLD twin must FAIL. A checker that
//    cannot fail is the thing this PR is replacing.
// ---------------------------------------------------------------------------
test("positive control: untracked -ready.md with no HOLD twin FAILS", () => {
  const { root, cleanup } = createFixture();
  try {
    initRepoWithSeed(root);
    // Write a *-ready.md into the working tree WITHOUT adding it to the index.
    // In the real repo .gitignore would swallow it; here we simulate the same
    // observable state (present on disk, absent from the index).
    writeFileSync(
      join(root, "docs", "pr-prompts", "pr-fixture-ready.md"),
      "# fixture prompt\n",
    );

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.notEqual(status, 0, "exit must be non-zero when a swallowed prompt is present; got:\n" + combined);
    assert.ok(
      combined.includes("pr-fixture-ready.md"),
      "output must name the offending file; got:\n" + combined,
    );
    assert.ok(
      combined.includes("FAIL") || combined.includes("SWALLOWED"),
      "output must contain FAIL or SWALLOWED; got:\n" + combined,
    );
    // The fix guidance must appear — a red light without a next step invites
    // people to disable the check.
    assert.ok(
      combined.includes("HOLD") && combined.includes("git mv"),
      "output must point at the fix (commit as -HOLD.md, arm via git mv); got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 2. Arming-by-rename mid-flight passes.
//    Untracked pr-foo-ready.md WITH pr-foo-HOLD.md on origin/main is the
//    legitimate transient state during `git mv`.
// ---------------------------------------------------------------------------
test("arming-by-rename: untracked -ready.md with HOLD twin on origin/main PASSES", () => {
  const { root, cleanup } = createFixture();
  try {
    initRepoWithSeed(root, {
      "docs/pr-prompts/pr-foo-HOLD.md": "# held\n",
    });
    writeFileSync(
      join(root, "docs", "pr-prompts", "pr-foo-ready.md"),
      "# armed\n",
    );

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.equal(status, 0, "exit must be 0 when HOLD twin is on origin/main; got:\n" + combined);
    assert.ok(
      combined.includes("PASS") && combined.includes("pr-foo-ready.md"),
      "output must mark the ready file as PASS; got:\n" + combined,
    );
    assert.ok(
      combined.includes("HOLD twin") || combined.includes("arming-by-rename"),
      "output must explain WHY it passed; got:\n" + combined,
    );
    assert.ok(
      combined.includes("swallowed=0"),
      "output must report swallowed=0; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 3. Tracked -ready.md passes.
//    The 8 top-level -ready.md files on origin/main (and any future ones)
//    must not trip this checker.
// ---------------------------------------------------------------------------
test("tracked: a committed -ready.md PASSES even though .gitignore would ignore it", () => {
  const { root, cleanup } = createFixture();
  try {
    initRepoWithSeed(root, {
      "docs/pr-prompts/pr-tracked-ready.md": "# tracked\n",
    });
    // Do NOT modify the working tree — the seeded commit already put the file
    // in the index and on disk.

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.equal(status, 0, "exit must be 0 for a tracked -ready.md; got:\n" + combined);
    assert.ok(
      combined.includes("PASS") && combined.includes("pr-tracked-ready.md"),
      "output must mark the tracked ready file as PASS; got:\n" + combined,
    );
    assert.ok(
      combined.includes("(tracked)"),
      "output must state the reason 'tracked'; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 4. Empty case passes.
//    Zero *-ready.md files at the top level is a pass, not a crash — this is
//    the normal state in a fresh CI checkout.
// ---------------------------------------------------------------------------
test("empty: zero top-level -ready.md files PASSES cleanly (the quiet CI state)", () => {
  const { root, cleanup } = createFixture();
  try {
    initRepoWithSeed(root);
    // docs/pr-prompts/ exists (createFixture made it) but is empty.

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.equal(status, 0, "exit must be 0 when no ready files exist; got:\n" + combined);
    assert.ok(
      combined.includes("0 top-level") && combined.includes("*-ready.md"),
      "output must announce zero files found; got:\n" + combined,
    );
    assert.ok(
      combined.includes("swallowed=0"),
      "output must report swallowed=0; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});
