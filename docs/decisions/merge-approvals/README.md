# Merge-approval receipts (CP-26)

A receipt is a small markdown file committed to a PR whose front-matter carries
`escalates: true`. Its job is to convert a merge approval from a click that
leaves no trace — removing the `do-not-merge` label — into an in-diff artefact
that is authored, timestamped and reviewable.

## When a receipt is required

A receipt is required on a PR iff the `do-not-merge` label was **ever applied**
to it (regardless of whether the label is still present). The CP-26 gate reads
the PR's events log, not just the current label state — see
`scripts/pr-gates/approval-receipt.mjs` for the truth table.

The label alone is not enough. The watcher (`GH-Mantova`) applies the label and
Marco removes it under the same identity, so `UNLABELED by GH-Mantova` in the
events stream cannot distinguish a human release from an agent clearing its own
gate. The receipt does not fix that authentication gap — anyone with write
access can commit one — but it makes the approval visible in the PR diff a
reviewer already reads.

## What a receipt looks like

Path: `docs/decisions/merge-approvals/<pr>.md` (the number is the PR this
receipt belongs to, and CP-26 rejects a receipt whose `pr:` field disagrees).

```markdown
---
pr: 1431
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---

Why this was approved, in the approver's own words. At least one non-empty
line. This is what a reviewer sees in the PR diff.
```

## Required fields

| field | rule |
| --- | --- |
| `pr` | integer equal to the PR under test — a receipt copied from another PR fails |
| `approved_by` | non-empty string |
| `approved_at` | anything `Date.parse` accepts (ISO-8601 recommended) |
| body | at least one non-empty line after the front matter |

## What CP-26 does with it

`scripts/pr-gates/approval-receipt.mjs` implements the decision. Summary:

| condition | verdict | code |
| --- | --- | --- |
| `do-not-merge` label currently on the PR | FAIL | `LABEL_PRESENT` |
| label absent and never applied | PASS | `NEVER_ESCALATED` |
| ever escalated, released, receipt not in this PR's diff | FAIL | `RECEIPT_MISSING` |
| receipt in diff but missing/malformed required fields | FAIL | `RECEIPT_MALFORMED` |
| receipt in diff and valid | PASS | `RECEIPT_VALID` |

`receiptInDiff` is computed against `merge-base origin/main HEAD` — a receipt
sitting on `main` from an earlier PR does **not** count for a later one.

## Worked example

The 2026-08-31 release of #1431:

```markdown
---
pr: 1431
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---

Reviewed the WL-1a tender-outcome-capture DTO surface and the migration. The
enum widening is additive and every writer is covered by the seed. Releasing.
```

## What this does not do

- **It does not make forgery impossible.** Any actor with write access to the
  repo can commit a receipt just as it can remove a label. The change is that
  the approval becomes an authored, timestamped commit in the PR diff, not an
  event with no attribution.
- **It does not authenticate the approver.** Closing that hole needs a separate
  identity for the watcher (Station 00 option B, still open).
- **It is not automatically merge-blocking.** The `Approval receipt (CP-26)`
  CI job runs on every PR and reports its verdict, but until the ruleset for
  `main` includes it in the required-status-checks list, the verdict does not
  block a merge.
