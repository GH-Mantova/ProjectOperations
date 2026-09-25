---
premise: '! grep -q "ADOPT_REQUIRES_NO_WRAPPER_ANCESTOR_V1" scripts/pr-watcher/supervise-watcher.ps1'
premise_means: >-
  The adopt branch of Resolve-WatcherExitAction still decides purely on the string SINGLE-INSTANCE
  in the child's output, with no check of who owns the running node - so it adopts a node that
  already has a live wrapper and then logs "no wrapper was supervising it" as though it had
  checked. MEASURED 2026-09-24T23:1xZ by Station 03 at d8eea113 and re-confirmed 2026-09-25T00:23Z
  by Station 00 at 54b7cbbf: two wrappers alive, one (pid 30116) with no node of its own since
  2026-09-20, both holding Stop-Process authority over node 42212.
scope:
  - scripts/pr-watcher/supervise-watcher.ps1
  - scripts/pipeline/status-sweep.ps1
  - docs/pr-prompts/superseded/pr-watcher-adopt-ancestry-and-watchdog-identity-HOLD.md
done_when: >-
  grep -q "ADOPT_REQUIRES_NO_WRAPPER_ANCESTOR_V1" scripts/pr-watcher/supervise-watcher.ps1 &&
  grep -q "WATCHDOG_LINE_CARRIES_PID_V1" scripts/pr-watcher/supervise-watcher.ps1 &&
  grep -q "WRAPPER_COUNT_ANOMALY_V1" scripts/pipeline/status-sweep.ps1 &&
  ! test -f docs/pr-prompts/pr-watcher-adopt-ancestry-and-watchdog-identity-HOLD.md
size: 3
gate_allow: none
seed_only: false
escalates: true
module: watcher
---

# Watcher: make ADOPT prove its own claim, and give the duplicate an instrument

Staged by Station 00 on 2026-09-25 from Station 03's breadcrumb
`00-03-machine-minder-2026-09-24-2320-...` findings **F2, F3 and F4**, all three of which 03
dispatched to Station 00 and all three of which live in two tracked files.

The half of this defect that is **not** here is the root cause: `C:\po-watcher\ensure-watcher.ps1`
is outside every repo this pipeline can PR, and is escalated to Marco in
`docs/pr-prompts/needs-marco/ensure-watcher-relaunches-a-second-wrapper-because-it-only-asks-about-the-node-2026-09-25.md`.
**This prompt does not fix the race. It stops the race becoming permanent, and makes it visible.**

## 1. The adopt branch must ask who owns the node (F2)

In `scripts/pr-watcher/supervise-watcher.ps1`, `Resolve-WatcherExitAction` reaches `adopt` when the
child's output matches `SINGLE-INSTANCE`. Nothing in that path asks who owns the running node.

**Measured, 2026-09-24T08:01:59Z**, the most recent ADOPT line at the time (177 in the file):

```
ADOPT: a watcher node is already running and no wrapper was supervising it. Adopting rather than
exiting. ([...] SINGLE-INSTANCE: watcher already running (PID 42212).)
```

At that moment node 42212's parent was `start-watcher.ps1` pid 44740, whose parent was wrapper pid
1724. **A wrapper WAS supervising it.** The line states the stronger of two possibilities as fact.

**The change.** Before adopting, resolve the matched node's ancestry and check for a
`start-watcher.ps1` ancestor. If one exists, **exit** rather than adopt, and log that the node is
already supervised. If none exists, adopt exactly as today. Tag the new branch
`ADOPT_REQUIRES_NO_WRAPPER_ANCESTOR_V1` in a comment so the premise and `done_when` can see it.

Correct the log line so it states what was actually verified, in both directions.

**Do NOT remove the adopt branch.** It was added 2026-07-20 for a genuinely orphaned node and is
still correct for that case. What is missing is only the check that distinguishes the two.

## 2. Every WATCHDOG line must carry its PID (F3)

Two watchdog jobs write `WATCHDOG` lines into one `supervisor.log` and `WD-Log` writes
`"[{0}] WATCHDOG {1}"` - a timestamp and no process identity. The two are indistinguishable in the
file. Station 03 separated them only by histogramming the gaps: 25-28 s paired with 92-95 s, summing
to the 120 s `$wdPollSec`, which a single 120-second poller cannot produce.

**The change.** One interpolation in `WD-Log`: include `$PID`. Tag it `WATCHDOG_LINE_CARRIES_PID_V1`.

This does not remove the duplicate - it makes the duplicate visible the moment it recurs, which no
instrument does today. That is why it is additive to item 1 rather than an alternative to it.

## 3. The sweep must not report two wrappers as health (F4)

`scripts/pipeline/status-sweep.ps1` prints `[LIVE] auto-restart wrapper: alive (2)`. The count is
correct; the framing is not. Two wrappers is the defect, reported in the column that tells a reader
the chain is up - and every station reads that report under its own instruction to "Report ONLY from
`[LIVE]` lines". DOCTRINE section 9.5 already records that provenance is not correctness for exactly
these derived verdicts.

**The change.** Keep the count. Mark any value above 1 as an anomaly, with the extra wrapper's PID
and start time beside it. Tag it `WRAPPER_COUNT_ANOMALY_V1`.

## Operational note for whoever lands this

After any `scripts/pr-watcher/**` change merges, the RUNNING watcher still executes the OLD code. An
idle-window restart is required before these rules take effect - kill the wrapper first, then the
node, then relaunch DETACHED via `C:\po-watcher\watcher-launcher-singlelane.ps1`. **Never restart
mid-run.**

`escalates: true` because this touches the watcher's own lifecycle: the PR opens and is labelled
`do-not-merge`, and Marco releases it.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Work in your own disposable worktree off `origin/main`. `pnpm build` and `pnpm lint` must pass
before the PR. Retire this prompt in the same PR by `git mv`-ing it to
`docs/pr-prompts/superseded/` — its own path is in `scope` for exactly that reason, and the
`done_when` above checks it is gone.

These are PowerShell files, so two shell rules from DOCTRINE section 9.1 apply directly to the code
you are editing: **no single-letter variable names**, and **no automatic-variable names** (`$home`,
`$host`, `$input`, `$pwd`, `$args`, `$matches`) as a loop or assignment target — binding one throws
to the error stream once and the loop body never runs, at exit 0.

Control the ancestry walk against a process you know has the ancestor you are looking for, and
against one you know does not. A walk that returns nothing and a walk that never ran are
byte-identical in output.
