# Three PRs were released at 19:01–19:06Z and no scheduled run can write their receipts

**Raised by** Station 00, scheduled run 2026-09-24T19:15Z · **true at** `origin/main` **d97806c9**
**Updates the premise of** `five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`
— that file says the approval channel has issued nothing in 21 days. **It has now issued, three times,
in five minutes.** That half is discharged; what replaces it is narrower and is below.

## What happened

[MEASURED] `gh pr view <n> -R GH-Mantova/ProjectOperations --json number,state,labels,mergeStateStatus`,
per-PR (never from a listing — LL-47), exit 0 on all five, negative control `gh pr view 999999
--json number,state` exit **1**:

| PR | labels | mergeStateStatus | title |
|---|---|---|---|
| #2167 | **[]** | BLOCKED | fix(pr-watcher): rescue bare paths under spaced top-level directories |
| #2166 | **[]** | BLOCKED | fix(pr-watcher): recover paths whose top-level dir contains a space |
| #2164 | `do-not-merge` | BLOCKED | feat(tendering): S8h waste travel-index UI and find-tip fix |
| #2158 | `do-not-merge` | BLOCKED | feat(forms): drop five legacy FormRule flat columns |
| #2148 | **[]** | BLOCKED | feat(auth): stop writing sign-in codes and reset links to the production log |

Station 04 measured **all five** carrying `do-not-merge` at 18:10Z on two transports. So the change is
real and recent, and the in-band positive control is that the same query still returns the label for
#2164 and #2158 — the instrument is not returning a blanket empty (DOCTRINE §9.4's jq-literal trap,
which produces exactly that, is excluded: this used raw `--json` plus `ConvertFrom-Json`, no `--jq`).

[MEASURED] `gh api repos/GH-Mantova/ProjectOperations/issues/<n>/timeline`, `unlabeled` events for
`do-not-merge`, exactly one each:

| PR | removed by | at |
|---|---|---|
| #2148 | `GH-Mantova` | 2026-09-24T19:01:50Z |
| #2166 | `GH-Mantova` | 2026-09-24T19:05:39Z |
| #2167 | `GH-Mantova` | 2026-09-24T19:06:23Z |

## Why this run stopped rather than driving them

[MEASURED] CP-26's verdict token, quoted verbatim from column 3 of job `107789127047`, run
`36045863628` (§9.4 — read the token, never the pass/fail counts):

```
FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #2167 was labelled do-not-merge and
released, but docs/decisions/merge-approvals/2167.md is not in this PR's diff against
merge-base with origin/main.
```

`[RELEASED_NO_RECEIPT]` is, per §9.4, *"the label was removed and no receipt was committed, which IS a
real finding"* — as against `[LABEL_PRESENT]`, which is parked-by-design and needs nothing. For #2167
and #2148 this is the **only** cause: the two reds each PR carries are `Approval receipt (CP-26)` and
`PR gates — diff checks`, and CP-26 runs as a step inside the latter, so they are two reds with one
cause. #2166 additionally failed `tendering-e2e` (4 failed / 162 passed, all four dashboard-customise
assertions) on a diff that touches only `scripts/pr-watcher/**` — transient by §8 rule 5; I re-ran the
failed jobs (`gh run rerun 36043685925 --failed`, exit 0).

**I did not write the receipts, and I do not think any scheduled run should.**
`docs/decisions/merge-approvals/README.md` states the reason in its own words: *"Both the watcher
(which applies the label) and Marco (who releases it) authenticate as `GH-Mantova`, so `LABELED by
GH-Mantova` followed by `UNLABELED by GH-Mantova` in the events API is unattributable."* So the
timeline measurement above **cannot tell me who released these three**, and `approved_by: marco` would
be a claim I cannot measure. [MEASURED] every precedent supports the same reading: the two most recent
receipts (`2161.md`, `2114.md`) were both authored by the **interactive** lane and both cite Marco's
own words in chat (*"2161 label removed"*, *"Label removed"*) as their Authority. A headless run has no
such channel — which is the standing finding in
`rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`.

Writing the receipt anyway would defeat exactly what CP-26 exists to prevent: *"A released escalation
was indistinguishable from an agent clearing its own gate."*

## The question, RULE 1 — complete-and-additive first

**May the release carry a signature a scheduled run can read?**

- **(A) — complete and additive, and the recommendation.** Release by committing the receipt, not by
  removing the label: the receipt lands on the PR branch, CP-26 goes green, and whichever lane is
  awake drives the merge. Failing that, leave the release word somewhere a headless run can read — a
  one-line PR comment (`released: 2167`) is enough, since a comment carries an author and a timestamp
  the API returns. Either form solves it immediately **and** in future, adds a record rather than
  removing one, and touches no data entry. The three PRs above still need their receipts either way.
- **(B) — fails the "future" half.** You or the interactive lane hand-write the three receipts now.
  Correct for tonight; the next release stalls the same way, and a scheduled run meeting it has no
  move except to stop again.
- **(C) — fails the "completely" half, and I recommend against it.** Authorise a scheduled run to
  author `approved_by: marco` from the `unlabeled` timeline event alone. It would clear the board
  tonight and it would make CP-26 unable to distinguish your approval from an agent's — the README
  says the event is unattributable, so the run would be certifying precisely what it cannot measure.

**Nothing was merged, no label was touched, and no receipt was authored.** The three released PRs sit
green-able but unmergeable until a receipt exists.

## Falsifying probe

Re-ask `gh pr view <n> --json labels` per PR for #2148, #2166, #2167 and re-read CP-26's verdict token
from the newest run. If any of the three reports `[LABEL_PRESENT]` again, the label was re-applied and
this escalation is spent. If any reports `PASS`, a receipt landed and that PR is mine to merge.
