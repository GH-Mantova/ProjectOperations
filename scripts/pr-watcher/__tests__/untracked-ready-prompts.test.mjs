// Unit tests for parseUntrackedReadyPrompts — the pure filter behind the
// startup `untracked-ready-prompt` warning. Keeps the log-tag emission and
// git-output parsing testable without spawning git.
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseUntrackedReadyPrompts } from "../index.mjs";

test("returns [] on empty / null-ish input", () => {
  assert.deepEqual(parseUntrackedReadyPrompts(""), []);
  assert.deepEqual(parseUntrackedReadyPrompts(null), []);
  assert.deepEqual(parseUntrackedReadyPrompts(undefined), []);
});

test("picks up top-level *-ready.md and *-HOLD.md, ignores others", () => {
  const porcelain = [
    "pr-42-foo-ready.md",
    "pr-43-bar-HOLD.md",
    "notes.md",
    "pr-44-baz.md", // draft, not ready
    "README.md",
  ].join("\n");
  assert.deepEqual(
    parseUntrackedReadyPrompts(porcelain),
    ["pr-42-foo-ready.md", "pr-43-bar-HOLD.md"],
  );
});

test("ignores entries nested below the prompt dir (paused/, processed/, ...)", () => {
  const porcelain = [
    "pr-01-real-ready.md",
    "paused/pr-99-old-ready.md",
    "processed/pr-98-done-ready.md",
    "failed/pr-97-boom-HOLD.md",
    "backslash\\weird-ready.md",
  ].join("\n");
  assert.deepEqual(
    parseUntrackedReadyPrompts(porcelain),
    ["pr-01-real-ready.md"],
  );
});

test("handles CRLF and trims stray whitespace", () => {
  const porcelain = " pr-1-a-ready.md \r\n\r\npr-2-b-HOLD.md\r\n";
  assert.deepEqual(
    parseUntrackedReadyPrompts(porcelain),
    ["pr-1-a-ready.md", "pr-2-b-HOLD.md"],
  );
});

test("case-insensitive on the -ready.md / -HOLD.md suffix", () => {
  const porcelain = ["pr-1-mixed-Ready.MD", "pr-2-shout-hold.MD"].join("\n");
  assert.deepEqual(
    parseUntrackedReadyPrompts(porcelain),
    ["pr-1-mixed-Ready.MD", "pr-2-shout-hold.MD"],
  );
});
