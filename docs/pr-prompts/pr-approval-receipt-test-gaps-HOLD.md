---
premise: '! grep -q "label present overrides" scripts/pr-gates/__tests__/approval-receipt.test.mjs'
premise_means: >-
  The CP-26 test suite that shipped in #1492 has four uncovered branches. MEASURED 2026-09-01 on
  origin/main at 13e5397c - scripts/pr-gates/__tests__/approval-receipt.test.mjs is 11,325 bytes
  and 19 tests, and none of them (a) combines labelPresent:true with a valid receipt to prove the
  label check short-circuits, (b) passes receiptBody:null while receiptInDiff:true, which is the
  read-error path through parseReceipt, (c) exercises a primitive row inside the events array
  (a bare string or number), or (d) passes a plain object rather than an array to
  wasEverEscalated. The closed PR #1493 - a duplicate build of the same prompt, superseded by
  #1492 - did cover those four, and they are the only material coverage it had that main lacks.
scope:
  - scripts/pr-gates/__tests__/approval-receipt.test.mjs
done_when: >-
  grep -q "label present overrides" scripts/pr-gates/__tests__/approval-receipt.test.mjs &&
  node --test "scripts/pr-gates/__tests__/*.mjs"
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# CP-26 tests: add the four branches #1493 covered and #1492 did not

## Read this before you start, because the obvious approach is wrong

PR #1493 was closed as a duplicate of #1492. Both were built from
`pr-gates-approval-receipt-HOLD.md` by different agents; #1492 merged first and is what main runs.

**Do NOT copy #1493's test file onto main.** It was written against #1493's module, which used a
different, coarser set of result codes. MEASURED - the two implementations disagree:

| Case | #1493's tests assert | main's module actually returns |
|---|---|---|
| escalated, no receipt in diff | `RECEIPT_MISSING` | **`RELEASED_NO_RECEIPT`** |
| receipt missing `pr` | `RECEIPT_MALFORMED` | **`RECEIPT_MISSING_PR`** |
| receipt `pr` mismatched | `RECEIPT_MALFORMED` | **`RECEIPT_WRONG_PR`** |
| receipt missing `approved_by` | `RECEIPT_MALFORMED` | **`RECEIPT_MISSING_APPROVED_BY`** |
| receipt missing `approved_at` | `RECEIPT_MALFORMED` | **`RECEIPT_MISSING_APPROVED_AT`** |
| `approved_at` unparseable | `RECEIPT_MALFORMED` | **`RECEIPT_INVALID_APPROVED_AT`** |
| empty body | `RECEIPT_MALFORMED` | **`RECEIPT_EMPTY_BODY`** |
| no front matter | `RECEIPT_MALFORMED` | **`RECEIPT_MALFORMED_FRONT_MATTER`** |

Dropping #1493's file in would fail roughly a dozen tests, and the temptation would then be to
"fix" the module to match the tests. That would be backwards: **main's granular codes are the
better contract, and `docs/decisions/merge-approvals/README.md` already advertises them by name**
(`RECEIPT_MISSING_PR`, `RECEIPT_INVALID_APPROVED_AT`). The module is right. Only the coverage is
short.

**Do not modify `scripts/pr-gates/approval-receipt.mjs`.** This slice touches one file: the test.

## What is already right - do not rebuild it

MEASURED on origin/main at 13e5397c. `approval-receipt.test.mjs` already covers, and covers well:

- `wasEverEscalated`: a labelled event, `unlabeled`-only, empty array, non-array inputs, a mixed
  array of null/undefined/partial rows, and **case sensitivity** (`Do-Not-Merge` must NOT match).
  That last one is a genuinely good test that #1493 lacked - keep it.
- The four primary truth-table rows: `LABEL_PRESENT`, `NEVER_ESCALATED`, `RELEASED_NO_RECEIPT`,
  `RECEIPT_VALID`.
- All eight malformed-receipt codes, each asserted by its own specific code.
- `receiptInDiff:false` with a valid `receiptBody` - the "receipt on main from an earlier PR does
  not clear this one" case.
- A negative control proving the `everLabeled` term is load-bearing, which logs
  `correct=3/3 ordinary-pass, broken=3/3 ordinary-fail`.

Do not restructure the file, do not rename its `receipt()` fixture helper, and do not convert its
flat `test(...)` calls into `describe` blocks. Add to it.

## Add exactly these four tests

1. **Label precedence.** `labelPresent: true` together with `receiptInDiff: true` and a valid
   `receiptBody` must still return `FAIL` / `LABEL_PRESENT`. The label check short-circuits ahead
   of everything else, and nothing currently proves that a valid receipt cannot release a PR whose
   label is still on. Name the test so it contains the phrase **`label present overrides`** -
   `done_when` greps for it.

2. **Read-error path.** `receiptInDiff: true` with `receiptBody: null`. The caller sets this when
   the file is named in the diff but could not be read. It must reach
   `RECEIPT_MALFORMED_FRONT_MATTER` via `parseReceipt`'s empty-or-missing branch. Assert the code,
   not just the verdict.

3. **Primitive rows inside the events array.** `wasEverEscalated(["garbage", 42, { event:
   "labeled", label: { name: "do-not-merge" } }])` must not throw and must return `true`. Main's
   existing tolerance test uses only object and nullish rows; a bare string or number takes a
   different path through the `typeof` guard.

4. **A plain object passed instead of an array.** `wasEverEscalated({ event: "labeled", label: {
   name: "do-not-merge" } })` must return `false`. Main's non-array test passes
   `{ event: "labeled" }`, which would return false even if `Array.isArray` were removed, because
   it has no matching label - so it does not actually prove the array guard. This fixture does.
   That distinction is the point of the test; say so in a comment.

Use the file's existing `receipt()` helper for any receipt fixture rather than hand-building a
string.

## Prove the new tests can fail

DOCTRINE section 7 guard 1. For each of the four, confirm it is load-bearing before you believe it:

- Test 1: temporarily move the `labelPresent` block below the `everLabeled` check in a scratch copy
  of the module and confirm the new test fails. **Revert that scratch edit** - it must not appear
  in the diff.
- Test 4: temporarily drop `if (!Array.isArray(events)) return false;` in a scratch copy and
  confirm the new test fails while main's existing non-array test still passes. That contrast is
  the finding worth reporting.

Report both results in the PR body as measured numbers. If a test passes with the rule removed,
it is not testing the rule - rewrite the fixture until it does.

## Do not do these things

- **Do not touch `approval-receipt.mjs`, `approval-receipt-check.mjs`, `pr-gates.mjs`, or
  `ci.yml`.** If a new test reveals what looks like a real defect in the module, **stop and report
  it as a finding**. Changing a live merge gate is not in scope for a test slice, and CP-26 is the
  gate that decides whether escalated PRs can merge.
- **Do not reopen or cherry-pick #1493.** It is closed as a duplicate; this slice is the only part
  of it worth keeping.
- **Do not add a receipt file.** This PR was never escalated, so CP-26 passes with
  `NEVER_ESCALATED` and no receipt is required.

## A note for whoever reviews this

This slice exists because one prompt was consumed twice and produced two implementations. The
prompt has since been retired. The lasting fix is the module-provenance chain
(`pr-module-provenance-s1/s2`, staged and unarmed), which records which prompt produced which PR
so a consumed prompt cannot be picked up again.

## Gate routing

`scripts/` is outside `^(tests|docs)/`, so `classifyPolicyFiles` routes this to Marco and the
watcher will not auto-merge it, despite it being a test-only change. That is expected; do not try
to work around it.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.
