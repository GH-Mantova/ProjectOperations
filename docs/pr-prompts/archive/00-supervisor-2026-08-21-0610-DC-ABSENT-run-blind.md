# 00-SUPERVISOR — 2026-08-21 06:10Z — scheduled run was STRUCTURALLY BLIND (Desktop Commander absent)

**Breadcrumb, not a prompt.** Nothing was armed, merged, moved or repaired by this run.

## What happened

The 2-hourly scheduled Station 00 run started in a session where the
`plugin:desktop-commander:desktop-commander` MCP **never finished connecting**. Four `ToolSearch`
queries over ~2 minutes (`start_process`, `interact_with_process`, `read_process_output`,
`+desktop-commander`, plus a 45 s wait and retry) returned **no matching tools**; the server
disappeared from the "still connecting" list without ever exposing a tool.

Consequence, stated plainly: **no PowerShell on the Windows host.** Therefore
`scripts\pipeline\bring-up-to-speed.ps1` **DID NOT RUN**. There is no `[LIVE]`/`[STALE]`/`[FILE]`
sweep behind this run and no SAFE / CAUTION / DO-NOT-ACT verdict from the instrument that is
supposed to issue one.

Per the station brief, `gh`/GitHub-side reads are **not** a substitute and are not presented as one.

## What WAS measured, and how

Only **pure filesystem reads** over the connected-folder mount (`stat`, `cat`, `ls`, `find`).
**Zero `git` invocations** — deliberately, because a VM-side `git` cut short against the Windows
`.git` is the measured cause of the 0-byte `index.lock` that has frozen the board three times in
two days.

| Fact | Value | Method |
|---|---|---|
| `C:\ProjectOperations2\.git\index.lock` | **ABSENT** | `stat` |
| `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer` | all **ABSENT** | `stat` |
| `.git/objects/maintenance.lock` | present, **0 bytes, 2026-08-18 06:11Z** (~3 days) | `stat` |
| dev tree HEAD | `c17373121b7330dc48c3cbf114faa3ffa019576d` | `cat .git/refs/heads/main` |
| watcher clone HEAD (`C:\po-watcher\ProjectOperations`) | `c1737312` — **in sync** | `cat` |
| armed prompts (`docs/pr-prompts/*-ready.md`, **depth 1 only**) | **0** | `find -maxdepth 1` |
| parked prompts (`*-HOLD.md`, depth 1 only) | **72** | `find -maxdepth 1` |
| open PRs on `GH-Mantova/ProjectOperations` | **0** | GitHub MCP `list_pull_requests` |
| `main` tip on GitHub | `c1737312` (#1293, 2026-08-20T19:04Z) | GitHub MCP `list_commits` |
| heartbeat last tick | 2026-08-20T18:23Z, last job **`rev-1293-ready.md`** | `tail heartbeat.log` |
| `watcher-launch.log` last write | 2026-08-21T01:43Z (review-poller seeding, `poll-every: 90 s`) | `tail` |

**COUNTING RULE, published beside the count:** armed = `*-ready.md` at **depth 1** of
`docs/pr-prompts/`. A `-maxdepth 2` sweep returns **1673**, because thirteen retirement
subdirectories (`archive/`, `processed/`, `superseded/`, `binned-shipped-*`, `no-pr-opened/`, …)
are full of retired `-ready.md` files. Depth 2 is the wrong instrument and would have reported a
catastrophic false queue.

## Watcher liveness — INFERRED, not measured

The heartbeat's **last job name is `rev-1293-ready.md`**, and #1293 is exactly the prompt behind the
most recent merge to `main`. Per the disambiguator rule that reads **IDLE and healthy**, not wedged —
the heartbeat only ticks mid-run, and the queue is deliberately empty.
**CANNOT MEASURE:** whether the watcher process is actually alive right now. That is a Windows
process and needs Desktop Commander. Do not upgrade this inference to a measurement.

## STILL OPEN — the `po-scan-0CwZSs` worktree needs a decision

`.git/worktrees/po-scan-0CwZSs/` is still registered and still carries the exact signature from the
root-cause finding:

- `gitdir` → **`/tmp/po-scan-0CwZSs/.git`** — a **Linux VM path**, in a VM that no longer exists
- `HEAD.lock` **0 bytes**, `index.lock` **0 bytes**, both stamped 2026-08-20 ~22:11Z
- a `locked` file is present, so `git worktree prune` will refuse it

These locks live under `.git/worktrees/<name>/`, **not** `.git/` root, so they are **not** blocking
the main tree today. They are the fossil of the defect, not an active freeze. Left alone
deliberately: clearing a worktree registration is Station 03's lane and needs Windows-side git.

## What was NOT done, and why

- **Arming: nothing.** Marco's standing hold is in force. `main` has not moved since #1293, so none
  of the three failure modes has landed — **the precondition to even ask him is not met.**
- **Merging: nothing to merge.** 0 open PRs.
- **Dispatching: nothing.** Stations 02 and 03 do machine and board work through Windows git.
  Dispatching them from a session with no host access would produce another blind station, and 03's
  repair path is exactly where a cut-short VM-side git mints the next stale lock.

## The actionable item for the next run

**A Station 00 run without Desktop Commander should be treated as a failure of the run, not of the
board.** It is currently silent: the task starts, finds no host, and the only trace is a chat
transcript no other agent can read. Worth a prompt — the scheduled task should fail loudly, or the
station should re-check for the MCP on a longer backoff before declaring itself blind.
