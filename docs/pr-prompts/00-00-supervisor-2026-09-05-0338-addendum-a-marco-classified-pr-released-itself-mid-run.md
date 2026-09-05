# Station 00 — Supervisor | ADDENDUM to the 0308 run | 2026-09-05T03:33Z–2026-09-05T03:45Z

## GROUND

```
UTC            2026-09-05T03:38:00Z
origin/main    95055219            (git fetch --prune, then git rev-parse --short origin/main)
dev tree       main @ 95055219      C:\ProjectOperations2   (0 ahead / 0 behind, numstat EMPTY, cached EMPTY)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Addendum to `00-00-supervisor-2026-09-05-0308-the-cp-26-red-cleared-itself-and-nothing-can-name-who-authored-the-receipts.md`,
landed by **#1635** (merged 03:22:46Z). That breadcrumb is correct as written and nothing in it is retracted.
This records one event it could not contain, because the event happened **after** its evidence was gathered.

## WHAT I MEASURED

**#1616 merged in the middle of this run, and I did not merge it.** [MEASURED]
`gh pr view 1616 --json state,mergedAt,mergedBy,mergeCommit`:

```
state=MERGED  mergedAt=2026-09-05T03:14:55Z  mergedBy=GH-Mantova  sha=06981b12
feat(crm): Relationships becomes one four-panel screen, not three hidden tabs (CRM_RELATIONSHIPS_V2)
```

At **03:09:30Z** the sweep listed it OPEN and BLOCKED. At **03:38Z** the open board is
`#1633 #1621 #1619 #1615 #1614`, all `BEHIND` — five, not six.

**The 0308 breadcrumb had already classified #1616.** [MEASURED, recorded there] second lane —
no `.arming-log.txt` row, no processed prompt log under any name for its head branch, RULE 2 probe
`NO LOG` (probe controlled: 1926 logs, newest 02:44Z, POS `marco.:true` 612, NEG 0). Files: 3, of which
**1 outside all three `NESTED_TEST_PATHS` forms** (`apps/web/src/pages/crm/RelationshipsPage.tsx`),
0 migrations ⇒ **`[NO LANE VERDICT — hand-classified]` MARCO'S.**

**It also carried one of the five unattributable CP-26 receipts.** `docs/decisions/merge-approvals/1616.md`
was in its diff (that is why CP-26 read `[RECEIPT_VALID]`), and its receipt commit is the one the 0308 run
recorded as `[CANNOT MEASURE]` — the `git fetch` of its branch raced the auto-update force-push and returned
`fatal: bad revision 'FETCH_HEAD'`. **The one receipt commit whose author could not be read is the one whose
PR then merged.** That is a coincidence of timing, not evidence of intent, and is recorded as such.

**Also merged in the window, not opened by me:** #1634 at 03:17:19Z,
`docs(pr-prompts): the tender total ignores an item's markup override, so two screens disagree`.
Docs-only, so it needs no hand-classification under §10.1 step 2.

⚠️ [CANNOT MEASURE] **which actor merged #1616.** `mergedBy=GH-Mantova` is the shared identity every
station, the watcher and Marco present. This is the same collapse the 0308 breadcrumb measured one layer
down on the receipt commits' `Marco <marco@initialservices.net>` author line.

## WHAT CHANGED

- Nothing on the board. This addendum only.
- [MEASURED] the only `gh pr merge` this session issued was `gh pr merge 1635 --auto --squash --delete-branch`,
  read back as `autoMerge=True method=SQUASH`, then `state=MERGED mergedAt=2026-09-05T03:22:46Z`.
  **#1616 was not mine.**

## FINDINGS

### F1 — A Marco-classified second-lane PR released itself while the supervisor was mid-run

This is the failure mode the 0308 breadcrumb escalated, occurring **during** the run that escalated it,
which is the strongest available argument that the escalation is live rather than historical.

The sequence, all [MEASURED]: `do-not-merge` removed → CP-26 red on `[RELEASED_NO_RECEIPT]` → a receipt
commit appears whose author is the box's global default identity → CP-26 green → the PR merges. Every step
is legitimate on its own; the chain has no point at which an instrument can name the human. **RULE 2's only
probe returns `NO LOG` for the whole board, so nothing in CI or in the pipeline ever asserted that this PR
was Marco's — only this station's hand-classification did, and a hand-classification cannot block a merge.**

**ESCALATED — Marco.** Folded into the 0308 breadcrumb's F1 question, which is unchanged and unanswered:
did you strip those labels and author those receipts? RULE 1 option (a) — a **signed** receipt that
`approval-receipt-check.mjs` verifies, rather than a file whose mere presence passes — remains the
complete-and-additive answer, and this event is the case for it: had the receipt required a signature,
this merge would either have carried your attribution or not have happened.

### F2 — The 0308 run's own board snapshot went stale in five minutes

`status-sweep.ps1` printed `OPEN PRs: 6` at 03:09:30Z. One had merged by 03:14:55Z. The station doc's
`[LIVE] means "true when measured", not "true now"` rule is stated against a 161-second example; this is a
325-second one on the board rather than the watcher.

**ACTIONED** by re-measuring before writing this addendum, and recorded so the next run does not read the
0308 breadcrumb's six-PR table as current. **The table is correct as of 03:09:30Z and is a snapshot.**

## WHAT I DID NOT DO

- **Did not merge, label, unlabel, revert or touch #1616 or any other PR.** A merged PR of Marco's is not
  something a station reverts; that is DOCTRINE §5 item 4 (irreversible) and item 5 (his call).
- **Did not author, edit or delete any `merge-approvals/*.md`.**
- **Did not arm anything.** `armed` 0 at open and at close.
- **Did not re-run the RULE 2 probe for #1616 after the merge.** Its classification was measured while it
  was open, with controls, and is quoted from that measurement rather than re-derived post-hoc.
