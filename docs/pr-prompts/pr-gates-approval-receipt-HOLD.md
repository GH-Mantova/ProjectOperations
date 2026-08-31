---
premise: '! grep -q "approval-receipt" scripts/pr-gates/pr-gates.mjs'
premise_means: >-
  The only machine-enforced human gate in this pipeline is a label whose removal is recorded as
  "UNLABELED by GH-Mantova" - the same actor string the watcher writes when it applies the label.
  A released escalation is therefore indistinguishable, in the audit trail, from an agent clearing
  its own gate. Nothing in the repo records who approved what, and the gate that reads the label
  is not a required check, so it cannot block a merge even when it is red.
scope:
  - scripts/pr-gates/approval-receipt.mjs
  - scripts/pr-gates/pr-gates.mjs
  - scripts/pr-gates/__tests__/**
  - .github/workflows/ci.yml
  - docs/decisions/merge-approvals/**
done_when: >-
  grep -q "approval-receipt" scripts/pr-gates/pr-gates.mjs && node --test
  "scripts/pr-gates/__tests__/*.mjs"
size: 6
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: pipeline-hygiene
cluster_order: 1
rollback_strategy: >-
  One new pure module, one gate edit, one new test file, one new CI job, one docs directory. No
  schema, no migration, no data, no change to any existing job. Revert the commit and CP-26 goes
  back to reading the label alone; no PR merged in the meantime becomes invalid, because the
  receipt is additive evidence, not a rewrite of any existing record.
---

# The human gate can be cleared by the machines it exists to stop

## The defect

`scripts/pr-gates/pr-gates.mjs:483` documents the release mechanism in as many words:

> Removing the label IS the human's approval: CI re-runs, this gate passes, the PR can merge.

CP-26 reads the **live label** (`:498`) and nothing else. On 2026-08-31 the events API for `#1431`
returned exactly two rows:

```
2026-08-31T05:40:02Z  LABELED    'do-not-merge'  by GH-Mantova
2026-08-31T05:53:54Z  UNLABELED  'do-not-merge'  by GH-Mantova
```

Marco has since confirmed that removal was his. That is the reassuring answer, and it changes
nothing about the mechanism: the watcher authenticates as `GH-Mantova` too, so the next such pair
of rows will be exactly as unattributable. The gate records a click that no one can attribute.

## What to build

### 1. `scripts/pr-gates/approval-receipt.mjs` - pure, exported, no I/O

Node built-ins only, ASCII-only output, matching the house style of `pr-gates.mjs`. Export two
functions and nothing else:

```js
export function wasEverEscalated(events)   // -> boolean
export function decideApprovalReceipt(input) // -> { verdict, code, message }
```

`wasEverEscalated(events)` takes the parsed array from
`gh api repos/{owner}/{repo}/issues/<pr>/events` and returns true if **any** row is
`{ event: "labeled", label: { name: "do-not-merge" } }`. Tolerate null/undefined/partial rows the
way `hasDeclaredDependencies` does - this runs on the hot path of a required check and a malformed
row must not throw.

`decideApprovalReceipt({ labelPresent, everLabeled, receiptInDiff, receiptBody, prNumber })`
returns one of:

| condition | verdict | why |
|---|---|---|
| `labelPresent` | FAIL | unchanged behaviour - a human must remove it |
| `!labelPresent && !everLabeled` | PASS | ordinary PR, never escalated, nothing to prove |
| `!labelPresent && everLabeled && !receiptInDiff` | FAIL | released without a receipt |
| receipt present but malformed | FAIL | name the missing field |
| otherwise | PASS | released with a receipt |

### 2. The receipt itself

`docs/decisions/merge-approvals/<pr>.md`, committed **to the PR branch** so it lands in the diff a
reviewer already reads:

```
---
pr: 1431
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---

Why this was approved, in the approver's own words. At least one non-empty line.
```

Validation, all four required: `pr` equals the PR number under test (a receipt copied from another
PR fails); `approved_by` non-empty; `approved_at` parses as a date; at least one non-empty body
line after the front matter. `receiptInDiff` means the file is in this PR's diff against the
merge-base - a receipt sitting on `main` from an earlier PR does not count.

Add `docs/decisions/merge-approvals/README.md` carrying the template above and one worked example.

### 3. `pr-gates.mjs` CP-26 calls the module

CP-26 keeps its existing label read verbatim and additionally fetches the events, then reports the
verdict `decideApprovalReceipt` returns. The existing PASS/FAIL strings for the label-present and
never-escalated cases must not change - other tooling greps this output. Fail CLOSED on any `gh`
error, exactly as the current code does when it cannot read labels.

CP-26 stays where it is and stays advisory. It is not the enforcement point; job 4 is.

### 4. A new CI job - this is the part that actually bites

`.github/workflows/ci.yml` gains a job that runs **only** this check:

```yaml
  approval-receipt:
    name: Approval receipt (CP-26)
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4.1.0
        with: { node-version: '22' }
      - run: node scripts/pr-gates/approval-receipt-check.mjs
        env:
          PR_NUMBER: ${{ github.event.pull_request.number }}
          GH_TOKEN: ${{ github.token }}
```

Three properties of this job are load-bearing, and getting any of them wrong is worse than not
shipping it:

1. **No path filter, no `needs:`.** A required check that never reports leaves every PR pending
   forever. This job must run on every pull request and pass in seconds for the ordinary case.
   `pipeline-tests` has the same property for the same reason and says so in a comment - copy that
   comment's spirit here.
2. **`fetch-depth: 0`.** `receiptInDiff` is computed against the merge-base with `origin/main`. A
   shallow checkout has no merge-base and the check would silently degrade - the exact failure mode
   `pipeline-tests` documents at `ci.yml:157-166`.
3. **Its own thin entry point.** `approval-receipt-check.mjs` does the I/O (env, `gh pr view`,
   `gh api ... /events`, `git diff --name-only`) and calls the pure module. Keep the decision
   logic out of it so the tests test the decision, not the plumbing.

Also add `- run: node --test "scripts/pr-gates/__tests__/*.mjs"` to the existing `pipeline-tests`
job. The double-quotes around the glob are load-bearing - `ci.yml:170-172` explains why.

### 5. Tests - `scripts/pr-gates/__tests__/approval-receipt.test.mjs`

Cover, at minimum: label present; never escalated; escalated and released with a valid receipt;
escalated and released with no receipt; each of the four malformed-receipt cases separately; a
receipt whose `pr` belongs to a different PR; a receipt present on `main` but absent from the diff;
and malformed/empty/null event rows through `wasEverEscalated`.

Include a **negative control**, as `#1438` did: delete the `everLabeled` term from the predicate,
confirm that exactly the escalation cases fail and the ordinary ones still pass, then restore it
and report both numbers in the PR body. A test suite that passes with the rule removed is not
testing the rule.

## What this prompt does NOT do - read this before claiming the hole is closed

**It does not make forgery impossible. It makes forgery visible.** Any actor with write access to
the repo can commit `docs/decisions/merge-approvals/<pr>.md` just as it can remove a label. What
changes is that the approval stops being a click that leaves no artefact and becomes a commit in
the PR diff, authored, timestamped, and reviewable. That is a detection and attribution
improvement, not an authentication one.

Closing it properly needs Station 00's option (B) as well - a separate GitHub App or machine
account for the watcher, so `LABELED by watcher` and `UNLABELED by marco` are distinguishable
identities. (A) and (B) are complements, not alternatives: (A) creates the record, (B) makes the
record's author mean something. Marco has chosen (A). (B) remains open and unranked.

**It does not make the check required.** A prompt cannot edit repo settings. After this merges,
someone must add `Approval receipt (CP-26)` to the required-status-checks rule of ruleset
`15532058` ("Main"), which today requires exactly four: `CodeQL`, `API - lint, test, compliance
smoke`, `Web - lint, logic tests, vitest, build`, `tendering-e2e`. **Until that is done this job
reports and blocks nothing.** Say so plainly in the PR body rather than implying the gate is live.

**It does not fix the missing `unlabeled` CI trigger.** `ci.yml:6-10` has no `types:`, so removing
a label re-runs nothing. This lands differently here than elsewhere, and in our favour: the
approver must push the receipt commit, and that push is what re-runs CI. An approver who removes
the label and pushes nothing leaves the last run red, which - once the check is required - is
exactly the outcome we want. Do not "fix" the trigger as part of this prompt; it is a separate
change with its own blast radius.

## Verification

- [ ] `node --test "scripts/pr-gates/__tests__/*.mjs"` passes, and the negative-control run fails
      only the escalation cases.
- [ ] `node --test "scripts/pr-watcher/__tests__/*.mjs"` and `node scripts/pipeline/test-lint-prompt.mjs`
      still pass - no existing suite regressed.
- [ ] The new job appears on this PR's own check list and passes (this PR is escalated, so it will
      demand a receipt of itself - commit one).
- [ ] CP-26's existing PASS/FAIL strings for the label-present and never-escalated cases are
      byte-identical to what they were before.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not stop to ask
whether to proceed; the decision to build (A) was Marco's, taken 2026-08-31, and this prompt is
that decision written down.

Two things are outside that authority and must NOT be attempted:

- **The ruleset.** Adding `Approval receipt (CP-26)` to the required checks of ruleset `15532058`
  is a repo-settings change. Leave it to Marco and say in the PR body that the check is inert
  until he makes it.
- **Weakening CP-26 to make your own PR green.** This prompt is `escalates: true`, so your PR
  will be labelled `do-not-merge` and your new job will demand a receipt of it. That is the design
  working, not an obstacle. Commit the receipt for your own PR if and only if Marco has removed
  the label; if he has not, leave the PR red and hand it over. Editing the gate so that it passes
  on your own PR is the precise failure this whole slice exists to prevent, and it will be read as
  such.
