# Station 00 — Supervisor | 2026-10-11T06:18Z–2026-10-11T06:30Z

**BLIND: `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`**

No shell on the Windows host this run. Read-only, no board mutation, run ended at PREFLIGHT step 1
per `00-supervisor.md` ("If Desktop Commander is absent ... STOP"). This is a BLIND run, not a
healthy quiet one — nothing below is coverage of the board.

## GROUND

```
UTC          2026-10-11T06:18:30Z (measured in the sandbox VM, `date -u`)
origin/main  [CANNOT MEASURE] — no host shell; `git fetch` + `git rev-parse` not run.
             Reading `origin/main` from the sandbox mount is a HARD STOP (device-bridge git ban).
dev tree     [CANNOT MEASURE] — branch and SHA both require git in C:\ProjectOperations2.
doc version  1  (station doc front matter, read from origin/main via blob ?plain=1)
bootstrap    1  (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE (1 == 1). Read-only for the rest of the run anyway, on blindness.

## WHAT I MEASURED

**1. Device bridge — absent. [MEASURED]**
Schemas loaded FIRST, per BOOTSTRAP_PREFLIGHT_V1, so this is not a cold-call validation error.

- `ToolSearch` keyword `desktop-commander`, max 30 → `No matching deferred tools found.` with
  `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT)` named in the server-failure list.
- Retried once with an explicit id form,
  `ToolSearch select:mcp__desktop-commander__start_process,...interact_with_process,...read_file`
  → `No matching deferred tools found.`, same CONNECT_TIMEOUT.

Two load attempts, no schema, server never connected. `start_process` was therefore never callable,
so no PowerShell host shell existed at any point in this run.

**2. The VM-side git guard — NOT INSTALLED, and the attempt wedges the sandbox shell. [MEASURED]**
Three attempts; no installer last line and no installer exit code obtained, which the contract asks
for "whichever outcome you got" — so this is recorded as an absence, not as a pass.

- Attempt 1 `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh" | tail -20`
  → `request timed out after 30s. The workspace did not confirm the command started`.
- Attempt 2 (redirect to a file, `timeout 120`) → same 30s start-confirmation timeout.
- Attempts 3 and 4 (trivial `echo`) → `RPC error -1: process with name "vigilant-serene-bardeen"
  already running (id: oneshot-f9cb77c7-...)`. The first invocation was still live and held the
  one-shot slot: **the sandbox shell was unusable for ~3 minutes because of the guard call itself.**
- Shell recovered (`echo RECOVERED`), and `/tmp/guard.out` did not exist — attempt 2 never ran.
- Attempt 5, `timeout 25 bash ./mnt/.../vm-git-guard.sh` → wedged identically at 30s.

The script's own file is present and executable: `-rwx------ 10256 Sep 22 15:30
/sessions/.../mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh`. The mount itself is fine —
`ls -d` on it and a `date -u` in the same shell both returned instantly. So what hangs is the guard
run, repeatably, and it takes the one available sandbox shell with it. The guard was therefore
**never installed this run**; per the station doc that is a FINDING, not a STOP, and it is never a
licence to run my own `git` against the mount — which I did not.

**3. No git, no sweep, no board read. [CANNOT MEASURE]**
`status-sweep.ps1`, `Enter-BoardLease`, `Assert-SmokedOrEscalate`, `Merge-Pr`, `arm-prompt.ps1`,
`check-breadcrumb.mjs --freshness`, `lint-prompt.mjs` are all PowerShell/node on the Windows host.
None was run. No PR state, no lock state, no watcher liveness, no armed-prompt count, and no
WAITING ON MARCO figures exist for this run. GitHub-side reads were not substituted for any of it.

**4. Native file tools still reach the dev tree — listings only, no git, no coverage claim. [MEASURED]**
`Glob` against `C:\ProjectOperations2` works (same channel the 2026-10-10T11:14Z blind run used).
Two listings were taken, and nothing was inferred from them beyond file names and dates:

- `docs/pr-prompts/00-*.md` — the breadcrumbs sitting uncollected in the dev tree root include
  04's `2026-10-11-0613-blind-no-device-bridge`, 00's `2026-10-11-0000-blind-no-host-shell`,
  04's `2026-10-11-0000-blind-no-shell`, 05's `2026-10-11-1425-blind-on-the-windows-host...`,
  and 00's 2026-10-10 chain at 1617 / 1705 / 1814 / 2015 / 2114.
- `docs/pr-prompts/needs-marco/` — contains `WATCHER-CRASH-LOOP-2026-10-11-063643.md`,
  `-120512.md`, `-135514.md`; `system-thread-exhaustion-2116-processes-and-cim-is-dead-...-2026-10-10.md`;
  and `station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`.

[INFERRED, not measured] Station 05's breadcrumb and two of today's crash-loop files carry stamps
ahead of this run's UTC. That is consistent with the local-clock/Brisbane +10 offset already
recorded in the 2026-10-10T15:14Z breadcrumb, not with a future event. I did not re-measure it.

## WHAT CHANGED

**Nothing.** No arm, no merge, no label, no branch update, no lease taken, no scheduled task
touched, no `/sot/` edit, no commit. The only write this run is this breadcrumb, into the dev tree
at `docs\pr-prompts\`, left untracked for `sweep-breadcrumbs.ps1` — not into the Cowork `outputs`
folder, which a measured 2026-09-22 blind run proved reaches nobody.

## FINDINGS

**F1 — Station 00 is blind again: no device bridge, and the dev-tree breadcrumb trail says this is
sustained, not a one-off.** `00-*` in the queue root shows blind runs at 2026-10-10 0000/0716/0815/
0915/1114/1514/1705 and 2026-10-11 0000, plus Station 04 blind at 2026-10-11 0613 and 0000 and
Station 05 blind on its latest — so the outage is cross-station and still live an hour ago. The
plausible shared cause is already lodged:
`system-thread-exhaustion-2116-processes-and-cim-is-dead-...-2026-10-10.md`, with
`WATCHER-CRASH-LOOP-2026-10-11-*.md` × 3 landing today. The blindness escalation itself is already
open as `station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`, so this is not a new
question for Marco — it is fresh evidence on an open one, and I have not duplicated the file.
**DISPOSITION: ESCALATED** — to the existing
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`, as the
2026-10-11 datapoint. Nothing further from a station: every remedy (restarting the bridge, clearing
the process storm, the watcher crash-loop) is Marco's host, and none of it is reachable from a run
with no shell.

**F2 — `vm-git-guard.sh` hangs and takes the sandbox's single shell slot with it, so the guard
cannot be installed on a blind run at all.** Three timed-out invocations, ~3 minutes of
`already running (id: oneshot-...)` refusals on unrelated commands afterwards, and no installer
output or exit code recovered — against a script file that is present, executable and on a mount
that answers `ls` and `date` instantly. This is worse than exit 2 ("installed but inert"): a station
that has to install the guard first, and whose shell the installer eats, loses its one instrument
before it has measured anything. [MEASURED] 2026-10-11T06:19–06:26Z, five calls.
**DISPOSITION: DISPATCHED** — to **Station 03 — Machine Minder**, which owns instrument repair.
Handing over: find why `scripts/pipeline/vm-git-guard.sh` blocks past 30s in a non-interactive
sandbox shell (first suspect: it probes the Windows host or the mount's `.git` and waits on a host
that is currently thread-exhausted), and give it a hard internal timeout plus a non-zero exit so the
caller gets the "install failed" outcome the contract already allows instead of losing its shell.
A fix here is `instrument` lane; note `pipeline-lib.ps1` is never-listed but this script is not.

**F3 — COLLECT did not happen, and ten-plus breadcrumbs are stacking up undispositioned in the dev
tree root.** 00 is the only station that reads them and the only channel that closes; eight
consecutive blind 00 runs mean eight cycles of findings from 03/04/05 with no disposition. The list
is in WHAT I MEASURED §4. I did not open any of them: COLLECT needs `check-breadcrumb.mjs
--freshness`, `list_scheduled_tasks` crossed against `lastRunAt`, and `gh pr view` per PR, none of
which a blind run can do, and dispositioning from a filename would be a §7 instrument lie.
**DISPOSITION: DEFERRED** — to the first sighted 00 run, which should COLLECT the whole backlog
before arming anything. What would make it urgent: a ninth consecutive blind 00 run, or any of those
breadcrumbs turning out to carry an ACTIONED-by-nobody defect older than 24h.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for board coverage.** The station doc's blind clause
  forbids it. The one network read I made was the station doc itself, from
  `blob/main/...?plain=1`, which the same doc sanctions as the fallback when the local checkout
  cannot be read through git — and I say plainly that it tells me nothing about the board.
- **Did not run `git` against the mounted Windows `.git`** from the sandbox, guard or no guard.
  A missing or inert guard is not a licence (DOCTRINE §9.2 — the 0-byte `index.lock` with no owning
  process freezes every station).
- **Did not mutate the board**: no arm, no merge, no `gh pr update-branch`, no label change, no
  lease. All four board-driving conditions were unmeetable with no host shell; condition 3 alone
  (BOARD_LEASE_V1) rules out every mutation.
- **Did not touch any scheduled task** — not disabled, enabled, run, re-run or edited. Forbidden on
  a freshness/MISSED reading alone, and this run has no freshness reading at all.
- **Did not open a new `needs-marco/` file for F1.** The escalation exists; a duplicate would split
  one question across two files. Also did not append to any existing `needs-marco/` file — 6 of 61
  there are tracked in fact and `git ls-files` was not available to tell me which.
- **Did not retire any `[STALE]` escalation row** — that needs the sweep's tags and per-PR
  `gh pr view`, neither available.
- **Did not archive any breadcrumb** to `docs/pr-prompts/archive/` — archiving is part of COLLECT,
  and COLLECT did not happen.
- **Did not touch `/sot/`** — Station 05's lane.
- **Did not retry the guard a sixth time.** Two honest attempts failed, then three more confirmed
  the wedge; past that it is a loop, and each attempt costs the shell for minutes.
