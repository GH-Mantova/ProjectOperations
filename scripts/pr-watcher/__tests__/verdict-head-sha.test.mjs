// VERDICT_HEAD_SHA_ANCHOR_V1 — tie every review verdict to the commit it reviewed.
//
// MEASURED 2026-10-02: verdictApproves (export in ../index.mjs) reads the verdict
// file and tests only VERDICT: MERGE + the cited-files guard. No SHA is read on
// that path. If a push lands between the review and the merge, the old code
// auto-merges the newer, unreviewed commit under the older MERGE. These tests
// are the regression guard: a verdict approves one commit, not two.
//
// Style follows verdict-home-resolver.test.mjs — node:test, node:assert/strict,
// temp-dir sandboxes, zero external deps. All FS work under os.tmpdir().

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  renderTemplate,
  verdictApproves,
  verdictApprovesStatus,
  verdictReviewedSha,
  verdictStatus,
  hasQueuedReviewForHead,
  loadReviewedSet,
  _getReviewedHeads,
  _resetReviewedHeads,
} from "../index.mjs";

// Two full-length SHAs used throughout. Deliberately distinct so a prefix
// collision cannot hide a bug.
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHORT = "abcdef1";

// A verdict home that only exposes the clone path (same shape as the
// resolver uses in VERDICT_HOME_RESOLVER_V1 tests). Returns opts to inject.
async function makeHome(tag) {
  const base = await mkdtemp(path.join(tmpdir(), `vhs-${tag}-`));
  const repoRoot = path.join(base, "clone");
  const cloneReviews = path.join(repoRoot, "docs", "pr-reviews");
  const archiveDir = path.join(base, "archive");
  const devRoot = path.join(base, "devtree");
  await mkdir(cloneReviews, { recursive: true });
  await mkdir(archiveDir, { recursive: true });
  await mkdir(path.join(devRoot, "docs", "pr-reviews"), { recursive: true });
  return { base, cloneReviews, opts: { repoRoot, archiveDir, devTree: devRoot } };
}

async function writeVerdict(dir, prNumber, content) {
  const p = path.join(dir, `pr-${prNumber}-review.md`);
  await writeFile(p, content, "utf-8");
  return p;
}

// ─── 1a. verdictReviewedSha — bare line
test("verdictReviewedSha reads a bare REVIEWED-SHA line", () => {
  const text = `VERDICT: MERGE\nREVIEWED-SHA: ${SHA_A}\n\nLooks good.\n`;
  assert.equal(verdictReviewedSha(text), SHA_A);
});

// ─── 1b. verdictReviewedSha — heading-prefixed line
test("verdictReviewedSha tolerates a `## ` heading prefix", () => {
  const text = `## VERDICT: MERGE\n## REVIEWED-SHA: ${SHA_B}\n\nFindings.\n`;
  assert.equal(verdictReviewedSha(text), SHA_B);
});

// ─── 1c. verdictReviewedSha — ignores a SHA inside a closed code fence
test("verdictReviewedSha ignores a SHA quoted inside a closed code fence", () => {
  // The real verdict is MERGE with no SHA; the fenced block shows a transcript
  // that includes a REVIEWED-SHA line. The fence must be stripped before match.
  const text = [
    "VERDICT: MERGE",
    "",
    "Example output we saw while debugging:",
    "```",
    `REVIEWED-SHA: ${SHA_A}`,
    "```",
    "",
    "No real reviewed-sha was recorded.",
  ].join("\n");
  assert.equal(verdictReviewedSha(text), null);
});

// ─── 1d. verdictReviewedSha — short SHA returns null (prefix ambiguity)
test("verdictReviewedSha returns null for a short SHA (prefix can match two commits)", () => {
  const text = `VERDICT: MERGE\nREVIEWED-SHA: ${SHORT}\n`;
  assert.equal(verdictReviewedSha(text), null);
});

// ─── 1e. verdictReviewedSha — no line at all
test("verdictReviewedSha returns null when no REVIEWED-SHA line exists", () => {
  assert.equal(verdictReviewedSha("VERDICT: MERGE\n\nFine.\n"), null);
  assert.equal(verdictReviewedSha(""), null);
  assert.equal(verdictReviewedSha(null), null);
});

// ─── 2. MERGE verdict + SHA matches: approves
test("verdictApproves returns true for MERGE verdict whose REVIEWED-SHA matches headSha", async () => {
  const { cloneReviews, opts } = await makeHome("c2");
  await writeVerdict(cloneReviews, 2000, `VERDICT: MERGE\nREVIEWED-SHA: ${SHA_A}\n`);
  const approved = await verdictApproves(2000, null, { ...opts, headSha: SHA_A });
  assert.equal(approved, true, "matching SHA must approve");
});

// ─── 3. MERGE verdict + SHA differs: stale, does NOT approve
test("verdictApprovesStatus returns stale (and false) when REVIEWED-SHA differs from headSha", async () => {
  const { cloneReviews, opts } = await makeHome("c3");
  await writeVerdict(cloneReviews, 3000, `VERDICT: MERGE\nREVIEWED-SHA: ${SHA_A}\n`);
  const result = await verdictApprovesStatus(3000, null, { ...opts, headSha: SHA_B });
  assert.equal(result.status, "stale", `status must be "stale", got ${result.status}`);
  const approved = await verdictApproves(3000, null, { ...opts, headSha: SHA_B });
  assert.equal(approved, false, "a stale verdict must not approve");
});

// ─── 4. MERGE verdict + no SHA line + headSha given: missing, does NOT approve
test("verdictApprovesStatus returns missing when no REVIEWED-SHA line and headSha is given", async () => {
  const { cloneReviews, opts } = await makeHome("c4");
  await writeVerdict(cloneReviews, 4000, "VERDICT: MERGE\n\nNo sha anywhere.\n");
  const result = await verdictApprovesStatus(4000, null, { ...opts, headSha: SHA_A });
  assert.equal(result.status, "missing");
  const approved = await verdictApproves(4000, null, { ...opts, headSha: SHA_A });
  assert.equal(approved, false, "missing SHA line must not approve when head is specified");
});

// ─── 5. No headSha given: backward compatible — approves on MERGE text alone
test("verdictApproves is backward compatible when headSha is omitted", async () => {
  const { cloneReviews, opts } = await makeHome("c5");
  await writeVerdict(cloneReviews, 5000, "VERDICT: MERGE\n\nNo sha, no problem.\n");
  // No headSha in opts — the SHA check is skipped entirely.
  const approved = await verdictApproves(5000, null, opts);
  assert.equal(approved, true, "omitting headSha must preserve the pre-anchor behaviour");
});

// ─── 6. renderTemplate replaces {{HEAD_SHA}} and leaves other placeholders
test("renderTemplate substitutes {{HEAD_SHA}} and leaves the other placeholders working", () => {
  const template = [
    "PR #{{PR_NUMBER}} '{{PR_TITLE}}'",
    "Queue: {{PROMPT_DIR}}",
    "Files:",
    "{{PR_FILES}}",
    "Head SHA: {{HEAD_SHA}}",
  ].join("\n");
  const rendered = renderTemplate(template, 42, "my title", "/q", ["a.ts"], SHA_A);
  assert.ok(rendered.includes(`Head SHA: ${SHA_A}`), "{{HEAD_SHA}} must be substituted");
  assert.ok(rendered.includes("PR #42"), "{{PR_NUMBER}} still works");
  assert.ok(rendered.includes("'my title'"), "{{PR_TITLE}} still works");
  assert.ok(rendered.includes("Queue: /q"), "{{PROMPT_DIR}} still works");
  assert.ok(rendered.includes("- a.ts"), "{{PR_FILES}} still works");
  assert.ok(!rendered.includes("{{HEAD_SHA}}"), "placeholder must be gone");
});

test("renderTemplate renders (unknown) when headSha is missing or empty", () => {
  const template = "{{HEAD_SHA}}";
  assert.equal(renderTemplate(template, 1, "t", "/q", [], undefined), "(unknown)");
  assert.equal(renderTemplate(template, 1, "t", "/q", [], ""), "(unknown)");
});

// ─── 7a. Dedupe: same (PR, SHA) returns "already queued"; new SHA is new
test("hasQueuedReviewForHead dedupes per (PR, head) and admits a new head", () => {
  const heads = { "100": [SHA_A.toLowerCase()] };
  assert.equal(hasQueuedReviewForHead(heads, 100, SHA_A), true, "same (PR, SHA) is a dupe");
  assert.equal(hasQueuedReviewForHead(heads, 100, SHA_B), false, "new SHA must be allowed");
  assert.equal(hasQueuedReviewForHead(heads, 101, SHA_A), false, "different PR must be allowed");
  // Case-insensitive on the input: a caller passing an upper-cased SHA still
  // hits the dedupe entry stored lower-cased.
  assert.equal(hasQueuedReviewForHead(heads, 100, SHA_A.toUpperCase()), true);
  // Guards: null/undefined map or empty SHA.
  assert.equal(hasQueuedReviewForHead(null, 100, SHA_A), false);
  assert.equal(hasQueuedReviewForHead(heads, 100, ""), false);
});

// ─── 7b. loadReviewedSet reads a state file that holds only `reviewed`
test("loadReviewedSet still reads a state file that only holds `reviewed`", async () => {
  _resetReviewedHeads();
  const dir = await mkdtemp(path.join(tmpdir(), "vhs-7b-"));
  const file = path.join(dir, "reviewed.json");
  await writeFile(file, JSON.stringify({ reviewed: [10, 20, 30] }), "utf-8");

  const set = await loadReviewedSet(file);
  assert.ok(set.has(10) && set.has(20) && set.has(30), "numbers must be loaded");
  assert.deepEqual(_getReviewedHeads(), {}, "no reviewedHeads key -> empty map");
});

// ─── 7c. loadReviewedSet reads a state file with reviewedHeads too
test("loadReviewedSet loads reviewedHeads when present", async () => {
  _resetReviewedHeads();
  const dir = await mkdtemp(path.join(tmpdir(), "vhs-7c-"));
  const file = path.join(dir, "reviewed.json");
  await writeFile(file, JSON.stringify({
    reviewed: [1824],
    reviewedHeads: { "1824": [SHA_A.toLowerCase()] },
  }), "utf-8");
  await loadReviewedSet(file);
  const heads = _getReviewedHeads();
  assert.deepEqual(heads, { "1824": [SHA_A.toLowerCase()] });
  assert.equal(hasQueuedReviewForHead(heads, 1824, SHA_A), true);
  assert.equal(hasQueuedReviewForHead(heads, 1824, SHA_B), false,
    "a push to a new head must be allowed one more review");
});

// ─── 8. Negative control: FIX verdict with matching SHA still does not approve
// The SHA check must never WIDEN the gate — only tighten it. A FIX verdict is
// still a FIX, even if its REVIEWED-SHA matches the PR's current head.
test("FIX verdict with matching SHA does NOT approve (negative control)", async () => {
  const { cloneReviews, opts } = await makeHome("c8");
  await writeVerdict(cloneReviews, 8000, `VERDICT: FIX\nREVIEWED-SHA: ${SHA_A}\n`);
  const approved = await verdictApproves(8000, null, { ...opts, headSha: SHA_A });
  assert.equal(approved, false, "FIX never approves, regardless of SHA match");
  const status = await verdictApprovesStatus(8000, null, { ...opts, headSha: SHA_A });
  assert.equal(status.status, "rejects");
});

// ─── Bonus coverage: verdictStatus pure function
test("verdictStatus classifies all four cases", () => {
  const merge = `VERDICT: MERGE\nREVIEWED-SHA: ${SHA_A}\n`;
  const mergeNoSha = "VERDICT: MERGE\n";
  const fix = `VERDICT: FIX\nREVIEWED-SHA: ${SHA_A}\n`;
  assert.equal(verdictStatus(merge, SHA_A), "approves");
  assert.equal(verdictStatus(merge, SHA_B), "stale");
  assert.equal(verdictStatus(mergeNoSha, SHA_A), "missing");
  assert.equal(verdictStatus(fix, SHA_A), "rejects");
  // No expected SHA — approves as long as it's a MERGE.
  assert.equal(verdictStatus(mergeNoSha, undefined), "approves");
  assert.equal(verdictStatus(fix, undefined), "rejects");
});
