// Unit tests for validateVerdict — the pure guard that cross-checks a review
// verdict's file references against the actual PR file list obtained from
// `gh pr view --json files`.
//
// Style follows verdict-archival.spec.mjs: node:test, node:assert/strict,
// zero external dependencies.
import assert from "node:assert/strict";
import { test } from "node:test";

import { validateVerdict } from "../verdict-guard.mjs";

// (a) Verdict names one file that IS in prFiles → ok:true
test("returns ok:true when the only cited file is in prFiles", () => {
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "The change to `apps/api/src/foo.ts` looks correct.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/foo.ts"],
  });

  assert.deepEqual(result, { ok: true });
});

// (b) Verdict names one file NOT in prFiles → ok:false, path in unmatched
test("returns ok:false with unmatched path when cited file is not in prFiles", () => {
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "The change to `apps/api/src/ghost.ts` looks correct.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/real.ts"],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.unmatched, ["apps/api/src/ghost.ts"]);
});

// (c) Real-case regression: backtick-quoted allocation spec against docs-only prFiles
test("real-case regression: allocation spec cited against docs-only PR", () => {
  const verdictText = [
    "VERDICT: FIX",
    "",
    "The spec at `apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts`",
    "covers the happy path but not the error branch.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["docs/pipeline/foo.md", "docs/pipeline/bar.md"],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.unmatched, [
    "apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts",
  ]);
});

// (d) Paths in docs/pr-reviews/ and docs/pr-prompts/ are ignored → ok:true
test("ignores docs/pr-reviews/ and docs/pr-prompts/ paths", () => {
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "This review is stored at docs/pr-reviews/pr-9999-review.md.",
    "The prompt was docs/pr-prompts/foo.md.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/something.ts"],
  });

  assert.deepEqual(result, { ok: true });
});

// (e) Verdict with no path-shaped tokens at all → ok:true
test("returns ok:true when verdict contains no path-shaped tokens", () => {
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "The PR looks good overall. No concerns.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/something.ts"],
  });

  assert.deepEqual(result, { ok: true });
});

// (f) Path with trailing :1601 line-number suffix — strip and match correctly
test("strips trailing :line suffix before matching", () => {
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "See scripts/pr-watcher/index.mjs:1601 for the relevant call site.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["scripts/pr-watcher/index.mjs"],
  });

  assert.deepEqual(result, { ok: true });
});

// Extra: suffix match tolerates a prFiles entry that has a prefix
test("suffix match: cited short path matches a longer prFiles entry", () => {
  const verdictText = "Changes to `src/foo.ts` look correct.";

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/foo.ts"],
  });

  assert.deepEqual(result, { ok: true });
});

// Extra: multiple files, some matched some not → unmatched lists only the bad ones
test("mixed cited paths: only unmatched paths appear in result", () => {
  const verdictText = [
    "VERDICT: FIX",
    "",
    "- `apps/api/src/real.ts` — correct",
    "- `apps/api/src/ghost.ts` — the change here is wrong",
    "- `apps/api/src/also-real.ts` — fine",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/real.ts", "apps/api/src/also-real.ts"],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.unmatched, ["apps/api/src/ghost.ts"]);
});

// Extra: empty prFiles with no path citations → ok:true
test("empty prFiles and no citations → ok:true", () => {
  const result = validateVerdict({
    verdictText: "VERDICT: MERGE\n\nAll looks fine.",
    prFiles: [],
  });
  assert.deepEqual(result, { ok: true });
});

// Extra: backtick-quoted path with a line-range suffix (:12-34)
test("strips trailing :line-range suffix from backtick path", () => {
  const verdictText = "See `apps/api/src/bar.ts:12-34` for context.";

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/bar.ts"],
  });

  assert.deepEqual(result, { ok: true });
});

// Extra: unmatched list is deduplicated and sorted
test("unmatched list is sorted and deduplicated", () => {
  const verdictText = [
    "File `apps/z/c.ts` is bad.",
    "File `apps/a/b.ts` is bad.",
    "Also `apps/z/c.ts` again.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: [],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.unmatched, ["apps/a/b.ts", "apps/z/c.ts"]);
});
