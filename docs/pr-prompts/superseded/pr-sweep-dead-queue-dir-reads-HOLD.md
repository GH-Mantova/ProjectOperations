---
premise: grep -q "in-progress" scripts/pipeline/status-sweep.ps1
premise_means: >-
  status-sweep.ps1 still reads docs/pr-prompts/in-progress/, a directory that NO producer writes.
  scripts/pr-watcher/index.mjs never mentions "in-progress" (git grep exit 1, with a passing
  positive control on classifyPolicyFiles and a passing negative control on a nonsense token);
  its real destinations are processed/, failed/, no-pr-opened/, blocked/ and paused/. The folder
  is neither tracked on origin/main nor present on disk. So the sweep counts a directory that
  cannot exist, prints "in-progress prompts (a station is running one): 0" as a [LIVE] fact, and
  feeds that permanent zero into $boardBusy and the DO NOT ACT verdict. Measured
  2026-09-01T02:55:09Z at 1efd079c - the sweep printed 0 while the watcher was actively building
  pr-scopesub-s3-priced-or-provisional.
requires_on_main:
  - scripts/pipeline/status-sweep.ps1 :: -Recurse -File
scope:
  - scripts/pipeline/status-sweep.ps1
done_when: >-
  ! grep -q "in-progress" scripts/pipeline/status-sweep.ps1 && grep -q "queue subdir absent"
  scripts/pipeline/status-sweep.ps1 && grep -q "buildRunning" scripts/pipeline/status-sweep.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# status-sweep reports a permanent zero from a directory nothing writes

> **AMENDED 2026-09-01 by Station 06 (PR Master - General), before this prompt was ever armed.**
> PR **#1487** (`fix/sweep-measure-object-length`) independently fixed the `Measure-Object` throw
> that this prompt originally carried as its section D, and it edits the same file. Two changes were
> made here: **section D was removed** because that work is done, and **every line-number citation
> was replaced with a symbol anchor**, because #1487 inserts 8 comment lines above the escapee scan
> and would shift every number in this prompt by 8. A `requires_on_main` gate now holds this prompt
> until #1487 is on main, so the two cannot collide in the same file.

## The defect

`scripts/pipeline/status-sweep.ps1` builds its in-progress count from this assignment - find it by
the variable name `$inprog`, not by line number:

```powershell
$inprog = @(Get-ChildItem (Join-Path $Queue "in-progress\*") -File -ErrorAction SilentlyContinue)
```

`docs/pr-prompts/in-progress/` has **no producer.** `git grep -n "in-progress" origin/main --
scripts/pr-watcher/index.mjs` returns nothing and exits 1, with a passing positive control
(`classifyPolicyFiles` -> exit 0) and a passing negative control
(`qqzzxxnotarealtokenqqzzxx` -> exit 1). The watcher's destinations are `processed/`, `failed/`,
`no-pr-opened/`, `blocked/` and `paused/`. The directory is not tracked under `docs/pr-prompts/`
(603 tracked paths, zero containing `in-progress`) and `Test-Path` on the dev tree returns False.

The count therefore cannot ever be non-zero. It is consumed in three places, each identified here
by the code that names it:

- the `$boardBusy` expression, which ORs `($inprog.Count -gt 0)` with `$lockInteractive`,
  `$lockClone` and `($gitProc.Count -gt 0)`
- the `Line "LIVE"` call that prints `in-progress prompts (a station is running one): `
- the `DO NOT ACT:` verdict string, which names an in-progress prompt as one of its signals

**Measured 2026-09-01T02:55:09Z:** the sweep printed `in-progress prompts (a station is running
one): 0` while `scripts/pr-watcher/logs/2026-08-31.log` showed
`[2026-09-01T02:33:55.430Z] [start] pr-scopesub-s3-priced-or-provisional-ready.md` and the
heartbeat was ticking `elapsed=180s`. A build was running. The sweep said none was. That is
DOCTRINE section 7 in the one instrument every station is told to obey before mutating the board,
and DOCTRINE section 9.6 exactly: an empty result reported as an empty world.

The `foreach ($sub in @("in-progress","needs-marco","no-pr-opened","failed","blocked"))` loop has
the same problem for the same folder.

## What to build

All changes are confined to `scripts/pipeline/status-sweep.ps1`.

### A. Delete the dead `in-progress` reads

1. Remove the `$inprog` assignment and the `Line "LIVE"` call that prints its count.
2. Remove `"in-progress"` from the `foreach ($sub in @(...))` subdirectory list.
3. Reword the `DO NOT ACT:` verdict text so it no longer names an in-progress prompt as a signal.
4. `$boardBusy` keeps its three REAL signals (`$lockInteractive`, `$lockClone`, `$gitProc.Count`)
   and drops the dead term. **Its truth value must not otherwise change.**

### B. Add a REAL build-running fact - reported, NOT wired into the block

The watcher publishes two live signals from the clone
(`C:\po-watcher\ProjectOperations\scripts\pr-watcher\`):

- `heartbeat.log` - during a run its last lines read
  `[<iso>] <prompt>-ready.md elapsed=<N>s last: ...`, rewritten every 60 s.
- `.queue-state.json` - carries `armed`, `owned`, `runnable`.

Add a variable named `buildRunning` set from the heartbeat: true when the file's last non-empty
line matches `elapsed=\d+s` **and** the file's `LastWriteTimeUtc` is under 3 minutes old. Print a
`[LIVE]` line naming the prompt when true. When the heartbeat file is missing or unreadable, print
`[CANNOT MEASURE]` - never `false`.

**Do NOT add `buildRunning` to `$boardBusy`, and do not let it produce `DO NOT ACT`.** A watcher
build lasts 20-75 minutes and the watcher builds near-continuously, so blocking on it would freeze
Station 00 for most of the day - that is the "without damaging existing work" half of RULE 1, and
it is the reason this fact is reported rather than enforced. Put that reason in a comment above the
variable so the next reader does not "complete" the wiring.

### C. Never report a count from a directory that does not exist

Wherever the sweep counts files in a queue subdirectory, `Test-Path` the directory first. If it is
absent, print `[CANNOT MEASURE] queue subdir absent: <name>` instead of a number. A folder that is
not there is not a folder holding zero files, and the difference is the whole of section 9.6.
Apply this to the `foreach ($sub in @(...))` loop and to any other subdirectory count in the file.

### D. REMOVED - already shipped by #1487. Do not redo it.

This prompt originally asked for `-File` to be added to the escapee-size `Get-ChildItem`, because
`-Recurse` without it pipes `DirectoryInfo` objects into `Measure-Object -Property Length` and
PS 5.1 throws. **PR #1487 did exactly that**, with a comment block explaining why. The
`requires_on_main` gate above holds this prompt until that change is on main.

🔴 **Do not touch the escapee scan at all.** Do not re-add `-File`, do not reformat the comment
#1487 added, do not "improve" the size calculation. Any edit there re-opens a conflict in a region
of the file another PR just settled.

## Prove it before you believe it

- **Positive control for B:** while the watcher is mid-build, your probe must return true and name
  the prompt. If you cannot observe a live build, say `[CANNOT MEASURE]` in the PR body rather than
  asserting the probe works.
- Run the whole sweep once and paste the section 2 and section 3 output into the PR body. There
  must be no `Measure-Object` exception anywhere in it - if there is, #1487 has not actually landed
  and you should stop and say so rather than fixing it here.
- Show that `git diff` touches no line inside the escapee scan.

## Guard against the obvious way of getting this wrong

- **Anchor on symbols, never on line numbers.** This prompt was amended precisely because #1487
  shifted every line in the second half of the file by 8. Find `$inprog`, `$boardBusy`, the
  `foreach ($sub in @(...))` list and the `DO NOT ACT:` string by name.
- **The premise for this prompt asserts the DEFECT is present** (`grep -q "in-progress"`), not that
  some new identifier is absent. Keep it that way if you touch it.
  `pr-statussweep-orphan-worktree-dirs-HOLD.md` greps for `orphanWorktreeDirs`, the feature shipped
  in #1460 as `REGISTRY-ESCAPEE` / `worktree-registry-escapees`, and that prompt's premise was
  therefore still true after its work landed - it was retired in #1475 for exactly this.
- No single-letter PowerShell variables (DOCTRINE section 9.1, section 7 lie #5).
- No `Write-Output` inside any PowerShell function whose return value is captured (section 7 lie #6).
- Do not "fix" file encoding by adding `-Encoding UTF8` to `Set-Content` - that is the
  double-encoder (DOCTRINE section 9.3).
- Do not change the sweep's exit code, its VERDICT section, or any `[LIVE]` line this prompt does
  not name. Other stations parse this output.

## Do NOT

- Do NOT create `docs/pr-prompts/in-progress/` to make the old read work. Nothing writes it; an
  empty directory would restore the same permanent zero with a directory to back it up.
- Do NOT touch the escapee-size scan - see section D.
- Do NOT touch `scripts/pr-watcher/supervise-watcher.ps1`. It carries the same dead glob in its
  `$inProg` assignment and is a SEPARATE prompt, deliberately, so the two cannot collide on one file.
- Do NOT touch `/sot/`, `apps/**`, `prisma/**`, or any file outside `scope`.
- Do NOT prune, clean, remove or move any worktree, directory, stash or lock file.
- Do NOT run `git checkout .`, `git checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`
  anywhere. Consumed prompts retired into gitignored folders come back armed.

## VERIFY

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-sweep-dead-queue-dir-reads-ready.md
! grep -q "in-progress" scripts/pipeline/status-sweep.ps1
grep -q "queue subdir absent" scripts/pipeline/status-sweep.ps1
grep -q "buildRunning" scripts/pipeline/status-sweep.ps1
grep -q -- "-Recurse -File" scripts/pipeline/status-sweep.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/status-sweep.ps1
```

The `-Recurse -File` check is there to confirm #1487's change is present and untouched, not to
ask you to make it.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - say `NO-OP: <reason>` if you do nothing.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the job log before diagnosing any CI failure; never reason a red out of the diff.
- Before you finish, ask: is there a PR number in my output?
