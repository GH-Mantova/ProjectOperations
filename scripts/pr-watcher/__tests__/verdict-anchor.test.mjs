// Tests for verdictTextApproves (VERDICT_HEADING_TOLERANT_V1) and its wiring into
// verdictApproves.
//
// WHAT THIS GUARDS. The watcher decides whether its own reviewer approved a PR with one
// pattern. That pattern was anchored hard at column 0, and the reviewer's output format is
// not constrained: MEASURED over docs/pr-reviews/ in this repo (59 files, 49 containing a
// MERGE verdict) the old regex read 47 and silently missed pr-762-review.md, whose line 3
// is "## VERDICT: MERGE". A missed MERGE is filed as
// "timeout waiting for green checks + MERGE verdict" — byte-identical to a genuine policy
// routing, which is why it went unnoticed.
//
// THE RISK RUNS BOTH WAYS, AND NOT SYMMETRICALLY. A verdict this reader misses costs a
// deadlocked PR and a human. A verdict this reader INVENTS arms auto-merge. So the
// negative controls below are the tests that matter: they are here to prove the widening
// did not make the reader permissive, and the NEAR-MISS block is there because "mentions a
// verdict" and "is a verdict" are different things — a quotation, a heading in a report
// ABOUT verdicts, and a fenced example must all still read as NO APPROVAL.
//
// Style: node:test, node:assert/strict, zero external dependencies. FS work uses
// os.tmpdir() — never the real trees.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { verdictApproves, verdictTextApproves } from "../index.mjs";

// Fixtures are built from line arrays rather than template literals so that a fence
// marker in a fixture is unambiguous in the source.
const doc = (...lines) => lines.join("\n");

// The pattern EXACTLY as it stood before VERDICT_HEADING_TOLERANT_V1. Used only by the
// "strictly additive" property test below, which is the direct proof that widening the
// reader took nothing away.
const OLD_ANCHORED_RE = /^VERDICT:\s*MERGE\b/m;

// ---------------------------------------------------------------------------
// APPROVES — the pre-existing form (regression controls) and the new heading form
// ---------------------------------------------------------------------------

// Every entry here is also fed to the "strictly additive" property test.
const APPROVES = [
  ["bare verdict, whole file", doc("VERDICT: MERGE")],
  ["bare verdict, line 1, with a body under it", doc("VERDICT: MERGE", "", "Looks good.")],
  ["bare verdict on line 3, under a title", doc("# Review of PR #1234", "", "VERDICT: MERGE")],
  ["extra spaces after the colon", doc("VERDICT:   MERGE")],
  ["a tab after the colon", doc("VERDICT:\tMERGE")],
  ["CRLF line endings", "# Review\r\n\r\nVERDICT: MERGE\r\n"],
  ["trailing text on the verdict line", doc("VERDICT: MERGE — ship it")],
];

for (const [label, content] of APPROVES) {
  test(`approves (unchanged behaviour): ${label}`, () => {
    assert.equal(verdictTextApproves(content), true);
  });
}

// The fix. pr-762-review.md's real shape is a title, a blank line, then "## VERDICT: MERGE"
// on line 3 — this is that file's shape, which is also the prompt's "verdict on line 3
// rather than line 1" case.
const HEADING_APPROVES = [
  ["h2 heading, bare", doc("## VERDICT: MERGE")],
  ["h2 heading on line 3 (the pr-762 shape)", doc("# Review of PR #762", "", "## VERDICT: MERGE")],
  ["h1 heading", doc("# VERDICT: MERGE")],
  ["h6 heading (the deepest ATX level)", doc("###### VERDICT: MERGE")],
  ["heading with a tab after the hashes", doc("##\tVERDICT: MERGE")],
  ["heading with several spaces after the hashes", doc("##    VERDICT: MERGE")],
  ["closed ATX heading", doc("## VERDICT: MERGE ##")],
];

for (const [label, content] of HEADING_APPROVES) {
  test(`approves (newly, the fix): ${label}`, () => {
    assert.equal(verdictTextApproves(content), true);
    // Each of these is a string the OLD reader rejected. If this stops being true the
    // fixture has drifted and the test above has stopped testing the fix.
    assert.equal(OLD_ANCHORED_RE.test(content), false, "fixture must be one the old reader missed");
  });
}

// A real verdict that happens to sit AFTER a code block must still be read. This is the
// guard on the fence-blanking below: blanking must not eat the document.
test("approves: a real verdict after a closed fence containing unrelated output", () => {
  const content = doc(
    "# Review of PR #999",
    "",
    "```",
    "$ pnpm test",
    "264 passing",
    "```",
    "",
    "## VERDICT: MERGE",
  );
  assert.equal(verdictTextApproves(content), true);
});

// An UNCLOSED fence must not swallow the rest of the document. A malformed review losing
// its own verdict is the exact deadlock this slice exists to remove, so fence handling
// fails toward READING the verdict.
test("approves: an unclosed fence does not swallow the verdict below it", () => {
  const content = doc(
    "# Review",
    "",
    "```",
    "some output the reviewer forgot to close",
    "",
    "## VERDICT: MERGE",
  );
  assert.equal(verdictTextApproves(content), true);
});

// ---------------------------------------------------------------------------
// REJECTS — verdicts that are not MERGE
// ---------------------------------------------------------------------------

const NOT_MERGE = [
  ["bare BLOCK", doc("VERDICT: BLOCK")],
  ["bare FIX", doc("VERDICT: FIX")],
  ["heading BLOCK", doc("## VERDICT: BLOCK")],
  ["heading FIX", doc("## VERDICT: FIX")],
  // MERGE\b is untouched by this change. MERGED is the case the word boundary exists for.
  ["MERGED is not MERGE", doc("VERDICT: MERGED")],
  ["heading MERGED is not MERGE", doc("## VERDICT: MERGED")],
  ["MERGE_LATER is not MERGE", doc("VERDICT: MERGE_LATER")],
  ["DO NOT MERGE", doc("VERDICT: DO NOT MERGE")],
  ["NO MERGE", doc("VERDICT: NO MERGE")],
  ["empty document", ""],
  ["a document with no verdict at all", doc("# Review", "", "Looks fine to me.")],
];

for (const [label, content] of NOT_MERGE) {
  test(`rejects (not a MERGE verdict): ${label}`, () => {
    assert.equal(verdictTextApproves(content), false);
  });
}

// ---------------------------------------------------------------------------
// REJECTS — NEAR MISSES. Text that MENTIONS a MERGE verdict without BEING one.
//
// These are the tests that keep the widening honest. Every string below contains the
// literal "VERDICT: MERGE"; none of them is a decision to merge, and this reader arms
// auto-merge, so every one of them must read as NO APPROVAL.
// ---------------------------------------------------------------------------

const NEAR_MISSES = [
  // A report ABOUT the verdict format, quoting the form it is reporting on, inside a
  // fence. The document's own verdict is BLOCK. This is the case that most plausibly
  // occurs in the wild: it is the shape of a review OF THIS VERY CHANGE.
  [
    "a fenced example inside a review whose real verdict is BLOCK",
    doc(
      "# Review of PR #1730 — verdict reader tolerates a heading",
      "",
      "VERDICT: BLOCK",
      "",
      "The change makes the reader accept the heading form:",
      "",
      "```md",
      "## VERDICT: MERGE",
      "VERDICT: MERGE",
      "```",
      "",
      "I do not think the fence handling is right.",
    ),
  ],
  [
    "a tilde-fenced example inside a review whose real verdict is FIX",
    doc("VERDICT: FIX", "", "~~~", "## VERDICT: MERGE", "~~~"),
  ],
  // A quotation. The reviewer is citing what some other document said.
  ["a blockquoted bare verdict", doc("# Review", "", "The earlier review said:", "", "> VERDICT: MERGE")],
  ["a blockquoted heading verdict", doc("# Review", "", "> ## VERDICT: MERGE")],
  // Four leading spaces is a markdown INDENTED CODE BLOCK — an example, not a heading.
  // The obvious widening ("#{0,6}[ \t]*") would have accepted this one.
  ["an indented code block (four spaces)", doc("# Review", "", "    VERDICT: MERGE")],
  ["an indented code block (a tab)", doc("# Review", "", "\tVERDICT: MERGE")],
  // Not ATX headings: ATX requires whitespace after the hashes, and stops at six.
  // "#{0,6}[ \t]*" would have accepted the first of these too.
  ["hashes with no space is not a heading", doc("#VERDICT: MERGE")],
  ["seven hashes is not a heading", doc("####### VERDICT: MERGE")],
  // Prose. The anchor did this job before and still does.
  ["mid-line prose", doc("The reviewer wrote VERDICT: MERGE on line 3, which the reader missed.")],
  ["mid-line prose after a heading marker", doc("## The reviewer wrote VERDICT: MERGE and we missed it")],
  ["an inline-code mention", doc("# Review", "", "The pattern is `VERDICT: MERGE`, anchored at column 0.")],
  ["an html comment", doc("<!-- VERDICT: MERGE -->")],
  // A list item is not a verdict line either.
  ["a bulleted mention", doc("- VERDICT: MERGE was expected here")],
];

for (const [label, content] of NEAR_MISSES) {
  test(`rejects (NEAR MISS — mentions a verdict, is not one): ${label}`, () => {
    assert.equal(verdictTextApproves(content), false);
  });
}

// KNOWN, DELIBERATE, NOT FIXED HERE. pr-1347-review.md's line 3 is "**VERDICT: MERGE**" —
// a second live instance of the same defect class (a markdown decoration defeating the
// anchor), found in this repo's corpus while measuring this change. It is NOT fixed here:
// this slice widens the reader for ONE form, on the argument that every widening of a
// reader that arms auto-merge should be a decision rather than a side effect. Recorded as
// a test so the next person finds it as a fact rather than a surprise. Flip this
// assertion, do not delete it, if the bold form is later admitted on purpose.
test("rejects (known unfixed): the bold form **VERDICT: MERGE** — pr-1347's live shape", () => {
  assert.equal(verdictTextApproves(doc("# Review of PR #1347", "", "**VERDICT: MERGE**")), false);
});

// Non-string input must not throw and must not approve.
for (const bad of [undefined, null, 0, {}, ["VERDICT: MERGE"]]) {
  test(`rejects (non-string input): ${JSON.stringify(bad) ?? String(bad)}`, () => {
    assert.equal(verdictTextApproves(bad), false);
  });
}

// ---------------------------------------------------------------------------
// STRICTLY ADDITIVE — the property, not an example
// ---------------------------------------------------------------------------

// Everything the OLD anchored reader approved, the new one must still approve. Run over
// every fixture in this file that is not a fenced one (fenced text is the ONE deliberate
// place the new reader is stricter than the old, and it is stricter in the fail-closed
// direction: it refuses to read a verdict out of a quoted example).
test("strictly additive: every string the old anchored reader approved still approves", () => {
  const fenced = new Set(["```", "~~~"]);
  const corpus = [...APPROVES, ...HEADING_APPROVES, ...NOT_MERGE, ...NEAR_MISSES]
    .map(([label, content]) => [label, content])
    .filter(([, content]) => typeof content === "string")
    .filter(([, content]) => ![...fenced].some((f) => content.includes(f)));

  let oldApproved = 0;
  for (const [label, content] of corpus) {
    if (!OLD_ANCHORED_RE.test(content)) continue;
    oldApproved++;
    assert.equal(
      verdictTextApproves(content),
      true,
      `the old reader approved "${label}" and the new one must too`,
    );
  }
  // Guard against the property passing vacuously: if the corpus stops containing any
  // string the old reader approved, this test proves nothing.
  assert.ok(oldApproved >= 5, `expected the corpus to exercise the old reader; got ${oldApproved}`);
});

// ---------------------------------------------------------------------------
// WIRING — the pure predicate is actually the one production uses
// ---------------------------------------------------------------------------

// A pure-function suite proves nothing if verdictApproves still carries its own copy of
// the pattern. These cases go through the real I/O path.
async function sandbox(tag) {
  const base = await mkdtemp(path.join(tmpdir(), `vat-${tag}-`));
  const repoRoot = path.join(base, "clone");
  const cloneReviews = path.join(repoRoot, "docs", "pr-reviews");
  const archiveDir = path.join(base, "archive");
  const devRoot = path.join(base, "devtree");
  await mkdir(cloneReviews, { recursive: true });
  await mkdir(archiveDir, { recursive: true });
  await mkdir(path.join(devRoot, "docs", "pr-reviews"), { recursive: true });
  return { cloneReviews, opts: { repoRoot, archiveDir, devTree: devRoot } };
}

test("wiring: verdictApproves reads a heading-form verdict off disk", async () => {
  const { cloneReviews, opts } = await sandbox("head");
  await writeFile(
    path.join(cloneReviews, "pr-762-review.md"),
    doc("# Review of PR #762", "", "## VERDICT: MERGE", ""),
    "utf-8",
  );
  assert.equal(await verdictApproves(762, undefined, opts), true);
});

test("wiring: verdictApproves still rejects a BLOCK verdict off disk", async () => {
  const { cloneReviews, opts } = await sandbox("block");
  await writeFile(
    path.join(cloneReviews, "pr-763-review.md"),
    doc("# Review", "", "## VERDICT: BLOCK", ""),
    "utf-8",
  );
  assert.equal(await verdictApproves(763, undefined, opts), false);
});

// The phantom-file guard is unchanged by this slice and must still fire on a heading-form
// MERGE. Without this, widening the reader could have handed the guard's cases a free pass.
test("wiring: the verdict-guard still blocks a heading-form MERGE that cites a file not in the PR", async () => {
  const { cloneReviews, opts } = await sandbox("guard");
  await writeFile(
    path.join(cloneReviews, "pr-764-review.md"),
    doc("## VERDICT: MERGE", "", "In scope: `apps/web/src/components/NotInThisPr.tsx`"),
    "utf-8",
  );
  assert.equal(await verdictApproves(764, ["scripts/pr-watcher/index.mjs"], opts), false);
  // Positive control for the same fixture shape: cite a file that IS in the PR and the
  // same heading-form verdict approves. This is what proves the case above failed on the
  // guard and not on the heading.
  await writeFile(
    path.join(cloneReviews, "pr-765-review.md"),
    doc("## VERDICT: MERGE", "", "In scope: `scripts/pr-watcher/index.mjs`"),
    "utf-8",
  );
  assert.equal(await verdictApproves(765, ["scripts/pr-watcher/index.mjs"], opts), true);
});

// A missing verdict file is still not an approval (VERDICT_HOME_RESOLVER_V1's hole).
test("wiring: a verdict absent from all three homes does not approve", async () => {
  const { opts } = await sandbox("absent");
  assert.equal(await verdictApproves(766, undefined, opts), false);
});
