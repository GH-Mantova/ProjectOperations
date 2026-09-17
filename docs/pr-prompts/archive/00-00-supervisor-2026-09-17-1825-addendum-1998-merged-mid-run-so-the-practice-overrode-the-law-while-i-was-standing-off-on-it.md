# Station 00 — Supervisor | ADDENDUM to the 2026-09-17T18:07:55Z run

## GROUND

```
UTC            2026-09-17T18:25Z
origin/main    e74a75b6               (#1998 merged 18:22:10Z, mid-run)
dev tree       main @ 4c8c6868        C:\ProjectOperations2   (behind by 1, untouched this run)
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

**This addendum exists because my own report was overtaken while its PR was in CI.** F-1 of the
18:07Z breadcrumb reasons at length about two PRs I would not merge. **One of them merged, by another
actor, seventeen minutes later.** Leaving that unsaid would have shipped a report whose central
example was false, in the same PR, on the same day.

## WHAT I MEASURED

**[MEASURED] `#1998` is MERGED, and it carried a live watcher `marco:true` verdict when it merged.**
Read with a single per-PR GET, never from a list response — the list `merged` field is unusable
(§9.4, `merged` reads false or absent on every list entry):

```
gh pr view 1998 --json number,state,mergedAt,closedAt,mergeCommit,labels,headRefName
  state=MERGED  mergedAt=2026-09-17T18:22:10Z  closedAt=2026-09-17T18:22:10Z
  mergeCommit=e74a75b6ada2e8ed4334a3ec9270edd35b0a66f5  labels=[]  head=feat/crmvis-s5-followups
```

Corroborated from the other side: `git rev-parse origin/main` → `e74a75b6ada2e8ed…`, and
`git log --oneline -3 origin/main` has that SHA as the tip, titled
`feat(crm): S5 - Follow-ups on the s7 kit, one SHOW row, striped KPI cards (CRM_PARITY_FOLLOWUPS_V1)
(#1998)`. **The merge commit and the branch tip are the same object**, so this is not a cached rollup.

**[MEASURED] The timeline, and it is the whole point:**

| time | event |
|---|---|
| 2026-09-17T17:07Z | previous run measured `#1998` OPEN, `do-not-merge`, `marco:true` |
| 2026-09-17T18:12Z | this run measured it OPEN, **unlabelled**, CP-26 `[RECEIPT_VALID]`, still `marco:true`, `BLOCKED` on pending checks |
| 2026-09-17T18:2xZ | this run declined to merge it under `STATION-CAPABILITIES.md` §5 |
| **2026-09-17T18:22:10Z** | **it merged** |
| 2026-09-17T18:25Z | `#2002` is the only product PR still open, still `BLOCKED` |

**[MEASURED] `#2002` is unchanged and still open:** `OPEN`, `BLOCKED`, `labels=[]`. The open board is
now `#2002` plus my own `#2014`.

**[MEASURED] It was not me.** This run issued exactly one git mutation — a commit in an isolated
worktree — plus `git push`, `gh pr create` and one `gh pr update-branch` on **my own** `#2014`. No
`gh pr merge`, no `gh pr edit`, no label touched, on any PR. **[CANNOT MEASURE]** who did merge it:
`mergedBy` reads `GH-Mantova` for every merge on this board, agent and human alike
(`STATION-CAPABILITIES.md` §5), and that is stated as unmeasured rather than filled in with a guess.

**[MEASURED] A SECOND ACTOR PUSHED TO THIS RUN'S OWN BOARD BRANCH WHILE THE RUN WAS STILL USING IT,
AND GIT — NOT ANY GATE — IS WHAT CAUGHT IT.** My push of this addendum was REJECTED
(`PUSH2_EXIT=1`, *"'git pull' before pushing again"*). `git pull --rebase` then replayed one commit
cleanly and revealed two commits on `origin/chore/board-20260917-1826` that this run did not author:

```
0a66bf48 Merge branch 'main' into chore/board-20260917-1826
976a76b7 docs(merge-approvals): receipt for PR #2014 (station-00.interactive-0003)
```

The first is my own `gh pr update-branch`. **The second is the supervised interactive lane writing a
merge-approval receipt onto my branch** — for a docs-only board PR that was never labelled, so CP-26
on it reads `NEVER_ESCALATED` and needs no receipt. No harm was done and nothing was lost: the rebase
was clean and both histories survive. ⚠️ **But this is LL-38's shape — two actors, one branch — and
the only thing that stopped it was a non-fast-forward, which is a collision detector, not a lock.**
Recorded rather than escalated, because it is the same single-actor question already open as
`needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`,
and because a clean rebase is not an incident. It is noted here so the next run that meets a rejected
push on its own board branch does not spend a run rediscovering the cause.

## WHAT CHANGED

1. **This addendum**, added to the same branch and the same PR (`#2014`) as the 18:07Z breadcrumb, so
   the correction travels with the claim it corrects.

No merge, no label change, no arm, no `/sot/` edit, no commit on `main`, no `git` in the watcher
clone, nothing Azure / Entra / SharePoint.

## FINDINGS

### F-4 — The practice merged a PR the law told me not to merge, seventeen minutes after I declined to, which settles the *cost* of F-1 even though it settles nothing about the rule

F-1 argued that `STATION-CAPABILITIES.md` §5 (*"not overridden by … unlabelled"*) and the 2026-09-16
*"label off means merge"* ruling cannot both be acted on, and that a scheduled run cannot pick between
them because the ruling reaches it only through a receipt another lane wrote. **That argument is
unchanged and I still would not have merged it.** Declining an action I had no authority for is not a
mistake, and I would decline it again on the same evidence.

🔴 **What this measures is the PRICE, and the price is not latency — it is that the scheduled lane is
decorative on exactly the work it exists to move.** F-1 said the standoff *"costs latency, not work"*.
That was true of a PR sitting still. It is not true of one that merges anyway: the lane that hesitated
contributed nothing, and the only thing standing between a released PR and `main` turned out to be
whether a human-driven lane happened to be awake. **A gate that only one of two lanes observes is not
a gate; it is a delay applied to one of them.**

⚠️ **And it is now measured in the direction that matters.** Every earlier instance of this question
was about a PR that stayed put, so the two readings were indistinguishable by outcome. This one
separates them: under the ruling, the merge was correct and my standoff was pure cost; under §5, a
`marco:true` PR has just reached `main` without the instruction §5 requires. **Both cannot be true,
and `main` has already moved on one of them.**

**DISPOSITION: ESCALATED** — folded into the same ask, not filed as a new question. The addendum
already appended to `needs-marco/rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`
this run is extended by this instance; the three RULE-1 options there are unchanged, and **option (a)
— write the ruling into the binding documents — is the only one this instance does not weaken.**
Option (c) (*"leave it; the supervised lane merges, the scheduled lane does not"*) is now measurably
the status quo rather than a hypothetical, and `#1998` is what it looks like.

## WHAT I DID NOT DO

- **Did not merge `#2002`.** Everything in F-1 still applies to it: live `marco:true`, unlabelled,
  `BLOCKED`. Nothing about `#1998` merging is an instruction naming `#2002`, and reading one merge as
  a precedent for the next is exactly the inference §5 forbids.
- **Did not revise F-1 of the 18:07Z breadcrumb.** It was true when measured and it carries its own
  timestamps; rewriting it to look prescient is how a claim outlives its SHA. This addendum is the
  correction, in the same PR.
- **Did not fast-forward the dev tree.** It sits at `4c8c6868`, one behind, clean and untouched —
  Station 04 was mid-run in it for this whole run, and its `sweep-rotation.json` hand-off is not mine
  to race.
- **Did not investigate who merged it.** `mergedBy` cannot answer and the receipt is already on the
  branch; manufacturing an actor from a timestamp is what the 17:55Z addendum refused to do about
  `#2005`, and the same refusal applies here.
