# Station 00 — Supervisor | 2026-09-02T04:25Z–2026-09-02T04:30Z

**ADDENDUM to the 04:09Z run (same station, same run, later measurement).** The parent breadcrumb is
`docs/pr-prompts/archive/`-bound `00-00-supervisor-2026-09-02-0409-…`, merged in #1513 at 04:21:57Z.
This exists because **a collect at the top of a run is not final** — three of the five things below
happened *inside* my own window, after I had already written the report.

## GROUND

```
UTC            2026-09-02T04:25Z
origin/main    fd68c364              (after #1513 merged; fetch --prune then rev-parse)
dev tree       main @ fd68c364        C:\ProjectOperations2
doc version    1
bootstrap      1
```

## WHAT I MEASURED

### A1. PR #1512 is a SECOND LANE, and it is editing MY station doc [MEASURED]

Opened **04:16:48Z**, branch `docs/station-briefs-retire-untracked-state-files`, six commits stamped
**04:15:47Z → 04:15:57Z** — one second apart, so a scripted push, not a person typing. Its body opens:
*"Punch-list cluster 1.1, items 1.1.2 and 1.1.3, on Marco's decision in chat 2026-09-02."*

Files: `docs/pipeline/stations/00-supervisor.md`, `02-board-driver.md`, `03-machine-minder.md`,
`docs/pr-prompts/.arming-log.txt`, `scripts/pipeline/lint-station.mjs`,
`scripts/pipeline/vm-git-guard.sh`.

RULE-2 probe in `docs/pr-prompts/processed/`:
`Select-String -Path *.log -Pattern 'merge result for PR #(1512|1514)'` → **empty**, against a live
positive control of **604** `marco.:true` hits on the same corpus. Nothing was armed for this on my
box. **No lane verdict exists**, which is exactly the DOCTRINE §10.1 condition, and an empty probe
must never be read as *"checked, and not Marco's"*.

Hand-classified: `scripts/pipeline/lint-station.mjs` and `scripts/pipeline/vm-git-guard.sh` are
outside `^(tests|docs)/` ⇒ **MARCO'S**. `[NO LANE VERDICT — hand-classified]`. Corroborated: #1512
already carries `do-not-merge`.

**What it means for the next 00 run, stated plainly: `docs/pipeline/stations/00-supervisor.md` may
change under you while #1512 is open.** Re-read your station doc from the tree, not from memory of
this run — and note that #1512 appears to be the fix for **open escalation #18** (the three dangling
state files: `triage-state.md`, `AWAITING-MARCO-DECISION.md`, `queue-watch-state.md`). If it merges,
#18 discharges; do not re-raise it.

### A2. Marco authored the #1510 approval receipt during my run [MEASURED]

`gh pr view 1510 --json files` now lists **`docs/decisions/merge-approvals/1510.md`**; the head moved
`369b6250` → `cfe2c26d`. At 04:06Z, when I read the CP-26 failure log, that file was not in the diff
and `origin/main` held only `1483.md` and `README.md`.

This **answers both halves of the parent breadcrumb's F4 escalation** and they should not be re-asked:

1. The receipt is authored, so CP-26's stated remedy is satisfied and #1510 can go green.
2. The `do-not-merge` unlabel at 04:06:19Z — actor `GH-Mantova`, which is the shared account and is
   never proof a human acted — is now attributable to Marco by the same sequence he ran on #1483
   (unlabel, then author the receipt on the branch). **Nothing removed a label autonomously.**

🔴 **RULE 2 still bars every station from merging #1510.** A receipt is Marco's act of approval, not
a station's clearance; clearance comes from Marco in chat, for that batch only. On #1483 he merged by
hand at 02:46:46Z, and that is the pattern. I did not merge it and did not touch it.

🔴 **The agent prohibition is unchanged: no agent may EVER author a `merge-approvals/<N>.md`.** I did
not, and this addendum is not an invitation for the next run to.

### A3. #1514 opened from the prompt I armed — and I deliberately left it alone [MEASURED]

`pr-schema-label-removal-is-marcos` (armed 04:16:09Z) produced **#1514** at 04:21:03Z:
`docs(pr-prompts): name Marco as the sole remover of do-not-merge`, one file
(`docs/pr-prompts/PROMPT-SCHEMA.md`), no labels, `BEHIND`, auto-merge not enabled.

`docs/pr-prompts/pr-schema-label-removal-is-marcos-ready.md` was **still on disk** when I looked,
which is precisely the state that fooled me an hour earlier: the PR is open but the run has not
retired its own prompt yet. **I did not move it, did not enable auto-merge, and did not touch the
PR.** A docs-only PR is the tests/docs lane's to merge; pre-empting it is how a station steals a
verdict it then cannot read. This is the parent breadcrumb's F1 lesson applied inside the same run.

Watch item for the next run, not a finding yet: escalation **#21** says the tests/docs lane writes a
timeout in a byte-identical format to a policy routing, so a docs-only PR it should have merged can
come back `marco:true`. If #1514 acquires a `marco:true` verdict, that is #21 firing again — and per
RULE 2 a provably-false routing reason still does **not** clear the bar.

### A4. Board at the close of this run [MEASURED]

| PR | lane | classification | why it is not merged |
|---|---|---|---|
| #1510 | watcher | `marco:true` verdict, live | RULE 2. Receipt authored; Marco merges by hand. |
| #1511 | watcher (verdict destroyed by me — parent F1) | hand-classified MARCO'S | `do-not-merge`; needs a receipt. |
| #1512 | **second lane** | `[NO LANE VERDICT — hand-classified]` MARCO'S | `do-not-merge`. Not mine to drive. |
| #1514 | watcher | pending; docs-only | its own lane's to merge. Left alone. |

#1513 (mine) merged CLEAN at 04:21:57Z via native auto-merge, all gates SUCCESS including CP-26.

## WHAT CHANGED

This breadcrumb, and nothing else. No merge, no label, no arm, no queue move since 04:16:09Z.

## FINDINGS

### A-F1 — a second lane is rewriting station instructions with no verdict any station can read [MEASURED]

#1512 is the second time in two days that a PR reached the board without the watcher, and the first
time one has edited **the station docs themselves**. The parent breadcrumb's F2 (no probe for "a
watcher run is in flight") has a sibling here: **no probe for "another lane is mid-change on my own
instructions".** The only reason I noticed is that `rev-1512-ready.md` appeared in my queue root.

RULE 1. **Complete and additive, no risk to data entry: the watcher GitHub App is the fix already
built and waiting** — slug `projectops-watcher`, App ID 4798698, Installation ID 158348768, token
mint measured `201`, and part 2 is **PR #1510, open right now**. Once the watcher pushes under its
own identity, `GH-Mantova` stops being the answer to "who did this" and a second lane becomes
distinguishable from the watcher at a glance. It fixes the immediate case and every future one, and
it removes nothing. Alternative (b), "hand-classify every verdict-less PR", is what I did today — it
works but fails the *complete* test, because it depends on a station noticing. Alternative (c),
asking the second lane to label its PRs, fails the same half: it is a convention, and conventions
are what drifted.

**DEFERRED** — to #1510 merging, which is Marco's. Nothing further is needed from a station; the
change is built. What would make it urgent: a second-lane PR that merges without a receipt.

### A-F2 — escalation #18 is being fixed by #1512; do not re-raise it [MEASURED]

#1512's body tabulates exactly #18's three files with their on-main / on-disk status.

**DEFERRED** — to #1512 merging. When it does, discharge #18 rather than re-measuring it. If it
closes unmerged, #18 stands unchanged.

### A-F3 — F4's escalation is answered and must not be re-asked [MEASURED]

Both questions in the parent breadcrumb's F4 are closed by A2 above. Re-asking Marco a question he
has already answered by acting is the failure mode this pipeline calls *"a disposition addressed to
a future run outlives its own fix"*.

**ACTIONED** — recorded here so the next run reads the answer instead of the question.

## WHAT I DID NOT DO

- **Did not merge, label, unlabel, or update any of #1510, #1511, #1512 or #1514.**
- **Did not author a `merge-approvals/<N>.md`.** Permanently forbidden.
- **Did not touch `pr-schema-label-removal-is-marcos-ready.md`**, even though it looked stranded —
  the same appearance that cost a lane verdict earlier in this run.
- **Did not arm a second prompt.** RULE 4, one at a time; the first is still in flight.
- **Did not review or amend #1512's edits to my own station doc.** Reviewing a change to my
  instructions while acting on the old copy is the version-skew trap; the next run reads the merged
  doc from the tree.
- **Did not remove the two orphaned worktrees** (`C:/po-1483-fix`, `C:/po-work/s2-e2e`) — still
  Station 03's, still dispatched. My own worktrees for this run were both torn down.
