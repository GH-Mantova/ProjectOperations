# 00-SUPERVISOR — 2026-08-22 00:10Z — DESKTOP COMMANDER ABSENT AGAIN (2nd blind scheduled run)

## Verdict
This scheduled Supervisor run was **structurally blind**. Desktop Commander was not present
(ToolSearch for the server returned nothing after the connect window closed), so:
`bring-up-to-speed.ps1` **never ran** — there is **no sweep verdict for this run**.
No PowerShell, no Windows process list, no `gh`, no merge, no dispatch.

## This is the SECOND occurrence, not a fluke
- 2026-08-21 06:10Z — `00-supervisor-2026-08-21-0610-DC-ABSENT-run-blind.md`
- 2026-08-22 00:10Z — this file

Two blind runs in ~18 h. Combined with the measured fact that **no Windows Scheduled Task
references the watcher launcher**, the pipeline currently has **no supervisor of last resort**:
the only scheduled thing that could notice a dead watcher is a station run that half the time
cannot see the machine.

## What WAS measured (read-only filesystem over the mount; NO git was run — deliberately, per
the VM-git stale-lock root cause)
| Item | Value | Tag |
|---|---|---|
| dev / clone / origin-main SHA | all `c17373121b7330dc48c3cbf114faa3ffa019576d` | MEASURED |
| `.git/index.lock` (dev) | **ABSENT** | MEASURED |
| `HEAD.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `sequencer`, `rebase-*` | all absent | MEASURED |
| `.git/objects/maintenance.lock` | present, **0 B, 5397 min (3.7 d) old** — known fossil | MEASURED |
| armed `*-ready.md` **depth 1** | **0** (recursive returns 1848, all inert) | MEASURED |
| `*-HOLD.md` depth 1 | **72** | MEASURED |
| `escalate*` depth 1 | 0 | MEASURED |
| suffix-less `.md` depth 1 | 8 | MEASURED |
| open PRs | **0** | MEASURED (GitHub MCP — not a substitute for the sweep) |
| breadcrumbs `00-*.md` depth 1 | **15** (was 13 on 08-21) | MEASURED |

## Watcher — CANNOT MEASURE liveness
- `.watcher.lock` rewritten **2026-08-21 22:20Z**, contents **pid 42112** (the dead pid 13372 is gone).
- `watcher-launch.log` last write **2026-08-21 22:21:15Z**, ending on the clean startup banner
  (`verdict-archive sweep: archived=34 kept=0 skipped=0` → `reviewed-set seeded with 829 PR(s)` →
  `poll-every: 90 s, min-age: 2 min`). So it **was relaunched** after the 22:12Z hibernate death.
- 108 min of silence since. With `armed=0` that is **exactly what a healthy idle watcher looks like**,
  and exactly what a dead one looks like. **A down watcher is invisible while armed=0 — only the
  Windows process match on `pr-watcher[\\/]index\.mjs` separates them, and I could not run it.**
- `heartbeat.log` last tick 2026-08-20 18:23Z, last job `rev-1293-ready.md` — stale by design under
  the arming hold; carries no liveness information.

## Deliberately NOT done
- No git of any kind against `C:\ProjectOperations2\.git` from this VM (that is how the three
  0-byte no-process `index.lock`s were minted).
- Nothing armed — Marco's STANDING HOLD is in force and its three preconditions are unchanged.
- Nothing merged (0 open PRs anyway). No station dispatched: a dispatched station inherits the same
  missing host tools and would be equally blind.

## For Marco — the question
The Supervisor's scheduled run cannot be relied on to notice a dead watcher, because it
intermittently starts with no way to see the machine. Two candidate fixes, RULE 1 applied:
1. **(complete + additive)** A Windows Scheduled Task that runs the watcher launcher on boot,
   on resume-from-sleep, and every N minutes if absent — independent of Claude entirely. Solves it
   now and in future; touches no data.
2. *(fails the "completely" half)* Make the Supervisor task fail loudly when DC is missing. Turns a
   silent no-op into a visible one, but still leaves the watcher with no restarter.
