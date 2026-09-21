# Station 00 — Supervisor | 2026-09-21T10:00Z–2026-09-21T10:12Z

> **FIRST LINE: THIS WAS A BLIND RUN.** Desktop Commander returned `CONNECT_TIMEOUT` after a
> successful `ToolSearch` load, so there was no `start_process` and no `powershell.exe` on the
> Windows host. I could READ the dev tree through the Cowork mount but could execute NOTHING on it:
> no `git`, no `gh`, no `status-sweep.ps1`, no `smoke-pr.ps1`. **I armed nothing, dispatched
> nothing, merged nothing, and labelled nothing.** Do not read this run's quiet as a quiet board.

## GROUND

```
UTC            2026-09-21T10:00Z (start) – 2026-09-21T10:12Z (end)
origin/main    08ff8b3d  ⚠ READ FROM .git/refs AS A FILE, pinned to the 10:04Z fetch — NOT rev-parsed
dev tree       main @ 76ed975a  C:\ProjectOperations2   (BEHIND origin/main — see F2)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter, read from the WORKING COPY)
bootstrap      1   (scheduled-task SKILL.md)
```

Version check: **doc version 1 == bootstrap 1. No mismatch.** The read-only posture of this run is
forced by blindness, not by a version disagreement.

⚠ **The GROUND block above is degraded and I will not dress it up.** The preflight requires
`origin/main` via `git fetch` then `git rev-parse`, run in the dev tree. I could do neither. Both
SHAs above were read by `cat`-ing `.git/HEAD`, `.git/refs/heads/main` and
`.git/refs/remotes/origin/main` as plain files — a read that never takes the index lock, so it is
safe, but it is **not** the measurement the contract asks for. `origin/main` is whatever the last
fetch recorded, not what GitHub holds now.

## WHAT I MEASURED

**[MEASURED] Device bridge git guard — installed, passing.** Run at the top of the run, before any
other VM-side call, per the preflight:

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/.../.local/bin/git - refuses mounted paths and mounted cwd,
  allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Last line quoted as required. **PASS.** No `git` was run against the mount at any point this run.

**[MEASURED] Desktop Commander is unreachable — this is the blindness, and it is not an unloaded
schema.** I loaded first, exactly as the preflight demands, with a keyword search rather than
hard-coded ids:

```
$ ToolSearch  query="desktop-commander"  max_results=30
No matching deferred tools found. Note: these configured MCP servers failed to connect, so their
tools are unavailable for this session: ...
  plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

The search waited on the connecting server and the server timed out. That is a failure **after** a
load, which the contract defines as blindness. No `InputValidationError`, no "no such tool" from a
cold call — the schema search itself reported the transport dead.

**[MEASURED] Breadcrumb structure and station freshness — CLEAN, all five stations inside cadence.**
This is the one COLLECT instrument that needs neither git nor PowerShell, so it survived the
blindness:

```
$ node scripts/pipeline/check-breadcrumb.mjs --freshness        # node v22.23.2, exit 0
structure: 12 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)
freshness (a station is SILENT past 2x its cadence):
  00  last 2026-09-21T09:15:00Z  0.9h ago  (cadence 2h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-21T00:21:00Z  9.8h ago  (cadence 24h)  ok
  04  last 2026-09-21T06:11:00Z  4.0h ago  (cadence 4h)   ok
  05  last 2026-09-21T00:45:00Z  9.4h ago  (cadence 24h)  ok
CLEAN
```

**No station is silent and no breadcrumb is malformed.** The 09:15Z Station 00 run is 0.9h back, so
there is no uncollected breadcrumb backlog for me to disposition — the previous run closed the
channel. This is the single most reassuring measurement in the run, and it is why I am confident the
defect is local to my session rather than systemic.

**[MEASURED] The dev tree git state is clean — no stale lock, no interrupted operation.** Checked by
`stat`, not by `git status`:

```
absent  index.lock          absent  MERGE_HEAD      absent  REBASE_HEAD    absent  CHERRY_PICK_HEAD
absent  dir rebase-merge    absent  dir rebase-apply    absent  dir sequencer
.git/FETCH_HEAD mtime       2026-09-21T10:04Z   (5 minutes before this run ended)
```

**No 0-byte `index.lock`, no merge/rebase/cherry-pick in flight.** DOCTRINE §9.2's frozen-board
failure mode is NOT present. Worth stating positively: a blind run is the exact circumstance in
which a station is tempted to skip this check, and a stale lock left unreported is how the board
freezes for hours.

**[MEASURED] The watcher lane is ALIVE and fired twice inside the last ten minutes.** Two
`-ready.md` files in the queue root:

```
2026-09-21T09:59Z  rev-2040-ready.md   PR #2040  feat(web): SLICE 17 S2 — swap final AdminOnly
                                                 route guard for company.manage
2026-09-21T10:05Z  rev-2042-ready.md   PR #2042  feat(client-quotes): scopecards S4b — push panel
                                                 + diff + grouped Cost Summary (QUOTE_PUSH_PANEL_V1)
```

**These are NOT an ARM-ONE-AT-A-TIME violation and must not be reported as one.** I opened both
before judging them. Each begins *"Use the pr-fix-reviewer agent to review PR #N ... Auto-fired by
the PR-watcher"* — they are watcher-generated **review** prompts of the `rev-<PR>` species, which
the watcher writes itself and which are gitignored. The arming rule governs `git mv` of a tracked
`pr-*-HOLD.md` to `-ready.md`, a different species entirely. Two concurrent `rev-` prompts is the
watcher working normally. `.git/FETCH_HEAD` at 10:04Z corroborates: something fetched five minutes
ago, consistent with the 10:05Z enqueue.

**[MEASURED] Two build prompts remain on HOLD, untouched by me.**
`pr-lintstation-contract-version-compare-HOLD.md` and `pr-permission-role-reconciler-HOLD.md`, both
mtime 2026-09-21T18:54 local. Arming either is precisely the mutation blindness forbids.

**[MEASURED] `needs-marco/` holds 62 escalation files.** Up from the 57 recorded on 2026-09-10 when
eleven were found dead. **I could not triage a single one**, because clearing a `[STALE]` row
requires `gh pr view <n> --json state,mergedAt` per file with a negative control (DOCTRINE §9.4
forbids trusting a LIST response's `merged` field), and I have no `gh`. See F3.

**[CANNOT MEASURE] Everything the board verdict actually rests on.** `status-sweep.ps1` (PowerShell
only), open PR list, check status, labels, `do-not-merge` state, RULE-2 verdicts, smoke exit codes.
**I deliberately did not substitute GitHub-side MCP reads for any of it.** The preflight forbids it
in terms, and the reason is sound: `origin/main` is not the tree the watcher globs, and a
GitHub-shaped board report from a blind run is worse than no report because it reads as coverage.

## WHAT CHANGED

**Nothing.** No arm, no dispatch, no merge, no label, no file moved, no branch touched, no `git`
invoked against the mount. The only write this run performed is this breadcrumb.

## FINDINGS

**F1 — Desktop Commander `CONNECT_TIMEOUT` blinded this run; it is now 3 of the last ~7 Station 00
runs.** The queue's own breadcrumb names record blind runs at **0410** ("desktop-commander connect
timeout no windows execution so i mutated nothing"), **0710** ("desktop-commander connect timeout no
windows shell"), and now **1009**. The station doc calls blindness "intermittent" with cause "not
known" — these three timestamps are evidence toward a rate, and roughly 40% matches the figure the
bootstrap already carries. The transport is timing out at a flat 30 000 ms, which reads more like a
handshake never completing than a slow machine. **What I did not do is guess at the cause** — I have
no host access to inspect the MCP process, which is the same access I am missing.
**DISPOSITION: ESCALATED** — Marco, this is now frequent enough to be the pipeline's largest single
source of lost supervisor cycles, and no station can fix it from inside a blind run. RULE 1 says
lean to what solves it completely and additively. **Option A (complete + additive, my
recommendation):** give Station 00 a non-Desktop-Commander execution path on the host — a tiny
always-running local agent, or a scheduled PowerShell runner that the station drops a request file
for and reads a result file back from through the existing mount. The mount demonstrably survives
when the MCP transport does not — every measurement in this report came through it — so this
removes the single point of failure without touching how any station reasons. **Option B (complete,
NOT additive):** debug and repair the Desktop Commander transport itself. If it fixes the root cause
it is cleaner, but it is unbounded work on an unknown cause and it leaves the pipeline with one
transport and no fallback, so a recurrence blinds us again. **Option C (additive, NOT complete):**
have blind runs auto-retry the load a few times before stopping. Cheap, and it would rescue a
transient handshake, but it does nothing for a transport that is down for minutes. Which do you
want?

**F2 — The dev tree working copy is behind `origin/main`, so I read my own binding instructions
unverified.** `main @ 76ed975a` in `C:\ProjectOperations2` against `origin/main` pinned at
`08ff8b3d`. The preflight is explicit that all three binding documents must be read via
`git show origin/main:<path>` and **never** from the working copy, because the tree is routinely
several commits behind and `station_doc_version` cannot catch a content correction. I had no git, so
I read the working copy — the exact failure that served two stations superseded instructions on
2026-08-29. My version match is therefore **not** a freshness proof, and every rule I applied this
run should be treated as "as of 76ed975a". The saving grace is that I performed no mutation, so a
superseded rule could not have been executed against the board.
**DISPOSITION: DEFERRED** — real, and inseparable from F1 rather than independently fixable: with
host execution restored the prescribed `git show` works and this evaporates. What would make it
urgent on its own is a blind run that mutates anything, or evidence that `76ed975a..08ff8b3d`
touches `docs/pipeline/`. I could not diff those two commits — that needs git.

**F3 — `needs-marco/` has grown to 62 files and no run has been able to triage it today.** The
2026-09-10 measurement found 11 of 57 dead — escalations whose PR had already merged, surviving
because the standing hand-over was addressed to Station 03, which is report-only and cannot execute
it. The queue is now 62. I cannot tell how many of today's are dead, because per-file
`gh pr view --json state,mergedAt` with a negative control is the only sound test and I have no
`gh`. A dead escalation is not harmless: it is a question in Marco's queue that has already been
answered, and eleven of them once taught the pipeline to distrust the whole queue.
**DISPOSITION: DISPATCHED** — to the **next sighted Station 00 run**, as an explicit COLLECT-phase
obligation: before any arming, walk `needs-marco/` per-file, re-ask each named PR individually,
confirm nothing GENERAL survives the merged PR, and move the dead ones out. I am naming Station 00
and not Station 03 deliberately — the 09-10 incident is precisely a dispatch to a station that
lacked the authority to act, and repeating it would be a dispatch to nobody.

**F4 — The board itself shows no distress, and that is a real finding, not an absence of one.**
Every independent health signal I could reach is green: freshness CLEAN with all four cadenced
stations inside their windows, 12 breadcrumbs structurally valid and 0 malformed, no `index.lock`,
no interrupted merge or rebase, the watcher fetching and enqueuing minutes before I finished. The
defect is confined to **my** execution transport. I state this positively because the doctrine's
sharpest warning is that a blind run and a healthy quiet run produce identical "no news" — here the
evidence happens to distinguish them, and saying so is more useful than blanket uncertainty.
**DISPOSITION: ACTIONED** — verified by the four independent read-only measurements quoted in full
under WHAT I MEASURED, each with its command and output. No further action; recorded so the next run
can tell this run's quiet from a frozen board.

## WHAT I DID NOT DO

- **Did not substitute GitHub MCP reads for the sweep.** The GitHub tools were available and it
  would have been easy to produce a confident-looking PR table. The preflight forbids exactly this,
  because `origin/main` is not the tree the watcher globs and the result reads as coverage it is not.
- **Did not arm either HOLD prompt**, did not touch `rev-2040-ready.md` or `rev-2042-ready.md`.
  Arming is a mutation and requires a `git mv` I could not perform soundly.
- **Did not merge, label, or unlabel anything.** No watcher-routed PR was touched; no `do-not-merge`
  label was removed. I never reached a position to consider it.
- **Did not run `git` against the mount**, by hand or otherwise. The guard was installed and would
  have refused, but the guard is a backstop, not a licence — DOCTRINE §9.2.
- **Did not clear any `needs-marco/` file on a tag alone.** Sound clearing needs per-PR `gh`
  confirmation with a negative control; guessing would put dead and live escalations in one bucket.
- **Did not touch `/sot/`.** Station 05 owns it.
- **Did not touch Azure, Entra or SharePoint.** Absolute, and nothing this run needed them.
- **Did not improvise station behaviour from the bootstrap.** It does not contain it, and it says so.

---

**Collection note for the next Station 00 run:** this breadcrumb is **untracked** in
`C:\ProjectOperations2\docs\pr-prompts\` — I had no git to commit it. Its filename begins `00-` and
so matches no watcher glob; it arms nothing. Please sweep it into the next board PR. **F3 is an
obligation on you, not a note.**
