# Station 04 — Scanner | 2026-09-23T10:10:42Z–2026-09-23T10:13Z

**BLIND RUN. Desktop Commander did not connect. No sweep was run. Nothing was staged, armed, or
advanced.** This is the STEP 1 stop, not a healthy quiet run — read FINDINGS F1 before you read
anything else.

## GROUND

```
UTC            2026-09-23T10:10:42Z
origin/main    85d85b54    (see provenance note below — NOT from `git rev-parse`)
dev tree       main @ 85d85b54  C:\ProjectOperations2
doc version    1           (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1           (station_doc_version declared in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (1 == 1). The read-only posture of this run comes from the
blindness stop, not from a version mismatch.

🔴 **PROVENANCE NOTE ON THE TWO SHA LINES — read before trusting them.** The preflight tells you to
`git fetch` then `git rev-parse`. **I could not run git at all** (F1, F2), so neither SHA came from
git. Both came from two independent non-git sources that agree:

- `cat .git/refs/heads/main` and `cat .git/refs/remotes/origin/main` — **plain file reads of the ref
  files; no git process was started.** Both returned `85d85b542bfe6c701ce6709b56398622322fc8e7`.
- GitHub REST via the read-only connector (`list_commits main perPage 1`) →
  `85d85b542bfe6c701ce6709b56398622322fc8e7`, authored 2026-09-23T09:25:04Z, *"docs(pr-prompts):
  station 00 collect - #2114 parked on Marco, nothing armable, coverage intact (#2117)"*.

These agree, so the dev tree's `origin/main` ref is **not** stale in the way §110-119 of the station
doc warns about. **But a ref file is not a working-tree state.** `refs/heads/main` tells you what
commit `main` points at; it tells you **nothing** about whether the working tree is dirty, whether
files are modified or deleted, or whether the index is clean — and those are exactly the readings
`git status --porcelain` exists to provide (station doc §217: *"The first three pass on a dirty
tree; only the fourth catches it"*). **This run has no clean-tree reading of any kind.** Do not read
the `dev tree` line above as "the dev tree is clean."

## WHAT I MEASURED

**[MEASURED] Desktop Commander is unreachable. Three load attempts, three query forms, then an
explicit server-level timeout.**

The preflight is emphatic that a cold-call `InputValidationError` is an unloaded schema and **not**
blindness, and that declaring blindness without loading first is a §7 instrument lie in the one step
every run begins with. So I did not declare on the first miss. I loaded, three ways:

1. `ToolSearch { query: "desktop-commander", max_results: 30 }` → `No matching deferred tools
   found. Some MCP servers are still connecting: plugin:desktop-commander:desktop-commander. Their
   tools will become available shortly — try searching again.` — **This is the ambiguous answer the
   preflight warns about; I did not act on it.**
2. `ToolSearch { query: "desktop commander terminal process file read write", max_results: 30 }` →
   returned a full page of unrelated tools (Drive, GitHub, Chrome, pdf-viewer). The search ran and
   resolved; **no Desktop Commander tool was among them.**
3. `ToolSearch { query: "select:mcp__plugin_desktop-commander_desktop-commander__start_process,
   mcp__desktop-commander__start_process, ...__interact_with_process, ...__read_file" }` → `No
   matching deferred tools found.`

The third call returned the server's own verdict, which settles it:

```
plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

**This is a failure AFTER the load, which the contract defines as blindness.** Per the station doc's
own rule I note it was *not* inferred from the scheduled-task listing, from the task name, or from a
quiet result — the listing predicted nothing here, exactly as `STATION-CAPABILITIES.md` §2 says it
would not.

**[MEASURED] `vm-git-guard.sh` → exit 2, INSTALLED BUT INERT.** Run at the top of the run, exit code
read off the installer itself and **not** off a pipeline appended to it (the trap that recorded a
false `0` twice on 2026-09-22):

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"; echo "GUARD_EXIT=$?"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
  bash -lc 'command -v git' -> /sessions/zen-lucid-fermat/.local/bin/git   (LOGIN shell: the shim)
  bash -c  'command -v git' -> /usr/bin/git                                (the shell a STATION IS GIVEN)
GUARD_EXIT=2
```

Per the station doc's three-outcome table this is **the expected outcome for a station, not an
anomaly** — a FINDING, carry on. Recorded because an install nobody can see in the report is
indistinguishable from one that never ran. Its practical consequence for this run is F2.

**[MEASURED] No PowerShell anywhere I can reach.** `command -v pwsh` and `command -v powershell.exe`
in the VM both → `NO POWERSHELL`. With the device bridge down there is no Windows-host shell either.
**Every `.ps1` in my own script registry is therefore unrunnable this run:**
`status-sweep.ps1` (47140 bytes, present on disk — present is not runnable), `triage-holds.ps1`,
`check-all-drift.ps1`, `check-sot-encoding.ps1`. STEP 4 of the preflight requires a real sweep
verdict before any board action; **I have no verdict of any kind**, which is independently
disqualifying even setting F1 aside.

**[MEASURED] `node` v22.23.2 IS available in the VM — and that does not rescue the run.**
`check-backlog.mjs` executes each gate string as a subprocess:

```
scripts/pipeline/check-backlog.mjs:28   import { execSync } from "node:child_process";
scripts/pipeline/check-backlog.mjs:212  execSync(String(it.gate || "false"), { cwd: repoRoot, ... shell: BASH, ... });
```

The gates in `BACKLOG.yaml` are git commands, `cwd` is the repo root, and the repo root here is the
**mounted** folder. Running it would fire real `git` against the Windows `.git` through the device
bridge — the precise action the hard stops forbid and that DOCTRINE §9.2 records as having frozen
the board seven times. The guard being INERT (F2) means nothing would have stopped it. **I did not
run it.** `next-sweep.mjs` was checked the same way and shells out to nothing — see F4 for why I
still did not run its `--advance`.

**[MEASURED] Dev tree `.git` is free of stale-lock and in-progress-operation markers.** Plain
file-existence checks, no git invoked: `index.lock` → absent. `MERGE_HEAD`, `REBASE_HEAD`,
`CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` → none present. **Scope limit, stated plainly:
this rules out the DOCTRINE §9.2 frozen-lock condition. It does NOT establish a clean tree** — see
the GROUND provenance note.

**[MEASURED] No concurrent QA run.** `docs/qa/.qa-run.lock` → `No such file or directory`. The
concurrency guard's stand-down condition did not fire. **I did not claim the lock**, because
claiming a lock for a run that stops immediately would make the next run stand down for nothing.

**[MEASURED] Rotation state, read but deliberately NOT advanced.** `docs/pipeline/sweep-rotation.json`:
`last_index: 3` · `last_run_utc: "2026-09-23T06:10:31Z"` · `last_station: "04-scanner"`. Index 3 is
`instruction-drift`, so **this run's sweep would have been index 0, `gate-liveness`.** Two things
worth Station 00's attention: the 06:10:31Z stamp is exactly four hours before this run's 10:10:42Z
start, so **the 4-hour cadence is firing on time**; and the previous run's advance **is** present in
the working copy, i.e. it is sitting there uncommitted awaiting 00's collect, which is the designed
flow.

**[CANNOT MEASURE] Everything the sweep itself consists of.** No gate premise executed against a
named SHA; no board read; no queue read; no HOLD triage; no Part 0 static audit; no Part 1 GitHub
reconciliation; no Part 2 live-site or visual pass; no adversarial prompt critique. **I am not
reporting these as clean. I am reporting that I did not look.**

## WHAT CHANGED

**Nothing on the board, and nothing in the repo except this breadcrumb.**

- No prompt staged, armed, disarmed, renamed, moved or deleted.
- No PR opened, merged, labelled or commented. No `do-not-merge` label touched.
- No git command run, in any tree, by any route.
- `sweep-rotation.json` **NOT advanced** (F4).
- `docs/qa/.qa-run.lock` **not** created; no `docs/qa/` state file written.
- `vm-git-guard.sh` appended its `PATH` export to `~/.bashrc` / `~/.profile` **inside the disposable
  Linux VM only** — nothing on Marco's machine, nothing in the repo. Idempotent by design.
- This file, untracked, in the dev tree at `docs/pr-prompts/`. **Station 00 must commit it.**

## FINDINGS

**F1 — Desktop Commander timed out; Station 04 ran blind and executed no sweep. [MEASURED]**

Evidence above: three loads, three query forms, then `CONNECT_TIMEOUT ... after 30000ms` from the
server itself. Not inferred from the task listing. The consequence is total for this station's
purpose: no Windows-host shell, therefore no `status-sweep.ps1` verdict, therefore no sanctioned
board mutation is even theoretically available, and no git by any route.

Saying this as loudly as the contract asks: **a blind run and a healthy quiet run both produce "no
news," and this was the blind kind.** The board has had no Station 04 coverage in this 4-hour slot.
Nothing below should be read as "04 checked and found nothing."

Two notes on scope so 00 can calibrate rather than over-read this. First, blindness here was
**partial**, not total — see F3; I could read the tree but not act on it. Second, `STATION-CAPABILITIES.md`
§2 says blindness is intermittent (~40% of Station 00's recent runs) with **no known cause**, so this
is one data point in a known pattern, not evidence of a new break. It is the *fifth* thing below that
makes it worth Marco's time, not this occurrence on its own.

**DISPOSITION: ESCALATED.** Marco — the question, with options. RULE 1 order, complete-and-additive
first:

1. **Make the stations tolerant of a dead bridge, rather than chasing the bridge.** F3 shows the
   mount stays readable when Desktop Commander is down, and that a whole class of read-only work is
   still sound — it is *git* and *PowerShell* that are unavailable, not *sight*. A `git`-free,
   `pwsh`-free read-only sweep (Part 0 static audit is pure grep+read and needs neither) would turn
   ~40% of runs from zero-coverage into partial-coverage. **Solves it immediately and in future, and
   damages no data — it adds a capability and removes none.** Passes both halves of RULE 1. Cost: one
   station-doc PR plus a fallback path, and the honest risk that a half-capable run gets mistaken for
   a full one, which the GROUND block is already designed to prevent.
2. **Diagnose the 30s timeout itself** (is the DC process running on the host, is 30s simply too
   short for a cold start under a scheduled non-interactive session). Complete *if* the cause turns
   out to be fixable; **fails the "future" half if the cause stays unknown**, which §2 says it
   currently is. Best run *alongside* option 1, not instead of it.
3. **Accept it and do nothing.** Fails both halves — coverage keeps silently dropping in ~40% of
   slots, and the failure mode is invisible except in breadcrumbs like this one.

I cannot progress this myself: it is connector/environment state on your machine, outside every
lane this station has.

**F2 — `vm-git-guard` is INERT, so the device-bridge git ban is remembered, not mechanical. [MEASURED]**

Exit 2, output quoted above. The installer writes its `PATH` export to `~/.bashrc` / `~/.profile`;
the shell a station is given is non-interactive and non-login and sources neither, so `git` resolves
to `/usr/bin/git`. This reproduces the station doc's own table exactly and is the **expected**
outcome, not a regression — a FINDING, not a STOP, and I carried on.

Its bite this run was real rather than theoretical: it is the only thing standing between
`check-backlog.mjs` (which `execSync`s git gate strings with `cwd` = the mounted repo) and a 0-byte
`index.lock` with no owning process. I honoured the ban by not running it.

**DISPOSITION: DEFERRED.** Real, documented, and correctly described by the station doc as expected —
not now. **What would make it urgent:** an `index.lock` appearing in `C:\ProjectOperations2\.git`
with no git process behind it (absent this run — measured above), or any station's breadcrumb
reporting it ran a `.mjs` checker from the VM. The complete fix is for the installer to emit a
wrapper the station can `source` in a non-login shell, rather than relying on rc files a station
never reads; that is a repo change and belongs in a PR, which this station may not open.

**F3 — The mount stayed fully readable while the device bridge was down, and no binding document
covers that state. [MEASURED]**

Every read in this breadcrumb — the station doc, `DOCTRINE`-adjacent paths, `sweep-rotation.json`,
the `.git` ref and marker files, the script greps — was taken through the Cowork file tools and the
VM bash mount at `/sessions/zen-lucid-fermat/mnt/ProjectOperations2/`, **with Desktop Commander
already confirmed timed out.** Sight and action came apart cleanly.

This matters because of what the documents assume. The STEP 1 blindness paragraph contemplates
exactly one fallback and forbids it — *"Do NOT substitute GitHub-side reads and present them as
coverage — `origin/main` is not the tree the watcher globs."* The PROVENANCE section likewise frames
the Linux sandbox purely as the thing that *lacks* probes: *"Sanctioned liveness probes are
PowerShell on the Windows host and are reachable only while the desktop bridge is up."* **Neither
anticipates a readable mount.** So a station in this state is handed a binary — full run or blind
stop — when the truth is a third thing: *can see the tree the watcher globs, cannot run git or
PowerShell against it.*

Stating the limit precisely, so this is not misread as a licence: this does **not** make the run
non-blind, and I did not treat it as such. Ref files are not working-tree state; no `.ps1` runs; the
`.mjs` checkers shell out to banned git; and §7 says a partial read dressed as a sweep is the
classic instrument lie. **Stopping was still correct under the contract as written.** The finding is
that the contract could be written to get useful work out of this state instead of none — which is
the *substance* of F1's option 1, recorded separately here because it is a documentation defect that
outlives today's timeout.

**DISPOSITION: DISPATCHED — to Station 00**, which collects breadcrumbs and dispositions findings,
for routing to whoever owns the station-doc and `STATION-CAPABILITIES.md` change. Handing over: the
measurement above, the two quoted passages that need amending (STEP 1's blindness paragraph and
PROVENANCE's sandbox sentence), and the proposed third state — *bridge-down / mount-readable* — with
its concrete capability list: **available** = file reads, greps, `node`, GitHub read-only connector;
**unavailable** = git in any tree, all `.ps1`, every `.mjs` checker that shells to git. Instructions
live in the repo, so this must land as a PR; **Station 04 may not open one**, which is why it is
dispatched rather than actioned. `docs/pipeline/` is not `sot/`, so this needs no Station 05
involvement.

**F4 — The rotation was not advanced, and that is deliberate; `gate-liveness` is owed. [MEASURED]**

`sweep-rotation.json` still reads `last_index: 3` / `2026-09-23T06:10:31Z`. Index 0, `gate-liveness`,
was this run's sweep and **was not performed**.

The station doc is direct that skipping the advance means the next run repeats the sweep and the
rotation silently stops. That instruction presupposes the sweep *happened*. Advancing past a sweep I
never ran would have recorded false coverage in the one file whose entire purpose is to make coverage
honest — the same class of error as writing a finding into a gitignored sink and believing it
reported. **Not advancing costs one repeated slot; advancing falsely would hide a permanently skipped
`gate-liveness` sweep.** I took the cheaper error.

Worth flagging to 00: `gate-liveness` is the sweep that catches finished work still armed on the
board, and it is now **owed**. If the next run is also blind it will be owed again, with no signal
anywhere but these breadcrumbs — which is a second, quieter reason F1 deserves an answer.

**DISPOSITION: ACTIONED** — the decision is made and verified. Verification: re-read after the run's
writes, `last_index` is still `3` and `last_run_utc` still `2026-09-23T06:10:31Z`; the file is
byte-unchanged by me. The next Station 04 run will correctly draw `gate-liveness` with no
intervention. Station 00: the *previous* run's advance is still sitting uncommitted in the dev tree
and needs your collect — that is pre-existing, not something this run created.

## WHAT I DID NOT DO

- **Did not run any git command, in any tree, by any route** — DC down, guard INERT (F2), ban
  remembered. Both SHAs in GROUND came from plain ref-file reads and the GitHub API, labelled as such.
- **Did not run `check-backlog.mjs`, `check-escalations.mjs`, `check-lessons.mjs`, `lint-prompt.mjs`
  or `triage-holds.ps1`** — the `.mjs` ones `execSync` git gate strings against the mounted repo; the
  `.ps1` one needs a shell that does not exist here.
- **Did not run the `gate-liveness` sweep** it was my turn to run, and **did not advance the
  rotation** to pretend otherwise (F4).
- **Did not run Part 0's static audit.** Honest note: Part 0 is pure grep+read and is the one part I
  might have managed — that is precisely the observation F3 exists to raise. I did not do it because
  the contract's STEP 1 stop is unconditional on DC absence and says *end the run*, and a station that
  improvises past its own stop is the failure mode DOCTRINE §5 exists to prevent. **Changing that rule
  is Marco's call (F1) or a repo PR (F3) — not mine to assume mid-run.**
- **Did not run Part 1 or Part 2** — no GitHub reconciliation audit, no Dependabot check, no live-site
  regression or visual pass, no `GITHUB-AUDIT-MARKER` written.
- **Did not stage a prompt** (0 of the 2-per-run budget). Staging needs five-angle evidence and a
  lint-clean verdict from `lint-prompt.mjs`; I had neither.
- **Did not claim or write `docs/qa/.qa-run.lock`**, and wrote to no `docs/qa/` state file.
- **Did not mint a worktree** — forbidden; an orphan's lock has no holding process, by construction,
  forever.
- **Did not touch `sot/`** (Station 05's), source, `roadmap.md`, `progress.md`, or any Azure / Entra /
  SharePoint surface.
- **Did not write this report to the Cowork session's `outputs` folder.** It is in the dev tree at
  `docs/pr-prompts/`, untracked, per the REPORT CONTRACT. A blind run on 2026-09-22 wrote a complete
  report to `outputs` and it reached nobody; the whole value of this breadcrumb is that F1 gets seen.
- **Did not run `check-breadcrumb.mjs` against this file** — it is `node`-only and would likely run,
  but it was not worth a VM-side call on a run that has already stopped. **So this breadcrumb is
  NOT certified `breadcrumb-clean`**, and I am not claiming it is. It follows the five-section order
  by hand. Station 00: validate on collect.
