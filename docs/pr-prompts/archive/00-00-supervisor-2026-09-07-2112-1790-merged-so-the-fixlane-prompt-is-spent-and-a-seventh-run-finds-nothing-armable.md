# Station 00 — Supervisor | 2026-09-07T21:09Z–2026-09-07T21:4xZ

## GROUND

```
UTC            2026-09-07T21:09:03Z
origin/main    dc3f1d33            (fetched, then rev-parse)
dev tree       main @ 16ddd34c -> dc3f1d33 (fast-forwarded this run)  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. **Sighted run** — Desktop Commander reached the box; the first
`start_process` through the `-Command` form died as a parser error (DOCTRINE section 9.1: `$env:`
is expanded before PowerShell parses), and a persistent `powershell.exe` REPL started on the next
call and served the whole run. A parser error on a reached shell is not blindness.

All three binding documents were read in full **after** the fast-forward, and
`git diff --numstat origin/main -- <path>` was EMPTY for `docs/pipeline/stations/00-supervisor.md`,
`docs/pipeline/DOCTRINE.md` and `docs/pipeline/STATION-CAPABILITIES.md`, so the working copies are
byte-identical to `origin/main` (PREFLIGHT step 2, and the no-piped-hash rule).

vm-git-guard installer last line, quoted:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` captured to a file (it returns early and hides its own section 7),
  exit 0, section 7: `SAFE TO ACT: no board mutation in progress, no recent remote activity, no
  live station worktrees.` Section 0 instrument controls both PASS — `gh` reached GitHub, `node`
  runs. Generated `21:10:56Z`.
- [MEASURED] Board: **2 open PRs, both carrying `do-not-merge`.** `#1775` TIP-ID-S2 (created
  `08:57:26Z`) and `#1767` TR-1 (created `06:43:58Z`), each `BLOCKED`, each 13 pass / 2 fail.
  `main` CI on `dc3f1d33`: 4 success / 0 failed (trunk green).
- [MEASURED] Those 2 reds are ONE cause, and I read the verdict token rather than the counts
  (DOCTRINE section 9.4, section 9.1 tab-column rule). `gh run view 34160481304 --job 101861109081
  --log` is 218 lines; splitting each on the tab and searching the LAST column gives exactly one
  hit: `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
  (escalates:true). A human must review and REMOVE the label`. NEGATIVE control, a freshly minted
  needle over the same column, -> 0. `[LABEL_PRESENT]` is **parked by design, not work**, and only
  Marco removes the label.
- [MEASURED] RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`
  and never the clone: **2059** logs, newest `2026-09-07T20:25:33Z` — younger than the oldest open
  PR's `createdAt` (`#1767`, `06:43:58Z`), which is the freshness control that separates the live
  directory from the decoy. POSITIVE `marco.:true` -> **620**. NEGATIVE, freshly minted needle -> 0.
  Matching `PR #<n>` in the BODY of `pr-*.log` only (excluding `rev-*`): `#1775` -> 0, `#1767` -> 0,
  NEGATIVE control `PR #999999` -> 0. Both read `NO LOG`.
- [MEASURED] `[NO LANE VERDICT — hand-classified]`, per section 10.1 step 2. `#1767` carries
  `apps/api/prisma/migrations/...` and is refused on the `(^|/)migrations/` clause -> **MARCO'S**.
  `#1775` carries `apps/api/.../map-locations.service.ts` and `scripts/rates/...`, outside all three
  `NESTED_TEST_PATHS` forms -> **MARCO'S**. **MERGE NONE.** Both also carry the label, so two
  independent gates say the same thing.
- [MEASURED] COLLECT: `check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0,
  `structure: 1 checked, 0 malformed`; all five rows `ok`. Crossed against `lastRunAt` from the
  scheduled-tasks MCP: 00 `21:08:33Z` (this run; prior run's breadcrumb is the 2010 one),
  03 `2026-09-06T23:01:13Z` vs breadcrumb `2026-09-06-2302`, 04 `2026-09-07T18:10:11Z` vs
  `2026-09-07-1810`, 05 `2026-09-07T14:11:15Z` vs `2026-09-07-1412`. **All four aligned; no station
  breadcrumb has been written since my 20:10Z run**, so the only thing to collect was that run's
  own three findings, dispositioned below.
- [MEASURED] `#1790` MERGED `2026-09-07T20:40Z`; `#1777` MERGED `20:07:35Z`; `#1774` MERGED
  `19:50:20Z`. Receipts present for all three at `docs/decisions/merge-approvals/{1774,1777,1790}.md`.
- [MEASURED] `triage-holds.ps1` on the fast-forwarded tree: `TOTALS spent=1 of 44 evaluated
  gates-satisfied=15 still-gated=28 unreadable=0`. GIT control PASS, SPENT fixture control PASS,
  three distinct verdicts observed. The single SPENT is
  `pr-fixlane-s1-a-fix-lane-prompt-can-never-escalate-HOLD.md`.
- [MEASURED] That prompt's premise, checked independently of the linter:
  `git grep -c FIXES_PR_ESCALATION origin/main -- scripts/pr-watcher/index.mjs` -> **5**
  (NEGATIVE control, a minted needle over the same file -> exit 1). The premise
  `! grep -q FIXES_PR_ESCALATION scripts/pr-watcher/index.mjs` is therefore FALSE. The work
  shipped in `#1790`.
- [MEASURED] Lane classification of all 15 ADMIT prompts' `scope:` entries against the three
  `NESTED_TEST_PATHS` forms, controls first (`docs/pipeline/DOCTRINE.md` -> true,
  `apps/api/src/main.ts` -> false, `scripts/pipeline/__tests__/x.mjs` -> true, so the widened forms
  are live and not just the single regex): **ZERO are tests-or-docs only.** Four are
  `gate_allow: migrations`; the remainder's first non-test-or-docs path is `apps/api`, `apps/web`,
  `scripts/`, `.github/workflows/` or `sot/`.
- [MEASURED] Watcher: node RUNNING pid **31660**, auto-restart wrapper alive (1), heartbeat age
  46 min. Armed `*-ready.md` counted by hand -> **0**, so an idle watcher with a stale heartbeat is
  CORRECT, not wedged. `git index.lock` False in both trees; 0 git processes; no PR touched in the
  last 2 min.
- [MEASURED] Watcher clone `C:\po-watcher\ProjectOperations`: `branch=main dirty=3`.
  `C:\po-vg` still orphaned, `age=5117 min`, holding 1 uncommitted file.

## WHAT CHANGED

- Fast-forwarded the dev tree `16ddd34c -> dc3f1d33` (it was `0 1`). The index was clean and no
  tracked file was modified beforehand. All three prescribed read-backs afterwards:
  `git rev-list --left-right --count HEAD...origin/main` -> `0  0`, `git diff --numstat` -> EMPTY,
  `git diff --cached --name-status` -> EMPTY.
- Retired `pr-fixlane-s1-a-fix-lane-prompt-can-never-escalate-HOLD.md` to
  `docs/pr-prompts/superseded/` in this PR (`git mv` on a tracked file, `git ls-files
  --error-unmatch` -> exit 0 beforehand; staged as `R100`).
- Archived the 20:10Z breadcrumb, every finding in it now carrying a disposition.
- **Nothing armed. Nothing merged. No label touched. No receipt authored.**

## FINDINGS

### F1 — The fix-lane prompt is now SPENT, and this discharges the 20:10Z run's only deferral

The 20:10Z run's F2 deferred `pr-fixlane-s1-a-fix-lane-prompt-can-never-escalate-HOLD.md` with the
exact condition *"it becomes a retirement the moment `#1790` merges"*, because retiring on an OPEN
PR is what DOCTRINE section 10.6 forbids — a close-unmerged would make the prompt live again.
`#1790` merged at 20:40Z, 30 minutes after that run ended. The linter agrees: `spent=1 of 44`,
lint exit 3, with the SPENT fixture control passing in the same run so the bucket is measurable.

Retiring it now is the deferral being carried out, not a new decision.

**DISPOSITION: ACTIONED.** Moved to `docs/pr-prompts/superseded/` in this PR; verified by the
staged `R100` rename and by the independent premise measurement above (`FIXES_PR_ESCALATION` -> 5
on `origin/main`, negative control exit 1).

### F2 — Seventh consecutive run in which nothing armable can merge without Marco

Zero of the 15 ADMIT prompts is tests-or-docs only, measured this run with three controls proving
the classifier accepts all three `NESTED_TEST_PATHS` forms and not merely `^(tests|docs)/`. The
`tests-docs` auto-merge lane therefore still has no eligible supply. Both open PRs hand-classify to
Marco and both additionally carry `do-not-merge`. Arming anything on this board adds a PR to his
queue rather than moving the board — which is the throughput constraint stated exactly.

Two of the 15 duplicate an open PR and must be neither armed nor retired while that PR is open:
`pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md` against `#1775`, and
`pr-tr-s1-reminder-policy-HOLD.md` against `#1767`. Two more are Station 05's `sot/` lane
(`pr-sot-01-nav5-reconcile-2026-08-20`, `pr-sot-05-d24-theme-sequencing-reconcile`) and are not
mine to arm.

**DISPOSITION: ESCALATED — already open, not duplicated.**
`docs/pr-prompts/needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md`,
filed 19:0xZ, carries the options in RULE 1 order with **(a) give 06 a cron** first — complete and
additive, because 06 stages `-HOLD` only, so it adds supply and never spends it. This run adds one
more measurement to that cause and **no new file**: a second escalation on one cause is noise.

### F3 — The `#1774` released-no-receipt escalation is dead, and the `#1777` stale-verdict one with it

The 12:31Z run escalated `#1774` as `[RELEASED_NO_RECEIPT]`, and the 19:2xZ run escalated `#1777`
as green with a stale `REJECT-AND-REDO` verdict. Both PRs have since merged — `#1774` at
`19:50:20Z`, `#1777` at `20:07:35Z` — and both carry receipts at
`docs/decisions/merge-approvals/1774.md` and `1777.md` (`Test-Path` -> True for each). The premises
of both escalations are gone, not merely their evidence.

The files themselves live under `docs/pr-prompts/needs-marco/`, which is gitignored
(`.gitignore:76-83`), so clearing them is dev-tree queue hygiene rather than a PR — Station 03's
lane, and already inside the open clone-hygiene dispatch. I am naming them as dischargeable rather
than reaching into another station's tree, which is the LL-38 shape.

**DISPOSITION: DISPATCHED — Station 03.** Add these two to the existing clone-hygiene dispatch:
move `pr-1777-is-green-and-its-only-review-verdict-is-stale-2026-09-07.md` and the `#1774`
released-no-receipt file to `needs-marco/discharged/`, **never delete**. The evidence that
discharges them is in this section, so 03 does not need to re-derive it.

### F4 — The watcher clone is dirty and `C:\po-vg` is still orphaned, both already with 03

`branch=main dirty=3` in the clone, and `C:\po-vg` has held 1 uncommitted file for 5117 minutes.
`git worktree remove` refuses it and `--force` would discard the work. Neither is new and neither
is mine: the clone is 03's to fast-forward and only 03 may, and the orphan is already escalated.

**DISPOSITION: DISPATCHED — Station 03, already open.** Named here so the dispatch does not go
stale, not re-raised as a new finding. 03's next scheduled run is `2026-09-07T23:00:45Z`.

## WHAT I DID NOT DO

- **Armed nothing.** All 15 ADMIT candidates stop at Marco; four are `gate_allow: migrations`, two
  duplicate an open PR, two are 05's `sot/` lane. Adding supply does not move a board whose
  constraint is a human gate.
- **Merged nothing and removed no label.** Both open PRs read `NO LOG` and hand-classify to Marco,
  and both carry `do-not-merge`, which only Marco removes. The `[LABEL_PRESENT]` verdict quoted
  above says the same thing from CI's side.
- **Wrote no approval receipt.** A scheduled run may never author one, whatever `#1790`'s own
  receipt shows about the supervised cloud lane.
- **Did not clear any `[STALE]` line in the sweep's section 5 myself**, including the two F3 names —
  dispatched to 03 instead.
- **Did not touch the watcher clone, `C:\po-vg`, `/sot/`, Azure, Entra or SharePoint.**
- **Did not re-file the 06-cadence escalation**, the 00 `CADENCE` map defect in
  `check-breadcrumb.mjs` (`'00': 2` against a live hourly cron), or the 00x04 cron collision. All
  three are open with Marco and all three are `scripts/` or scheduled-tasks-layer changes outside
  what I may land.
