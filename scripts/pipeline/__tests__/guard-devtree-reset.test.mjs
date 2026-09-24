/**
 * Tests for the DEVTREE_RESET rule in .claude/hooks/guard.mjs
 *
 * Runs with: node --test scripts/pipeline/__tests__/guard-devtree-reset.test.mjs
 *
 * The guard receives a PreToolUse JSON payload on stdin - {tool_name, tool_input, cwd}.
 * We invoke the hook the same way Claude Code does and assert on exit code + stderr.
 *
 * A guard never OBSERVED to pass on the cases it must ALLOW is not a guard - it is a comment.
 * (DOCTRINE section 7.) Every allow-case below has a positive assertion.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const GUARD = join(REPO_ROOT, ".claude", "hooks", "guard.mjs");

function runGuard({ command, cwd }) {
  const payload = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command },
    cwd,
  });
  const res = spawnSync("node", [GUARD], {
    input: payload,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    code: res.status != null ? res.status : 1,
    stderr: String(res.stderr || ""),
  };
}

describe("guard.mjs - DEVTREE_RESET rule", () => {

  // -------------------------------------------------------------------------
  // BLOCK cases
  // -------------------------------------------------------------------------

  test("blocks `git reset --hard origin/main` when session cwd IS the dev tree", () => {
    const { code, stderr } = runGuard({
      command: "git reset --hard origin/main",
      cwd: "C:\\ProjectOperations2",
    });
    assert.equal(code, 2, "must exit 2 (block)");
    assert.ok(/DEVTREE_RESET/.test(stderr), `stderr must carry the DEVTREE_RESET marker, got:\n${stderr}`);
    assert.ok(/ff-only/.test(stderr), `stderr must name the merge --ff-only replacement, got:\n${stderr}`);
    assert.ok(/INFORMATION, not an obstacle/.test(stderr), `stderr must say a refusal from --ff-only is INFORMATION, got:\n${stderr}`);
  });

  test("blocks in a subdirectory of the dev tree", () => {
    const { code } = runGuard({
      command: "git reset origin/main",
      cwd: "C:\\ProjectOperations2\\apps\\api",
    });
    assert.equal(code, 2);
  });

  test("blocks every form of reset (bare, --soft, --mixed, --hard)", () => {
    for (const cmd of [
      "git reset",
      "git reset --soft HEAD~1",
      "git reset --mixed",
      "git reset --hard origin/main",
    ]) {
      const { code } = runGuard({ command: cmd, cwd: "C:\\ProjectOperations2" });
      assert.equal(code, 2, `must block: ${cmd}`);
    }
  });

  test("blocks when the command embeds `cd C:\\ProjectOperations2 && git reset`", () => {
    const { code } = runGuard({
      command: "cd C:\\ProjectOperations2 && git reset --hard origin/main",
      cwd: "C:\\po-watcher\\ProjectOperations",
    });
    assert.equal(code, 2);
  });

  test("blocks when the command uses `git -C C:\\ProjectOperations2 reset`", () => {
    const { code } = runGuard({
      command: "git -C C:\\ProjectOperations2 reset --hard origin/main",
      cwd: "C:\\po-watcher\\ProjectOperations",
    });
    assert.equal(code, 2);
  });

  test("blocks when the dev-tree path uses forward slashes", () => {
    const { code } = runGuard({
      command: "git reset --hard origin/main",
      cwd: "C:/ProjectOperations2",
    });
    assert.equal(code, 2);
  });

  // -------------------------------------------------------------------------
  // ALLOW cases - a guard never seen to PASS on these is not a guard.
  // -------------------------------------------------------------------------

  test("ALLOWS `git reset` in C:\\po-watcher (watcher tree, not dev tree)", () => {
    const { code } = runGuard({
      command: "git reset --hard origin/fix/foo",
      cwd: "C:\\po-watcher\\ProjectOperations",
    });
    assert.equal(code, 0, "reset in the watcher tree must be allowed");
  });

  test("ALLOWS `git reset` inside a .claude/worktrees/... path (feature-branch worktree)", () => {
    const { code } = runGuard({
      command: "git reset --hard HEAD~1",
      cwd: "C:\\po-watcher\\ProjectOperations\\.claude\\worktrees\\agent-abc123",
    });
    assert.equal(code, 0, "reset in a worktree must be allowed");
  });

  test("ALLOWS `git merge --ff-only origin/main` in the dev tree (the prescribed replacement)", () => {
    const { code } = runGuard({
      command: "git merge --ff-only origin/main",
      cwd: "C:\\ProjectOperations2",
    });
    assert.equal(code, 0, "the replacement command must be allowed in the dev tree");
  });

  test("ALLOWS `git fetch` in the dev tree", () => {
    const { code } = runGuard({
      command: "git fetch origin +refs/heads/main:refs/remotes/origin/main",
      cwd: "C:\\ProjectOperations2",
    });
    assert.equal(code, 0);
  });

  test("does NOT false-positive on `git commit -m \"reset the foo\"` in the dev tree", () => {
    const { code } = runGuard({
      command: 'git commit -m "reset the foo counter"',
      cwd: "C:\\ProjectOperations2",
    });
    assert.equal(code, 0, "commit message containing the word 'reset' must not be blocked");
  });

  test("ALLOWS reset when no cwd signal points at the dev tree", () => {
    // Session cwd absent AND no embedded cd/-C. This is the shape test-guard.mjs uses.
    const { code } = runGuard({
      command: "git reset --hard origin/fix/foo",
      cwd: undefined,
    });
    assert.equal(code, 0, "reset with no dev-tree cwd signal must pass through");
  });

});
