// Tests for scripts/pr-gates/sot-inpr.mjs -- the pure decision module
// behind CP-27. The suite covers parseInPrSection and decideInPrFreshness,
// plus a negative control that proves the "first-cell only" rule is load-bearing.
//
// Every fixture is built INLINE as a string literal. The real
// sot/02-roadmap-and-status.md is NEVER read -- tests must be hermetic.
//
// The negative control (test 13) follows the pattern from approval-receipt.test.mjs:
// build both a naive whole-section grep set and the parseInPrSection result,
// assert they DIFFER, so that removing the first-cell constraint is visible.

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInPrSection, decideInPrFreshness } from "../sot-inpr.mjs";

// ---------------------------------------------------------------------------
// parseInPrSection
// ---------------------------------------------------------------------------

test("parseInPrSection: one row, header (1) -> declaredCount=1, prNumbers=[123]", () => {
  const md = [
    "## 2. In-PR (1)",
    "",
    "| PR | Title | Notes |",
    "|---|---|---|",
    "| #123 | Some title | some notes |",
    "",
  ].join("\n");
  const result = parseInPrSection(md);
  assert.equal(result.declaredCount, 1);
  assert.deepEqual(result.prNumbers, [123]);
});

test("parseInPrSection: header (3), table has 2 rows -> declaredCount=3, prNumbers=[100,200]", () => {
  const md = [
    "## 2. In-PR -- open right now (3)",
    "",
    "| PR | Title | Notes |",
    "|---|---|---|",
    "| #100 | First PR | notes |",
    "| #200 | Second PR | notes |",
    "",
  ].join("\n");
  const result = parseInPrSection(md);
  assert.equal(result.declaredCount, 3);
  assert.deepEqual(result.prNumbers, [100, 200]);
});

test("parseInPrSection: no matching heading -> { declaredCount: null, prNumbers: [] }", () => {
  const md = [
    "# Some doc",
    "",
    "## 1. Overview",
    "",
    "Some content.",
    "",
    "## 3. Done",
    "",
    "| #999 | title | notes |",
  ].join("\n");
  const result = parseInPrSection(md);
  assert.equal(result.declaredCount, null);
  assert.deepEqual(result.prNumbers, []);
});

test("parseInPrSection: prose footnote below table naming #999 must NOT be picked up", () => {
  const md = [
    "## 2. In-PR (1)",
    "",
    "| PR | Title | Notes |",
    "|---|---|---|",
    "| #100 | Open PR | notes |",
    "",
    "Previously #999 was here but it merged last week.",
    "",
  ].join("\n");
  const result = parseInPrSection(md);
  assert.deepEqual(result.prNumbers, [100]);
});

test("parseInPrSection: heading with no parens -> declaredCount === null", () => {
  const md = [
    "## 2. In-PR",
    "",
    "| PR | Title | Notes |",
    "|---|---|---|",
    "| #55 | title | notes |",
    "",
  ].join("\n");
  const result = parseInPrSection(md);
  assert.equal(result.declaredCount, null);
  assert.deepEqual(result.prNumbers, [55]);
});

test("parseInPrSection: dedupe two table rows with same #100 -> single entry", () => {
  const md = [
    "## 2. In-PR (2)",
    "",
    "| PR | Title | Notes |",
    "|---|---|---|",
    "| #100 | First entry | notes |",
    "| #100 | Duplicate entry | more notes |",
    "",
  ].join("\n");
  const result = parseInPrSection(md);
  assert.deepEqual(result.prNumbers, [100]);
});

test("parseInPrSection: section stops at next ## heading, #999 in ## 3. must NOT appear", () => {
  const md = [
    "## 2. In-PR (1)",
    "",
    "| PR | Title | Notes |",
    "|---|---|---|",
    "| #100 | Open PR | notes |",
    "",
    "## 3. Done",
    "",
    "| #999 | Done PR | was merged |",
    "",
  ].join("\n");
  const result = parseInPrSection(md);
  assert.deepEqual(result.prNumbers, [100]);
  assert.equal(result.prNumbers.includes(999), false);
});

// ---------------------------------------------------------------------------
// decideInPrFreshness
// ---------------------------------------------------------------------------

test("decideInPrFreshness: one OPEN PR, count matches -> PASS", () => {
  const result = decideInPrFreshness({
    declaredCount: 1,
    prNumbers: [100],
    states: new Map([[100, "OPEN"]]),
  });
  assert.equal(result.verdict, "PASS");
  assert.match(result.detail, /1 row\(s\) all OPEN/);
});

test("decideInPrFreshness: one MERGED PR -> FAIL, detail names #n and MERGED", () => {
  const result = decideInPrFreshness({
    declaredCount: 1,
    prNumbers: [200],
    states: new Map([[200, "MERGED"]]),
  });
  assert.equal(result.verdict, "FAIL");
  assert.match(result.detail, /#200/);
  assert.match(result.detail, /MERGED/);
});

test("decideInPrFreshness: declaredCount=3, prNumbers.length=2, both OPEN -> FAIL count mismatch", () => {
  const result = decideInPrFreshness({
    declaredCount: 3,
    prNumbers: [100, 200],
    states: new Map([[100, "OPEN"], [200, "OPEN"]]),
  });
  assert.equal(result.verdict, "FAIL");
  assert.match(result.detail, /header count 3 disagrees with 2 table rows/);
});

test("decideInPrFreshness: declaredCount=null, one OPEN PR -> PASS (null count is not a mismatch)", () => {
  const result = decideInPrFreshness({
    declaredCount: null,
    prNumbers: [100],
    states: new Map([[100, "OPEN"]]),
  });
  assert.equal(result.verdict, "PASS");
});

test("decideInPrFreshness: empty prNumbers, declaredCount=null -> PASS", () => {
  const result = decideInPrFreshness({
    declaredCount: null,
    prNumbers: [],
    states: new Map(),
  });
  assert.equal(result.verdict, "PASS");
  assert.match(result.detail, /0 row\(s\) all OPEN/);
});

// ---------------------------------------------------------------------------
// Negative control: prove the "first-cell only" rule is load-bearing.
//
// A whole-section grep for #\d+ on the fixture from test 4 (prose footnote)
// would return BOTH #100 and #999. parseInPrSection returns only #100.
// Explicitly building both sets and asserting they differ proves the
// first-cell constraint is doing real work -- matching the pattern from
// approval-receipt.test.mjs.
// ---------------------------------------------------------------------------

test("negative control (prose-footnote trap): whole-section grep finds #100 and #999, but parseInPrSection finds only #100", () => {
  const md = [
    "## 2. In-PR (1)",
    "",
    "| PR | Title | Notes |",
    "|---|---|---|",
    "| #100 | Open PR | notes |",
    "",
    "Previously #999 was here but it merged last week.",
    "",
  ].join("\n");

  // Simulate a naive whole-section grep approach.
  // Find the section the same way parseInPrSection does.
  const lines = md.split("\n");
  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+2\.\s.*In-PR/.test(lines[i])) { headingIdx = i; break; }
  }
  let endIdx = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { endIdx = i; break; }
  }
  const sectionLines = lines.slice(headingIdx + 1, endIdx);
  const sectionText = sectionLines.join("\n");

  // Naive grep: extract all #\d+ from the whole section text.
  const naiveSet = new Set(
    [...sectionText.matchAll(/#(\d+)/g)].map((m) => parseInt(m[1], 10))
  );

  // parseInPrSection result.
  const { prNumbers } = parseInPrSection(md);
  const parseSet = new Set(prNumbers);

  // Naive grep finds BOTH #100 and #999.
  assert.equal(naiveSet.has(100), true, "naive grep should find #100");
  assert.equal(naiveSet.has(999), true, "naive grep should find #999 (in prose)");

  // parseInPrSection finds only #100.
  assert.equal(parseSet.has(100), true, "parseInPrSection should find #100");
  assert.equal(parseSet.has(999), false, "parseInPrSection must NOT pick up prose #999");

  // The two sets differ -- proving the rule is load-bearing.
  assert.notDeepEqual(
    [...naiveSet].sort((a, b) => a - b),
    [...parseSet].sort((a, b) => a - b),
    "naive set and parse set must differ (the first-cell rule is load-bearing)"
  );
});
