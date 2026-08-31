// Unit tests for handleConflictedPr and clearConflictEntry — the conflict-
// notification helpers that post a single PR comment per (PR number, head sha)
// when a PR's mergeStateStatus is observed DIRTY on two consecutive polls.
//
// All tests use injected deps (no network, no disk I/O, no gh calls) following
// the pattern established in verdict-archival.spec.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";

import { handleConflictedPr, clearConflictEntry } from "../index.mjs";

// Build a minimal injected-dep set for handleConflictedPr.
// We use a container so loadState/saveState share the same mutable reference —
// the real watcher does the same with module-level conflictNotified.
function makeDeps({ postComment = async () => {}, logger = () => {} } = {}) {
  const confirmedSet = new Set();
  const container = { current: {} };
  return {
    postComment,
    loadState: async () => container.current,
    saveState: async (next) => { container.current = next; },
    updateConfirmedSet: (prNum, add) => {
      if (add) confirmedSet.add(prNum);
      else confirmedSet.delete(prNum);
    },
    logger,
    // Accessors so tests can read state without caring about container internals
    get state() { return container.current; },
    _confirmedSet: confirmedSet,
  };
}

function makePr(number, sha = "abc1234") {
  return { number, headRefOid: sha };
}

// Helper: run clearConflictEntry with the same deps object
async function clear(prNum, deps) {
  return clearConflictEntry(prNum, {
    loadState: deps.loadState,
    saveState: deps.saveState,
    updateConfirmedSet: deps.updateConfirmedSet,
    logger: deps.logger,
  });
}

// ── Test 1: one observation does not notify ────────────────────────────────
// This is the most important test — guards against false positives when
// mergeStateStatus is transiently stale immediately after a push.
//
// NEGATIVE CONTROL: if the two-observation threshold were reduced to one,
// this test would fail because `postComment` would be called on the first poll.
test("one DIRTY observation does not post a comment", async () => {
  const comments = [];
  const deps = makeDeps({
    postComment: async (prNum, body) => comments.push({ prNum, body }),
  });

  await handleConflictedPr(makePr(101), deps);

  assert.equal(comments.length, 0, "no comment on first observation");
  assert.equal(deps.state[101].consecutiveDirtyCount, 1, "count incremented to 1");
  assert.equal(deps.state[101].notifiedAt, null, "not yet notified");
  assert.equal(deps._confirmedSet.has(101), false, "not in confirmed set");
});

// ── Test 2: two consecutive observations notify exactly once ───────────────
test("two consecutive DIRTY observations notify exactly once", async () => {
  const comments = [];
  const deps = makeDeps({
    postComment: async (prNum, body) => comments.push({ prNum, body }),
  });

  // First poll
  await handleConflictedPr(makePr(42), deps);
  assert.equal(comments.length, 0, "no comment after first poll");

  // Second poll (same sha)
  await handleConflictedPr(makePr(42), deps);
  assert.equal(comments.length, 1, "exactly one comment after second poll");
  assert.equal(comments[0].prNum, 42);
  assert.ok(comments[0].body.includes("merge conflict"), "comment mentions conflict");
  assert.ok(comments[0].body.includes("human rebase"), "comment mentions human rebase");
  assert.ok(deps.state[42].notifiedAt !== null, "notifiedAt recorded");
  assert.equal(deps._confirmedSet.has(42), true, "in confirmed set");

  // Third, fourth, fifth polls — must add no further comments
  await handleConflictedPr(makePr(42), deps);
  await handleConflictedPr(makePr(42), deps);
  await handleConflictedPr(makePr(42), deps);
  assert.equal(comments.length, 1, "still exactly one comment after further polls");
});

// ── Test 3: new head sha re-arms notification ──────────────────────────────
test("new head sha re-arms: same PR still DIRTY after push triggers one further comment", async () => {
  const comments = [];
  const deps = makeDeps({
    postComment: async (prNum, body) => comments.push({ prNum, body }),
  });

  // Reach notified state with sha "aaa"
  await handleConflictedPr(makePr(7, "aaa"), deps);
  await handleConflictedPr(makePr(7, "aaa"), deps);
  assert.equal(comments.length, 1, "first notification sent");

  // Developer pushes — new sha "bbb". First poll with new sha: no comment yet.
  await handleConflictedPr(makePr(7, "bbb"), deps);
  assert.equal(comments.length, 1, "no comment on first observation of new sha");
  assert.equal(deps.state[7].consecutiveDirtyCount, 1, "counter reset for new sha");
  assert.equal(deps.state[7].notifiedAt, null, "notifiedAt reset");

  // Second poll with new sha: one more comment.
  await handleConflictedPr(makePr(7, "bbb"), deps);
  assert.equal(comments.length, 2, "second notification sent for new sha");
  assert.ok(deps.state[7].notifiedAt !== null, "notifiedAt set again");
});

// ── Test 4: recovery clears counter and confirmed-set entry ───────────────
test("PR seen non-DIRTY clears counter and drops out of confirmed-set", async () => {
  const comments = [];
  const deps = makeDeps({
    postComment: async (prNum, body) => comments.push({ prNum, body }),
  });

  // Reach confirmed state
  await handleConflictedPr(makePr(55), deps);
  await handleConflictedPr(makePr(55), deps);
  assert.ok(deps.state[55].notifiedAt !== null, "confirmed before recovery");
  assert.equal(deps._confirmedSet.has(55), true, "in confirmed set before recovery");

  // PR recovers (conflict resolved by rebase) — call clearConflictEntry
  await clear(55, deps);

  assert.equal(deps.state[55], undefined, "entry removed from state");
  assert.equal(deps._confirmedSet.has(55), false, "removed from confirmed set");
});

// ── Test 5: postComment failure is swallowed, poll continues ──────────────
test("notification failure is swallowed — other PRs are still processed", async () => {
  const comments = [];

  // Separate deps for each PR so state doesn't bleed between them
  const deps10 = makeDeps({
    postComment: async () => { throw new Error("gh rate limit"); },
    logger: () => {},
  });
  const deps20 = makeDeps({
    postComment: async (prNum, body) => comments.push({ prNum, body }),
    logger: () => {},
  });

  // First observations for both (no comment yet)
  await handleConflictedPr(makePr(10), deps10);
  await handleConflictedPr(makePr(20), deps20);

  // Second observations — PR 10 throws, PR 20 should still notify.
  // handleConflictedPr must not rethrow when postComment fails.
  let threw = false;
  try {
    await handleConflictedPr(makePr(10), deps10);
  } catch {
    threw = true;
  }
  assert.equal(threw, false, "handleConflictedPr must not rethrow on comment failure");
  await handleConflictedPr(makePr(20), deps20);

  // PR 20 must have been notified regardless of PR 10's failure
  assert.equal(comments.length, 1, "PR 20 was notified");
  assert.equal(comments[0].prNum, 20);
  // PR 10: notifiedAt must remain null (failed to post)
  assert.equal(deps10.state[10].notifiedAt, null, "PR 10 notifiedAt stays null after failed comment");
});

// ── Test 6: clearConflictEntry on PR with no entry is a safe no-op ────────
test("clearConflictEntry on PR with no entry is a safe no-op", async () => {
  const deps = makeDeps();

  // Should not throw, should not modify state
  await clear(999, deps);

  assert.deepEqual(deps.state, {}, "state unchanged");
  assert.equal(deps._confirmedSet.has(999), false, "not in confirmed set");
});
