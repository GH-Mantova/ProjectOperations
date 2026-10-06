// RETIRE_TESTS_DOCS_LANE_V1 (Marco, 2026-10-03).
//
// Unit tests for the post-PR routing decision. The dispatcher used to inline a
// ternary that dropped `off` into waitForMerge, which did enable blanket
// auto-merge — the latent hazard retirement closes. postPrRoute() isolates the
// decision so each policy × escalates combination is proven in isolation and the
// invariant "no `off` combination reaches `gh pr merge --auto`" is directly
// asserted, not inferred.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { postPrRoute } from "../index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const START_WATCHER_PS1 = path.join(__dirname, "..", "start-watcher.ps1");
const INDEX_MJS = path.join(__dirname, "..", "index.mjs");

// (1) off + non-escalating -> route-and-return (never calls `gh pr merge --auto`).
test("policy=off, escalates=false -> route-and-return", () => {
  assert.equal(postPrRoute({ policy: "off", escalates: false }), "route-and-return");
});

// (2) off + escalating -> hold-for-marco (label do-not-merge, no polling).
test("policy=off, escalates=true -> hold-for-marco", () => {
  assert.equal(postPrRoute({ policy: "off", escalates: true }), "hold-for-marco");
});

// (3) tests-docs preserves today's behaviour exactly for non-escalating PRs.
test("policy=tests-docs, escalates=false -> wait-tests-docs (unchanged)", () => {
  assert.equal(postPrRoute({ policy: "tests-docs", escalates: false }), "wait-tests-docs");
});

test("policy=tests-docs, escalates=true -> hold-for-marco (unchanged)", () => {
  assert.equal(postPrRoute({ policy: "tests-docs", escalates: true }), "hold-for-marco");
});

// (4) all (legacy blanket) still routes to waitForMerge for non-escalating PRs.
test("policy=all, escalates=false -> wait-all (unchanged)", () => {
  assert.equal(postPrRoute({ policy: "all", escalates: false }), "wait-all");
});

test("policy=all, escalates=true -> hold-for-marco (unchanged)", () => {
  assert.equal(postPrRoute({ policy: "all", escalates: true }), "hold-for-marco");
});

// (5) Negative control: NO input combination with policy="off" ever returns a
// route that leads to `gh pr merge --auto`. The dispatcher maps:
//   wait-tests-docs -> waitForPolicyMerge -> gh pr merge --auto
//   wait-all        -> waitForMerge       -> gh pr merge --auto
//   hold-for-marco  -> holdForMarco (labels, returns; no auto-merge)
//   route-and-return-> {ok:false, marco:true} synthetic (no auto-merge)
// So the invariant is: policy="off" never returns "wait-*".
test("INVARIANT: no policy=off combination routes to a `gh pr merge --auto` path", () => {
  const autoMergeRoutes = new Set(["wait-tests-docs", "wait-all"]);
  for (const escalates of [false, true]) {
    const route = postPrRoute({ policy: "off", escalates });
    assert.ok(
      !autoMergeRoutes.has(route),
      `policy=off,escalates=${escalates} returned ${route}, which would enable auto-merge`,
    );
  }
});

// (6) The exported routing function must be stable — a drift in route names
// would break the dispatcher silently. Pin the enum.
test("postPrRoute return values are exactly the four documented routes", () => {
  const seen = new Set();
  for (const policy of ["off", "tests-docs", "all", "unknown-value"]) {
    for (const escalates of [false, true]) {
      seen.add(postPrRoute({ policy, escalates }));
    }
  }
  const expected = new Set([
    "route-and-return",
    "hold-for-marco",
    "wait-tests-docs",
    "wait-all",
  ]);
  // seen must be a subset of expected (no stray routes).
  for (const route of seen) {
    assert.ok(expected.has(route), `unexpected route value: ${route}`);
  }
});

// (7) start-watcher.ps1's default is `off`. A node test reading the file is
// enough — the file is PowerShell, not JS, so a regex scan is the appropriate
// shape. The RETIRE_TESTS_DOCS_LANE_V1 marker must also appear so a reader can
// trace the default back to this retirement.
test("start-watcher.ps1 defaults PR_WATCHER_AUTO_MERGE_POLICY to 'off'", async () => {
  const content = await readFile(START_WATCHER_PS1, "utf8");
  // The default assignment must set it to "off" when the env var is unset.
  // Match loosely on whitespace, but strictly on the quoted value.
  const defaultLine =
    /if\s*\(\s*-not\s+\$env:PR_WATCHER_AUTO_MERGE_POLICY\s*\)\s*\{\s*\$env:PR_WATCHER_AUTO_MERGE_POLICY\s*=\s*"off"\s*\}/;
  assert.match(content, defaultLine, "start-watcher.ps1 must default PR_WATCHER_AUTO_MERGE_POLICY to 'off'");
  assert.match(content, /RETIRE_TESTS_DOCS_LANE_V1/, "start-watcher.ps1 must carry the RETIRE_TESTS_DOCS_LANE_V1 marker");
});

// (8) index.mjs must carry the marker too, so a grep for the tag finds both
// files the retirement edits. (The marker is part of the done_when check in
// the originating PR prompt.)
test("index.mjs carries the RETIRE_TESTS_DOCS_LANE_V1 marker", async () => {
  const content = await readFile(INDEX_MJS, "utf8");
  assert.match(content, /RETIRE_TESTS_DOCS_LANE_V1/, "index.mjs must carry the RETIRE_TESTS_DOCS_LANE_V1 marker");
});
