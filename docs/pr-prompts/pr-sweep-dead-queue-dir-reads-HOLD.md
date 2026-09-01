---
premise: grep -q "in-progress" scripts/pipeline/status-sweep.ps1
premise_means: >-
  status-sweep.ps1 still reads docs/pr-prompts/in-progress/, a directory that NO producer writes.
  scripts/pr-watcher/index.mjs never mentions "in-progress" (git grep exit 1, with a passing
  positive control on classifyPolicyFiles and a passing negative control on a nonsense token);
  its real destinations are processed/, failed/, no-pr-opened/, blocked/ and paused/. The folder
  is neither tracked on origin/main nor present on disk. So status-sweep.ps1:224 counts a
  directory that cannot exist, prints "in-progress prompts (a station is running one): 0" as a
  [LIVE] fact, and feeds that permanent zero into $boardBusy (:229) and the DO NOT ACT verdict
  (:354). Measured 2026-09-01T02:55:09Z at 1efd079c - the sweep printed 0 while the watcher was
  actively building pr-scopesub-s3-priced-or-provisional. The same run threw at :204.
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

# status-sweep reports a permanent zero from a directory nothing writes, and throws while sizing escapees

## The two defects, both measured on `origin/main` at `1efd079c`

### 1. A dead read that reports `0` instead of "I cannot see"

`scripts/pipeline/status-sweep.ps1:224`:

```powershell
$inprog = @(Get-ChildItem (Join-Path $Queue "in-progress\*") -File -ErrorAction SilentlyContinue)
```

`docs/pr-prompts/in-progress/` **has no producer.** `git grep -n "in-progress" origin/main --
scripts/pr-watcher/index.mjs` returns nothing and exits 1, with a passing positive control
(`classifyPolicyFiles` -> exit 0) and a passing negative control
(`qqzzxxnotarealtokenqqzzxx` -> exit 1). The watcher's destinations are `processed/`, `failed/`,
`no-pr-opened/`, `blocked/` and `paused/`. The directory is not tracked under `docs/pr-prompts/`
(603 tracked paths, zero containing `in-progress`) and `Test-Path` on the dev tree returns False.

The count therefore cannot ever be non-zero. It is consumed three times:

- `:229` `$boardBusy = ($inprog.Count -gt 0) -or $lockInteractive -or $lockClone -or ($gitProc.Count -gt 0)`
- `:230` prints it as a `[LIVE]` line reading `in-progress prompts (a station is running one): 0`
- `:354` names it in the `DO NOT ACT` verdict text

**Measured 2026-09-01T02:55:09Z:** the sweep printed `in-progress prompts (a station is running
one): 0` while `scripts/pr-watcher/logs/2026-08-31.log` showed
`[2026-09-01T02:33:55.430Z] [start] pr-scopesub-s3-priced-or-provisional-ready.md` and the
heartbeat was ticking `elapsed=180s`. A build was running. The sweep said none was. That is
DOCTRINE section 7 in the one instrument every station is told to obey before mutating the board,
and DOCTRINE section 9.6 exactly: an empty result reported as an empty world.

`:254` iterates `@("in-progress","needs-marco","no-pr-opened","failed","blocked")` and has the
same problem for the same folder.

### 2. `Measure-Object` throws while sizing a registry escapee

`scripts/pipeline/status-sweep.ps1:204`:

```powershell
$escapeeSize = (Get-ChildItem $subdir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
```

`-Recurse` without `-File` yields directories as well as files, and a `DirectoryInfo` has no
`Length`. When a tree contains no files at all, **no** input object carries the property and
PowerShell raises `Measure-Object : The property "Length" cannot be found in the input for any
objects`. Observed in the same 02:55:09Z run, on `C:\po-worktrees\fix-followup-notes` (0 files).
The exception prints into the middle of the report and the sweep carries on, so a reader sees a
stack trace interleaved with `[LIVE]` lines.

## What to build

All changes are confined to `scripts/pipeline/status-sweep.ps1`.

### A. Delete the dead `in-progress` reads

1. Remove the `:224` `$inprog` assignment and the `:230` line that prints it.
2. Remove `"in-progress"` from the subdirectory list at `:254`.
3. Reword the `:354` `DO NOT ACT` text so it no longer names an in-progress prompt as a signal.
4. `$boardBusy` at `:229` keeps its three REAL signals (`$lockInteractive`, `$lockClone`,
   `$gitProc.Count`) and drops the dead term. **Its truth value must not otherwise change.**

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
Apply this to the `:254` loop and to any other subdirectory count in the file.

### D. Fix the escapee size

Add `-File` to the `:204` `Get-ChildItem`, so only files reach `Measure-Object`. Keep the existing
`if ($escapeeSize) { ... } else { 0 }` guard at `:205`.

## Prove it before you believe it

- **Positive control for B:** while the watcher is mid-build, your probe must return true and name
  the prompt. If you cannot observe a live build, say `[CANNOT MEASURE]` in the PR body rather than
  asserting the probe works.
- **Positive control for D:** create a temporary directory containing only a subdirectory, run the
  sizing expression against it, and show it returns 0 rather than throwing. Remove the temp
  directory afterwards.
- Run the whole sweep once and paste the section 2 and section 3 output into the PR body. There
  must be no `Measure-Object` exception anywhere in it.

## Guard against the obvious way of getting this wrong

- **The premise for this prompt asserts the DEFECT is present** (`grep -q "in-progress"`), not that
  some new identifier is absent. Keep it that way if you touch it.
  `pr-statussweep-orphan-worktree-dirs-HOLD.md` greps for `orphanWorktreeDirs`, the feature shipped
  in #1460 as `REGISTRY-ESCAPEE` / `worktree-registry-escapees`, and that prompt's premise is
  therefore still true and will rebuild shipped work if armed. A premise keyed on a name you hope
  someone adopts does not die when the work lands.
- No single-letter PowerShell variables (DOCTRINE section 9.1, section 7 lie #5).
- No `Write-Output` inside any PowerShell function whose return value is captured (section 7 lie #6).
- Do not "fix" file encoding by adding `-Encoding UTF8` to `Set-Content` - that is the
  double-encoder (DOCTRINE section 9.3).
- Do not change the sweep's exit code, its VERDICT section, or any `[LIVE]` line this prompt does
  not name. Other stations parse this output.

## Do NOT

- Do NOT create `docs/pr-prompts/in-progress/` to make the old read work. Nothing writes it; an
  empty directory would restore the same permanent zero with a directory to back it up.
- Do NOT touch `scripts/pr-watcher/supervise-watcher.ps1`. It carries the same dead glob at `:582`
  and is a SEPARATE prompt, deliberately, so the two cannot collide on one file.
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
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/status-sweep.ps1
```

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
