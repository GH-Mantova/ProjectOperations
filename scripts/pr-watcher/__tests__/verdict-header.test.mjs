// Unit tests for buildVerdictHeader - the pure header the watcher puts above a
// mirrored review verdict. Style follows verdict-guard.spec.mjs: node:test,
// node:assert/strict, zero external dependencies.
import assert from "node:assert/strict";
import { test } from "node:test";

import { buildVerdictHeader } from "../index.mjs";

const REL = "docs/pr-reviews/pr-1507-review.md";

test("a merged PR gets a POST-MERGE RECORD that denies gating the merge", () => {
  const h = buildVerdictHeader({ verdictRel: REL, prState: { state: "MERGED", mergedAt: "2026-09-02T03:20:18Z" } });
  assert.match(h, /POST-MERGE RECORD/);
  assert.match(h, /2026-09-02T03:20:18Z/);
  assert.match(h, /did NOT gate that merge/);
  assert.doesNotMatch(h, /PRE-MERGE/);
});

test("an open PR gets a PRE-MERGE REVIEW", () => {
  const h = buildVerdictHeader({ verdictRel: REL, prState: { state: "OPEN", mergedAt: null } });
  assert.match(h, /PRE-MERGE REVIEW/);
  assert.doesNotMatch(h, /POST-MERGE/);
});

test("a closed-unmerged PR gets a POST-CLOSE RECORD", () => {
  const h = buildVerdictHeader({ verdictRel: REL, prState: { state: "CLOSED", mergedAt: null } });
  assert.match(h, /POST-CLOSE RECORD/);
});

// The one that matters: a failed state read must never read as "this gated it".
test("a failed state read says so and claims nothing", () => {
  for (const bad of [null, undefined, "", 0]) {
    const h = buildVerdictHeader({ verdictRel: REL, prState: bad });
    assert.match(h, /POSITION UNKNOWN/);
    assert.match(h, /Do NOT assume this verdict gated the merge/);
    assert.doesNotMatch(h, /PRE-MERGE REVIEW/);
    assert.doesNotMatch(h, /POST-MERGE RECORD/);
  }
});

test("the header names the source and says the comment is the durable copy", () => {
  const h = buildVerdictHeader({ verdictRel: REL, prState: { state: "OPEN" } });
  assert.match(h, /docs\/pr-reviews\/pr-1507-review\.md/);
  assert.match(h, /local to the watcher clone/);
  assert.match(h, /durable copy/);
});

// The header is passed through a shell-spawned gh on Windows, where non-ASCII mangles.
test("the header is ASCII-only for every branch", () => {
  const states = [null, { state: "OPEN" }, { state: "CLOSED" }, { state: "MERGED", mergedAt: "2026-09-02T03:20:18Z" }];
  for (const s of states) {
    const h = buildVerdictHeader({ verdictRel: REL, prState: s });
    assert.ok(!/[^\x00-\x7F]/.test(h), `non-ASCII in header for ${JSON.stringify(s)}`);
  }
});
