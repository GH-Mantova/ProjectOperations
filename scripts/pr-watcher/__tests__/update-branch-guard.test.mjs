// shouldSkipUpdate — the guard on auto-update-branch.
//
// Runs with: node --test scripts/pr-watcher/__tests__/update-branch-guard.test.mjs
// ci.yml runs: node --test "scripts/pr-watcher/__tests__/*.mjs" on Ubuntu.
//
// `gh pr update-branch` rewrites the head, which CANCELS every in-flight check and
// restarts it. Station 00 lands a board PR on a cadence, so every open PR goes BEHIND
// on that cadence and this fires against whatever is mid-CI at the time.
//
// SCOPE, stated because it is deliberately narrower than the escalation asked for:
// this skips RUNNING only, never RED. A PR can be red BECAUSE it is behind — main may
// carry the fix — so refusing to update a red PR would strand it. The tests below pin
// that asymmetry so nobody "completes" the guard later without re-deciding it.
import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldSkipUpdate } from "../index.mjs";

const done = (name, conclusion) => ({ name, status: "COMPLETED", conclusion });

test("checks in flight: skip", () => {
  const r = shouldSkipUpdate([
    done("CodeQL", "SUCCESS"),
    { name: "tendering-e2e", status: "IN_PROGRESS", conclusion: null },
  ]);
  assert.equal(r.skip, true);
  assert.equal(r.check, "tendering-e2e");
});

test("queued counts as in flight — it has not started but it will", () => {
  const r = shouldSkipUpdate([{ name: "Web", status: "QUEUED", conclusion: null }]);
  assert.equal(r.skip, true);
  assert.equal(r.check, "Web");
});

test("all concluded green: update", () => {
  const r = shouldSkipUpdate([done("CodeQL", "SUCCESS"), done("API", "SUCCESS")]);
  assert.deepEqual(r, { skip: false });
});

test("RED but concluded: UPDATE — a PR can be red because it is behind", () => {
  // The deliberate half. main may carry the fix; skipping here strands the PR red.
  const r = shouldSkipUpdate([done("CodeQL", "SUCCESS"), done("API", "FAILURE")]);
  assert.deepEqual(r, { skip: false });
});

test("SKIPPED and NEUTRAL conclusions are concluded, not in flight", () => {
  // A path-filtered check reports SKIPPED. Treating that as running would wedge
  // every docs-only PR permanently.
  const r = shouldSkipUpdate([done("Web", "SKIPPED"), done("e2e", "NEUTRAL")]);
  assert.deepEqual(r, { skip: false });
});

test("cancelled-but-concluded does not block a fresh update", () => {
  // The state a previous mid-flight rebase leaves behind. It must not become
  // self-perpetuating.
  const r = shouldSkipUpdate([done("API", "CANCELLED")]);
  assert.deepEqual(r, { skip: false });
});

test("no checks at all: update — absence is not in-flight", () => {
  assert.deepEqual(shouldSkipUpdate([]), { skip: false });
});

test("DEGRADE: null/undefined/garbage rollup never throws and never blocks", () => {
  for (const bad of [null, undefined, "nope", 42, {}]) {
    assert.deepEqual(shouldSkipUpdate(bad), { skip: false }, `failed for ${JSON.stringify(bad)}`);
  }
});

test("DEGRADE: entries missing fields are ignored, not treated as running", () => {
  const r = shouldSkipUpdate([null, {}, { name: "x" }, done("API", "SUCCESS")]);
  assert.deepEqual(r, { skip: false });
});

test("an unnamed in-flight check still reports a usable string", () => {
  const r = shouldSkipUpdate([{ status: "IN_PROGRESS" }]);
  assert.equal(r.skip, true);
  assert.equal(r.check, "(unknown)");
});

test("KNOWN GAP: a legacy StatusContext entry fails OPEN, and that is deliberate", () => {
  // StatusContext carries `state`, not `status`. An in-flight one is invisible here, so
  // we rebase anyway - exactly today's behaviour. Pinned so the gap is a decision on
  // record rather than something discovered later and mistaken for a bug.
  const r = shouldSkipUpdate([{ __typename: "StatusContext", context: "legacy", state: "PENDING" }]);
  assert.deepEqual(r, { skip: false });
});
