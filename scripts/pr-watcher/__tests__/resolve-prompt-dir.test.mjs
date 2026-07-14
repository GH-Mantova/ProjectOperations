// Unit tests for resolvePromptDir — the pure helper that decouples the
// prompt queue location from the git-clone REPO_ROOT.
//
// See scripts/pr-watcher/index.mjs (PR_WATCHER_PROMPT_DIR).
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { resolvePromptDir } from "../index.mjs";

const REPO_ROOT = path.resolve("/tmp/po-watcher/ProjectOperations");

test("falls back to <repo>/docs/pr-prompts when PR_WATCHER_PROMPT_DIR is unset", () => {
  const dir = resolvePromptDir({}, REPO_ROOT);
  assert.equal(dir, path.join(REPO_ROOT, "docs", "pr-prompts"));
});

test("honours PR_WATCHER_PROMPT_DIR when set", () => {
  const override = path.resolve("/tmp/main-tree/docs/pr-prompts");
  const dir = resolvePromptDir({ PR_WATCHER_PROMPT_DIR: override }, REPO_ROOT);
  assert.equal(dir, override);
});

test("resolves a relative PR_WATCHER_PROMPT_DIR to an absolute path", () => {
  const dir = resolvePromptDir({ PR_WATCHER_PROMPT_DIR: "queue/prompts" }, REPO_ROOT);
  assert.equal(dir, path.resolve("queue/prompts"));
});

test("ignores an empty PR_WATCHER_PROMPT_DIR and falls back", () => {
  const dir = resolvePromptDir({ PR_WATCHER_PROMPT_DIR: "" }, REPO_ROOT);
  assert.equal(dir, path.join(REPO_ROOT, "docs", "pr-prompts"));
});
