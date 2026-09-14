# Station 00 — Supervisor | 2026-09-14T07:08Z–07:4xZ

## GROUND

```
UTC            2026-09-14T07:08:23.005Z (task lastRunAt, this run — scheduled-tasks MCP)
origin/main    ee885d07              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 73048f1a       C:\ProjectOperations2   (3 behind origin/main, 0 ahead)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only on that account.

**SIGHTED.** Desktop Commander answered on the first call (`start_process`, shell `powershell.exe`,
pid 30812) and never dropped. That breaks the 3-of-4 blindness run the 06:08Z breadcrumb recorded.

**GUARD INSTALL: FAILED, and it is a finding, not a stop.** `bash .../scripts/pipeline/vm-git-guard.sh`
returned, verbatim: `resume: RPC error -1: failed to mount … is under Plan9 share "c" which is not
mounted … A Windows update released September 8 prevents Claude's workspace from reaching your
files.` [CANNOT MEASURE] the installer's last line. The guard's hazard is a VM-side `git` against a
mounted folder; **this run made zero VM-side calls**, because there is no VM to call into, and it
never substituted its own `git` against a mount.

PREFLIGHT step 2 was honoured the sound way, not the piped way: `git diff --numstat origin/main --
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
returned **EMPTY**, so the three working copies I read ARE `origin/main`'s. No piped `hash-object`
was used anywhere (§9.1: unsound under `powershell.exe`). All three were read in full.

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` §7 → `[LIVE] SAFE TO ACT: no board mutation in progress, no recent
  remote activity, no live station worktrees.` Captured with `*>` to a file and decoded **utf16le**
  (§9.3 — PowerShell redirection writes UTF-16LE and the prescribed cure walks into it): 419 lines,
  all ten sections present. Section 0 controls both PASS (`gh` reached GitHub, `node` runs).
- [MEASURED] **The board is three PRs and every one of them is Marco's.**

  | PR | state | classification | evidence |
  |---|---|---|---|
  | `#1918` fv2-import S1 | OPEN CLEAN, 15/0 green | **RULE 2** | `[watcher] merge result for PR #1918: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/forms/inspection-builder.controller.ts"}` |
  | `#1919` scope-cards plan reconcile | OPEN CLEAN, 10/0 green | **second lane, docs-only — and its body is a PROSE HOLD** | 0 prompt-log hits; `classifyPolicyFiles` by hand ⇒ tests-docs; body reads *"HOLD — Marco releases. Do not merge from a station."* |
  | `#1920` EA-2a preset seed | OPEN BLOCKED, 12/3 | **RULE 2 + label** | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`, `labels=[do-not-merge]` |

  RULE 2 probe run the mandated way — `Select-String -Path docs\pr-prompts\processed\pr-*.log
  -Pattern 'PR #<n>\b'`, regex not `-SimpleMatch`, excluding `rev-*`, in the **live** tree
  `C:\ProjectOperations2` and never the clone. POSITIVE control `marco.:true` → **665**. NEGATIVE
  control, a freshly minted needle → **0**. Newest `processed/` log `06:33:54Z`, younger than every
  open PR, which is the control that separates the live corpus from the 2026-08-17 decoy.
  Both verdicts cross-check against their own prompt's log (each log carries that prompt's own
  `opened PR #<n>` / PR-URL line for the same number), so neither is a §10.1 prose scrape.
- [MEASURED] `check-breadcrumb.mjs --freshness` → exit **2**. `00` 1.1 h ok · `04` 1.0 h ok ·
  `03` **80.0 h SILENT** · `05` **89.0 h SILENT**. Crossed against `list_scheduled_tasks`, which is
  the instrument that names the cause: `03` `0 9 * * *` enabled, lastRunAt **2026-09-10T23:01:10Z**,
  nextRunAt **2026-09-14T23:00:45Z**; `05` `10 0 * * *` enabled, lastRunAt **2026-09-10T14:10:55Z**,
  nextRunAt **2026-09-14T14:10:37Z**. That is the freshness table's row 1 — *lastRunAt older than
  one cadence ⇒ the occurrence never fired* — and F5 says why it is not a station defect.
- [MEASURED] armed queue: `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0**;
  `*-LOOPING.md` → **0**. Tracked depth-1 `-HOLD.md` on `origin/main` → **41**.
- [MEASURED] `.arming-log.txt` → **115** rows, newest `2026-09-14T06:03:57Z ARMED
  pr-ea-s2a-dashboard-preset-seed escalates=true actor=station-00.interactive-0003
  by=Marco@LAPTOP-E6NHU4E4 pid=20752`. No `07:03:57Z` row — the hourly arming lane did **not** arm
  this hour, which is the 06:08Z run's F1 falsifying probe answered in the direction that weakens it.
  `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → `2  0`, i.e. insertions with
  ZERO deletions: the working copy is a strict superset of `main` and safe to land whole.
- [MEASURED] **The dev tree's 3-commit lag is not cosmetic — it inverted a lint verdict this run.**
  `lint-prompt.mjs docs/pr-prompts/pr-geocodify-v2-host-HOLD.md` → exit **0, ADMIT**, because the
  linter greps `premise:` against the WORKING TREE. Asked of `origin/main` instead:
  `git grep -c "app.geocodify.com/api" origin/main -- <the adapter>` → **exit 1, no hits** (the
  premise is FALSE, the prompt is SPENT); POSITIVE control `api.geocodify.com/v2` → **6**; NEGATIVE
  control, the minted needle → exit 1. The same needle in the working copy → **6**. See F2.
- [MEASURED] `lint-prompt.mjs docs/pr-prompts/pr-brandtheme-s4-named-presets-seed-HOLD.md` → exit
  **3, STALE**, *"The work is ALREADY DONE"* — independent of `triage-holds.ps1`, and agreeing with
  Station 04's 06:10Z reading.
- [MEASURED] watcher: `status-sweep.ps1` §2 `watcher node: RUNNING pid 30976`, wrapper alive (1),
  heartbeat 37 min (ticks only mid-run; stale + empty queue = idle, not wedged). `git worktree list`
  shows no build worktree in the clone and **0** running `git.exe` processes. `restart-watcher-if-wedged.ps1`
  was NOT run separately: the sweep's own §2/§3 answered it and nothing suggested WEDGED or DOWN.
- [MEASURED] the branch `#1920` sits on was touched by another actor 49 min before I did:
  `375c603a … PR Supervisor <supervisor@local> … 06:27:25Z fix(platform): EA-2a seed queries
  Role.rolePermissions` (dev-tree identity ⇒ the interactive lane, §10.2.1's corrected table), then
  `6f45425c … GH-Mantova <…users.noreply…> 06:43:14Z Merge branch 'main' into …` (the update-branch
  automation). Nothing at all since. Condition 3 was re-measured immediately before I pushed.

## WHAT CHANGED

1. **`#1920`'s branch: one commit pushed, `6f45425c..b1efa896`.** Read back from GitHub:
   `gh pr view 1920 --json headRefOid` → `b1efa896`, state OPEN. See F1. **The `do-not-merge` label
   was NOT touched and `#1920` was NOT merged.**
2. **Board PR opened** carrying: five untracked breadcrumbs (00's 0308/0408/0508/0608 and 04's
   0610) plus this one; `docs/pipeline/sweep-rotation.json` (04 advanced it and may not commit);
   `.arming-log.txt` (the two uncommitted arm rows); two spent prompts retired by `git mv` to
   `docs/pr-prompts/superseded/`; five 2026-09-11 breadcrumbs `git mv`-ed to `docs/pr-prompts/archive/`.
   Built in a **disposable worktree off `origin/main`** (`C:\po-wt\board-0709`), never in the dev tree.
3. **Three escalations discharged** (disk move, `needs-marco/` is gitignored):
   `pr-1898-review-fix.md`, `pr-1911-review-fix.md`, `pr-1913-review-fix.md` → `needs-marco/discharged/`,
   with `_DISCHARGE-NOTE-2026-09-14-0709.md` beside them. Census 55 → **52**. See F4.
4. **Nothing else.** No arm, no disarm, no merge, no label change, no `/sot/`, no Azure, no
   production data, no receipt authored, no process killed, no `git` in `C:\po-watcher`, no
   `checkout .` / `reset --hard` / `stash pop` / `clean` anywhere.

## FINDINGS

### F1 — S2. The one real red on the board was a REQUIRE CYCLE that has been latent on `main`, and only a test entering the module from the wrong side could ever see it

`#1920` read 12 pass / 3 fail. Two of the three are the CP-26 pair DOCTRINE §9.4 calls **parked by
design** — `Approval receipt (CP-26)` and `PR gates — diff checks` fail from the one cause, the
`do-not-merge` label, and only Marco clears it. The third was real: `API — lint, test, compliance
smoke`.

Read from the job log, **column 3 after splitting on the tab** (§9.1 — column 1 is the job name, so
grepping whole lines matches every line of all 4073):

```
FAIL src/modules/platform/__tests__/estimating-analytics-preset.spec.ts
  ● Test suite failed to run
    TypeError: tender_winloss_report_definitions_1.TENDER_WINLOSS_REPORT_DEFS is not iterable
      at Object.<anonymous> (src/modules/reporting/reporting.service.ts:383:6)
      at Object.<anonymous> (src/modules/reporting/tender-winloss-report.definitions.ts:2:1)
      at Object.<anonymous> (src/modules/platform/__tests__/estimating-analytics-preset.spec.ts:27:1)
```

**The cause is a cycle, and it is on `main`, not in this PR's diff.** `reporting.service.ts` imports
every `*.definitions.ts` file to build `REPORT_DEFS`; `tender-winloss-report.definitions.ts` imported
`dateRangeFilter` and `decimalToNumber` **as runtime values** back out of `reporting.service.ts`.
Enter the definitions module first and `reporting.service.ts` evaluates while
`TENDER_WINLOSS_REPORT_DEFS` is still uninitialised, so line 383 spreads `undefined`. Trunk is green
because nothing on `main` enters from that side; `#1920`'s new spec is the first thing that does.

🔧 **The fix is the pattern the codebase already documents.** `estimating-analytics-report.definitions.ts`
carries the comment *"This file intentionally does NOT import from reporting.service to avoid …"* and
avoids it by **duplicating** both helpers. I moved them instead: new
`apps/api/src/modules/reporting/reporting.helpers.ts` (imports nothing from the reporting layer),
`reporting.service.ts` imports **and re-exports** both names so every existing importer is unchanged,
and the definitions file keeps only an `import type` of `reporting.service`, which is erased at
runtime. Complete (it removes the cycle for every future definitions file, not just this one) and
additive (no behaviour change, no signature change, nothing weakened, no test skipped — §8.2's
"never a mask"). Both edits were made in node by concatenation with the **byte delta asserted**
(§9.3's `$`-in-replacement trap): `svc expected=15210 actual=15210 MATCH=true`,
`def expected=13292 actual=13292 MATCH=true`.

Pushed to `#1920`'s own branch rather than staged as a separate `fixes_pr`, per §8.2's "prefer ONE
complete fix in place": both routes need Marco (an `apps/api` diff is outside `tests|docs` either
way), and in place is one move instead of two plus a rebase.

⚠️ **Stated plainly: the change is verified by read-back and by construction, NOT by a local test
run.** The worktree has no `node_modules` and installing one does not fit an hourly slot. **CI is the
evidence and its exit code decides** — F1 is not closed until `API — lint, test, compliance smoke`
goes green on `b1efa896`. If it does not, the next run owns it.

DISPOSITION: **ACTIONED** — fix pushed, PR head read back as `b1efa896`. **`#1920` is NOT merged and
must not be: `escalates:true`, `do-not-merge`, watcher `marco:true`.** Driving it green is the whole
of this station's authority over it.

### F2 — S2. A three-commit lag in the shared dev tree made `lint-prompt.mjs` say ADMIT about work that merged 45 minutes earlier

Station 04's 06:10Z F1 asked me to retire two prompts. `pr-brandtheme-s4-named-presets-seed-HOLD.md`
lints **exit 3 STALE** and is unambiguous. `pr-geocodify-v2-host-HOLD.md` lints **exit 0 ADMIT** —
and `#1915`, which merged at **06:32:00Z**, carries **exactly** that prompt's two `scope:` files and
its subject in the title.

The discrepancy is entirely the dev tree's lag: the linter evaluates `premise:` against the
**working tree**, `origin/main` is 3 ahead, and the premise needle `app.geocodify.com/api` is gone
from `main` (exit 1, with the v2 host present 6 times as the positive control) while the working
copy still shows 6. **A run that trusted the ADMIT would have armed a duplicate of a PR that merged
during this very hour.**

This is the standing "a stale dev tree reports a spent prompt as armable" trap firing on a live
board, and the standing cure — fast-forward before any triage or arm — could not be applied first,
because the dev tree is dirty with exactly the files this run is landing. **That ordering is the
finding: the cure for the trap is blocked by the work that clears it.** The sound substitute, used
here, is to ask `origin/main` directly with `git grep <needle> origin/main -- <path>` and controls,
never the working copy.

DISPOSITION: **ACTIONED** — both prompts `git mv`-ed to `docs/pr-prompts/superseded/` in the board
PR, on two independent instruments each (lint verdict + merged-PR scope match for brandtheme; the
`origin/main` premise probe + merged-PR scope match for geocodify). 04's ask (2) — add the
`superseded/` rename to `#1915`'s branch before it merges — is **moot**: `#1915` merged at 06:32Z,
40 minutes before this run started, and the retirement is done here instead.

### F3 — S3. `pr-ea-s2a-dashboard-preset-seed` is the next instance of the same defect and its PR will not retire it either

`pr-ea-s2a-dashboard-preset-seed-HOLD.md` is tracked on `origin/main` at depth 1 and deleted in the
dev-tree working copy (the arm's `git mv`, whose `-ready.md` the build then consumed). `#1920`'s
diff is **two files**, `apps/api/prisma/seed.ts` and the new spec — **no `docs/pr-prompts/` path**.
So on the next fast-forward the HOLD returns to disk and is armable again while its own PR is open,
exactly as `pr-geocodify-v2-host` and `pr-brandtheme-s4` did.

`#1918` is the positive control and proves this is a divergence rather than "the watcher never does
this": its diff carries `docs/pr-prompts/superseded/pr-fv2-import-s1-docx-and-persona-HOLD.md` as a
pure rename, which is the correct retirement, on the branch, awaiting merge.

I did **not** add the rename to `#1920`'s branch this run. I had already pushed F1's fix, a second
push would spend another full CI cycle on Marco's PR for a queue-hygiene rename, and the hazard
cannot fire until someone fast-forwards the dev tree — which is the next sighted run, with this
paragraph in front of it.

🔴 **DO NOT ARM `pr-ea-s2a-dashboard-preset-seed` while `#1920` is open.** The one-name do-not-arm
list from the 06:08Z run is now exactly this one: the other two are retired by F2, and
`pr-fv2-import-s1-docx-and-persona` retires itself when `#1918` merges.

DISPOSITION: **DEFERRED** — to the next sighted run, with one concrete instruction: **before
fast-forwarding the dev tree, add the `superseded/` rename to `#1920`'s branch**, or retire it in
that run's own board PR the moment `#1920` merges. What would make it urgent: any arming decision
reached on a quiet board, since `lint-prompt.mjs` will read it ADMIT.

### F4 — S4. Three `[STALE]` escalation rows cleared, and the sweep's own section 5 is the falsifying probe

`status-sweep.ps1` §5 tagged three files `[STALE]`. Each PR was re-asked **individually** with
`gh pr view <n> -R GH-Mantova/ProjectOperations --json state,mergedAt` — never a list response,
whose `merged` field DOCTRINE §9.4 records as unusable — against a negative control
(`gh pr view 999997` → exit 1): `#1898` MERGED 09-13T11:11:36Z, `#1911` MERGED 09-14T04:00:56Z,
`#1913` MERGED 09-14T05:23:16Z. Each file was opened and read: 1911 (hex literals → tokens) and 1913
(CP-23 `SEED-ONLY` marker missing from the PR body) are re-fire instructions for builds that have
since merged; 1898 asks for a **backfilled merge-approval receipt**, which a scheduled run may never
author and whose general form is already carried by the live escalation
`nothing-verifies-a-merge-approval-receipt-2026-09-07.md`. Nothing general survives any of the three.

Moved — **never deleted** — to `needs-marco/discharged/` with `_DISCHARGE-NOTE-2026-09-14-0709.md`.
Census **55 → 52**.

DISPOSITION: **ACTIONED**. ⚠️ That folder is gitignored, so **this breadcrumb is the only place the
discharge is reported**. Falsifying probe: re-run the sweep and read section 5 — if any of the three
names is still tagged, the move did not take.

### F5 — S3. `03` and `05` read SILENT for four days, and the cause is the outage already on file, not a station defect

`--freshness` calls both SILENT. The MCP names the cause: both are **enabled**, both have
`lastRunAt` on **2026-09-10**, and both have a `nextRunAt` **later today** (`05` at 14:10:37Z, `03`
at 23:00:45Z). That is row 1 of the freshness table — the occurrences never fired — and it is
consistent with the 00:27Z breadcrumb *"stations were switched off"* plus 00's own 53-hour reporting
gap between 09-11T04:08Z and 09-13T09:00Z. `04`'s re-enable already proved itself by firing at
06:10:01Z. **Neither daily station has reached its first post-re-enable occurrence yet**, so there is
nothing here to call a defect, and calling one would be the §7 false alarm that licenses destructive
action.

DISPOSITION: **DEFERRED**, with the probe handed forward by run-slot exactly as the 06:08Z run did:
**the 14:1xZ or 15:0xZ run owns `05`; the 23:0xZ+ run owns `03`.** What would make it urgent: either
`nextRunAt` passing with `lastRunAt` unchanged — that IS a defect, and at that point read the session
transcript before calling the station stopped.

### F6 — S3. `#1919` is green, docs-only, unlabelled, second-lane — every machine signal says mergeable, and its body says do not

`#1919` touches one file, `docs/plans/scope-cards-reconciliation-plan.md`. Hand-classified under
§10.1 step 2: matches `^(tests|docs)/`, no `(^|/)migrations/` path, so `classifyPolicyFiles` reads
**tests-docs**; `[NO LANE VERDICT — hand-classified]`, 0 prompt-log hits with the probe's controls
passing. Unlabelled, CLEAN, 10/0 green. On every instrument this station owns it is inside my merge
authority.

**Its body reads: `HOLD — Marco releases. Do not merge from a station.`** A prose gate matches
neither `lint-prompt.mjs` marker regex and no label, so nothing mechanical would have stopped a merge
here — DOCTRINE §9.5's *"a prose human gate is invisible to both the linter and any grep built on
them"*, reached from the PR side rather than the prompt side, which is a corpus that rule does not
currently name.

DISPOSITION: **ESCALATED**, as a narrow question rather than a status update, and deliberately NOT
as a new `needs-marco/` file — it is one clause on an existing mechanism and a new file would be the
noise the standing rules warn about. **Marco: should a PR body's prose HOLD be given a machine form
— the `do-not-merge` label, which is yours alone to apply and remove — so that a station is stopped
by a gate rather than by reading carefully?** Under RULE 1: **(a) complete + additive — the lane that
opens a held PR applies `do-not-merge` at open time.** It solves it immediately and in future (every
future held PR is gated, not narrated), damages no data entry, and removes nothing: the prose stays,
it simply stops being the only stop. **(b) Add a body-marker regex to the merge primitives.** Fails
the *complete* half — it gates only the PRs whose authors happen to use the exact wording, and a
paraphrase silently passes. **(c) Leave it.** Fails *complete* outright: it holds only for as long as
every station reads every body, which is the assumption §9.5 exists to refute.

### F7 — Q6: the one most important thing blocking progress

**Every PR on the board needs Marco, and two of the three needed him before any of today's work
started.** `#1918` and `#1920` are RULE 2, `#1919` is held in prose. The board cannot move further
than green, and it is now green apart from `#1920`'s CI re-run and the two CP-26 reds that only the
label removal clears. Everything this station could do without him is done.

DISPOSITION: **ESCALATED** — not as a new file. The throughput constraint is already stated in
`arming-throughput-rule-b-is-ungated-2026-09-06.md` and
`instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`; what this run adds is that on a
three-PR board it was 3 of 3.

## WHAT I DID NOT DO

- **Did not merge anything.** All three open PRs are Marco's on the evidence above, and `#1919` —
  the only one that reached my merge authority on every machine instrument — was stopped by reading
  its body. I did not run `Assert-SmokedOrEscalate` or `Merge-Pr` at all this run.
- **Did not remove a `do-not-merge` label** from `#1920` or anything else. Only Marco does that.
- **Did not arm, disarm or rename any prompt into `-ready.md`.** `armed` was 0 at the start of this
  run and is 0 at the end; the two `git mv`s in the board PR are retirements into `superseded/`,
  which arms nothing. **Arming was not attempted at all**: the board carries three PRs Marco has not
  cleared, and adding a fourth would lengthen the queue rather than shorten it.
- **Did not fast-forward the dev tree**, which is still 3 behind and dirty with the files this board
  PR lands. Doing it before the PR merges would need the `save → restore → FF → REAPPLY` dance on an
  append-only `.arming-log.txt` whose local copy is a strict superset of `main` (`2 0` on
  `--numstat`), and step 1 of the naive cure deletes those two rows silently with every read-back
  still passing. **Whoever fast-forwards next: save the local `.arming-log.txt` first, and read back
  that the final row count is 115 or higher.**
- **Did not run `smoke-pr.ps1` or `visual-smoke.mjs`.** No PR here is mine to merge, and neither
  `#1918` nor `#1920` touches `apps/web/**` in a way declaring visual acceptance screens.
- **Did not install the VM git guard** — [CANNOT MEASURE], the Plan9 share is unmounted for the
  seventh consecutive day. Already carried by three open escalations; not re-raised.
- **Did not touch** `/sot/`, Azure / Entra / SharePoint, any migration or production-data prompt, the
  watcher process, `C:\po-watcher\ProjectOperations` beyond read-only `worktree list`, or
  `C:\PR-Master\worktrees\po-vg` — which still holds the only copy of untracked
  `scripts/pipeline/check-pipeline-heartbeat.mjs` (04's F2; still 03's or a later run's, and worth
  publishing before that worktree is pruned).
- **Did not author any `merge-approvals/<N>.md`.** Absolutely barred to a scheduled run.
- **Did not re-dispatch 04's F3 (72 clone stashes) or F4 (the VM transport).** F3 is already
  DISPATCHED to 03 by 04 and 03 wakes on its own clock; F4 is already ESCALATED to Marco by 04 with
  its options. Re-raising either would be the duplicate-signal failure the station doc names.
- **Did not tear down `C:\po-wt\ea2a-fix` before reading back the push.** Both disposable worktrees
  (`ea2a-fix`, `board-0709`) are removed at the end of this run; neither ever held this breadcrumb,
  which was written inside the board PR's worktree per the REPORT CONTRACT's first cure.
