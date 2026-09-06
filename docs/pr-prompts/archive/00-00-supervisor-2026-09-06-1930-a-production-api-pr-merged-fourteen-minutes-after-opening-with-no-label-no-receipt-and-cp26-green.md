# Station 00 — Supervisor | 2026-09-06T19:24Z–2026-09-06T19:40Z (addendum to the 19:08Z run)

## GROUND

```
UTC            2026-09-06T19:24:00Z
origin/main    e7706c25            (after #1732 merged 19:23:54Z)
dev tree       main @ e7706c25     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Same sighted run as the 19:08Z collect; this is its second board PR, not a second run. It exists
because the fast-forward that followed `#1732`'s merge brought in a file my own PR did not carry —
`apps/api/src/modules/tendering/allocation.controller.ts` — which is how I learned that `#1730`,
a PR this run had just hand-classified as **Marco's**, had merged while `#1732` was in CI.

## WHAT I MEASURED

**`#1730` merged fourteen minutes after it was opened.** [MEASURED] `gh pr view 1730 --json
number,state,mergedAt,mergedBy,labels,files`: opened `2026-09-06T18:58:41Z`, **MERGED
`2026-09-06T19:12:41Z`**, `mergedBy GH-Mantova`, `labels []`, 2 files —
`apps/api/src/modules/tendering/allocation.controller.ts` and `tendering.module.ts`. Neither is
inside any of the three `NESTED_TEST_PATHS` forms, so `classifyPolicyFiles` refuses it and §10.1
step 2 classifies it **Marco's**. That is the classification this run recorded 20 minutes earlier,
independently, before knowing it had merged.

**It was never labelled, so there was nothing for CP-26 to check.** [MEASURED] `gh api
repos/GH-Mantova/ProjectOperations/issues/1730/timeline --paginate --jq '… select(.event=="labeled"
or .event=="unlabeled") …'` → **empty**. `gh pr checks 1730` → `Approval receipt (CP-26)  pass  8s`.
**A green CP-26 on this PR is a statement about a release that never happened, not about the merge.**

**No receipt exists for it.** [MEASURED] `git ls-tree -r --name-only origin/main --
docs/decisions/merge-approvals/` filtered for `1730` → **nothing**. POSITIVE control, the same query
filtered for `1699` → **1** (that receipt landed 32 minutes earlier). NEGATIVE control, `999999` →
**0**. So the instrument answers in both directions and the absence is real.

**No watcher lane, on two instruments neither of which F1's defect touches.** [MEASURED]
`.arming-log.txt` newest row is `2026-09-06T09:20:50Z` — no arm inside `#1730`'s window, so no
watcher build could have started. And `#1730` and `#1731` were created **nine seconds apart**
(18:58:41Z / 18:58:50Z), which the single-lane watcher cannot do.

**It merged 40 seconds before its own review verdict was mirrored.** [MEASURED] the daily clone log:
`[2026-09-06T19:13:21.046Z] [review] verdict mirrored to PR #1730 as a comment`, against a merge at
`19:12:41Z`. The verdict was `MERGE`, so the outcome agrees — but the merge did not wait for it.

## WHAT CHANGED

One board PR carrying this breadcrumb only. **Armed 0 before, 0 after. Merged nothing but this PR.
No label touched, no clone write, no process killed.**

## FINDINGS

### F7 — a production-API PR merged unlabelled, unattributed and with a vacuously green CP-26: ESCALATED into the existing open escalation, not as a new one

Every gate on this board passed on `#1730`, and **not one of them looked at the diff**:

- the `do-not-merge` label — never applied, so it never bound;
- **CP-26 — passed in 8 seconds, because it is armed by LABELLING, not by the diff.** With no
  release event there is no receipt to demand, so the required check is green on a PR that shipped
  production API code with no recorded human decision anywhere in the repo;
- the watcher's RULE 2 routing — absent, because no watcher lane was involved;
- `classifyPolicyFiles` — would have refused it, and is not wired to anything that runs on merge.

This is not a new escalation. It is a **live, dated instance** of
`needs-marco/cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`, and of the
standing note that **the hole is upstream: CP-26 is armed by labelling, not by the diff.** What is
new is that it has now happened on `main` today, in fourteen minutes, on a PR an independent station
had classified as Marco's before it merged.

⚠️ **Read this as `STATION-CAPABILITIES.md` §5 instructs — a defect in the supervised cloud lane,
not an unknown actor.** `mergedBy` reads `GH-Mantova` for every merge on this board, agent and human
alike, so it discriminates nothing; `DOCTRINE.md` §10.2.1 makes the receipt that lane's only durable
signature, and requires one *"of every merge it makes"*. `#1699`, merged 20 minutes earlier by the
same lane, carries an exemplary one. `#1730` carries none. **The requirement is being met
inconsistently, and nothing enforces it on an unlabelled PR.**

**ESCALATED.** The complete-and-additive fix is the one already on file and is unchanged by this
instance — **RULE 1 (a): trigger the approval-receipt check off `classifyPolicyFiles` rather than
off the label timeline**, so any PR the classifier refuses must carry a signed receipt to reach
`main`, whether or not it was ever labelled. It fixes the immediate case and every future one, and
it damages no data entry. **(b)** requiring the lane to label its own PRs before merging is smaller
but fails the *future* half — it is a convention, not a gate, and it is exactly the convention that
was missed here. This is `scripts/pr-gates/**`, outside this station's lane to merge; it needs
Marco, and this run is registering the instance rather than re-opening the argument.

## WHAT I DID NOT DO

- **Did not revert `#1730`.** A revert is an irreversible board action on work that may well have
  been released in chat, and this station has no channel that can see chat (§10.2's last bullet).
  The finding is about the missing signature, not about the code.
- **Did not open a new `needs-marco/` file.** The escalation already exists and 04 has measured that
  the sweep is currently telling every reader to clear 26 of the 29 that are there; adding a
  duplicate makes that worse.
- **Did not touch `#1731`**, which is the sibling PR from the same lane and is still open and BEHIND.
  The watcher updated its branch at 19:14:07Z and it went BEHIND again when `#1732` merged; hand-
  updating a BEHIND PR is the known-unfixed `pollForBehindPrs()` hazard and is not mine to force.
- **Armed nothing**, unchanged from the 19:08Z run and for the same stated reason: the clone is 22
  behind and the watcher is running pre-`#1704` code.
