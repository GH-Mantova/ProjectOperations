# Station 00 — Supervisor | ADDENDUM to 0108 | 2026-09-05T01:19Z–2026-09-05T01:3xZ

## GROUND

```
UTC            2026-09-05T01:19:26Z
origin/main    65660ec9   (#1625, which carried the report this addendum corrects)
dev tree       main @ b7daed3e → fast-forwarded this run; addendum written in a disposable worktree
doc version    1
bootstrap      1
```

**This corrects the run that landed 25 minutes ago in #1625.** That breadcrumb carried a falsifying
probe for its own two central findings. I ran it. **It refuted me.** The correction is here rather
than in an edit, because #1625 had already auto-merged at 01:19:26Z when the result came back.

## WHAT I MEASURED

**The probe, and its result.** #1616's `do-not-merge` came off at 00:49:45Z. F1/F2 in #1625 rested on
*"the label is the sole cause of the red"*, and the stated test was the first CI run created after the
unlabel. [MEASURED] run `33935407415`, created 2026-09-05T01:11:37Z on
`pr-crmui-relationships-s1-four-panels` → **failure**, and the failure is not what I predicted:

```
FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1616 was labelled do-not-merge and
released, but docs/decisions/merge-approvals/1616.md is not in this PR's diff against
merge-base with origin/main. Commit the receipt on the PR branch so the approval leaves an
authored, reviewable artefact.
```

**CP-26 has a second state I did not know about, and it makes removing the label insufficient.**
Once a PR has been labelled and released, the gate demands a committed, authored receipt carrying
`approved_by` and `approved_at`. It is enforced. It is already built.

**So both of the previous run's headline claims are wrong:**

| claim | where | status |
|---|---|---|
| *"an actor is stripping the gate"* (as an attack) | 00:08Z run | over-read; the removal is a documented step |
| *"a label cannot hold; it needs a REQUIRED CHECK"* | 00:08Z run | **REFUTED** — CP-26 is one, since #1492 |
| *"removing the label releases the merge"* | 01:08Z run, #1625 F1 | **REFUTED** — `RELEASED_NO_RECEIPT` |
| *"the release leaves no signature"* | 01:08Z run, #1625 F1 | **REFUTED** — the receipt is the signature, and it is mandatory |
| *"the label is the sole cause of the red"* | 01:08Z run, #1625 F1/F2 | **REFUTED** for #1616 |

I read CP-26's `LABEL_PRESENT` headline sentence — *"removing it is what releases the merge"* — and
not the three numbered steps printed directly under it, which say remove the label **and** commit the
receipt **and** push. The escalation I filed at 01:08Z proposed building a mandatory approval
receipt. **It already exists. That option is withdrawn** — the same "already built and merged" trap
the memory index records against escalation #22's option (A).

**F2's cost figure survives** — 48 of 72 workflow runs in the hour on the five gated branches is a
measurement of run creation, independent of why the runs fail. The phrase *"structurally incapable of
passing"* is right for a different reason than I gave: it is `RELEASED_NO_RECEIPT`, not the label.

## WHAT CHANGED

Nothing on the board. This addendum and the rewritten escalation file. No label touched, no PR
merged by me beyond #1625's own armed auto-merge, nothing armed, no receipt authored.

## FINDINGS

### F6 — A migration merged tonight unlabelled, unreceipted, with no watcher verdict. CP-26 never saw it.

CP-26 is armed by a **human labelling action**, not by what the diff contains. A PR nobody labels
never enters `RELEASED_NO_RECEIPT` and never needs a receipt.

[MEASURED] the four PRs that merged while my last two runs were reasoning about labels:

| PR | merged | labels | files | migrations | receipt |
|---|---|---|---|---|---|
| #1618 | 2026-09-05T00:06:42Z | *none* | 2 | 0 | 0 |
| #1620 | 2026-09-04T23:49:56Z | *none* | 3 | 0 | 0 |
| #1623 | 2026-09-05T00:47:58Z | *none* | 5 | 0 | 0 |
| **#1624** | **2026-09-05T01:10:30Z** | *none* | **7** | **1** | **0** |

[MEASURED] `git ls-tree -r --name-only origin/main -- docs/decisions/merge-approvals/` → receipts for
#1483, #1510, #1511, #1512, #1519, #1520, #1523, #1536 and **nothing since 2026-09-02**. NEGATIVE
control on a nonexistent directory → empty, so the query answers rather than merely staying quiet
(§9.6).

**#1624 carries `apps/api/prisma/migrations/20260905000000_scope_item_labour_store/migration.sql`.**
`classifyPolicyFiles` refuses any `(^|/)migrations/` path outright — the one clause no station lane
covers and no policy merge can pass. It is unambiguously Marco's. It merged 40 minutes ago with no
label, no receipt and no watcher `marco:true` verdict.

**This is not a CP-26 defect. It is the DOCTRINE §10.1 second-lane hole**, and CP-26 is precisely the
gate that would have stopped it had anything labelled the PR. My two previous runs spent their whole
budget on the five PRs that *were* labelled — the ones the gate was already holding — while four
unlabelled ones merged past, one of them a migration. **I was watching the guarded door.**

**DISPOSITION: ESCALATED.** Rewritten in
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` (filename kept
so the 01:08Z reference resolves; contents fully replaced). The RULE 1 lead option is to trigger
CP-26's receipt requirement **on the diff** — any `(^|/)migrations/` path, anything outside the three
`NESTED_TEST_PATHS` forms — instead of on whether a human remembered to label. Complete: it stops
depending on a station's attention. Additive: it widens the trigger of an existing check, reusing the
receipt format and the `RELEASED_NO_RECEIPT` code path that already exist; no migration, no
production data, no auth, no capability removed. Not built — it changes a merge gate, which is
Marco's.

## WHAT I DID NOT DO

- **Did not author `docs/decisions/merge-approvals/1616.md`** or any other receipt, which would turn
  #1616 green. No agent may ever author an approval file — and this run is the clearest case yet for
  why that rule exists: the gate held, and it held against me.
- **Did not re-apply any label**, and did not remove one.
- **Did not touch #1624 or the migration it landed.** It is merged; reverting a migration is
  irreversible-adjacent and is Marco's call, not a station's.
- **Did not amend #1625.** It had merged; a correction that rewrites history reads worse than one
  that is appended, and the refuted claims are quoted above so a search finds both.

## THE LESSON, STATED PLAINLY

The falsifying probe is the only reason this was caught. #1625's findings were coherent, measured,
internally consistent and wrong, and they would have been read as current by every station until
someone re-derived them. **DOCTRINE §9.5's closing rule — a claim that names no falsifying probe will
outlive its own truth — did its job here within 25 minutes.** Every finding in this addendum carries
its probe in the command that produced it.
