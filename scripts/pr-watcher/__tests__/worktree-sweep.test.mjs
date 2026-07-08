// Unit tests for parseWorktreePaths — pure porcelain parser used by the
// orphaned-worktree sweep. Run with `node --test`.
//
// Path literals are platform-neutral (built via path.resolve) so the suite
// runs the same on Windows and Linux CI.
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { parseWorktreePaths } from "../index.mjs";

const MAIN = path.resolve("/tmp/po-watcher/ProjectOperations");
const ORPHAN_A = path.resolve("/tmp/po-worktrees/po-508-apitest");
const ORPHAN_B = path.resolve("/tmp/po-worktrees/po-509-apitest");
const ORPHAN_C = path.resolve("/tmp/po-worktrees/po-510-apitest");

test("excludes the main worktree when it is listed first", () => {
  const porcelain = [
    `worktree ${MAIN}`,
    "HEAD abc123",
    "branch refs/heads/main",
    "",
    `worktree ${ORPHAN_A}`,
    "HEAD def456",
    "branch refs/heads/apitest/pr-508",
    "",
  ].join("\n");

  const paths = parseWorktreePaths(porcelain, MAIN);
  assert.deepEqual(paths, [ORPHAN_A]);
});

test("returns every extra worktree", () => {
  const porcelain = [
    `worktree ${MAIN}`,
    "HEAD abc",
    "",
    `worktree ${ORPHAN_A}`,
    "HEAD def",
    "",
    `worktree ${ORPHAN_B}`,
    "HEAD 123",
    "",
    `worktree ${ORPHAN_C}`,
    "HEAD 456",
    "",
  ].join("\n");

  const paths = parseWorktreePaths(porcelain, MAIN);
  assert.deepEqual(paths, [ORPHAN_A, ORPHAN_B, ORPHAN_C]);
});

test("handles CRLF line endings", () => {
  const porcelain = [
    `worktree ${MAIN}`,
    "HEAD abc",
    "",
    `worktree ${ORPHAN_A}`,
    "HEAD def",
    "",
  ].join("\r\n");

  const paths = parseWorktreePaths(porcelain, MAIN);
  assert.deepEqual(paths, [ORPHAN_A]);
});

test("handles empty and null-ish input", () => {
  assert.deepEqual(parseWorktreePaths("", MAIN), []);
  assert.deepEqual(parseWorktreePaths(null, MAIN), []);
  assert.deepEqual(parseWorktreePaths(undefined, MAIN), []);
});

test("main-path arg with trailing separator still excludes the main worktree", () => {
  const mainWithSlash = MAIN + path.sep;
  const porcelain = [
    `worktree ${MAIN}`,
    "HEAD abc",
    "",
    `worktree ${ORPHAN_A}`,
    "HEAD def",
    "",
  ].join("\n");

  const paths = parseWorktreePaths(porcelain, mainWithSlash);
  assert.deepEqual(paths, [ORPHAN_A]);
});

test("porcelain lines with a trailing separator still match main", () => {
  const porcelain = [
    // porcelain uses the trailing-slash form; parser should still exclude it
    `worktree ${MAIN}${path.sep}`,
    "HEAD abc",
    "",
    `worktree ${ORPHAN_A}`,
    "HEAD def",
    "",
  ].join("\n");

  const paths = parseWorktreePaths(porcelain, MAIN);
  assert.deepEqual(paths, [ORPHAN_A]);
});

if (process.platform === "win32") {
  test("Windows: mixed / and \\ separators resolve to the same main path", () => {
    const winMain = "C:\\po-watcher\\ProjectOperations";
    const winMainMixed = "C:/po-watcher/ProjectOperations/";
    const winOrphan = "C:\\po-worktrees\\po-508-apitest";

    const porcelain = [
      `worktree ${winMainMixed}`,
      "HEAD abc",
      "",
      `worktree ${winOrphan}`,
      "HEAD def",
      "",
    ].join("\n");

    assert.equal(path.resolve(winMain), path.resolve(winMainMixed));
    assert.deepEqual(parseWorktreePaths(porcelain, winMain), [winOrphan]);
  });
}
