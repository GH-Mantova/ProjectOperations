# Station 00 — Supervisor | 2026-08-25T06:13Z–07:04Z | **BOARD EMPTIED**

Interactive continuation of the 04:08Z BLIND run. Desktop Commander came up mid-session, so this
half was **NOT BLIND**. Marco was present and answering.

## GROUND

```
UTC            2026-08-25T06:13Z-07:04Z
origin/main    NOT STAMPED by the original run  (measured c0d5d57b at 07:10Z by the 07:09Z run)
dev tree       NOT STAMPED by the original run
doc version    NOT STAMPED by the original run
bootstrap      NOT STAMPED by the original run
```

> **Contract repair, Station 00, 2026-08-25T07:2xZ.** `check-breadcrumb.mjs` REJECTed this file for
> five missing sections. The five canonical headings below were inserted and the original headings
> demoted one level. **No prose was changed, added or removed** apart from this note and the two
> pointer lines marked "contract repair". The GROUND block was never stamped by the original run and
> is recorded as missing rather than reconstructed.

## WHAT I MEASURED

### AUTHORISATION — recorded, because both of these are normally hard stops

1. **RULE 2 (never merge a watcher-routed PR) was released by Marco in chat**, via `AskUserQuestion`:
   *"Yes — merge #1311, #1312, #1314."* RULE 2 is a gate that waits for Marco; his explicit
   instruction is the only thing that satisfies it. It remains uncleared by green / clean /
   unlabelled / a MERGE verdict / a provably-false routing reason.
2. **`do-not-merge` on #1313 was removed on Marco's explicit per-PR authorisation**
   (*"I authorise you to remove it"*). Default hard stop is unchanged: never remove that label on
   my own judgement. Recorded here because RULE 2 has no audit trail — everything merges as
   `GH-Mantova`.

### What was merged, in order, and why that order

| # | PR | merged (UTC) |
|---|---|---|
| 1 | **#1311** `fix(crm)` rename page H1 to "Leads & opportunities" | 06:13:59Z |
| 2 | **#1312** `feat(crm)` Archive action on triage entries + Restore | 06:30:16Z |
| 3 | **#1313** `feat(auth)` `@RequireAnyPermission` + pipeline dashboard to `tenders.view` | 06:46:00Z |
| 4 | **#1314** `ci(web)` raw-error-envelope gate | 07:01:15Z |

- **#1311 before #1312** — the one real dependency: both touch
  `apps/web/src/pages/crm/CrmBoardPage.tsx`. #1312 flipped to `BEHIND` the moment #1311 landed.
- **#1314 last, deliberately.** It is a *gate*; putting it last made it validate the final `main`.
  Before committing to that order I checked the interaction rather than assuming it:
  `gh pr diff <n>` filtered to added lines matching `.text()` → **0 hits in #1311 and #1312**, so
  the gate could not have blocked them in either order. Its own `raw-error-envelope` check then
  passed against a `main` already containing all three. **[MEASURED]**

### The only "issue" any of them had — and it was not a defect

#1313's sole red was:

```
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.]
```

**CP-26 is the hold itself, not a bug to chase.** Label removed → re-ran → **green with zero code
change**. Nothing was fixed because nothing was broken. All other checks on all four PRs were
already passing.

### Method

Sanctioned path only, per DOCTRINE — no hand-merging:

```
. .\scripts\pipeline\pipeline-lib.ps1
Assert-SmokedOrEscalate -PR <n>    # never-merge list → checks green → body claims real
Merge-Pr -PR <n>                   # gh pr merge --squash --delete-branch, then RE-READS state
```

`Merge-Pr` throws unless the read-back says `MERGED`. Every one of the four printed
`MERGED-CONFIRMED` plus a `mergedAt`. No merge is reported here that was not read back.

🔧 **Branch protection requires up-to-date branches.** Each merge pushed the remainder to `BEHIND`,
forcing `gh pr update-branch` and a full CI re-run — `tendering-e2e` is a ~13 min long pole. I
updated the *remaining* PRs together after each merge so their CI ran concurrently; that turned four
serial ~15 min waits into two.

## WHAT CHANGED

*(contract repair: this run's mutations are the four merges listed under "What was merged, in order, and why that order" above.)*

### Board @ 2026-08-25T07:04Z [MEASURED]

- **OPEN PRs: `[]` — ZERO.** `origin/main = c0d5d57b`.
- ⚠️ **Dev tree is 4 commits BEHIND** origin/main. Fast-forward before any local work.
- 🟢 Watcher **LIVE, no freeze** — `.queue-state.json` `ts` 06:58:03Z → 07:03:03Z = **exactly
  5m00s** against the 5-min rescan. pid **29024**, exact cmdline `pr-watcher[\\/]index\.mjs`.
- **ARMED = 0.** No `*-ready.md` at depth 1; queue-state `armed:0 owned:0 runnable:0`, lane idle.
- `-HOLD` = 57.

## FINDINGS

### FINDING — nothing was gated on these merges

Marco asked whether any gated PR pending these four is armed. **No, and nothing was waiting either.**
Swept all 57 depth-1 HOLD prompts for `#1311|#1312|#1313|#1314|RequireAnyPermission|raw-error-envelope`
and for `blocked on|depends on|after #|once #|waiting on`:

- `pr-sor-s9b-register-ui-HOLD.md` and `pr-sot-02-reconcile-2026-08-19-HOLD.md` mention the
  raw-error-envelope work, but as **background context** ("use `readApiErrorMessage`", "migration
  PARTIAL") — not as a blocking premise.
- Every genuine "waiting on" belongs to something else: the DNS checker's slice-4 gate, e2e-container
  s2's gate, asset-usage F-7.

**DISPOSITION: ACTIONED** — question answered with a measurement. Emptying the board unblocked
nothing and armed nothing. The next arm remains a deliberate act.

### FINDING — live hazard left in place, deliberately

`git diff --cached --name-status` in the dev tree shows another chat's staged rename:

```
R100  docs/pr-prompts/pr-apierr-s12-ci-gate-HOLD.md -> docs/pr-prompts/pr-apierr-s12-ci-gate-ready.md
```

That prompt was **already consumed and shipped as #1314**. Anyone who commits the dev tree now
**re-arms a dead prompt**. Drain with `git restore --staged <path>` — never `git checkout` /
`reset --hard` (board trap).

**DISPOSITION: ESCALATED** — it is another chat's staged work and I did not commit, so I left it
rather than reaching into a shared index. Station 04 flagged it independently at 06:20Z. Whoever
commits next must drain it first.

### FINDING — with an empty board, the verdict-archive log goes MUTE

`runArchiveSettledVerdicts()` logs only when `archived+kept+skipped > 0`. With zero open PRs it will
now print nothing. **Silence means "no PRs", not "frozen".** Use the `.queue-state.json` `ts` GAP —
written unconditionally every rescan.

**DISPOSITION: ACTIONED** — recorded here and in project memory so the next station does not read
the silence as a death.

## WHAT I DID NOT DO

*(contract repair: the original run recorded this as "Still open", below.)*

### Still open from the 04:08Z run

- **F1** `pr-hygiene-gitignore-no-pr-opened-HOLD.md` — staged, ADMIT-linted, lane now idle. Ready to
  arm. **DEFERRED** to a deliberate arming decision.
- **F7** `lint-prompt.mjs` TIER-1 fires on a quoted filename → **DISPATCHED, Station 06.**
- **Q1/Q2** to Marco (the Marco-gate queue, and the breadcrumb/no-Desktop-Commander channel) — Q1 is
  now moot for this batch; Q2 stands, unanswered.

**This file is UNTRACKED.** I did not commit it: the dev-tree index carries another chat's staged
rename, and the Supervisor does not open PRs (LL-38). Project memory is updated and remains primary.
