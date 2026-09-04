/**
 * breadcrumbsFromPrFiles - the open-PR half of the freshness input set.
 *
 * Runs with: node --test scripts/pipeline/__tests__/check-breadcrumb.open-prs.test.mjs
 * ci.yml runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu.
 *
 * WHY THIS FUNCTION IS PURE AND SEPARATELY EXPORTED. The bug it fixes was invisible
 * precisely because the freshness set was assembled inline, from two impure reads, with
 * nothing to assert against. The `gh` call stays in a one-line wrapper that cannot do
 * anything but succeed or return []; everything with a decision in it lives here, where
 * a test can pin it.
 *
 * The tests that matter most are the DEGRADE ones. This input is an improvement, never a
 * dependency: malformed, missing or absent data must yield [] and never throw, because a
 * throw here would turn a working detector into a broken one - strictly worse than the
 * false SILENT it was written to prevent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { breadcrumbsFromPrFiles, NAME_RE } from "../check-breadcrumb.mjs";

const DIR = "docs/pr-prompts";
const GOOD = "00-05-sot-keeper-2026-09-03-2154-sot-refs-provenance-burndown.md";
const GOOD2 = "00-00-supervisor-2026-09-04-0109-a-pr-head-froze-behind-its-own-branch.md";
const pr = (...paths) => ({ files: paths.map((p) => ({ path: p })) });

test("the real incident: a breadcrumb living only in an open PR is found", () => {
  // 05 wrote this at 21:54; it reached main at 01:55 inside #1554. In between it was in
  // neither `onDisk` nor `fromMain`, and 05 was reported SILENT at 58h while healthy.
  const out = breadcrumbsFromPrFiles([pr(`${DIR}/${GOOD}`)], DIR, NAME_RE);
  assert.deepEqual(out, [GOOD]);
});

test("collects across several open PRs", () => {
  const out = breadcrumbsFromPrFiles(
    [pr(`${DIR}/${GOOD}`), pr(`${DIR}/${GOOD2}`)], DIR, NAME_RE);
  assert.deepEqual(out.sort(), [GOOD2, GOOD].sort());
});

test("a PR's non-breadcrumb files are ignored, not counted", () => {
  const out = breadcrumbsFromPrFiles(
    [pr(`${DIR}/${GOOD}`, "sot/03-progress-log.md", "docs/qa/sot-refs-baseline.json",
        `${DIR}/pr-some-slice-HOLD.md`)], DIR, NAME_RE);
  assert.deepEqual(out, [GOOD]);
});

test("a sibling directory with the same prefix must not match", () => {
  // startsWith(dir) alone would swallow this; the separator is load-bearing.
  const out = breadcrumbsFromPrFiles(
    [pr(`${DIR}-archive/${GOOD}`, `${DIR}x/${GOOD}`)], DIR, NAME_RE);
  assert.deepEqual(out, []);
});

test("NAME_RE is the only gate, exactly as for the other two inputs", () => {
  const out = breadcrumbsFromPrFiles(
    [pr(`${DIR}/00-05-missing-the-slug-2026-09-03-2154.md`,
        `${DIR}/00-5-single-digit-station-2026-09-03-2154-slug.md`,
        `${DIR}/README.md`)], DIR, NAME_RE);
  assert.deepEqual(out, []);
});

test("a nested breadcrumb counts by basename - same as fromMain, deliberately", () => {
  // fromMain maps every tracked path under DIR to its basename with no depth limit, so
  // this input matches that rather than inventing a second, quieter rule.
  const out = breadcrumbsFromPrFiles([pr(`${DIR}/archive/${GOOD}`)], DIR, NAME_RE);
  assert.deepEqual(out, [GOOD]);
});

test("plain string file entries are accepted as well as {path}", () => {
  const out = breadcrumbsFromPrFiles([{ files: [`${DIR}/${GOOD}`] }], DIR, NAME_RE);
  assert.deepEqual(out, [GOOD]);
});

test("DEGRADE: no open PRs yields [] - the live case on an empty board", () => {
  assert.deepEqual(breadcrumbsFromPrFiles([], DIR, NAME_RE), []);
});

test("DEGRADE: malformed shapes return [] and never throw", () => {
  for (const bad of [null, undefined, {}, "", 0, [null], [{}], [{ files: null }],
                     [{ files: "not-an-array" }], [{ files: [null, 42, {}] }]]) {
    assert.deepEqual(breadcrumbsFromPrFiles(bad, DIR, NAME_RE), [],
      `expected [] for ${JSON.stringify(bad)}`);
  }
});

test("duplicates are returned, because de-duplication is the caller's Set", () => {
  // The caller does [...new Set([...onDisk, ...fromMain, ...fromPrs])]. If this function
  // de-duped too, that Set would look redundant and someone would eventually remove it.
  const out = breadcrumbsFromPrFiles(
    [pr(`${DIR}/${GOOD}`), pr(`${DIR}/${GOOD}`)], DIR, NAME_RE);
  assert.deepEqual(out, [GOOD, GOOD]);
});
