// Unit tests for validateVerdict — the pure guard that cross-checks a review
// verdict's file references against the actual PR file list obtained from
// `gh pr view --json files`.
//
// Style follows verdict-archival.spec.mjs: node:test, node:assert/strict,
// zero external dependencies.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  validateVerdict,
  looksLikeCommand,
  isLikelySpaceTruncation,
} from "../verdict-guard.mjs";

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

// ---------------------------------------------------------------------------
// IN-SCOPE NARROWING (2026-09-04)
//
// A verdict cites paths for two reasons and only one is a claim about the diff.
// "In scope: <path>" asserts the PR changed that file. Everything else - the test
// cases exercised, the traps checked, the originating prompt - is EVIDENCE, and
// those paths are SUPPOSED to be absent from the diff.
//
// Scanning the whole document conflated them and blocked eight real PRs
// (#1542 #1543 #1544 #1545 #1561 #1563 #1564 #1572); #1543 and #1544 then waited
// ~15 h for a human. The incentive ran backwards: a verdict saying only "looks
// fine" passed, one that showed its work was blocked.
//
// The narrowing FAILS CLOSED - no in-scope line means the whole document is
// scanned, exactly as before.
// ---------------------------------------------------------------------------

// The real #1572 verdict, trimmed to the shape that mattered. One file in the PR;
// three cited paths that are correctly absent from it.
test("real-case regression #1572: evidence paths outside the claim do not block", () => {
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "Scope compliance:",
    "- In scope: scripts/pr-watcher/index.mjs constant rename and comment enhancement (1 file, +9/-6)",
    "- Out of scope: none",
    "",
    "Originating prompt: `pr-watcher-merge-policy-nested-test-paths-LOOPING.md`",
    "",
    "Self-verification claims:",
    "- Test case PR #1374 (scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs) passes",
    "- Test case substring trap (apps/api/src/rates/latest-rates.ts) refuses",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["scripts/pr-watcher/index.mjs"],
  });

  assert.deepEqual(result, { ok: true });
});

test("the claim itself is still guarded: an in-scope path absent from the PR blocks", () => {
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "Scope compliance:",
    "- In scope: `apps/api/src/ghost.ts` rewritten",
    "",
    "Self-verification claims:",
    "- Exercised apps/api/src/__tests__/ghost.spec.ts",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/real.ts"],
  });

  assert.equal(result.ok, false);
  // Only the CLAIM is reported - the evidence path is not dragged in.
  assert.deepEqual(result.unmatched, ["apps/api/src/ghost.ts"]);
});

test("FAILS CLOSED: a verdict with no in-scope line is still scanned whole", () => {
  // Byte-identical in shape to the free-prose regression above, which must keep
  // blocking. This is the property that makes the narrowing safe to ship.
  const verdictText = [
    "VERDICT: FIX",
    "",
    "The spec at `apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts`",
    "covers the happy path but not the error branch.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["docs/pipeline/foo.md"],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.unmatched, [
    "apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts",
  ]);
});

test("'Out of scope:' paths are never required to be present", () => {
  // A path named out-of-scope is being declared ABSENT from the diff. Requiring
  // it to be present would invert the check.
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "- In scope: apps/web/src/Kept.tsx",
    "- Out of scope: apps/web/src/Untouched.tsx (deliberately not modified)",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/web/src/Kept.tsx"],
  });

  assert.deepEqual(result, { ok: true });
});

test("recognises the formatting variants a reviewer actually writes", () => {
  for (const heading of ["In scope:", "**In scope**:", "- In Scope:", "in_scope:", "> In-scope:"]) {
    const result = validateVerdict({
      verdictText: `VERDICT: MERGE\n\n${heading} apps/api/src/foo.ts\n\nNotes: see apps/api/src/other.ts`,
      prFiles: ["apps/api/src/foo.ts"],
    });
    assert.deepEqual(result, { ok: true }, `heading form failed: ${heading}`);
  }
});

test("several in-scope lines: every one is checked, only the bad one is named", () => {
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "- In scope: apps/api/src/a.ts",
    "- In scope: apps/api/src/b.ts",
    "- In scope: apps/api/src/missing.ts",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["apps/api/src/a.ts", "apps/api/src/b.ts"],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.unmatched, ["apps/api/src/missing.ts"]);
});

// ---------------------------------------------------------------------------
// COMMANDS ARE EVIDENCE, NOT SCOPE CLAIMS
//
// A verdict shows its working, and the guard was reading the working as a claim.
// MEASURED 2026-09-04: 39 of the 117 files in docs/pr-prompts/blocked/ are
// verdict-guard blocks, NINE of them that day, and the three sampled name only
// commands the reviewer ran. #1574 narrowed WHICH text is scanned; these cover
// WHAT counts as a claim inside it.
// ---------------------------------------------------------------------------

const PR_FILES = ["scripts/pr-watcher/index.mjs"];

test("looksLikeCommand: a command word followed by an argument", () => {
  assert.equal(looksLikeCommand("node scripts/pipeline/lint-station.mjs"), true);
  assert.equal(looksLikeCommand("pnpm --filter api test"), true);
  assert.equal(looksLikeCommand("gh pr view 1580 --json files"), true);
});

test("looksLikeCommand: a flag, a quote, a pipe, a redirect or an &&", () => {
  assert.equal(looksLikeCommand("something --json"), true);
  assert.equal(looksLikeCommand('grep -c "device_bash" docs/pipeline/x.md'), true);
  assert.equal(looksLikeCommand("a | b"), true);
  assert.equal(looksLikeCommand("a > b"), true);
  assert.equal(looksLikeCommand("a && b"), true);
});

test("looksLikeCommand: a plain path is not a command", () => {
  assert.equal(looksLikeCommand("apps/api/src/foo.ts"), false);
  assert.equal(looksLikeCommand("scripts/pr-watcher/index.mjs:42"), false);
});

// A space alone must not condemn a span. `Claude Design/` is a real folder in this
// repo, and Station 04 flagged space-bearing paths as a live defect the same morning.
test("looksLikeCommand: a real path containing a space is not a command", () => {
  assert.equal(looksLikeCommand("Claude Design/assets/routes.js"), false);
});

test("the shape that blocked rev-1580 now passes", () => {
  const verdictText = [
    "MERGE",
    "",
    'Checked with `grep -c "device_bash" docs/pipeline/STATION-CAPABILITIES.md`',
    "and `node scripts/pipeline/lint-station.mjs`, both clean.",
    "The change itself is in `scripts/pr-watcher/index.mjs`.",
  ].join("\n");
  assert.deepEqual(validateVerdict({ verdictText, prFiles: PR_FILES }), { ok: true });
});

test("a fenced transcript is not mined for paths", () => {
  const verdictText = [
    "MERGE",
    "",
    "```",
    "$ node scripts/pipeline/check-breadcrumb.mjs",
    "apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx  ok",
    "```",
    "",
    "Only `scripts/pr-watcher/index.mjs` changed.",
  ].join("\n");
  assert.deepEqual(validateVerdict({ verdictText, prFiles: PR_FILES }), { ok: true });
});

// The guard must still do its job. Narrowing what counts as a claim must not let a
// genuine over-claim through.
test("a genuine over-claim in backticks still blocks", () => {
  const verdictText =
    "MERGE. This changes `apps/api/src/modules/rates/rate-resolver.service.ts`.";
  const result = validateVerdict({ verdictText, prFiles: PR_FILES });
  assert.equal(result.ok, false);
  assert.deepEqual(result.unmatched, [
    "apps/api/src/modules/rates/rate-resolver.service.ts",
  ]);
});

test("a bare path outside any fence or command still blocks", () => {
  const verdictText =
    "MERGE. Touches apps/web/src/pages/admin/RatesListsAdminPage.tsx as well.";
  const result = validateVerdict({ verdictText, prFiles: PR_FILES });
  assert.equal(result.ok, false);
  assert.deepEqual(result.unmatched, [
    "apps/web/src/pages/admin/RatesListsAdminPage.tsx",
  ]);
});

// ---------------------------------------------------------------------------
// SPACED_PATH_CANDIDATES_V1
//
// PATH_TOKEN_RE excludes whitespace, so a bare (un-backticked) reference to a
// file under a top-level directory whose name contains a space — the repo has
// `Claude Design/` and `Claude outputs/` — gets truncated:
// `Claude Design/proposed/x.html` matches only `Design/proposed/x.html`. That
// truncated token is not the name of any real file, and the resulting block
// note used to blame syncMain() and suggest deleting the reviewer's evidence.
//
// MEASURED: two occurrences in docs/pr-prompts/blocked/, 20 days apart —
// rev-1573-ready.md.guard-block.md (PR #1573, 6 tokens all beginning `Design/`)
// and rev-2157-ready.md.guard-block.md (PR #2157, `Design/proposed/...`).
//
// The rescue derives the spaced prefixes from prFiles themselves, offers the
// fully-prefixed variant as an ADDITIONAL candidate in pass 2, and relaxes
// pathMatches to also accept a `" " + candidate` suffix. Both are purely
// additive — a candidate is only accepted when it resolves to a real prFile.
// ---------------------------------------------------------------------------

test("SPACED_PATH_CANDIDATES_V1: bare Claude Design/... in a verdict matches the real PR file", () => {
  // The rev-2157 shape, distilled: an un-backticked reference to a file whose
  // top-level directory contains a space. Without the rescue, extractPaths
  // returns `Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html`,
  // which does not exist and blocks the verdict.
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "Reviewed the mockup at Claude Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html",
    "and it renders the traffic index legend correctly.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: [
      "Claude Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html",
    ],
  });

  assert.deepEqual(result, { ok: true });
});

test("SPACED_PATH_CANDIDATES_V1: rev-1573 shape — multiple bare Claude Design/... citations, all match", () => {
  // Six independent tokens truncated identically was the fingerprint that
  // distinguished the truncation defect from a stale clone in the field.
  const prFiles = [
    "Claude Design/a/one.html",
    "Claude Design/a/two.html",
    "Claude Design/b/three.html",
    "Claude Design/b/four.html",
    "Claude Design/c/five.html",
    "Claude Design/c/six.html",
  ];
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "Checked all six files:",
    ...prFiles.map((p) => `- ${p}`),
  ].join("\n");

  assert.deepEqual(validateVerdict({ verdictText, prFiles }), { ok: true });
});

test("SPACED_PATH_CANDIDATES_V1: a genuinely absent file under a spaced prefix still blocks", () => {
  // The rescue must not paper over real over-claims. `Claude Design/x/ghost.html`
  // is not in prFiles, so the block must fire — with the ORIGINAL truncated
  // token, since the extractor cannot know which spaced prefix was intended
  // when none of the prFiles produce a matching fully-prefixed candidate.
  const verdictText = [
    "VERDICT: MERGE",
    "",
    "Reviewed Claude Design/x/ghost.html and it looks right.",
  ].join("\n");

  const result = validateVerdict({
    verdictText,
    prFiles: ["Claude Design/x/real.html"],
  });

  assert.equal(result.ok, false);
  // The truncated variant is what the extractor produced; the fully-prefixed
  // variant is added but also does not resolve, so both remain unmatched. We
  // assert on the presence of the truncated form — that is the shape the block
  // note will display, and the diagnosis helper will identify the class.
  assert(result.unmatched.includes("Design/x/ghost.html"));
});

test("SPACED_PATH_CANDIDATES_V1: pathMatches suffix rescue when spacedPrefixes is empty", () => {
  // Defence in depth: even if a PR had no spaced top-level directories, a
  // verdict that names a file whose original path had a space-truncated
  // prefix should still match via the ` + candidate` suffix rule. Contrived:
  // a hypothetical prFile "Claude Design/foo.ts" is present, and the verdict
  // names bare "Design/foo.ts". Both mechanisms (candidate expansion AND
  // suffix relaxation) resolve this, which is intentional redundancy.
  const result = validateVerdict({
    verdictText: "Touches Design/foo.ts.",
    prFiles: ["Claude Design/foo.ts"],
  });
  assert.deepEqual(result, { ok: true });
});

test("isLikelySpaceTruncation: every unmatched path is ` ` + suffix of a prFile → true", () => {
  assert.equal(
    isLikelySpaceTruncation(
      ["Design/a.html", "Design/b.html"],
      ["Claude Design/a.html", "Claude Design/b.html"],
    ),
    true,
  );
});

test("isLikelySpaceTruncation: any path that is not a space-truncated suffix → false", () => {
  assert.equal(
    isLikelySpaceTruncation(
      ["Design/a.html", "apps/api/src/ghost.ts"],
      ["Claude Design/a.html", "apps/api/src/real.ts"],
    ),
    false,
  );
});

test("isLikelySpaceTruncation: empty unmatched list → false (no diagnosis to make)", () => {
  assert.equal(isLikelySpaceTruncation([], ["Claude Design/a.html"]), false);
});
