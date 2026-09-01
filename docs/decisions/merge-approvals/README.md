# Merge-approval receipts (CP-26)

This directory holds one file per PR that carried the `do-not-merge` label and
was released for merge. The receipt is the artefact of that approval: an
authored, timestamped commit in the PR's own diff.

## Why receipts exist

CP-26 originally read only the live `do-not-merge` label. Both the watcher
(which applies the label) and Marco (who releases it) authenticate as
`GH-Mantova`, so `LABELED by GH-Mantova` followed by `UNLABELED by GH-Mantova`
in the events API is unattributable. A released escalation was indistinguishable
from an agent clearing its own gate.

Adding a receipt does not make forgery impossible -- anyone with write access
to the repo can commit one. What it changes is that the approval stops being a
click that leaves no artefact and becomes a commit in the PR diff, authored,
timestamped, and reviewable. That is a detection/attribution improvement, not
an authentication one. Closing it properly needs a separate identity for the
watcher (option B); this is option A.

## The template

File name: `<PR-number>.md` (e.g. `1499.md`). The `pr` field must match the PR
number, and the file must be committed **to the PR branch** so it lands in the
diff a reviewer already reads. A receipt sitting on `main` from an earlier PR
does not clear a new one.

```markdown
---
pr: 1499
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---

Why this was approved, in the approver's own words. At least one non-empty
line -- more if the escalation warrants it.
```

All four are required:

| Field         | Rule                                                                 |
|---------------|----------------------------------------------------------------------|
| `pr`          | integer, must equal the PR number under test                         |
| `approved_by` | non-empty string (typically a handle or name)                        |
| `approved_at` | any string that `Date.parse` accepts (ISO-8601 recommended)          |
| body          | at least one non-empty line after the closing `---`                  |

Missing or malformed fields fail the `Approval receipt (CP-26)` CI job with
a specific error code (`RECEIPT_MISSING_PR`, `RECEIPT_INVALID_APPROVED_AT`,
etc.) so the reviewer knows exactly what to fix.

## Worked example

For a PR that Marco approved after review, the receipt looks like:

```markdown
---
pr: 1499
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---

Approved the CP-26 receipt cluster. The gate is deliberately additive
evidence, not a rewrite of any existing record; a revert restores the
prior label-only mechanism without invalidating any PR merged in the
meantime.
```

## When you do NOT need a receipt

If the `do-not-merge` label has never been applied to the PR, no receipt is
required and the gate passes silently. Receipts are only demanded when the
events API shows a prior `labeled` event for `do-not-merge` and the label is
currently absent -- i.e. someone escalated and then released.

## What this gate does NOT do

The `Approval receipt (CP-26)` job is inert until it is added to the
required-status-checks rule of ruleset `15532058` ("Main"). That is a
repo-settings change; a prompt cannot make it. Until Marco flips that
switch, the check runs and reports but blocks nothing.
