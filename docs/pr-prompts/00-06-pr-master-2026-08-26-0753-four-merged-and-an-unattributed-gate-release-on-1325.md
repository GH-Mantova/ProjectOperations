# Station 06 — PR Master | 2026-08-26T07:37:37Z–2026-08-26T07:56Z

## GROUND

```
UTC            2026-08-26T07:37:37Z
origin/main    1dba95ee -> 4da3eb68 (four merges during this window)
dev tree       main   C:\ProjectOperations2
doc version    1
bootstrap      1 (scheduled check-back on the 06:57Z fix-forward run)
```

NOT BLIND. Closure run for `00-06-pr-master-2026-08-26-0657-...`, whose verification was explicitly
deferred to this one.

## WHAT I MEASURED

- `[MEASURED]` All four merged, read from `gh pr view --json state,mergedAt,mergeCommit`:
  **#1316** 07:18:33Z · **#1326** 07:21:35Z · **#1320** 07:38:15Z · **#1323** 07:53:53Z.
  `origin/main` is now `4da3eb68`. Every one landed through native squash auto-merge; **nothing was
  hand-merged.**
- `[MEASURED]` #1323's final head `fd8d5b1f`: **12 checks, 12 success, 0 failure**, `PR gates`
  included — CP-26 clears the moment the label is off, exactly as designed.
- `[MEASURED]` Read-back on `origin/main`, each with a control:
  - `App.tsx:701` and `:710` carry `perms={["crm.view", "tenders.view"]}` (control: 13 `crm.view`
    hits in the file); `route-guards.crm-audience.test.ts` is tracked.
  - `ignoreCodes` in `apps/api/jest.config.ts`: **0 hits**.
  - `arm-prompt.ps1` carries `$undoExit = $LASTEXITCODE` and `[System.IO.FileShare]::ReadWrite`, and
    the blob **starts with a UTF-8 BOM** (`bom=true`, 14427 bytes) — so B4 is fixed on main, not just
    on a branch.
  - Tracked `00-*` breadcrumbs under `docs/pr-prompts`: **23 -> 69**.
- 🔴 `[MEASURED]` **#1325's `do-not-merge` label was removed at 07:22:09Z by an actor that was not
  this station.** From `gh api .../issues/1325/events`: `2026-08-25T16:29:17Z labeled` …
  `2026-08-26T07:22:09Z unlabeled do-not-merge`, actor `GH-Mantova`. My only label removal in this
  session was **#1323 at 07:15:21Z**, visible in the same query — so the instrument returns positives.
  The watcher did not do it: its source has **1 label-add call and 0 label-remove calls**
  (control: 23 hits for the string `do-not-merge`), and its log for 07:20–07:24Z shows only
  `[update] PR #NNNN branch updated`. No local `node.exe` running Claude at the time of the check.
  **Actor unattributable beyond the shared `GH-Mantova` token.**

## WHAT CHANGED

- **Re-applied `do-not-merge` to #1325** at ~07:39Z. Read back: `labels=[do-not-merge]`,
  `auto=NONE`, and still `NONE` at 07:53Z. Restoring a gate Marco personally reserved; reversible.
- Nothing else. No merge command was issued by hand, no prompt armed, no index touched.

## FINDINGS

### F1 — the fix-forward batch is verified on main, not merely merged
Four PRs, every fix re-read from `origin/main` with a control. The 08-25 review's three blocking
findings and the fourth found while proving them are all discharged.
**DISPOSITION: ACTIONED.**

### F2 — 🔴 a human gate released itself on the one PR Marco reserved
#1325 is the `sot/04` B-P0a direction reversal — the single item Marco explicitly kept. Its
`do-not-merge` came off 44 minutes after he said so, from the shared `GH-Mantova` identity, with no
watcher code path capable of doing it. It never approached merging (no auto-merge armed, `UNSTABLE`),
so the impact was zero — but a gate that can come off unobserved is worth more than the PR it guards,
and RULE 2's second leg (the watcher's `stays for Marco` routing) is the only thing that still held.
**DISPOSITION: ESCALATED** — Marco. Two things only he can settle: whether he or a tool he authorised
removed it, and whether the `do-not-merge` gate needs an alarm rather than a label.

### F3 — the breadcrumb pile is back to 1, by his decision
He declined a standing exception and took the one-off sweep, so this file is untracked the moment it
is written. Recording it so the next run reports the count, not the surprise.
**DISPOSITION: DEFERRED.**

## WHAT I DID NOT DO

- **Did not merge, re-run, re-label or otherwise touch #1325** beyond restoring the label that was
  removed. It remains Marco's, gated, unarmed.
- **Did not open a second docs-only PR** for this breadcrumb. He declined the standing exception one
  hour ago; doing it again by reflex would be that exception without the decision.
- **Did not arm** `pr-crm-tender-count-truth` or `pr-crm-wincount-s2`, whose gates remain open.
- **Did not hunt the label-removal actor further** — attribution past the shared token needs audit-log
  access I do not have, and guessing at it would be exactly the kind of confident-and-wrong claim
  DOCTRINE §7.1 exists to stop.
