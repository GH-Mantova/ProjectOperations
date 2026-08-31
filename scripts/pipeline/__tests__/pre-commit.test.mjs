/**
 * Tests for scripts/pipeline/hooks/pre-commit
 *
 * Runs with: node --test scripts/pipeline/__tests__/pre-commit.test.mjs
 *
 * Each test spins up a throwaway git repo under os.tmpdir(). The hook is
 * invoked directly via `node <hook-path>` from within the temp repo so that
 * `git rev-parse --show-toplevel` returns the temp path and all git operations
 * are isolated.
 *
 * ci.yml runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu.
 * The hook uses only Node.js builtins and `git`, so it is cross-platform.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const HOOK = join(REPO_ROOT, "scripts", "pipeline", "hooks", "pre-commit");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal temp git repo with the prompts directory and an initial commit.
 * Returns the absolute path to the temp repo root.
 */
function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "pre-commit-test-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

  git("init", "-b", "main");
  git("config", "user.email", "test@test.com");
  git("config", "user.name", "Test");

  // Create the prompts directory with a .gitkeep so it exists in the initial commit.
  mkdirSync(join(dir, "docs", "pr-prompts"), { recursive: true });
  writeFileSync(join(dir, "docs", "pr-prompts", ".gitkeep"), "");
  git("add", ".");
  git("commit", "-m", "init");

  return dir;
}

/**
 * Write a HOLD file into the repo (committed) and optionally a ready file (staged rename).
 */
function writeHoldFile(repoDir, slug, content = "# prompt\n") {
  const holdPath = join(repoDir, "docs", "pr-prompts", `${slug}-HOLD.md`);
  writeFileSync(holdPath, content, "utf8");
  return holdPath;
}

/**
 * Commit a file that already exists in the working tree.
 */
function gitAdd(repoDir, relPath) {
  execFileSync("git", ["add", relPath], {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function gitCommit(repoDir, message = "add file") {
  execFileSync("git", ["commit", "-m", message], {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/**
 * Write the arming log to docs/pr-prompts/.arming-log.txt in the repo.
 * Pass null to omit the file entirely.
 */
function writeArmLog(repoDir, content) {
  if (content === null) return;
  const logPath = join(repoDir, "docs", "pr-prompts", ".arming-log.txt");
  writeFileSync(logPath, content, "utf8");
}

/**
 * Stage a HOLD->ready rename pair for a given slug.
 * The HOLD file must already be committed.
 */
function stageRename(repoDir, slug) {
  const holdRel = `docs/pr-prompts/${slug}-HOLD.md`;
  const readyRel = `docs/pr-prompts/${slug}-ready.md`;
  // Use git mv which stages the rename
  execFileSync("git", ["mv", holdRel, readyRel], {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/**
 * Stage a bare HOLD deletion (no ready counterpart) — the Station 06 case.
 */
function stageDeletion(repoDir, slug) {
  const holdRel = `docs/pr-prompts/${slug}-HOLD.md`;
  execFileSync("git", ["rm", holdRel], {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/**
 * Run the pre-commit hook inside the given repo.
 * Returns { code, stdout, stderr }.
 */
function runHook(repoDir, env = {}) {
  const res = spawnSync("node", [HOOK], {
    cwd: repoDir,
    encoding: "utf8",
    env: Object.assign({}, process.env, env),
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    code: res.status != null ? res.status : 1,
    stdout: String(res.stdout || ""),
    stderr: String(res.stderr || ""),
  };
}

/**
 * Clean up a temp repo.
 */
function cleanup(repoDir) {
  try {
    rmSync(repoDir, { recursive: true, force: true });
  } catch (_) {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("pre-commit hook: unlogged-arm guard", () => {

  // -------------------------------------------------------------------------
  // 1. Refuses an unlogged rename pair
  // -------------------------------------------------------------------------
  test("refuses a staged HOLD->ready rename pair when slug is absent from the log", () => {
    const repo = makeTempRepo();
    try {
      const slug = "pr-test-unlogged-s1";

      // Write and commit the HOLD file.
      writeHoldFile(repo, slug);
      gitAdd(repo, `docs/pr-prompts/${slug}-HOLD.md`);
      gitCommit(repo, `add ${slug}`);

      // Write an arming log that does NOT contain this slug.
      writeArmLog(
        repo,
        "2026-08-31T00:00:00Z  ARMED  pr-other-slug  escalates=false  by=x@x  pid=1  caller=pwsh\n"
      );

      // Stage the HOLD->ready rename.
      stageRename(repo, slug);

      // Run the hook — expect non-zero exit.
      const { code, stderr } = runHook(repo);
      assert.notEqual(code, 0, "hook should refuse an unlogged rename pair");
      assert.ok(
        stderr.includes("unlogged-arm"),
        `stderr should mention 'unlogged-arm', got:\n${stderr}`
      );
      assert.ok(
        stderr.includes(slug),
        `stderr should name the offending slug '${slug}', got:\n${stderr}`
      );
      assert.ok(
        stderr.includes("arm-prompt.ps1"),
        `stderr should tell the user to re-arm via arm-prompt.ps1, got:\n${stderr}`
      );
    } finally {
      cleanup(repo);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Allows a logged rename pair
  // -------------------------------------------------------------------------
  test("allows a staged HOLD->ready rename pair when slug IS in an ARMED log line", () => {
    const repo = makeTempRepo();
    try {
      const slug = "pr-test-logged-s1";

      writeHoldFile(repo, slug);
      gitAdd(repo, `docs/pr-prompts/${slug}-HOLD.md`);
      gitCommit(repo, `add ${slug}`);

      // Write an arming log that DOES contain this slug.
      writeArmLog(
        repo,
        "2026-08-31T00:00:00Z  ARMED  " + slug + "  escalates=false  by=x@x  pid=1  caller=pwsh\n"
      );

      stageRename(repo, slug);

      const { code } = runHook(repo);
      assert.equal(code, 0, "hook should allow a logged rename pair");
    } finally {
      cleanup(repo);
    }
  });

  // -------------------------------------------------------------------------
  // 3. Allows a bare HOLD deletion (Station 06 bookkeeping)
  // -------------------------------------------------------------------------
  test("allows a bare HOLD deletion with no ready counterpart (Station 06 case)", () => {
    const repo = makeTempRepo();
    try {
      const slug = "pr-test-hold-delete";

      writeHoldFile(repo, slug);
      gitAdd(repo, `docs/pr-prompts/${slug}-HOLD.md`);
      gitCommit(repo, `add ${slug}`);

      // Write a log that does NOT contain the slug (doesn't matter — no ready pair).
      writeArmLog(repo, "# WRAPPER ARMS ONLY\n");

      // Stage only the HOLD deletion — no ready file added.
      stageDeletion(repo, slug);

      const { code } = runHook(repo);
      assert.equal(code, 0, "hook must allow a bare HOLD deletion (Station 06 bookkeeping)");
    } finally {
      cleanup(repo);
    }
  });

  // -------------------------------------------------------------------------
  // 4. Allows unrelated paths (normal source commit)
  // -------------------------------------------------------------------------
  test("allows a commit that touches no docs/pr-prompts/ paths", () => {
    const repo = makeTempRepo();
    try {
      // Stage a completely unrelated file.
      writeFileSync(join(repo, "README.md"), "hello\n", "utf8");
      gitAdd(repo, "README.md");

      const { code } = runHook(repo);
      assert.equal(code, 0, "hook must pass a normal source commit untouched");
    } finally {
      cleanup(repo);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Absent log — warns and allows
  // -------------------------------------------------------------------------
  test("warns and allows when .arming-log.txt is absent (fresh clone)", () => {
    const repo = makeTempRepo();
    try {
      const slug = "pr-test-no-log";

      writeHoldFile(repo, slug);
      gitAdd(repo, `docs/pr-prompts/${slug}-HOLD.md`);
      gitCommit(repo, `add ${slug}`);

      // Do NOT write an arming log.
      stageRename(repo, slug);

      const { code, stderr } = runHook(repo);
      assert.equal(code, 0, "hook must exit 0 when .arming-log.txt is absent");
      assert.ok(
        stderr.toLowerCase().includes("warn"),
        `stderr should contain a warning, got:\n${stderr}`
      );
    } finally {
      cleanup(repo);
    }
  });

  // -------------------------------------------------------------------------
  // 6. Header line tolerated — log starting with "# WRAPPER ARMS ONLY" still matches
  // -------------------------------------------------------------------------
  test("tolerates a # WRAPPER ARMS ONLY header comment and still matches ARMED entries", () => {
    const repo = makeTempRepo();
    try {
      const slug = "pr-test-header-tolerated";

      writeHoldFile(repo, slug);
      gitAdd(repo, `docs/pr-prompts/${slug}-HOLD.md`);
      gitCommit(repo, `add ${slug}`);

      // Log starts with the header comment added by the release-index slice.
      writeArmLog(
        repo,
        "# WRAPPER ARMS ONLY — arms made by bare git mv are refused by pre-commit\n" +
        "2026-08-31T00:00:00Z  ARMED  " + slug + "  escalates=false  by=x@x  pid=1  caller=pwsh\n"
      );

      stageRename(repo, slug);

      const { code } = runHook(repo);
      assert.equal(code, 0, "hook must match ARMED entries even when log starts with a header comment");
    } finally {
      cleanup(repo);
    }
  });

});
