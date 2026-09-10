---
premise: '! grep -q "GITPROC_SCOPED_V1" scripts/pipeline/status-sweep.ps1'
premise_means: >-
  The safe-to-act gate in status-sweep.ps1 section 3 still counts git processes BY IMAGE NAME,
  across the whole machine, with no PID or command-line test. Any git.exe alive at the instant of
  the sample - including a read-only "git show" run by a concurrent chat, or one of the sweep's own
  git children - raises the count above zero and drives section 7 to DO NOT ACT, which every
  station is told to obey before any board mutation. MEASURED 2026-09-10T06:2xZ by Station 04 at
  origin/main eaf0bcd2 - the marker is absent, and a single child git command takes the counter
  this line uses from 0 to 2 on an otherwise idle box.
scope:
  - scripts/pipeline/status-sweep.ps1
done_when: grep -q "GITPROC_SCOPED_V1" scripts/pipeline/status-sweep.ps1 && powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/status-sweep.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: pipeline
---

# status-sweep section 3 counts git BY IMAGE NAME, and a read-only git anywhere on the box says DO NOT ACT

## The defect, measured

`scripts/pipeline/status-sweep.ps1` builds its safe-to-act verdict from three signals. The third is:

    $gitProc = @(Get-Process -Name git -ErrorAction SilentlyContinue)
    $boardBusy = $lockInteractive -or $lockClone -or ($gitProc.Count -gt 0)

`Get-Process -Name git` matches **every git.exe on the machine**, whatever repository it is reading
and whoever started it. There is no PID resolution and no command-line test, which is the exact
practice DOCTRINE section 9.5 forbids in as many words: *"Never count or kill by image name.
Resolve PIDs and verify command lines - 19 node.exe were running on 2026-08-24 and exactly one was
the watcher."* The comment three lines above this one shows the author already reasoned the same
class through for `claude.exe` - *"counting those flags the user's own session and always says DO
NOT ACT"* - and keyed that signal on real mutation instead. The git counter kept the shape the
`claude.exe` counter was fixed to remove.

[MEASURED] 2026-09-10 by Station 04 at `origin/main` `eaf0bcd234d608a7e81ef11265725ceeb5365f10`,
PS 5.1, on an idle board (watcher pid 18228 running, heartbeat 105 min, no build in flight, no PR
touched in the previous 2 minutes, `index.lock` False in both trees):

| probe | reading |
|---|---|
| `status-sweep.ps1` @ 06:11:04Z, section 3 | `git index.lock interactive/clone: False / False`, `git processes running: 1` |
| the same run, section 7 | **DO NOT ACT: a board mutation is in progress** |
| `Get-CimInstance Win32_Process -Filter "Name='git.exe'"` minutes later | **0** |
| idle sample A, before any probe | **0** |
| peak during a `gh pr list` child job | **0** |
| idle sample C, between probes | **0** |
| **peak during one plain `git log` child job** | **2** |
| idle sample E, after | **0** |

So one ordinary git command - a **read**, not a write - takes the counter this gate depends on
from 0 to 2, and `index.lock` stays False throughout because nothing is being written. The verdict
the board acts on is therefore driven by a signal that does not mean what the verdict says it
means.

**What is NOT claimed.** Which process owned the git.exe at 06:11:04Z is `[CANNOT MEASURE]` - it
had exited before it could be attributed. The defect measured here is the counter's shape, not that
one instance. A prior breadcrumb
(`archive/00-00-supervisor-2026-09-01-0810-the-safe-to-act-gate-was-right-and-the-orphan-probe-was-not.md`)
recorded a genuine DO NOT ACT whose cause was two stale `index.lock` files with
`git processes running: 0` - that is a POSITIVE control that this counter can read zero and that
the other two signals work; it does not speak to this one.

## Why it matters

Section 7's DO NOT ACT is the gate every station consults, and the station contract requires the
sweep to be **re-run immediately before every board mutation**. A false DO NOT ACT fails safe for
writes but costs a station its entire run, and it recurs: this repository is read by concurrent
chats, by the watcher, by CI checkouts and by the sweep itself, all of which shell `git` constantly.
The failure is silent - nothing warns, nothing is empty, the cmdlet did exactly what it was asked -
which is DOCTRINE section 7's shape, a broken measurement of a working system.

## The change (complete and additive - RULE 1)

Replace the image-name count with a scoped one, and report both numbers so no reader loses
information:

1. Resolve git processes with their command lines, not by name:
   `Get-CimInstance Win32_Process -Filter "Name='git.exe'"`.
2. Count as board-busy only those whose `CommandLine` or working directory names the dev tree
   (`$Repo`) or the watcher clone (`$WatcherClone`). Anything else is another repository's business.
3. Feed only that scoped count into `$boardBusy`.
4. Keep emitting the unscoped total on its own `[LIVE]` line, labelled as informational, exactly
   as the `headless claude-code sessions` line already does one line below. Removing a number a
   reader may have been relying on is the "without damaging existing work" half of RULE 1.
5. Mark the new expression `GITPROC_SCOPED_V1` in a comment so the premise above dies on landing
   and so the next reader can anchor on a symbol rather than a line number (DOCTRINE section 9.5).

**Additive:** no signal is removed, no threshold is loosened for the two repositories that matter,
`index.lock` and the clone check are untouched, and a genuine git write in either tree still
produces DO NOT ACT.

**Do not** widen this to `$buildRunning`. The comment at that point in the file is explicit that
the build signal must never reach `$boardBusy` or emit a DO NOT ACT, and that instruction stands.

## Verification the change must carry

A read-back is required, not an assertion (DOCTRINE section 1). In the PR body, record:

- the scoped and unscoped counts side by side on an idle board (expect `0` scoped);
- the same pair sampled while a `git log` child job runs against **an unrelated repository** -
  expect unscoped at least 1 and **scoped 0**, verdict unchanged;
- the same pair sampled while a git command runs against `C:\ProjectOperations2` - expect scoped
  at least 1 and the verdict DO NOT ACT. This is the POSITIVE control: without it the change is
  indistinguishable from disabling the gate, and a gate that never fires is worse than a noisy one.

If the third control cannot be produced, do not land the change - say so and stop.

## Guards this is likely to trip

- The file is `scripts/`, so `classifyPolicyFiles` refuses it and the PR is Marco's at merge
  (DOCTRINE section 10.1). Expect the routing; it is correct.
- No migration, no schema, no seed, no permission code - CP-11, CP-24 and the permission registry
  are untouched.
- PS 5.1 only. Use no single-letter variables and no automatic-variable names, and do not put
  `Write-Output` inside a function whose return value is captured (DOCTRINE section 7, guards 5
  and 6).

## Standing authority

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Provenance

Found by Station 04 on 2026-09-10 during the `gate-liveness` sweep, at `origin/main`
`eaf0bcd234d608a7e81ef11265725ceeb5365f10`. Prior-art search over 589 files in `docs/pr-prompts`
(depth 1, `needs-marco/`, `archive/`): the symbols `$gitProc` and `Get-Process -Name git` returned
**0** each; POSITIVE control `status-sweep` returned **338**; NEGATIVE control, a needle minted
this run, returned **0**. The defect has not been reported before.
