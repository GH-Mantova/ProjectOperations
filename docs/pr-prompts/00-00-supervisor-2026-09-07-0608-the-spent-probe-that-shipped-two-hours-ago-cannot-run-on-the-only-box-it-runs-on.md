# Station 00 — Supervisor | 2026-09-07T06:08:46Z–2026-09-07T06:32Z

## GROUND

```
UTC            2026-09-07T06:08:46Z
origin/main    9a905ec6            (fetched, then rev-parse)
dev tree       main @ 5e0e26b2 -> 9a905ec6 after the fast-forward below   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (station_doc_version in the scheduled-task SKILL.md)
```

Versions AGREE — this run was not read-only.

**SIGHTED.** `start_process` shell `powershell.exe` returned a live prompt on the first call; PID
15424 served the whole run. Not a blind run.

**Device-bridge git guard, PREFLIGHT step 1.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
last line, quoted: `persistence controls passed: .bashrc byte-identical on re-run; login shell
resolves shim`. Installed at `/sessions/<id>/.local/bin/git`, both controls passed. No `git` was
run through the bridge against the Windows `.git` at any point in this run.

**Which tree I read the binding documents in.** `C:\ProjectOperations2`, the dev tree, after
`git fetch origin --prune`. `git diff --numstat origin/main -- <path>` was EMPTY for
`STATION-CAPABILITIES.md` and `00-supervisor.md` and reported `0 43` for `DOCTRINE.md`, so DOCTRINE
was read from `origin/main` (dumped with `cmd /c` to dodge the PS 5.1 UTF-16LE `>` trap, §9.3) and
not from the working copy. No piped hash was used or compared anywhere (§ PREFLIGHT 2).

## WHAT I MEASURED

| claim | how |
|---|---|
| `origin/main` = `9a905ec6`; dev tree was `5e0e26b2`, **7 behind** | [MEASURED] `git rev-parse --short origin/main`; `git rev-list --left-right --count HEAD...origin/main` -> `0	7` |
| 5 open PRs: `#1763 #1761 #1760 #1758 #1746`, **all labels `[]`**, all author `GH-Mantova` | [MEASURED] `gh pr list --state open --json number,title,headRefName,mergeStateStatus,isDraft,labels,createdAt,author` |
| `#1763/#1761/#1760` opened `05:34:03Z`, `05:34:21Z`, `05:34:56Z` — **53 seconds apart** | [MEASURED] same call. The single-lane watcher cannot open three PRs in 53 s |
| **no arm since `2026-09-07T01:22:59Z`** (a RENAME, not an arm; last ARM `00:20:55Z`) | [MEASURED] tail of `docs/pr-prompts/.arming-log.txt` |
| RULE 2 probe is LIVE and well controlled: 2039 logs, newest `2026-09-07T05:56:25Z` (younger than every open PR's `createdAt`), POS `marco.:true` -> **619**, NEG (freshly minted needle) -> **0** | [MEASURED] `Select-String -Path C:\ProjectOperations2\docs\pr-prompts\processed\*.log` — the LIVE tree, never the clone decoy (§9.5) |
| **all five open PRs return `0` prompt-log hits**; NEG control `PR #999999` -> `0` | [MEASURED] `Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'` (the `rev-*`-excluded form, §9.5) |
| `armed: 0`; `needs-marco/ 36`, `no-pr-opened/ 109`, `failed/ 43`, `blocked/ 123` | [MEASURED] `status-sweep.ps1`, section 4, captured to a file |
| watcher node RUNNING **pid 31660**, wrapper alive (1), heartbeat 15 min, clone `branch=main dirty=5` | [MEASURED] `status-sweep.ps1` section 2 |
| safe-to-act: in-progress prompts `0`, `index.lock` dev/clone `False/False`, `git` processes `0` | [MEASURED] re-run immediately before the worktree was created, not quoted from the sweep |
| sweep VERDICT: **CAUTION** — no local lock, but `#1761 #1760` were touched on GitHub inside 2 min | [MEASURED] `status-sweep.ps1` section 7 |
| freshness CLEAN — 00 1.1h, 03 7.2h, 04 4.0h, 05 16.0h, all `ok` | [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 0 |
| the three prompts the 04:08Z/05:08Z runs dispatched are **SPENT**: lint exit **3** on all three | [MEASURED] `node scripts/pipeline/lint-prompt.mjs` per file |
| `pr-linefields-s3-fields-table-from-and-used-in-HOLD.md` lint exit **0 (ADMIT)** — still armable while `#1758` is open | [MEASURED] same call |
| `$env:OS` is **the empty string** in the station shell; `$env:ProgramFiles` = `C:\Program Files`; `Test-Path 'C:\Program Files\Git\bin\bash.exe'` -> **True**; PS `5.1.26100.9168` | [MEASURED] in PID 15424 and again in a fresh `-File` child, which printed `OS=[] bashBin=[/bin/bash]` |
| exactly **one** `$env:OS` branch in `scripts/**.ps1` — `triage-holds.ps1:244`. POS control `Test-Path` -> 58, NEG (minted needle) -> 0 | [MEASURED] `Select-String -Path scripts\*.ps1,scripts\pipeline\*.ps1,scripts\pr-watcher\*.ps1` |
| main CI on `9a905ec6`: 1 success / 0 failed / **3 running** — not yet green | [MEASURED] `status-sweep.ps1` section 1 |
| `C:\po-vg`, 4217 min old, **1 dirty file**, branch `fix/no-rebase-while-checks-run` | [MEASURED] `status-sweep.ps1` section 2. Already escalated by Station 03; not re-raised |

**Lane classification of every open PR — `[NO LANE VERDICT — hand-classified]` for all five**
(no watcher verdict, no arm in any of their windows, each carries its own
`docs/decisions/merge-approvals/<N>.md` — the supervised cloud lane's signature, §10.2.1):

| PR | the file that decides | `classifyPolicyFiles` |
|---|---|---|
| `#1763` | `.github/workflows/ci.yml`, `scripts/pipeline/check-pr-title.mjs` | outside `tests\|docs` -> **MARCO'S** |
| `#1761` | `scripts/pipeline/status-sweep.ps1` | outside -> **MARCO'S** |
| `#1760` | `scripts/pr-watcher/index.mjs` | outside -> **MARCO'S** (its `__tests__` file passes; `index.mjs` does not) |
| `#1758` | `apps/web/src/pages/admin/RatesListsAdminPage.tsx` | outside -> **MARCO'S** |
| `#1746` | `apps/api/prisma/migrations/20260907120000_.../migration.sql` | `(^\|/)migrations/` -> **MARCO'S**, on its own clause |

I did not use the `opened PR #<n>` test as a lane discriminator: DOCTRINE §9.5 records it as sound
in ONE direction only, and absence is `[CANNOT MEASURE]`. The arming log is the corroborating
instrument the kill loop cannot erase, and it shows no arm inside any of the five windows.

## WHAT CHANGED

1. **The dev tree was fast-forwarded `5e0e26b2` -> `9a905ec6`.** Three consecutive runs (02:09Z F4,
   04:08Z F4, 05:08Z F5) DEFERRED this because they were blind. The FF refused once, naming
   `docs/pr-prompts/pr-fixlane-s1-a-fix-lane-prompt-can-never-escalate-HOLD.md` — the untracked-file
   blocker in the station doc. Cured as prescribed: `git rev-parse origin/main:<path>` and
   `git hash-object <path>` both returned `50a48e15`, so the disk copy was byte-identical; deleted,
   fast-forwarded, restored. All three read-backs pass — `git rev-list --left-right --count
   HEAD...origin/main` -> `0	0`, `git diff --numstat` -> EMPTY, `git diff --cached --name-status`
   -> EMPTY.
   `docs/pipeline/sweep-rotation.json` was restored to HEAD first; `git add --renormalize` staged
   **nothing**, so no `git restore --staged` was needed. Its working copy already equalled
   `origin/main` (`git diff --numstat origin/main -- <path>` EMPTY before the FF), so nothing of
   Station 04's advance was lost — it had already landed.
2. **Three SPENT prompts retired** to `docs/pr-prompts/superseded/` in this run's board PR —
   `pr-module-provenance-s1-HOLD.md` (`#1753`), `pr-hygiene-s1-guarded-branch-prune-HOLD.md`
   (`#1756`), `pr-triage-holds-spent-behind-a-reject-HOLD.md` (`#1754`). All three lint exit 3.
3. **Three breadcrumbs collected and archived**, two of which had never reached `main`:
   `00-00-supervisor-2026-09-07-0308-*` (`git mv` to `archive/`), and `-0408-*` and `-0508-*`,
   which existed on exactly one disk until this PR.
4. **One prompt staged, not armed:**
   `docs/pr-prompts/pr-triageholds-s2-env-os-is-empty-in-a-station-shell-HOLD.md`, lint **ADMIT**
   (size 2). Byte delta on the one edit it needed asserted exactly: `6656 -> 6762`, delta `106`,
   expected `106` (§9.3).
5. **Nothing merged. Nothing armed. No label touched.**

## FINDINGS

### F1 — `SPENT_BEHIND_A_REJECT_V1` shipped two hours ago and cannot run on the only box it runs on: `$env:OS` is EMPTY in a station shell

`#1754` merged at 04:05:40Z to close a real gap — `lint-prompt.mjs` evaluates the premise LAST, so a
prompt REJECTed for any other reason never has its premise run and can never be reported SPENT
however completely its work has landed. `triage-holds.ps1` now re-probes those prompts directly.

**On this host it has never probed one.** [MEASURED] this run:

```
=== TOTALS  spent=5 of 26 evaluated  gates-satisfied=21  still-gated=31  unreadable=0  of 57 HOLDs
    This script re-probed those 31 REJECT(s) directly: 0 spent behind a REJECT,
    0 still needed, 31 UNMEASURABLE.
!!! SUSPECT: this bucket is UNMEASURABLE this run -- fixture probe returned UNMEASURABLE (expected SPENT)
```

every one of the 31 detailed as `could not execute /bin/bash: The term '/bin/bash' is not
recognized...`.

**The cause, measured and not inferred.** `scripts/pipeline/triage-holds.ps1:244` reads
`if ($env:OS -eq "Windows_NT")` and its else branch sets `$bashBin = "/bin/bash"`. `$env:OS` is not
a property of the operating system — it is an inherited environment variable, and in the
PowerShell 5.1 process Desktop Commander starts for a scheduled station **it is empty**:

| probe, in PID 15424 and again in a fresh `-File` child | result |
|---|---|
| `$env:OS` | `[]` |
| `$env:ProgramFiles` | `[C:\Program Files]` |
| `Test-Path 'C:\Program Files\Git\bin\bash.exe'` | `True` |
| the same branch, replayed in a `.ps1` run with `-File` | `OS=[] bashBin=[/bin/bash]` |

So bash was present the whole time and the candidate scan that would have found it was never
reached. `lint-prompt.mjs`'s `findBash` asks `process.platform !== "win32"` — which no parent can
unset — which is exactly why lint evaluated 26 premises in the same run the probe evaluated none.
The script's own comment claims parity with `findBash`; the two diverged on this one line.

⚠️ **It fails SAFE, and that is the only reason this is S2.** The banner is loud, the fixture
positive control FAILED and said so, the 31 are excluded from the denominator, and nothing was
mis-binned or wrongly cleared for arming. **The instrument told the truth about itself.** What is
lost is the gap `#1754` was written to close — still open, behind a message that reads like a
transient — and a run that skims TOTALS has no reason to look.

**Blast radius is one line.** [MEASURED] this is the only `$env:OS` branch in `scripts/**.ps1`
(POS control `Test-Path` -> 58 hits, NEG minted needle -> 0).

**DISPOSITION: DEFERRED, and staged.** The fix is
`docs/pr-prompts/pr-triageholds-s2-env-os-is-empty-in-a-station-shell-HOLD.md`, lint **ADMIT**,
size 2, `gate_allow: none`, `escalates: false`, scope one file. **It is not armed, and could not
have been: arming is a `git mv` of a file TRACKED on `main`** (`00-supervisor.md`, AUTHORITY), and
this prompt is created by the very PR this run opens. **It is the arming candidate for the next
run** once this PR lands, and no open PR touches `scripts/pipeline/triage-holds.ps1` (`#1761`
touches `status-sweep.ps1`, which is a different file), so §10.6's duplicate check is clean.
What would make it urgent: any run reading an empty SPENT bucket as "nothing is spent".

### F2 — the fast-forward three blind runs deferred is done, and the blocker was the untracked-breadcrumb case, not the line-ending one

Recorded because the diagnosis inverts and has cost four runs before. `git diff --numstat` was
**non-empty** going in (`sweep-rotation.json` `2 2`, plus two ` D` consumed HOLDs), which is the
shape the station doc's FF-cure precondition says rules the untracked case out — and the untracked
case was the actual blocker anyway. The error names the file; reading it is the whole diagnosis.

Two details worth the next run's time:

- All three "dirty" paths already equalled `origin/main` (`git diff --numstat origin/main -- <path>`
  EMPTY for each). The dev tree was not carrying uncommitted work; it was carrying **7 commits of
  staleness wearing dirtiness's clothes.** `git add --renormalize` on `sweep-rotation.json` staged
  nothing, so the `git restore --staged` half of the cure did not fire this time.
- `.arming-log.txt` was **not** modified, so the append-only save-restore-FF-reapply path
  (`00-supervisor.md`, the 2026-09-06T08:2xZ measurement) was not needed. Confirmed before the FF,
  not assumed.

**DISPOSITION: ACTIONED.** Verified by all three read-backs, quoted under WHAT CHANGED.

### F3 — every PR on the board is Marco's, by hand-classification, and I merged none

No open PR carries a watcher verdict; the probe is live and controlled (619 POS / 0 NEG, newest log
younger than every PR). Under §10.1 step 2 all five hand-classify to Marco — four on the
outside-`tests|docs` clause, `#1746` on the `migrations/` clause. Step 3's station-lane exception
does not apply: the lane that opened them is the **supervised cloud lane** (§10.2.1), which is 00
under Marco's live direction, not this scheduled run, and its release decisions come from him in
chat where I cannot read them.

**This is not a complaint about throughput.** Eleven PRs merged between 02:40Z and 06:05Z, so the
board is draining faster than it is filling. It is the standing record that a scheduled 00 run finds
a five-PR board and correctly merges nothing.

**DISPOSITION: DEFERRED.** Nothing for me to do; the lane that opened them is the lane that merges
them. What would change it: a `marco:true` verdict appearing on any of them, which would move them
from "hand-classified" to RULE 2 binding, or Marco naming one in chat.

### F4 — the 04:08Z and 05:08Z dispatch is discharged: the three spent prompts are retired

`pr-module-provenance-s1-HOLD.md`, `pr-hygiene-s1-guarded-branch-prune-HOLD.md` and
`pr-triage-holds-spent-behind-a-reject-HOLD.md` were still at depth 1 on `origin/main` for work that
merged as `#1753`, `#1756` and `#1754`. All three lint **exit 3**. `git mv`'d to
`docs/pr-prompts/superseded/` in this run's board PR.

**DISPOSITION: ACTIONED.** Verified by `git status --short` showing three `R ` renames into
`superseded/` before the commit.

### F5 — `pr-linefields-s3` is still ADMIT for work `#1758` already carries — carried forward, not re-raised

[MEASURED] `lint-prompt.mjs` exit **0** on
`docs/pr-prompts/pr-linefields-s3-fields-table-from-and-used-in-HOLD.md`, while `#1758` (open,
opened 05:09:47Z) marks `apps/web/src/pages/admin/RatesListsAdminPage.tsx` with
`RATE_FIELDS_TABLE_V2` — the prompt's own premise string. The premise dies on MERGE, not on OPEN
(§10.6), so it will read ADMIT for as long as `#1758` stays open, and it is the most attractive
profile on the board.

🔴 **DO NOT ARM `pr-linefields-s3-fields-table-from-and-used-in-HOLD.md` while `#1758` is open.**
Retire it to `superseded/` when `#1758` merges.

⚠️ **UPDATED MID-RUN — `#1758` MERGED at 06:19:26Z, while this report was being written.**
Re-linted at that moment: `lint-prompt.mjs` returns **STALE (exit 3)**, quoting the premise back and
saying `The work is ALREADY DONE. Binned before spawning an agent.` So this prompt stopped being a
do-not-arm hazard and became a **fourth** spent prompt, and it is retired to
`docs/pr-prompts/superseded/` in this same board PR alongside the three in F4.

This is the cleanest live instance yet of §10.6's rule that **the premise dies on MERGE, not on
OPEN**: the same file read ADMIT before `#1758` merged and STALE minutes after it, with nothing
between the two readings but that merge. **The two clock times this line originally carried —
`ADMIT at 06:22Z and STALE at 06:31Z` — were INVENTED: I never timestamped either lint call, and 06:31Z was still in the future when I wrote it (§7.1). Corrected in `#1765`.** The do-not-arm window the 05:08Z run opened was real, and it closed on its own terms rather than being cleared by anyone.

**DISPOSITION: ACTIONED**, upgraded from the DEFERRED this finding opened with. I add no new
escalation and open no second thread: one finding, one owner.

### F6 — two escalations that existed on one machine's disk now reach `main`, by this PR

Neither is mine to answer and neither is re-argued here. Both are carried so that they exist at a
tracked path, which is the additive half of the fix the 04:08Z run itself recommended:

- **`needs-marco/` is the doctrine's only real stop and it is gitignored** — 36 escalations in the
  dev tree against 4 on `origin/main`. The 04:08Z breadcrumb (F2) carries the measurement, the
  stop-versus-report split, and RULE 1 options with **(a) a tracked home for escalation *notes*,
  leaving `.gitignore:82` untouched** as the complete-and-additive recommendation.
- **Nothing in this repository pins the App Service Node version, and `#1740` put
  `puppeteer@25.9.0` (`engines: node >=22.12.0`) on `main` at 04:24:56Z.** The 05:08Z breadcrumb
  (F2) carries the re-measurement and RULE 1 options with **(a) `engines` in
  `apps/api/package.json` plus a CI assertion** first. **S1 if the App Service is on Node < 22.12,
  S3 if not — and no agent may look**, per the absolute Azure/App-Service stop.

**DISPOSITION: ESCALATED — carried to a tracked path, unanswered.** Both are Marco's.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs hand-classify as Marco's (F3), and the sweep's own verdict
  was **CAUTION** — `#1761` and `#1760` had been touched on GitHub inside two minutes, which is
  BOARD-DRIVING condition 3 saying another actor is live. I confined myself to a NEW branch and a
  NEW PR in an isolated worktree, which is what that verdict prescribes.
- **Armed nothing.** `armed: 0` at the start and at the end. The one candidate I would arm is the
  prompt this run created, and it cannot be armed until it is tracked on `main` (F1).
- **Did not clear the `C:\po-vg` worktree** — 4217 min old, `dirty=1`, holding uncommitted work on
  `fix/no-rebase-while-checks-run`. `git worktree remove` would refuse and `--force` would discard
  it. Station 03 has already escalated it and it is outside my lane; re-raising it would be noise.
- **Did not touch the watcher.** Node pid 31660 running, wrapper alive, heartbeat 15 min, queue
  empty — `restart-watcher-if-wedged.ps1`'s own rule is that an idle watcher with 0 armed prompts is
  CORRECT, not wedged. No restart, no kill, no lock cleared.
- **Did not touch the watcher clone**, which reports `dirty=5`. Read-only git only; the clone is
  Station 03's.
- **Did not fix `triage-holds.ps1` in place.** It is `scripts/`, outside the lane this station may
  merge, and the fix belongs in a PR that carries its own verify steps. Staged as a prompt instead.
- **Did not delete the dev-tree disk copies of the `-0408-` and `-0508-` breadcrumbs** yet. They are
  untracked at `docs/pr-prompts/` and this PR lands them under `archive/`, so they block no future
  fast-forward; the next run deletes them once byte-identity against the committed blob is proved.
  The stray root copies of `-0209-` and `-0211-` were verified byte-identical to their `archive/`
  blobs this run (`f2319202` and `d70f8e0d` on both sides) and are left for the same treatment.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or any label.**
