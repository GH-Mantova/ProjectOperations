// Unit tests for computeRunnable — the pure helper that lets the watchdog
// know how many prompts this node can actually dequeue (vs. total armed).
//
// The watchdog used to count every *-ready.md on disk and flag idle nodes as
// hung when they could not dequeue any of them (wrong lane, unmet deps).
// computeRunnable separates "armed" (on-disk) from "runnable" (owned + not
// deferred), which is what the watchdog should compare against the heartbeat.
//
// See scripts/pr-watcher/index.mjs (computeRunnable, writeQueueState).

import assert from "node:assert/strict";
import { test } from "node:test";

import { computeRunnable } from "../index.mjs";

test("all armed, none owned by this lane, none deferred -> runnable === 0", () => {
  const result = computeRunnable({
    armed: ["pr-100-a-ready.md", "pr-101-b-ready.md"],
    owned: [],
    deferred: [],
  });
  assert.equal(result.armed, 2);
  assert.equal(result.owned, 0);
  assert.equal(result.deferred, 0);
  assert.equal(result.runnable, 0);
});

test("all armed and owned, one deferred -> runnable === owned - 1", () => {
  const result = computeRunnable({
    armed: ["pr-100-a-ready.md", "pr-101-b-ready.md"],
    owned: ["pr-100-a-ready.md", "pr-101-b-ready.md"],
    deferred: ["pr-100-a-ready.md"],
  });
  assert.equal(result.owned, 2);
  assert.equal(result.deferred, 1);
  assert.equal(result.runnable, 1);
});

test("every owned prompt deferred -> runnable === 0", () => {
  const result = computeRunnable({
    armed: ["pr-100-a-ready.md", "pr-101-b-ready.md"],
    owned: ["pr-100-a-ready.md", "pr-101-b-ready.md"],
    deferred: ["pr-100-a-ready.md", "pr-101-b-ready.md"],
  });
  assert.equal(result.runnable, 0);
});

test("nothing armed -> all four counts 0", () => {
  const result = computeRunnable({
    armed: [],
    owned: [],
    deferred: [],
  });
  assert.equal(result.armed, 0);
  assert.equal(result.owned, 0);
  assert.equal(result.deferred, 0);
  assert.equal(result.runnable, 0);
});

test("deferred name not owned -> does not reduce runnable", () => {
  const result = computeRunnable({
    armed: ["pr-100-a-ready.md", "pr-101-b-ready.md"],
    owned: ["pr-101-b-ready.md"],
    deferred: ["pr-999-other-ready.md"], // not in owned
  });
  assert.equal(result.owned, 1);
  assert.equal(result.runnable, 1, "deferred-but-not-owned must not reduce runnable");
});

test("duplicate names in armed, owned, deferred counted once each", () => {
  const result = computeRunnable({
    armed: ["pr-100-a-ready.md", "pr-100-a-ready.md"],
    owned: ["pr-100-a-ready.md", "pr-100-a-ready.md"],
    deferred: ["pr-100-a-ready.md", "pr-100-a-ready.md"],
  });
  assert.equal(result.armed, 1);
  assert.equal(result.owned, 1);
  assert.equal(result.deferred, 1);
  assert.equal(result.runnable, 0);
});

test("empty inputs passed explicitly -> all zeros, no throw", () => {
  const result = computeRunnable({ armed: [], owned: [], deferred: [] });
  assert.equal(result.armed, 0);
  assert.equal(result.owned, 0);
  assert.equal(result.deferred, 0);
  assert.equal(result.runnable, 0);
});

test("omitted arguments (no args at all) -> all zeros, no throw", () => {
  const result = computeRunnable();
  assert.equal(result.armed, 0);
  assert.equal(result.owned, 0);
  assert.equal(result.deferred, 0);
  assert.equal(result.runnable, 0);
});

test("runnable is never negative even if deferred exceeds owned", () => {
  // This cannot happen in production (deferred is a subset of owned),
  // but the function must be robust regardless.
  const result = computeRunnable({
    armed: ["pr-100-a-ready.md"],
    owned: ["pr-100-a-ready.md"],
    deferred: ["pr-100-a-ready.md", "pr-200-extra-ready.md"],
  });
  assert.ok(result.runnable >= 0, "runnable must never be negative");
});

test("runnable never exceeds owned", () => {
  const result = computeRunnable({
    armed: ["pr-100-a-ready.md", "pr-101-b-ready.md"],
    owned: ["pr-100-a-ready.md"],
    deferred: [],
  });
  assert.ok(result.runnable <= result.owned, "runnable must not exceed owned");
  assert.equal(result.runnable, 1);
});
