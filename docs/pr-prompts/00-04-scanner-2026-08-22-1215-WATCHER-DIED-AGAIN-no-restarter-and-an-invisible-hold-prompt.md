# 04-SCANNER — 2026-08-22 ~02:10–02:30Z — findings for Stations 00 / 03 / 05 / 06

All measurements at `c17373121b7330dc48c3cbf114faa3ffa019576d`, from a clean detached worktree
(`C:\po-scan-0822a`, dirty=0, removed cleanly at the end — `worktree_path_still_exists=False`).
Git ran through Desktop Commander on Windows. `.git/index.lock` ABSENT before and after.

## 1. [MEASURED] The watcher died a SECOND time in 12 h — and this one was NOT a hibernate

- Last act of the 08-21 22:20Z watcher: `watcher-launch.log` write at **2026-08-22T02:10:53Z**.
- At **02:11:04Z** my snapshot found **no `node.exe` matching `pr-watcher[\\/]index\.mjs`** — dead.
- **No power event** between 21:53:29Z and now (`Get-WinEvent` Id 1,42,107,109,506,507,6008 —
  the only hits are the 21:53 Modern-Standby exit, hours earlier). `LastBootUpTime` =
  2026-08-17T15:59:54Z → **uptime 4.4 days, no reboot.** So the 08-21 hibernate explanation does
  **not** cover this death.
- The dying wrapper wrote `TerminatingError(): "The pipeline has been stopped."` into
  `watcher-launch.log` — the signature of an *external* stop, matching the 08-21 21:53Z force-kill
  whose author is unknowable because 4688 auditing is OFF. **Still needs Marco.**
- A fresh wrapper started **02:12:34Z** (`watcher-launcher-singlelane.ps1`, pid 31132) and the node
  came up **02:12:40Z** (pid 32252). **It was not me and not a scheduled task** — [INFERRED] a
  concurrent station session relaunched it.

### The restarter gap is CONFIRMED, not inherited
`Get-ScheduledTask` → **207 tasks total** (positive control: non-zero), **zero** whose action string
matches `watcher|po-watcher|pr-watcher`. Control for the control: zero match `claude` either.
**There is still no supervisor of last resort.** Startup banners in the log show only 3 wrapper
launches since 08-21 01:42Z — every one manual/station.

**Counting rule:** `total_startup_banners_in_log=104` counts *node* starts across the log's whole
life; `Supervisor started` lines count *wrapper* launches. Do not conflate them.

## 2. [MEASURED] A properly-suffixed HOLD prompt is UNTRACKED — invisible to every worktree station

`pr-lintgate-standing-authority-detector-HOLD.md` is **untracked on `origin/main` and NOT
gitignored** (`git check-ignore` returns non-zero; `of_which_gitignored=0` across all 19 untracked
files). The watcher's own preflight flags it: `untracked-ready-prompt count = 1`.

This is the prompt that would fix **LL-53** (the STANDING AUTHORITY imposter heading). The fix for
the board's most quietly dangerous defect is itself invisible to the board. Needs a docs-only PR.

Also untracked, same cause: `pr-settings-home-slice0-DISARMED-premise-dead-2026-08-18.md`,
`queue-watch-state.md`.

## 3. [MEASURED] The breadcrumb channel is now 16 on disk / 0 tracked — it is getting worse

`breadcrumbs_on_disk=16`, `breadcrumbs_tracked_on_origin_main=0` (was 15/0 yesterday, 13/0 on 08-21).
**Writing a breadcrumb is still not reporting** — including this file. Landing them needs a docs PR.

## 4. [MEASURED] Board is byte-identical to 08-21 — nothing is rotting on the board itself

dev tree = watcher clone = `origin/main` = **`c1737312`** · **0 armed** (depth-1 rule; recursive
returns **1848 inert**) · **72 HOLD** · **0 escalate** · **0 open PRs** (control: 50 PRs all-states)
· CI **per-commit** on `c1737312` = **10 success / 1 skipped / 0 fail** (control: parent commit also
returns 11 runs) · `index.lock` ABSENT · `maintenance.lock` fossil unchanged (0 bytes, ~92 h).
`check-backlog.mjs` exit 10: **ready=2 needs-marco=1 blocked=5 broken=0** — both "ready" are the
known permanent false-READYs. **No new gate has opened.**

## 5. [MEASURED] The clone stash loop is still running: `clone_stash_count=136`, dirty=34

`verdict-archive sweep: archived=34 kept=0` fired again this morning. The closed loop
(preflight restores 34 review files, archive sweep re-deletes them) is **unfixed**.

## 6. REFUTED — three of my own findings this run

- **`internal-messages.view` / `.send` are NOT unregistered.** My registry extractor used
  `[a-z0-9_]+(\.[a-z0-9_]+)+`, which is **hyphen-blind**; both codes are at
  `permission-registry.ts:98-99`. **Permission codes in this codebase may contain hyphens.**
- **Part 0(d) enum drift produced 34 candidates and every one is untrustworthy.** Measured the
  mechanism: **24 enum member values are shared across up to 9 enums** (`APPROVED` ×9, `DRAFT` ×9,
  `SUBMITTED` ×6). `CommitmentStatus`/`CommitmentChangeStatus`/`ClaimStatus`/`ExpenseStatus` all
  share `DRAFT`+`APPROVED`, so a file handling one reports "3 of 4 present, MISSING=X" for the
  others by pure overlap. **Sub-check (d) as written in the brief is not implementable by literal
  matching** — it needs type-anchored analysis. Do not re-report these.
- **sot/04 is 8 named models behind, not 35.** Named diff (not `^###` counting):
  `ClientShare, WorkerShare, ContactShare, TenderAllocationCandidate, TenderAllocationRejection,
  EstimatorCapacity, AllocationWeightConfig, AllocatorDelegate`. (`sot04_h3_headings=323` vs
  `schema_models=292` — the header count is the misleading instrument.) For **Station 05**.
  `sot/03` still stops at **#495**.

## 7. Part 0 sub-checks run this cycle: (a), (b), (d)

- **(a) authorization parity — CLEAN.** 0 `<Navigate>` redirect guards gated on a
  permission/role without a super-user escape. Controls: 467 files scanned, 7 contain `<Navigate`,
  28 contain `isSuperUser` — the search can find things.
- **(b) permission-code integrity — CLEAN** after the refutation above. 98 registry codes,
  60 `const` aliases resolved, 104 distinct codes used, **0 genuine unknowns** (remaining 6 hits
  are literal placeholders inside `*.spec.ts` and one `${REQUIRED}` template).
- **(d) enum drift — NO TRUSTWORTHY RESULT.** See §6.

## 8. Two errors in the station brief itself (`docs/pipeline/stations/04-scanner.md`)

Both are wrong paths that make a check silently unrunnable:
- brief says `apps/api/src/common/auth/persona-permission.guard.ts` → actual location is
  **`apps/api/src/modules/personas/persona-permission.guard.ts`**.
- brief says grep **`prisma/schema.prisma`** → actual path is **`apps/api/prisma/schema.prisma`**.
A `Select-String` against the brief's path throws `PathNotFound`, which reads as operator error.
For **Station 06** to fold into the next brief-correction prompt.

## Nothing was armed, disarmed, renamed, moved or merged. Read-only run. Standing arming hold respected.
