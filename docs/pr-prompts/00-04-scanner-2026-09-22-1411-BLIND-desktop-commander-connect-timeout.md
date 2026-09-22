# Station 04 — Scanner | 2026-09-22T14:11Z–2026-09-22T14:14Z

🔴 **THIS IS A BLIND RUN, NOT A QUIET ONE.** Desktop Commander did not connect, so there was no
shell on the Windows host this cycle. Per the station contract's PREFLIGHT step 1 the run STOPPED
before any sweep: no sweep was taken, no gates were read, no prompts were critiqued, and nothing on
the board was inspected. **Read no coverage into this report.** What follows is the blindness
itself, plus the handful of facts obtainable from plain file reads that do not require `git` or
PowerShell.

## GROUND

```
UTC            2026-09-22T14:11:08Z
origin/main    58a53a11  [INFERRED from .git/refs/remotes/origin/main — a LAST-FETCHED tracking
                          ref read as a file, last fetched 2026-09-22T13:34Z. NOT a live
                          `git rev-parse origin/main`; no fetch was possible this run.]
dev tree       main @ 58a53a11  C:\ProjectOperations2
                         [INFERRED from .git/HEAD -> .git/refs/heads/main, read as files.
                          NOT `git rev-parse HEAD`.]
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **MATCH** — there is no version-mismatch downgrade in play. The run is
read-only because it is blind, not because of a mismatch.

Clock note, so the next run does not chase it: the session header declares "2026-09-23" while the
box reports `2026-09-22T14:11:08Z`. These agree — the host is UTC+10, where 14:11Z is 00:11 on the
23rd. The header carries the **local** date; this report is stamped in **UTC**, as the contract
requires. No skew.

## WHAT I MEASURED

**[MEASURED] Desktop Commander is absent — CONNECT_TIMEOUT, not an unloaded schema.**
The contract is explicit that a cold-call `InputValidationError` is an unloaded schema rather than
blindness, so the load was attempted first and by keyword, never by hard-coded id:

- `ToolSearch { query: "desktop-commander", max_results: 30 }` → *"No matching deferred tools
  found. Some MCP servers are still connecting: … plugin:desktop-commander:desktop-commander."*
- Waited 25s. Retried `ToolSearch { query: "desktop-commander start_process powershell" }` and
  `{ query: "+process start terminal session windows shell command execute" }` → neither returned
  any Desktop Commander tool; the matches were unrelated servers.
- The session's own server-status report then resolved it:
  `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
  plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`.

That is a failure **after** an honest load attempt, and a terminal one — the server moved from
"still connecting" to "failed to connect". **No `start_process`, no `powershell.exe`, no shell on
the Windows host.**

**[MEASURED] vm-git-guard installed but INERT — exit 2, the expected station outcome.**
Run at the top of the run, before any other VM-side call, exit code read off the installer itself
and not off an appended pipeline:

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"; echo "GUARD_EXIT=$?"
```

Last line and exit code, verbatim:

```
   PATH="/sessions/friendly-sleepy-cannon/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Its own controls reproduced the documented cause: `bash -lc 'command -v git'` resolves the shim,
`bash -c 'command -v git'` resolves `/usr/bin/git`, and the shell a station is given is
non-interactive and non-login, so neither `~/.bashrc` nor `~/.profile` is sourced. Per the contract
this is a FINDING, not a STOP — and it is **never** a licence to run VM-side `git` against the
mount. None was run this cycle.

**[MEASURED] The repo mount is readable; it is the Windows *shell* that is gone.**
`ls /sessions/friendly-sleepy-cannon/mnt/ProjectOperations2/` returned the real tree (apps,
packages, sot, scripts, docs, …), and `docs/pipeline/stations/04-scanner.md` read in full. This is
worth stating precisely because it is the tempting half-capability: a readable tree at an
**unverifiable** SHA. With no `git` available, nothing read from it can be pinned, and PROVENANCE
IS MANDATORY makes an unpinned read a **lead, not a finding**. That is why no Part 0 static audit
was attempted rather than a partial one being dressed up as coverage.

**[MEASURED] Tree state, from plain file reads only (no `git` invoked).**

| probe | result |
|---|---|
| `.git/HEAD` | `ref: refs/heads/main` |
| `.git/refs/heads/main` | `58a53a11a2124d770ca4ee000bc3cd28d95d3163` |
| `.git/refs/remotes/origin/main` (loose) | `58a53a11…` — identical to HEAD |
| `packed-refs` line for `origin/main` | `66194af6…` — **stale, and correctly shadowed**: git resolves loose before packed, so `origin/main` is `58a53a11`. Recorded only so a future reader grepping `packed-refs` does not mistake it for the answer. |
| `.git/FETCH_HEAD` mtime | `2026-09-22 23:34:36 +1000` = **2026-09-22T13:34Z**, 36 min before this run |
| `.git/index.lock` | **absent** |
| `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer` | **all absent** |

So: no stale 0-byte `index.lock`, no interrupted merge or rebase, and the dev tree sits level with
the last-fetched `origin/main`. **[INFERRED]** the tree is quiet — but "level with last-fetched"
says nothing about the live `origin/main`, which could have moved in the 36 minutes since, and I
could not fetch to find out.

**[MEASURED] No concurrent Station 04 run.** `docs/qa/.qa-run.lock` does not exist. The lock was
**not** claimed this cycle: claiming it only to release it seconds later buys nothing on a run that
takes no sweep, and a lock left behind by a stopped run is exactly the stale-lock defect the sweep
protocol exists to catch.

**[CANNOT MEASURE] — everything that defines a Station 04 cycle.**
`scripts/pipeline/status-sweep.ps1` (PowerShell, host-only) · live `git rev-parse origin/main` and
`git diff --numstat` · `check-backlog.mjs` / `check-escalations.mjs` / `check-lessons.mjs` /
`triage-holds.ps1` gate readings, which the CLEAN-TREE MANDATE requires be taken against a verified
clean read of `origin/main` · the `next-sweep.mjs` rotation · the adversarial critique of the 12+
HOLD prompts sitting in `docs/pr-prompts/` · Part 1 GitHub reconciliation · Part 2 live-site and
visual patrol. Each of these is reported as unmeasured rather than substituted.

## WHAT CHANGED

**Nothing on the board, and nothing in the repo but this file.** No prompt was staged, armed,
disarmed, renamed, moved or deleted. No PR was opened, labelled or merged. No `git` command of any
kind was run, in either the VM or the host. No source, `sot/`, `roadmap.md` or `progress.md` file
was touched. The sweep rotation was **not** advanced (see WHAT I DID NOT DO).

The one write this run: this breadcrumb, at
`C:\ProjectOperations2\docs\pr-prompts\00-04-scanner-2026-09-22-1411-BLIND-desktop-commander-connect-timeout.md`.
It is **untracked in the dev tree** until a board PR commits it — Station 00 sweeps it up. It is
deliberately *not* left in the Cowork session's `outputs` folder, which is where the 2026-09-22
blind run put a complete report that then reached nobody.

## FINDINGS

### F1 — Desktop Commander CONNECT_TIMEOUT blinded a scheduled Station 04 run outright (S2)

**Evidence:** quoted in full under WHAT I MEASURED. Load attempted first, by keyword, twice, with a
25-second wait between; the server then reported a hard 30s connection timeout rather than
remaining in "connecting".

**Why it is S2 rather than noise:** a blind run and a healthy quiet run produce the same silence,
and STATION-CAPABILITIES §2 records that blindness is intermittent with an unknown cause — so the
only signal anyone gets is a report like this one saying loudly which of the two it was. Every
station shares this single dependency: with Desktop Commander down there is no PowerShell, and with
the VM-side git ban in force (and the guard inert) there is no sanctioned `git` either, so gate
reads, sweeps, merges and arming all stop pipeline-wide. This is not a Station 04 problem.

**The question for Marco, with RULE 1 applied** — *complete-and-additive first*:

- **(a) Make the bridge's liveness measurable and self-healing.** Have the scheduled task probe
  Desktop Commander and, on timeout, retry the connection a bounded number of times before
  declaring blindness, and record every outcome to a tracked counter so the ~40% blindness rate
  stops being folklore and becomes a number with a trend. **Passes both halves**: it fixes the run
  in progress *and* produces the measurement needed to find the root cause, and it damages no
  existing data — it only adds a counter and retries.
- **(b) Give stations a sanctioned non-PowerShell path for read-only git.** Make the VM git guard
  effective in a non-interactive non-login shell (an `env`-level `PATH`, or a wrapper the station
  invokes) and permit *read-only* git through it, so a bridge outage degrades a station to
  read-only instead of to blind. **Fails the "immediately" half** — it is a real build, not
  available this cycle — and it widens a ban that DOCTRINE §9.2 records failing seven times, so it
  needs care to not damage the protection it relaxes.
- **(c) Accept the outage and rely on the blind-run report.** **Fails the "future" half**
  completely: it is today's behaviour, and today's behaviour is that roughly two runs in five see
  nothing while the board keeps moving.

**DISPOSITION: ESCALATED**

### F2 — The device-bridge git ban is remembered, not mechanical, in the shell a station is given (S3)

**Evidence:** guard exit 2 with the INERT headline, quoted above, plus the installer's own two
controls showing the shim resolves under `bash -lc` and `/usr/bin/git` resolves under `bash -c`.

This is the *expected* outcome documented in the station contract, so it is not new — it is filed
because the contract also requires it be quoted every run, and because an install nobody can see in
a report is indistinguishable from one that never ran. Nothing here was acted on: the ban was
honoured by not running VM-side `git` at all, which is the only protection available when the shim
is off `PATH`. The durable fix is (b) under F1 and belongs with it.

**DISPOSITION: DEFERRED** — it becomes urgent the moment a station, facing exactly this run's
blindness, reasons that an inert guard means VM-side `git` is now permitted. It is not. If that
happens once, the 0-byte `index.lock` it leaves has no owning Windows process, never expires, and
freezes every station.

### F3 — This cycle's rotation slot was consumed without a sweep, and the rotation must not skip it

**Evidence:** no sweep was taken (F1). `scripts/pipeline/next-sweep.mjs` was **not** run and
`--advance` was **not** issued, so `docs/pipeline/sweep-rotation.json` is unchanged and still points
at whichever sweep was due.

That is the correct outcome — advancing a rotation past a sweep that never happened is how coverage
rots silently — but it leaves a real gap: one Station 04 cycle of gate-liveness / instrument-honesty
/ repo-hygiene / instruction-drift coverage simply did not occur, and the next run has no memory of
that. It will read the rotation, take the sweep that was due, and have no way to know the previous
slot was lost rather than served.

**DISPOSITION: DISPATCHED** — to **Station 00**, which collects breadcrumbs and is the only actor
that closes a channel. Two concrete handovers: (1) commit this breadcrumb, since 04 may not;
(2) note in 00's own disposition that the 2026-09-22T14:11Z Station 04 slot was **blind, not
quiet**, so the gap is visible to whoever next asks why a sweep's findings are stale.

## WHAT I DID NOT DO

- **Took no sweep of any kind.** Not gate liveness, not instrument honesty, not repo hygiene, not
  instruction drift. The contract's PREFLIGHT step 1 stops the run on blindness, and it stops it
  *before* the sweep precisely so a blind run cannot be mistaken for a clean one.
- **Ran no Part 0 static audit**, though it needs no live site and the repo mount was readable. With
  no `git`, every read is at an unverifiable SHA, and an unpinned read is a lead rather than a
  finding. A Part 0 pass filed as coverage from an unpinnable tree is the §7 instrument lie in its
  purest form, and it would have read as a clean sweep to everyone downstream.
- **Substituted no GitHub-side reads for the tree.** The GitHub connector is available and the
  temptation is real, but `origin/main` is not the tree the watcher globs, and coverage claimed from
  it would be false coverage. Part 1's reconciliation audit is unrun, not partially run.
- **Did not advance the sweep rotation** — see F3.
- **Staged no prompt and critiqued none.** The adversarial critique pass needs the HOLD files read
  at a verified SHA and their premises actually executed; neither was possible.
- **Did not claim `docs/qa/.qa-run.lock`.** Confirmed absent, left absent.
- **Wrote nothing into the gitignored Overnight-QA state files.** `docs/qa/qa-findings.md` and
  `docs/qa/qa-checklist.md` are gitignored by their own literal lines in `.gitignore`; a finding
  that lives only there has not been reported, which is the nine-day-silence defect. This
  breadcrumb is the whole of this run's output.
- **Touched no Azure, Entra or SharePoint anything.** Absolute, and not reasoned past.
