# Station 06 — PR Master | 2026-10-02T05:49Z–10:05Z

## GROUND

```
UTC            2026-10-02T05:49:08Z (run start; staging at ~10:00Z)
origin/main    7d9926ae            (fetched, then rev-parse)
dev tree       main @ ce62d135  C:\ProjectOperations2 (behind; not used for staging)
doc version    1
bootstrap      n/a - interactive run, Marco present
```

Staging worktree: `C:\PR-Master\worktrees\stage-qf-batch` off origin/main 7d9926ae.

## WHAT I MEASURED

- [MEASURED] `vm-git-guard.sh` exited 2 (INSTALLED BUT INERT). Last line:
  `PATH="/sessions/rcw-01q48j2rwc7o2q9qrkkxl3rt/.local/bin:$PATH" git <args>`. All git ran in
  powershell.exe on the host.
- [MEASURED] `status-sweep.ps1` at 09:59:50Z: index.lock False/False, scoped git processes 0, no PR
  touched in the last 2 min, armed 0, watcher RUNNING. Board not busy.
- [MEASURED] The three prompts each lint ADMIT, run from a worktree at origin/main 7d9926ae.
- [MEASURED] Tender.status is a String. The values written in the app are DRAFT, IN_PROGRESS,
  SUBMITTED, AWARDED, CONTRACT_ISSUED, CONVERTED, LOST and WITHDRAWN. "WON" is a
  TenderOutcome.resultType (OutcomeCaptureModal.tsx:19).
- [MEASURED] win-likelihood.service.ts:276 `status: { in: ["WON", "LOST", "CLOSED", "NO_BID"] }`, so
  no won tender enters the cohort.
- [MEASURED] agreed-record-register.service.ts raiseClaim de-duplicates against the target month's
  claim only. contracts.service.ts:695 excludes items "not already on any prior claim line".
- [MEASURED] `git grep 's7-btn--danger' -- '*.css' '*.scss'` returns 0; positive control `s7-btn`
  returns tokens.css.

## WHAT CHANGED

- PR (this one): stages three HOLD prompts plus the approved danger-button mock-up. Docs only.
- PR #2193 branch: S7a gate released at commit 11e1adf0 on Marco's "s7a approved". Lint went from
  HUMAN_GATE_PRESENT to PROMOTE / GATE_RELEASED.
- `C:\PR-Master\drafts\`: 11 spent drafts moved to `_staged\`, S8b moved to `_superseded\`. Moved,
  never deleted.
- Punch list artifact (Work Breakdown) republished in place: package 10, groups 1.5 and 2.3, six
  statuses corrected.

## FINDINGS

**F1 — win likelihood is computed from losses only.** Every real win carries status AWARDED,
CONTRACT_ISSUED or CONVERTED, and the cohort query asks for WON. Bid ranking still ranks won jobs,
and the win-rate report drops CONVERTED.
DISPOSITION: ACTIONED — `pr-tender-status-vocab-s1-a-win-is-awarded-HOLD.md` staged here, approved
by Marco 2026-10-02.

**F2 — the SoR register can bill an item that is already on a previous month's claim.**
DISPOSITION: ACTIONED — `pr-sor-claim-s1-never-claim-an-item-twice-HOLD.md` staged here,
`escalates: true`, approved by Marco 2026-10-02.

**F3 — `s7-btn--danger` has no CSS rule in five confirm dialogs.**
DISPOSITION: ACTIONED — `pr-danger-button-s1-style-the-danger-variant-HOLD.md` staged here.
Marco chose the AA-contrast darker red from the mock-up.

**F4 — `new-worktree.ps1` leaks git's "HEAD is now at" line into its success stream**, so
`$wt = & new-worktree.ps1 …` captures more than the path.
DEFERRED — cosmetic until a caller trusts `$wt`. It becomes urgent when a station script does.

## WHAT I DID NOT DO

- Did not arm or merge anything. Arming the three HOLDs, and merging this PR and #2193, are Station
  00's.
- Did not touch `sot/`.
- Did not draft the pipeline items Station 00 handed over on 09-24. #2197 shows 00 is staging the
  PR-number one itself, so I left that cluster to avoid a duplicate.
