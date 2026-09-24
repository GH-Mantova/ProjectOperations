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

---

## CORRECTION 2026-09-24T19:42Z — two of the three were RE-PARKED 23 minutes later, by the same unattributable handle. Only #2148 is still released.

**true at** `origin/main` **6be40896** · raised by the same Station 00 run, after #2177 merged.

This file's own falsifying probe fired on the first re-check, which is why it is corrected here rather
than left to rot. [MEASURED] full `labeled`/`unlabeled` history for `do-not-merge`,
`gh api repos/GH-Mantova/ProjectOperations/issues/<n>/timeline`, exit 0 on all three:

| PR | labeled | unlabeled | **re-labeled** |
|---|---|---|---|
| #2167 | 13:53:29Z | 19:06:23Z | **19:29:16Z** |
| #2166 | 13:44:06Z | 19:05:39Z | **19:29:14Z** |
| #2148 | 02:56:08Z | 19:01:50Z | — **still released** |

Every event is `by=GH-Mantova`. The two re-labels are **two seconds apart**, which is a
programmatic write rather than two hand clicks.

### What changes, and what does not

**Changes:** the headline. Only **#2148** is released-without-a-receipt right now; #2166 and #2167 are
back in the `[LABEL_PRESENT]` state, which DOCTRINE §9.4 classes as **parked by design, nothing to
do**. Their `[RELEASED_NO_RECEIPT]` readings quoted above were true when measured at 19:20Z and are
now spent. Do not act on them.

**Does not change — and is sharpened:** the question this file asks. In one 28-minute window the
`do-not-merge` label was removed from three PRs and re-applied to two, and **every one of those five
writes is `GH-Mantova`**, so no instrument available to a scheduled run can say whether any of them
was you. That is precisely why a headless run cannot author a receipt, and it is now demonstrated on
live traffic rather than argued from the README. If anything the case for option (A) — *release by
committing the receipt, or leave an attributable one-line PR comment* — is stronger: a release that
is a label toggle is not only unattributable, it is not even stable for half an hour.

### A second lane was live throughout, and that is worth your attention separately

[MEASURED] `git worktree list` in the dev tree gained `C:/po-wt/stage-formrule-web`
[`docs/stage-formrule-legacy-payload-retire`] at `041fad08`, committed **2026-09-24T19:25:00+10:00**,
whose PR **#2176** (`f9b5ad4c docs(board): stage the FormRule legacy-payload retirement prompt`)
merged while this run was building #2177. Its untracked prompt file also blocked this run's
fast-forward until proved byte-identical to `origin/main` (`b30abf42` on both sides) and re-created
from the merge.

Nothing collided — #2177 and #2176 touched disjoint paths and the dev-tree index was EMPTY before and
after my commit — but this is DOCTRINE §10's second-lane case and LL-38's shape, and the re-label at
19:29Z falls inside that lane's window. **If that lane is yours, the two re-parks are explained and
the only open item is #2148's receipt.** If it is not, the re-label has no known author.

### Falsifying probe, restated

Re-ask `gh pr view <n> --json labels` per PR and re-read CP-26's verdict token from the newest run.
**#2148** is the live one: `[RELEASED_NO_RECEIPT]` means it still needs a receipt; `PASS` means one
landed and it is mergeable; `[LABEL_PRESENT]` means it too was re-parked and this file is fully spent.

---

## CORRECTION 2026-09-24T20:30Z — all three PR instances are now SPENT, and the unattributable handle has a name: `station-00.interactive-0004`

**true at** `origin/main` **a63bd1cb** · raised by the Station 00 scheduled run of 2026-09-24T20:14Z.

This file's restated falsifying probe — *"re-ask `gh pr view <n> --json labels` per PR and re-read
CP-26's verdict token"* — has now fired on all three. [MEASURED] per-PR, never from a listing
(LL-47), raw `--json` plus `ConvertFrom-Json` with no `--jq` (§9.4), negative control
`gh pr view 999999 --json number,state` → exit **1**:

| PR | state | labels | what that means here |
|---|---|---|---|
| #2148 | **MERGED `2026-09-24T20:16:30Z`** | `[]` | the receipt landed and it merged — see below |
| #2166 | **CLOSED**, `mergedAt` empty | `do-not-merge` | re-parked **and** closed unmerged as the duplicate of #2167 |
| #2167 | OPEN | `do-not-merge` | `[LABEL_PRESENT]` — parked by design, nothing to do |

So the board state this file describes no longer exists. **Nothing here is now actionable as a PR
task.**

### The open question in the 19:42Z correction is ANSWERED, by measurement

That correction ended: *"If that lane is yours, the two re-parks are explained and the only open item
is #2148's receipt. If it is not, the re-label has no known author."*

[MEASURED] `gh pr view 2148 -R GH-Mantova/ProjectOperations --json commits` — the **authoring**
commit list, never the squash commit (DOCTRINE §10.2.1, which records that `%an` on `main` is all the
squash retains):

```
07a85ef2  2026-09-24T19:29:57Z
  authors: station-00.interactive-0004 <marco@initialservices.net>;
           Claude Opus 5 <noreply@anthropic.com>
  docs(merge-approvals): receipt for #2148 - Marco removed the label at...
```

`station-00.interactive-0004` is the **supervised interactive lane** of DOCTRINE §10.2.1 — the
`station-00.interactive-NNNN <marco@initialservices.net>` row of that section's identity table, which
warns that attribution *by email alone reads it as a watcher build*. Its build-commit control is in
the same list: `a121827e` reads `Marco <marco@initialservices.net>`, the watcher clone's own git
config.

[MEASURED] the receipt itself, `git show origin/main:docs/decisions/merge-approvals/2148.md`, exit 0.
Its **body** — which §10.2.1 says to read in preference to the `approved_by` field — states in its own
words: *"Released by Marco and merged by the Station 00 supervised interactive lane … Marco removed
the `do-not-merge` label himself at 2026-09-24T19:01:50Z."*

[MEASURED] that lane is **still live**. `docs/pr-prompts/.arming-log.txt`, last line:

```
2026-09-24T20:21:20Z  ARMED  pr-formrule-legacy-payload-retire  escalates=false
  actor=station-00.interactive-0004  by=Marco@LAPTOP-E6NHU4E4  pid=33512
```

So the 19:29:16Z and 19:29:14Z re-labels — two seconds apart, which this file correctly called
programmatic rather than two hand clicks — fall inside that lane's window and now have a named actor.
**They are explained.**

### What is DISCHARGED, and what is NOT

**Discharged:** the three PR instances, and with them the headline. #2148 has its receipt and is on
`main`; #2166 and #2167 are back in `[LABEL_PRESENT]`, which §9.4 classes as parked by design. Do not
act on any `[RELEASED_NO_RECEIPT]` reading quoted earlier in this file — all of them are spent.

**Not discharged, and this file stays open for it:** the question in the *"The question, RULE 1"*
section. It was never about these three PRs; it is *may the release carry a signature a **scheduled**
run can read?* Every one of the five label writes in that 28-minute window is `GH-Mantova`, so a
headless run still cannot tell your release from an agent's. What this run adds is a real boundary
rather than an argument:

- when the **interactive** lane is awake, the channel exists — it read your words in chat, wrote the
  receipt 28 minutes after you removed the label, and merged the PR;
- when it is **not**, a scheduled run meeting a released PR has the same three options this file
  already lists, and **(A)** — release by committing the receipt, or leave a one-line attributable PR
  comment — is still the only one that passes both halves of RULE 1.

That is a narrower question than the one this file opened with, and it is still yours. The scheduled
run of 20:14Z did not write a receipt, did not touch a label, did not merge, and did not arm.

### Falsifying probe, restated a second time

Ask `gh pr view <n> --json state,mergedAt,labels` for #2148, #2166 and #2167. If any reading differs
from the table at the top of this correction, re-measure. And for the surviving general question: if a
release ever arrives carrying a signature a headless run can attribute — a committed receipt, or a PR
comment with an author and a timestamp — this file is fully spent and should be moved to
`needs-marco/discharged/` with a `_DISCHARGE-NOTE-*.md` naming what was measured.
