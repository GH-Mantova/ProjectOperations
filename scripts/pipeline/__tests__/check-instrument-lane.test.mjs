/**
 * Tests for check-instrument-lane.mjs (INSTRUMENT_LANE_V1).
 *
 * Run with:
 *   node --test "scripts/pipeline/__tests__/check-instrument-lane.test.mjs"
 *
 * Tests:
 *   1. Change only status-sweep.ps1 and a test file -> IN_LANE.
 *   2. Also change pipeline-lib.ps1 -> OUT_OF_LANE, naming it.
 *   3. Change instrument-lane.json (even just adding an entry) -> OUT_OF_LANE.
 *   4. Delete an in-lane file -> still checked (IN_LANE).
 *      Rename to an out-of-lane path -> OUT_OF_LANE.
 *   5. Empty diff -> OUT_OF_LANE (nothing proven).
 *   6. Unreadable range -> exit 2, never IN_LANE.
 *   7. Negative control: a change under apps/ alone -> OUT_OF_LANE.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { classifyPath, runControls, computeVerdict } from "../check-instrument-lane.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CHECKER = join(__dirname, "..", "check-instrument-lane.mjs");
const ALLOWLIST_SRC = join(__dirname, "..", "instrument-lane.json");

// ---------------------------------------------------------------------------
// Minimal allowlist for tests
// ---------------------------------------------------------------------------

const TEST_ALLOWLIST = {
  files: [
    "scripts/pipeline/status-sweep.ps1",
    "scripts/pipeline/check-breadcrumb.mjs",
    "scripts/pipeline/lint-prompt.mjs",
    "scripts/pipeline/lint-station.mjs",
    "scripts/pipeline/check-queue-layout.mjs",
    "scripts/pipeline/queue-layout.mjs",
    "scripts/pipeline/triage-holds.ps1",
    "scripts/pipeline/check-escalations.mjs",
    "scripts/pipeline/check-backlog.mjs",
    "scripts/pipeline/check-d-register.mjs",
    "scripts/pipeline/check-sot-refs.mjs",
    "scripts/pipeline/check-hex-ratchet.mjs",
    "scripts/pipeline/module-baseline.json",
  ],
  tests: ["scripts/pipeline/__tests__/**"],
};

// ---------------------------------------------------------------------------
// Helpers for git fixture repos
// ---------------------------------------------------------------------------

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "instrument-lane-test-"));
  return {
    root,
    cleanup() {
      try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      "git " + args.join(" ") + " failed (status " + result.status + "):\n" +
        (result.stdout || "") + (result.stderr || ""),
    );
  }
  return result;
}

function initRepo(root) {
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  git(root, ["config", "user.name", "test"]);
  git(root, ["config", "commit.gpgsign", "false"]);
}

function writeAndAdd(root, relPath, content) {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  git(root, ["add", "--", relPath]);
}

function commit(root, msg) {
  git(root, ["commit", "-q", "-m", msg]);
}

/** Setup a fixture repo with an initial commit containing instrument-lane.json. */
function setupRepo(root) {
  initRepo(root);
  // Write instrument-lane.json so the checker can load the allowlist
  const allowlistPath = "scripts/pipeline/instrument-lane.json";
  writeAndAdd(root, allowlistPath, JSON.stringify(TEST_ALLOWLIST));
  commit(root, "initial: allowlist");
  // Return the base SHA
  const result = git(root, ["rev-parse", "HEAD"]);
  return result.stdout.trim();
}

/** Run the CLI checker with --range */
function runChecker(root, range) {
  const result = spawnSync(process.execPath, [CHECKER, "--range", range, root], {
    cwd: root,
    encoding: "utf8",
  });
  return result;
}

/** Get last non-empty line of stdout (the verdict line). */
function lastLine(output) {
  const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

// ---------------------------------------------------------------------------
// Unit tests (no git needed)
// ---------------------------------------------------------------------------

test("classifyPath: in-lane file returns in-lane", () => {
  assert.equal(classifyPath("scripts/pipeline/status-sweep.ps1", TEST_ALLOWLIST), "in-lane");
});

test("classifyPath: test file under __tests__/ returns in-lane", () => {
  assert.equal(
    classifyPath("scripts/pipeline/__tests__/some-test.mjs", TEST_ALLOWLIST),
    "in-lane"
  );
});

test("classifyPath: out-of-lane file returns out-of-lane", () => {
  assert.equal(classifyPath("scripts/pipeline/pipeline-lib.ps1", TEST_ALLOWLIST), "out-of-lane");
});

test("classifyPath: instrument-lane.json itself is always out-of-lane", () => {
  // Even though instrument-lane.json is not in the files list, we explicitly check this
  assert.equal(
    classifyPath("scripts/pipeline/instrument-lane.json", TEST_ALLOWLIST),
    "out-of-lane"
  );
});

test("classifyPath: apps/ path is out-of-lane", () => {
  assert.equal(classifyPath("apps/web/src/app.tsx", TEST_ALLOWLIST), "out-of-lane");
});

test("runControls: passes with real allowlist", () => {
  assert.equal(runControls(TEST_ALLOWLIST), true);
});

test("computeVerdict: empty diff -> OUT_OF_LANE", () => {
  const result = computeVerdict([], TEST_ALLOWLIST);
  assert.equal(result.verdict, "OUT_OF_LANE");
  assert.ok(result.reason, "should have a reason");
});

test("computeVerdict: all in-lane paths -> IN_LANE", () => {
  const result = computeVerdict(
    ["scripts/pipeline/status-sweep.ps1", "scripts/pipeline/__tests__/foo.mjs"],
    TEST_ALLOWLIST
  );
  assert.equal(result.verdict, "IN_LANE");
  assert.deepEqual(result.offending, []);
});

test("computeVerdict: mixed paths -> OUT_OF_LANE with offending list", () => {
  const result = computeVerdict(
    ["scripts/pipeline/status-sweep.ps1", "scripts/pipeline/pipeline-lib.ps1"],
    TEST_ALLOWLIST
  );
  assert.equal(result.verdict, "OUT_OF_LANE");
  assert.ok(result.offending.includes("scripts/pipeline/pipeline-lib.ps1"));
});

test("computeVerdict: instrument-lane.json in diff -> OUT_OF_LANE", () => {
  const result = computeVerdict(
    ["scripts/pipeline/status-sweep.ps1", "scripts/pipeline/instrument-lane.json"],
    TEST_ALLOWLIST
  );
  assert.equal(result.verdict, "OUT_OF_LANE");
  assert.ok(result.offending.includes("scripts/pipeline/instrument-lane.json"));
});

// ---------------------------------------------------------------------------
// Integration tests (real git repos)
// ---------------------------------------------------------------------------

test("test 1: change only status-sweep.ps1 and a test file -> IN_LANE", () => {
  const fixture = createFixture();
  try {
    const baseSha = setupRepo(fixture.root);
    // Make changes to in-lane files
    writeAndAdd(fixture.root, "scripts/pipeline/status-sweep.ps1", "# updated sweep");
    writeAndAdd(fixture.root, "scripts/pipeline/__tests__/some-new-test.mjs", "// new test");
    commit(fixture.root, "update in-lane files");
    const headSha = git(fixture.root, ["rev-parse", "HEAD"]).stdout.trim();
    const range = baseSha + "..." + headSha;
    const result = runChecker(fixture.root, range);
    assert.equal(lastLine(result.stdout), "INSTRUMENT_LANE: IN_LANE",
      "stdout: " + result.stdout + "\nstderr: " + result.stderr);
    assert.equal(result.status, 0, "exit code should be 0");
  } finally {
    fixture.cleanup();
  }
});

test("test 2: also change pipeline-lib.ps1 -> OUT_OF_LANE naming it", () => {
  const fixture = createFixture();
  try {
    const baseSha = setupRepo(fixture.root);
    writeAndAdd(fixture.root, "scripts/pipeline/status-sweep.ps1", "# updated");
    writeAndAdd(fixture.root, "scripts/pipeline/pipeline-lib.ps1", "# not in lane");
    commit(fixture.root, "add out-of-lane file");
    const headSha = git(fixture.root, ["rev-parse", "HEAD"]).stdout.trim();
    const range = baseSha + "..." + headSha;
    const result = runChecker(fixture.root, range);
    assert.equal(lastLine(result.stdout), "INSTRUMENT_LANE: OUT_OF_LANE",
      "stdout: " + result.stdout + "\nstderr: " + result.stderr);
    assert.ok(
      result.stdout.includes("scripts/pipeline/pipeline-lib.ps1"),
      "Should name the offending path. stdout: " + result.stdout
    );
    assert.equal(result.status, 0, "exit code should be 0 (out-of-lane is normal)");
  } finally {
    fixture.cleanup();
  }
});

test("test 3: change instrument-lane.json -> OUT_OF_LANE", () => {
  const fixture = createFixture();
  try {
    const baseSha = setupRepo(fixture.root);
    // Modify instrument-lane.json (even just touching it)
    const modified = { ...TEST_ALLOWLIST, files: [...TEST_ALLOWLIST.files, "scripts/pipeline/extra.mjs"] };
    writeAndAdd(fixture.root, "scripts/pipeline/instrument-lane.json", JSON.stringify(modified));
    commit(fixture.root, "modify allowlist");
    const headSha = git(fixture.root, ["rev-parse", "HEAD"]).stdout.trim();
    const range = baseSha + "..." + headSha;
    const result = runChecker(fixture.root, range);
    assert.equal(lastLine(result.stdout), "INSTRUMENT_LANE: OUT_OF_LANE",
      "stdout: " + result.stdout + "\nstderr: " + result.stderr);
    assert.equal(result.status, 0);
  } finally {
    fixture.cleanup();
  }
});

test("test 4a: delete an in-lane file -> still IN_LANE (delete is checked)", () => {
  const fixture = createFixture();
  try {
    // The file must exist in the BASE commit so that the diff shows a delete (D)
    // rather than nothing. setupRepo only adds the allowlist; add the file there too.
    initRepo(fixture.root);
    writeAndAdd(fixture.root, "scripts/pipeline/instrument-lane.json", JSON.stringify(TEST_ALLOWLIST));
    writeAndAdd(fixture.root, "scripts/pipeline/status-sweep.ps1", "# original");
    commit(fixture.root, "initial with in-lane file");
    const baseSha = git(fixture.root, ["rev-parse", "HEAD"]).stdout.trim();
    // Delete the in-lane file
    git(fixture.root, ["rm", "-q", "--", "scripts/pipeline/status-sweep.ps1"]);
    commit(fixture.root, "delete in-lane file");
    const headSha = git(fixture.root, ["rev-parse", "HEAD"]).stdout.trim();
    const range = baseSha + "..." + headSha;
    const result = runChecker(fixture.root, range);
    assert.equal(lastLine(result.stdout), "INSTRUMENT_LANE: IN_LANE",
      "stdout: " + result.stdout + "\nstderr: " + result.stderr);
    assert.equal(result.status, 0);
  } finally {
    fixture.cleanup();
  }
});

test("test 4b: rename in-lane file to out-of-lane path -> OUT_OF_LANE", () => {
  const fixture = createFixture();
  try {
    const baseSha = setupRepo(fixture.root);
    // Add a file, then rename it to an out-of-lane path
    writeAndAdd(fixture.root, "scripts/pipeline/status-sweep.ps1", "# original");
    commit(fixture.root, "add in-lane file");
    const midSha = git(fixture.root, ["rev-parse", "HEAD"]).stdout.trim();
    mkdirSync(join(fixture.root, "scripts", "pr-watcher"), { recursive: true });
    git(fixture.root, ["mv",
      "scripts/pipeline/status-sweep.ps1",
      "scripts/pr-watcher/status-sweep.ps1"
    ]);
    commit(fixture.root, "rename to out-of-lane path");
    const headSha = git(fixture.root, ["rev-parse", "HEAD"]).stdout.trim();
    const range = midSha + "..." + headSha;
    const result = runChecker(fixture.root, range);
    assert.equal(lastLine(result.stdout), "INSTRUMENT_LANE: OUT_OF_LANE",
      "stdout: " + result.stdout + "\nstderr: " + result.stderr);
    assert.equal(result.status, 0);
  } finally {
    fixture.cleanup();
  }
});

test("test 5: empty diff -> OUT_OF_LANE (nothing proven)", () => {
  const fixture = createFixture();
  try {
    const baseSha = setupRepo(fixture.root);
    // No additional commits — use the same SHA for base and head
    const range = baseSha + "..." + baseSha;
    const result = runChecker(fixture.root, range);
    assert.equal(lastLine(result.stdout), "INSTRUMENT_LANE: OUT_OF_LANE",
      "stdout: " + result.stdout + "\nstderr: " + result.stderr);
    assert.equal(result.status, 0);
  } finally {
    fixture.cleanup();
  }
});

test("test 6: unreadable range -> exit 2, never IN_LANE", () => {
  const fixture = createFixture();
  try {
    setupRepo(fixture.root);
    const range = "deadbeef000000000000000000000000...HEAD";
    const result = runChecker(fixture.root, range);
    assert.equal(result.status, 2, "should exit 2 for unreadable range");
    // Must NOT print IN_LANE
    assert.ok(
      !result.stdout.includes("INSTRUMENT_LANE: IN_LANE"),
      "Must not print IN_LANE when range is unreadable. stdout: " + result.stdout
    );
  } finally {
    fixture.cleanup();
  }
});

test("test 7: change under apps/ alone -> OUT_OF_LANE (negative control)", () => {
  const fixture = createFixture();
  try {
    const baseSha = setupRepo(fixture.root);
    writeAndAdd(fixture.root, "apps/web/src/app.tsx", "// some app code");
    commit(fixture.root, "add app code");
    const headSha = git(fixture.root, ["rev-parse", "HEAD"]).stdout.trim();
    const range = baseSha + "..." + headSha;
    const result = runChecker(fixture.root, range);
    assert.equal(lastLine(result.stdout), "INSTRUMENT_LANE: OUT_OF_LANE",
      "stdout: " + result.stdout + "\nstderr: " + result.stderr);
    assert.equal(result.status, 0);
  } finally {
    fixture.cleanup();
  }
});
