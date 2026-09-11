# Station 00 — Supervisor (interactive lane, Marco directing) | 2026-09-11T00:02Z–03:2xZ

## GROUND

```
UTC            2026-09-11T00:02:01Z (start)
origin/main    e6e11370 at start → fd7234c6 at 02:58Z (six merges by this lane, four by other lanes)
dev tree       main @ e6e11370 → fd7234c6  C:\ProjectOperations2 (ff'd after every merge, read back 0 0)
doc version    1
bootstrap      1 (C:\Users\Marco\Claude\Scheduled\00-supervisor\SKILL.md, "station_doc_version: 1")
```

Lane: DOCTRINE §10.2.1, supervised interactive — Marco in the chat, directing turn by turn. Transport: Desktop
Commander (`start_process` powershell PID 20700 at 00:02Z). The Cowork VM mount / `device_bash` is DOWN on this box
(harness note: a 2026-09-08 Windows update; `device_bash` exits 1 with `no Plan9 drive shares mounted` before any
command runs) — [CANNOT MEASURE] anything that needs the device-bridge VM.

## WHAT I MEASURED

- [MEASURED] `bring-up-to-speed.ps1` 00:02:31Z → **SAFE TO ACT**; 6 open PRs; armed 0; "main CI on e6e11370: 4
  success / 2 failed <-- TRUNK IS RED". Re-derived on the full SHA (`gh run list --commit <40-char>`): the two
  failures were both `Dependabot Updates / dynamic`; Deploy, CodeQL, CI, Tendering Browser Smoke all `success`.
  Trunk was green; the row was the §9.5 SWEEP_LIVE_LINES defect, fixed by #1852 (below).
- [MEASURED] RULE 2 probe pinned to `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone): 2126 logs,
  newest `rev-1866-ready.md.log` 00:10:48Z (younger than every open PR), POS `marco.:true` 629, NEG minted needle
  `zzQq00Needle20260911T0002` 0 (now SPENT), `PR #999999` over `pr-*.log` 0. Per PR over `pr-*.log` only:
  #1850 / #1845 / #1832 carry `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/…"}`;
  #1823 carries `escalates:true — held for Marco, labelled do-not-merge`; #1852 and #1865 → NO LOG, no arm in
  window ⇒ second lane, hand-classified MARCO'S. All six were Marco's.
- [MEASURED] #1823 label timeline: `labeled do-not-merge 2026-09-09T00:06:38Z`, `unlabeled 22:40:06Z`, both actor
  `GH-Mantova`. Receipt `merge-approvals/1823.md` in the diff, authoring commit `9664f95a` `PR Supervisor
  <supervisor@local>` + `Co-Authored-By: Claude Opus 5` — the supervised cloud lane from a dev-tree worktree
  (`C:\po-worktrees\pr1823`, still parked at that SHA). CP-26 = SUCCESS. 36 `Merge branch 'main'` commits on the PR
  = the #24 hourly rebase churn.
- [MEASURED] Machinery: watcher node 18228 (up since 09-10T05:39Z) under `watcher-launcher-singlelane.ps1` 19848 →
  `start-watcher.ps1` 20704; heartbeat 00:10Z; `.queue-state.json` `armed 0 runnable 0`. Clone at `e4ecd9a5`
  (#1849), 14 commits behind main, `scripts/pr-watcher` + `scripts/pipeline` diff clone..main = **0 files** ⇒ the
  running node is current code; 71 stashes (state); tracked-dirty 0, 4 untracked `pr-*-review.md` (by design);
  MERGE_HEAD false. `.arming-log.txt` 76 = 76 at start. Dev tree 0 stashes, no locks.
- [MEASURED] Scheduled stations by session directory (`%APPDATA%\Claude\local-agent-mode-sessions\**\local_*`,
  `CreationTimeUtc`): 00 fired every hour at :08 for the 24 h before this run (25/25), 04 at 02:10/06:09/10:09/14:10/
  18:09/22:09, 05 at 14:10, 03 at 23:01. `check-breadcrumb --freshness` CLEAN exit 0. The scheduled-tasks MCP is
  not in this session ⇒ the live cron table is [CANNOT MEASURE]; the session directories are the third instrument.
- [MEASURED] Queue: 40 HOLDs on disk / 41 tracked (the +1 = #1866's SLICE-0 before the dev tree ff'd). `triage-holds`
  00:30Z: SPENT 0 · GATES SATISFIED 9 (10 after ff) · STILL GATED 31 · SPENT-BEHIND-A-REJECT 0; controls PASS.
  RULE 4 marker grep over the ten ADMITs: 0 / 0 / 0 on all three forms. Body read: ONE prose gate the linter cannot
  see — `pr-e2e-container-s2-swap-required-job-HOLD.md` ("Do not arm this prompt on the strength of its gate being
  open" + four trial-run preconditions).
- [MEASURED] Verification of the six released PRs, on Marco's condition that every body check be completed:
  - #1832 `vm-git-guard.sh`: VM down ⇒ run on a Linux host (bash 5.2, /usr/bin/git 2.43) with a fixture
    `$HOME/mnt/ProjectOperations2`: CONTROL origin/main script from the mount → exit 1 `FAIL: guard blocked a call
    that targets nothing mounted` (defect reproduces); T1 PR script from `$HOME` → exit 0, ONE success line; T2 from
    the mount → exit 0 (was 1), ONE line; T3 `command git --version` from `$HOME/mnt` → REFUSED exit 99; NEG from
    /tmp → exit 0; idempotent (`.bashrc` export count 1 → 1).
  - #1850 `triage-holds.ps1` (head 55ca7bd0) on the live queue: marker ×5 (NEG 0); header `41 prompt(s) … HOLD=41,
    ready=0, LOOPING=0 (rev-* excluded; TRIAGE_CORPUS_UNION_V1)`; TOTALS `spent=0 of 41 evaluated gates-satisfied=10
    still-gated=31`; sub-count line present.
  - #1845 `status-sweep.ps1` (head 6c7dfac9), three controls with a blocking `git cat-file --batch`: idle → scoped 0,
    SAFE; git alive on `C:\Temp\gitproc-negctl` → scoped 0 / unscoped 2 / SAFE; git alive on the dev tree → scoped 2 /
    DO NOT ACT.
  - #1852 `status-sweep.ps1` (head cae63e90) run in-process under a `gh` shim (`$global:` — `$script:` inside the
    shim resolves to the CHILD script's scope, measured) with the six fixture shapes from the body: F1 → `4 success /
    0 failed / 0 running (trunk green)` + `NOT trunk CI … 6 run(s), 6 failing / Dependabot Updates: 6 run(s), 6
    failing`; F2 → `3/1 TRUNK IS RED`; F3 (CodeQL `dynamic` failed) → `3/1 TRUNK IS RED`; F4 → green + excluded
    `Pipeline heartbeat: 1 run(s), 1 failing`; F5 → `[CANNOT MEASURE] no trunk-CI run`; F6 → `not yet green`.
    CONTROL origin/main script on F1 → `4 success / 6 failed <-- TRUNK IS RED`.
  - #1823 at head 9fcd6e46 in `C:\po-worktrees\v1823`: `pnpm install --frozen-lockfile --ignore-scripts` 44 s;
    `prisma generate` 0; jest `report-self-filter|estimating-analytics-report.definitions` → 2 suites, **26/26**;
    eslint on the changed API files 0; `tsc --noEmit` 0; `git diff origin/main..head -- apps/api/prisma` = 0 files.
    Body items 4–6 verified at the Prisma-`where` level by those suites, NOT on a running API — said so in the
    receipt addendum and in the corrected PR body.
  - #1865 dependabot: no body test plan; CI is the check.
- [MEASURED] The SLICE-0 arm at 00:57Z was consumed as a NO-OP: `processed/pr-scopecards-s0-plan-b-ready.md.log` —
  the code-writer read the prompt's `## STATUS` ("**HOLD.** Marco arms this.") as an instruction to wait, refused,
  mentioned #1866 in the refusal, and the watcher took that number as the build's PR (`merge result for PR #1866:
  {"ok":true}`). After the reword (#1869) the re-arm at 01:26Z built **#1870** — and the watcher's extractor missed
  `**#1870**` in bold, logged NO-PR, restaged `-b`; attempt 2 opened nothing and the file was renamed `-LOOPING`.
  #1870 merged via the docs lane. The scheduled 00 filed the extractor defect independently (#1872,
  `00-0126-extractprnumber-prose-hijack`).
- [MEASURED] Missing-PR survey for Marco: every `*-HOLD/ready/LOOPING.md` under the `C:\` po-*/Project*/_SWEEP*
  folders (2,966 files) crossed against `origin/main`'s `docs/pr-prompts` tree + the queue's sinks + `gh pr list`
  by slug. Genuinely unstaged: TWO — `pr-fv2-import-s1-docx-and-persona`, `pr-fv2-import-s2-review-route`, being
  written at 01:00–01:01Z by another lane into `C:\po-sup-fix-scripts\` (the same lane staged its draftpanel pair
  as #1868). Everything else: fixtures (`pr-zzfixture-*`), shipped work (#1747/#1752/#1759, #1492), July scratch.
- [MEASURED] Concurrency: scheduled 00 ran 00:08:47Z (merged #1867), 01:08Z (merged my #1869 and its own), 02:09Z
  (#1873); 04 at 02:10Z left `00-04-scanner-2026-09-11-0211-…md` + `sweep-rotation.json` dirty in the dev tree for
  00 to commit; a third lane's worktree `C:/po-worktrees/draftpanel-s1s2` appeared 00:50Z → #1868. Every one of
  my board mutations was preceded by `status-sweep.ps1` itself (section 7 read from the capture file).

## WHAT CHANGED

- MERGED, all via `Assert-SmokedOrEscalate -MustContain <marker>` → `Merge-Pr` → `gh pr view` read-back → dev-tree
  `merge --ff-only` read back `0 0`: **#1832** 00:55:39Z `80a2caee` · **#1850** 01:12:55Z `f3fbed20` · **#1845**
  01:38:59Z `2d31827d` · **#1852** 02:11:13Z `ec7dd590` · **#1823** 02:57:48Z `fd7234c6` · **#1865** (see the
  final line of this file). Each carries a receipt `docs/decisions/merge-approvals/<N>.md` committed to its own branch
  from a disposable worktree (author `PR Supervisor <supervisor@local>` + `Co-Authored-By: Claude Fable 5.1` +
  `Claude-Session:` trailers); #1823's existing receipt got an addendum (byte delta 1450 asserted) and its body was
  corrected with `gh pr edit --body-file` (it still described the seed-grant approach of head e43a5f3b).
- #1823's `tendering-e2e` went red once at head 13fe2a16 on `page.goto: WebKit encountered an internal error` in
  the tendering stats-bar test — a browser-engine crash in a UI test an `apps/api` diff does not touch, green on the
  PR's earlier heads the same day ⇒ transient; `gh run rerun 34554972504 --failed` → green → merged.
- Opened and merged (by the 01:08Z scheduled 00) **#1869**: SLICE-0 `## STATUS` reworded, `<!-- watcher: do-not-arm
  -->` on `pr-e2e-container-s2` (lint now REJECT `[HUMAN_GATE_PRESENT]`), `.arming-log.txt` swept.
- ARMED via `arm-prompt.ps1` (actor `station-00.cowork-0002`, `-WhatIf` first on the first): `pr-scopecards-s0-plan`
  00:57Z (no-op, above) and again 01:26Z (→ #1870, MERGED) · `pr-company-manage-s1-permission-and-grant` 02:30Z
  (→ #1874, `do-not-merge`, Marco's) · `pr-qpdf-1-estimate-preview-mark` 03:03Z (building).
- Dev-tree fast-forwards after each merge; the post-#1869 ff needed the §9.2-safe restore of the two paths the arm had
  touched (`git show HEAD:<path>` written by node, hashes read back, `update-index --refresh`), then `0 0` clean.
- Worktrees I created were torn down (`v1823`, `r18xx`, `board-0107`); temp refs `refs/temp/pr*` deleted.

## FINDINGS

**F1 — A `## STATUS` section that says "Marco arms this" is a prose human gate the code-writer obeys and the linter
cannot see, and the watcher's PR-number extractor turns the refusal into a "merged" prompt.** [MEASURED] above.
Two more prompts carry the same stamp on main today: `pr-draftpanel-s1-rates-lock-gate-HOLD.md` and
`pr-draftpanel-s2-finish-this-draft-HOLD.md` (staged by #1868); `pr-tenant-mt4-s2` carries it too but is Marco-run.
DISPOSITION: ACTIONED for SLICE-0 (#1869, verified by the re-arm building #1870); the draftpanel pair is reworded in
this breadcrumb's PR; the extractor half is DISPATCHED → the scheduled 00's #1872 (already filed), not re-raised.
Detector lesson: add `Marco arms` to the prose-gate grep — my body read at 00:5xZ missed it.

**F2 — The e2e-container-s2 prompt lints ADMIT while its body forbids arming.** DISPOSITION: ACTIONED (#1869 marker);
DEFERRED the arm itself until `gh run list --workflow playwright-container-trial.yml` shows ≥3 successful dispatches
on ≥2 branches with both suites and a same-commit agreement, as its body requires.

**F3 — `pr-ea-s2a-dashboard-preset-seed` is now gate-released (PROMOTE) but is a `seed.ts`-only diff with
`seed_only: false`** — the CP-23 unsatisfiable class already on Marco's desk
(`needs-marco/prompt-declared-seed-only-false-while-forbidding-a-migration-2026-09-09.md`). Arming it builds a PR the
gate refuses by construction. DISPOSITION: ESCALATED (existing file, not duplicated) — Marco to rule on the class.

**F4 — Marco's folder consolidation.** Worktrees and drafts live under six roots (`po-worktrees`, `po-wt`,
`po-watcher-worktrees`, `po-vg`, `po-fix9xx`, `po-work`, plus drafts in `po-sup-fix-scripts` and `po-preserve`); the
only way to find an unstaged prompt today is a 2,966-file sweep. Proposal: one root (`C:\PR-Master\`, hyphenated —
a space in the path is a PowerShell/git trap) with `worktrees\<pr-or-slug>\` and `drafts\<lane>\`, named in every
station doc, `STATION-CAPABILITIES.md §4` and `status-sweep.ps1`'s known roots; legacy empty roots moved under
`C:\PR-Master\_retired-<date>\`, never deleted. DISPOSITION: ESCALATED — the name is Marco's to confirm; docs half is
00's, the sweep-script half is a prompt for him.

**F5 — Every board merge re-triggers a full CI round on every other open PR** (the #24 churn, measured six times
today: each merge cost the next PR 12–18 minutes, and two other lanes' merges cost #1845 and #1823 a round each).
DISPOSITION: DEFERRED — known escalation `hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`; nothing new
except six more data points.

**F6 — `C:\po-vg` and `C:\po-worktrees\pr1823` are orphaned worktrees** (6.7 d and 26 h; the first still pins the
sweep to CAUTION on other runs; the second is the receipt commit of a now-merged PR, clean). DISPOSITION: DISPATCHED →
03 (prune; `po-vg`'s single file is preserved in `C:\po-preserve` and on main).

**F7 — Instrument errors this lane made, all caught by read-back:** `$` through `-Command` (§9.1); a helper named
`H` shadowing `Get-History`; `$r` clobbering `$R` (§7 #5); `$script:` in a shim resolving to the child's scope.
DISPOSITION: ACTIONED (recorded in project memory).

## WHAT I DID NOT DO

- Did not remove any `do-not-merge` label, author any receipt for a PR Marco had not released in chat, touch `/sot/`,
  Azure/Entra/SharePoint, or the watcher clone's git.
- Did not kill the SLICE-0 attempt-2 build mid-run (it ended on its own with no PR; the file is `-LOOPING` and is
  retired to `superseded/` in this PR).
- Did not arm `pr-e2e-container-s2` (F2) or `pr-ea-s2a` (F3); did not arm the draftpanel pair until their STATUS
  stamp is reworded (F1).
- Did not commit Station 04's 0211 breadcrumb or `sweep-rotation.json` — the scheduled 00's hourly collect owns that
  hand-off and two lanes committing it is the duplicate-basename defect on record.
- Did not edit `MEMORY.md` or the per-station index while scheduled runs were editing them; wrote two topic files
  instead (`project_supervisor_2026_09_11_0002_…`, `project_supervisor_2026_09_11_0023_…`).
