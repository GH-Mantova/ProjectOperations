# Station 00 — Supervisor | SECOND ADDENDUM to the 2026-09-17T18:07:55Z run

## GROUND

```
UTC            2026-09-17T18:43Z
origin/main    2c381bb7               (#2014 merged 18:32:22Z)
dev tree       main @ 4c8c6868        C:\ProjectOperations2   (0 ahead, 2 behind)
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

**Station 04 finished at 18:24Z — after this run's COLLECT had already read the queue — and dispatched
FOUR findings to this station.** COLLECT is the only channel that closes, and a dispatch nobody
collects is the defect 04's own F4 is about. So it is collected here rather than left for the next
occurrence.

## WHAT I MEASURED

**[MEASURED] 04's breadcrumb landed between my collect and my board PR.**
`00-04-scanner-2026-09-17-1811-four-scopecards-holds-are-gated-on-a-pr-that-closed-unmerged-and-marco-released-two-prs-six-minutes-before-this-run.md`,
**403 lines**, mtime `2026-09-17T18:24:22Z`, UNTRACKED in the dev tree. My `--freshness` run at
18:11Z read 3 breadcrumbs; this is a fourth. **Five findings, five dispositions, all present.**

**[MEASURED] Two of 04's four dispatches were already overtaken by live state, and I re-measured
rather than accepting or dismissing them:**

| 04's finding | 04 measured at 18:11Z | live at 18:2x–18:4xZ |
|---|---|---|
| F2 — *"Marco released `#1998` and `#2002` … neither has a receipt"* | no receipt | **both carry a valid receipt on their own head**: CP-26 column 3 reads `PASS - CP-26 approval-receipt [RECEIPT_VALID] approved_by=marco approved_at=2026-09-17T09:50:00Z` on both. The receipts are on the PR heads, not on `main`, which is where 04 looked. |
| F3 — *"`#1998` is 14-of-15 green with one check that has neither a conclusion nor a state, and `mergeStateStatus` is BLOCKED"* | BLOCKED | **`#1998` is MERGED**, `mergedAt 2026-09-17T18:22:10Z`, `mergeCommit e74a75b6…` = `origin/main`'s tip at that moment. The stateless check resolved on its own. |

Both were TRUE when taken. Neither is a defect in 04's instrument — F2's is a real difference between
`main` and a PR head, and it is worth recording that **a receipt search on `main` returns a false
negative for every PR whose receipt is still on its branch**, which is the prescribed shape.

**[MEASURED] 04's F1 blast radius, folded into the `#2005` escalation this run.** Four `scopecards`
HOLDs (`s4a`, `s4b`, `s5`, `s6`) are each gated on the previous link's marker, and the head of the
chain is `#2005` — closed UNMERGED, its prompt already consumed into `processed/`. So the close costs
**five** slices, not the one the escalation priced.

**[MEASURED] 04's F4: the 2026-09-15 `ESCALATED` disposition produced no file.**
`ls needs-marco/ | grep -i "fv2\|digest"` → **no match**, against a control that returns `pr-2005-…`
and `scopecards-s2b-…` for other terms. Nine days, roughly twelve 04 occurrences, and Marco had not
been asked.

## WHAT CHANGED

1. **Appended the five-slice blast radius to
   `needs-marco/pr-2005-closed-unmerged-one-second-after-a-board-merge-2026-09-17.md`** — its option
   (c) is now priced at five slices and not one. The three options are unchanged; the margin between
   them is not.
2. **Filed `needs-marco/fv2-ai-import-digests-output-channels-cluster-still-wanted-2026-09-17.md`** —
   the escalation 04's 2026-09-15 finding disposed as ESCALATED and never produced.
3. **Swept 04's breadcrumb to a tracked path**, at the ROOT path and not `archive/`, because it is
   genuinely unreported: asked of the TRACKED SET (`git ls-files docs/pr-prompts`, matched by trailing
   path segment) it is absent, which is the station doc's own guard against the 2026-09-07
   duplicated-basename defect. Archiving it is the next run's, once these dispositions are on `main`.
4. **Committed `docs/pipeline/sweep-rotation.json`** — 04 advanced it to `last_index: 0`,
   `last_run_utc 2026-09-17T18:11:02Z` and may not commit in the shared dev tree; landing it is this
   station's standing hand-off, and leaving it dirty is a fast-forward blocker for whoever converges
   next.
5. **Committed the tracked `needs-marco/agent-authored-rule-2-clearance-2026-09-04.md`** carrying this
   run's cross-reference. ⚠️ `needs-marco/` is **MIXED**, which is worth stating because every station
   doc calls it gitignored flat: `git ls-files --error-unmatch` on that file → **exit 0, tracked**;
   on `rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md` → **exit 1, unknown
   to git**. So some escalations reach a reader through git and some do not, and which is which is
   not predictable from the folder.

No merge on the product board, no arm, no label change, no `/sot/` edit, no commit on `main`, no `git`
in the watcher clone, nothing Azure / Entra / SharePoint.

## FINDINGS

### F-5 — Station 04's four dispatches, collected and dispositioned

- **04-F1 (scopecards chain, five slices) — DISPOSITION: ESCALATED.** Folded into the existing
  `pr-2005-…` escalation rather than filed as a new question, exactly as 04 asked. Its second ask —
  *"when he answers, option (a) also releases the four HOLDs and option (b) needs s3 re-staged first"*
  — is written into that file so the consequence travels with the decision.
- **04-F2 (released PRs, no receipt) — DISPOSITION: ACTIONED.** Re-measured and superseded: both
  receipts exist on the PR heads and CP-26 reads `[RECEIPT_VALID]`. The merge question it raises is
  F-1/F-4 of this run's earlier reports, already escalated. Nothing owed back to 04.
- **04-F3 (`#1998` BLOCKED on a stateless check) — DISPOSITION: ACTIONED.** Closed by live state:
  `#1998` merged at 18:22:10Z. Nothing to pull.
- **04-F4 (fv2 escalation never filed) — DISPOSITION: ACTIONED.** The file now exists at
  `needs-marco/fv2-ai-import-digests-output-channels-cluster-still-wanted-2026-09-17.md`, with the
  measurements, the nine-day gap, and three RULE-1 options. ⚠️ **04's generalisation is the part worth
  keeping**: an `ESCALATED` finding that produces no `needs-marco/` artifact is indistinguishable, to
  every later run, from one that was answered. That is a gap in the disposition contract itself, not
  in fv2.
- **04-F5 (`^key` grep blind to list-form YAML) — DISPOSITION: ACTIONED by 04 inside its own run.**
  Nothing owed; recorded here only so the collect is complete.

### F-6 — `needs-marco/` is not uniformly gitignored, and every station doc says it is

`[MEASURED]` this run with a positive/negative pair: `agent-authored-rule-2-clearance-2026-09-04.md`
→ `git ls-files --error-unmatch` **exit 0** (tracked); `rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`
→ **exit 1**, `error: pathspec … did not match any file(s) known to git`.

Every binding document treats the folder as uniformly gitignored — that is why each of this run's
escalation appends carries the disclaimer *"this reaches nobody through git"*. **For an unknown
fraction of the folder that disclaimer is false, and worse, the reverse error is the dangerous one**:
an append to an untracked escalation reaches nobody, while an append to a tracked one is uncommitted
work sitting in the shared dev tree until someone lands it — which is a fast-forward blocker of
exactly the class the station doc devotes a section to.

**DISPOSITION: DEFERRED** — real, small, and not safely fixable in a collect run. The fix is either to
track the folder or to ignore it wholly, and choosing which is a decision about whether escalations
should be public in the repo; that is Marco's, and it belongs alongside the receipt-and-signature
questions already open rather than as a fifth near-duplicate filed today. It becomes urgent the first
time an escalation append is lost to an untracked path while its author believed it landed.

## WHAT I DID NOT DO

- **Did not arm, repair or edit any of the four `scopecards` HOLDs.** 04 declined for the right
  reason and it binds me harder: `s4a` carries `gate_allow: migrations` and `escalates: true`, and its
  gate is the only thing holding it, so a repair would arm a migration slice whose predecessor is not
  on `main`.
- **Did not retire `pr-fv2-ai-digests-HOLD.md` or `pr-fv2-output-channels-HOLD.md`.** Whether the
  cluster is wanted is a product question (§5.5); the escalation asks it.
- **Did not merge `#2002`.** Unchanged from F-1 and F-4: live `marco:true`, unlabelled, and no
  instruction naming it.
- **Did not archive 04's breadcrumb.** It is being committed at the root path in this PR because it
  was unreported; archiving a file in the same PR that first tracks it is how the 2026-09-07
  duplicated-basename defect was made.
