# Station 00 — Supervisor | 2026-09-24T23:15Z–2026-09-24T23:20Z

**BLIND RUN. NO WINDOWS-HOST SHELL. Preflight step 1 failed after a successful tool load, so this
run STOPPED at the contract's stop clause and did NOT collect, arm, dispatch or merge anything.**
A blind run and a healthy quiet run both produce "no news" — this one was blind.

## GROUND

```
UTC            2026-09-24T23:15:48Z   (local date on the box: 2026-09-25)
origin/main    [CANNOT MEASURE] — no shell, so no `git fetch` + `git rev-parse`.
               Dev tree's remote-tracking ref, read as a FILE, was d8eea113 at its last fetch.
dev tree       main @ d8eea113  C:\ProjectOperations2   (from .git/HEAD + .git/refs/heads/main)
doc version    1   (station_doc_version, docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — no version-mismatch read-only clamp. Moot this run: the stop
clause already forbids mutation.

⚠️ The two SHAs above were obtained by reading ref files directly, **not** by invoking `git`. They
are the tree's own last-known state, not a live answer, and `origin/main` may have moved since that
tree last fetched. They are stamped here only so the report is not blank; they are **not** coverage.

## WHAT I MEASURED

**1. Windows-host shell — the one thing step 1 requires. [MEASURED] ABSENT.**

Schema load was attempted FIRST and repeatedly, per the preflight's own warning that a validation
error is not blindness, and by keyword (`desktop-commander`) rather than by hard-coded id, per the
warning that the ids are environment-specific:

```
ToolSearch "select:mcp__desktop-commander__start_process,…" -> No matching deferred tools found.
                                                               (server listed as STILL CONNECTING)
ToolSearch "desktop-commander" (keyword, max 30)            -> No matching deferred tools found.
                                                               (server listed as STILL CONNECTING)
ToolSearch "start_process powershell shell windows host"     -> returned 8 unrelated tools
                                                               (Microsoft Learn, Chrome, Shopify,
                                                               computer-use). No start_process.
```

The session then reported the server as failed, not pending:

```
plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

That is a failure **after** the load was attempted, and a server-level connect failure rather than
an `InputValidationError`. Both tests the preflight sets for real blindness are met. There is no
`start_process`, so there is no PowerShell on the Windows host, so there is no
`status-sweep.ps1`, no `pipeline-lib.ps1`, no `gh`, no `check-breadcrumb.mjs`, and no `git`.

**2. `mcp__computer-use__*` IS present and is NOT a substitute. [MEASURED] — record this, because
the next blind run will be tempted by it.** The computer-use toolkit loaded fine and its
`request_access` schema lists `Windows PowerShell`, `PowerShell 7 (x64)`, `Terminal`, `Command
Prompt` and `Git Bash` among installed apps. It still cannot give a station a shell, for two
independent reasons, either of which alone is fatal:

- Terminals and IDEs are granted at tier **"click"** — visible and left-clickable, but `type`,
  key presses and right-click are **blocked** by the frontmost-app check. A shell you cannot type
  into is not a shell.
- `request_access` raises an approval dialog that a human must accept. **Marco is not present in a
  scheduled run**, so the grant cannot be obtained.

Driving a terminal by pixels would also be a §7 instrument of the worst kind — unverifiable output
read off a screenshot. **Do not attempt this route on a future blind run.**

**3. Device-bridge git guard — installed, INERT, exit 2. [MEASURED]**

Run at the top of the run, before any other VM-side call, and its own exit code read (not a
pipeline's):

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"; echo "GUARD_EXIT=$?"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
GUARD_EXIT=2
```

Exit 2 is the row the contract's three-outcome table calls **the expected outcome for a station**:
the shim is byte-correct and off `PATH` because the shell a station is given is non-interactive and
non-login, so it sources neither `~/.bashrc` nor `~/.profile`. A FINDING, not a STOP. The
consequence was obeyed: **no `git` was invoked against the mount at any point this run.** The ref
values in GROUND are `cat` of ref files, which takes no lock and cannot create `index.lock`.

**4. Dev tree is not wedged. [MEASURED] — pure file reads, no `git` invoked.**

```
.git/index.lock        NO index.lock present
MERGE_HEAD             absent
REBASE_HEAD            absent
CHERRY_PICK_HEAD       absent
rebase-merge/          absent
rebase-apply/          absent
sequencer/             absent
.git/refs/heads/main            d8eea113b7482c0a1c0e870b98d0779cb52a509e
.git/refs/remotes/origin/main   d8eea113b7482c0a1c0e870b98d0779cb52a509e
```

No stale lock and no abandoned merge state in `C:\ProjectOperations2`. Local `main` and the tree's
`origin/main` tracking ref point at the same commit, so **no NO-DRIFT local-ahead condition is
visible** — [INFERRED], because ref equality is not `git rev-list --left-right --count`, and the
tracking ref is only as fresh as that tree's last fetch.

**5. A NEW instrument lie, found incidentally and not yet in DOCTRINE §9. [MEASURED]**
`.git/packed-refs` and the loose ref disagree about `origin/main` in this tree:

```
.git/refs/remotes/origin/main   d8eea113…   <- loose ref. This is the live answer.
.git/packed-refs                66194af6…   <- STALE. Silently wrong.
```

Loose refs shadow `packed-refs`; git resolves the loose one. A station reading `packed-refs` to
avoid invoking `git` — exactly what a blind run is pushed toward, and exactly what this run did —
gets a well-formed 40-hex SHA that is simply **wrong**, with no error, no emptiness, and therefore
no §9.6 trigger. Two plausible SHAs, no warning, and the stale one is the easier file to find.

**6. Watcher, board, queue and breadcrumb channel. [CANNOT MEASURE] — all of it.**
No process check (needs a host shell), no `gh pr list`, no `status-sweep.ps1`, no
`check-breadcrumb.mjs --freshness`, no `restart-watcher-if-wedged.ps1`. **Nothing below the GROUND
block above should be read as saying the board or the watcher is healthy.** They were not looked at.

## WHAT CHANGED

**Nothing on the board, in the queue, in git, or on GitHub.** No prompt armed, no label touched, no
PR merged or opened, no file committed, no breadcrumb archived, no `needs-marco/` file discharged,
no process started or killed.

One file written: this breadcrumb, at `docs/pr-prompts/00-00-supervisor-2026-09-24-2315-blind-no-windows-shell.md`
in the dev tree. It is **UNTRACKED** — it needs `scripts/pipeline/sweep-breadcrumbs.ps1` (or the next
board PR) to reach `main`. Written to the dev tree rather than the Cowork session's `outputs` folder
deliberately: a run on 2026-09-22 wrote a complete blind-run report to `outputs` and it reached
nobody.

⚠️ `check-breadcrumb.mjs` has **not** been run against this file — there is no shell to run it in.
Do not read "breadcrumb-clean" anywhere in this report, because it is not claimed.

## FINDINGS

**F1 — Station 00 was blind: no Windows-host shell, cause unknown, and this is recurring.**
Desktop Commander timed out at 30 s after three honest load attempts (§WHAT I MEASURED 1). The
station doc already records blindness at roughly 40% of recent Station 00 runs with **cause not
known**, which is the actual defect here — a supervisor that silently loses 4-in-10 occurrences is
not supervising. Every instrument this station needs sits behind that one MCP server, so the failure
mode is total rather than partial, and it is indistinguishable from a quiet healthy board to anyone
reading only the chat.

Marco — one decision, two options. Complete-and-additive first, per RULE 1:

- **(a) Make the shell route redundant, then measure the rate.** Add a second, independent path to
  the Windows box that does not depend on the Desktop Commander MCP handshake (a small always-on
  local HTTP/named-pipe command endpoint the station can call, or a host-side agent that executes a
  signed command file dropped in a watched folder), **and** have the station log every run's shell
  outcome to a tracked file so the blindness rate stops being folklore. Solves it immediately
  (a blind run gets a working fallback) and in future (the rate becomes measurable, so the root
  cause becomes findable), and adds nothing destructive — no existing path changes, no data written.
  Passes both halves of RULE 1.
- **(b) Raise the Desktop Commander connect timeout and retry on the station side.** Cheap, one
  config change. Fails the *future* half of RULE 1: it is a guess at the cause. If the timeout is a
  symptom of the desktop app's MCP host not being up when cron fires, a longer timeout changes
  nothing and we learn nothing, because there is still no log.

I cannot investigate either from here — diagnosing why a local MCP server on Marco's desktop fails
to hand out a shell requires that desktop, which is the very thing this run could not reach.

**DISPOSITION: ESCALATED**

**F2 — `vm-git-guard` reports INSTALLED BUT INERT (exit 2); the device-bridge git ban is
remembered, not mechanical.** Measured this run, matching the contract's documented expected
outcome. The installer writes its `PATH` export to `~/.bashrc` / `~/.profile`; a station's shell is
non-interactive and non-login and sources neither. DOCTRINE §9.2 records this class of ban failing
seven times when it depended on memory. No action available from a blind run, and none needed this
run — no `git` was invoked against the mount.

What would make it urgent: the next 0-byte `index.lock` with no owning Windows process. The durable
fix is for the installer to write the export somewhere a non-login shell actually reads (e.g. have
the station's shell invocation itself carry `PATH=…/.local/bin:$PATH`, or ship a `BASH_ENV`), which
is a repo change needing a shell to test.

**DISPOSITION: DEFERRED**

**F3 — `.git/packed-refs` silently serves a stale `origin/main` that no instrument flags.**
Measured this run: `packed-refs` says `66194af6`, the loose ref says `d8eea113`, git honours the
loose one. This is a §9-class instrument lie in the same family as the already-documented
`git show | git hash-object --stdin` trap and the `local_*` glob rename: a well-formed plausible
answer, exit 0, nothing empty, so §9.6 does not fire. It is newly dangerous **because** of F1 — a
blind station avoiding `git` against the mount is pushed toward reading ref files, and `packed-refs`
is the more discoverable of the two. The cure is one line: **read the loose ref first and treat
`packed-refs` as a fallback only when no loose ref exists.**

Handing over: **Station 05 — SoT Keeper**, to record the lesson in `sot/05-decisions-and-lessons.md`
via a doc-reconcile PR (I may not edit `/sot/`, and CI gate CP-24 hard-fails any PR mixing code and
`sot/`). The companion `DOCTRINE.md` §9 entry lives under `docs/`, not `sot/`, so it belongs to
whichever station next holds a shell — it must be a **separate** PR from the `sot/` one.

**DISPOSITION: DISPATCHED**

**F4 — This hour's COLLECT did not happen, so the breadcrumb channel did not close.**
Station 00 is the only reader of 03/04/05's breadcrumbs, and the only actor that dispositions their
findings, clears `[STALE]` section-5 escalation rows, and archives what it has dispositioned. None
of that ran. At an hourly cadence one missed COLLECT is small; the harm is cumulative, and the
`[STALE]` rows have historically survived ten days precisely by nobody clearing them.

What would make it urgent: two or more consecutive blind Station 00 runs, or any `04`/`05`
breadcrumb going past twice its cadence with nobody to disposition it. The next 00 run with a shell
must collect **this** breadcrumb plus everything since the last healthy run, not just the current
hour's.

**DISPOSITION: DEFERRED**

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for the local tree.** The GitHub MCP is present and
  read-only, and `origin/main` is not the tree the watcher globs. Presenting a `gh`-shaped board
  read as this run's coverage is the specific failure the stop clause names, so no board read was
  performed or reported.
- **Did not drive a terminal via computer-use.** Blocked at tier "click", needs a human grant Marco
  is not present to give, and unverifiable by construction (§WHAT I MEASURED 2).
- **Did not run `git` against the mounted folder** in any form — not `status`, not `fetch`, not
  `rev-parse`. The guard is inert (F2), so the ban was honoured by hand. Ref values came from `cat`.
- **Did not COLLECT, disposition, archive, or clear `[STALE]` rows** — F4. Requires
  `check-breadcrumb.mjs`, `status-sweep.ps1` and per-PR `gh pr view`, none of which exist here.
- **Did not arm, dispatch, merge, or open anything.** The stop clause forbids it and I could not
  verify a single gate LIVE, which forbids it independently.
- **Did not check the watcher, or restart anything.** No process visibility; a relaunch decision made
  blind is exactly the false-`wrapper=0` relaunch the station doc warns starts a second supervisor
  family against a healthy machine.
- **Did not touch Azure, Entra, or SharePoint.** Absolute, and nothing this run came near them.
- **Did not run `check-breadcrumb.mjs` on this file.** No shell. Its shape follows the v5 contract
  by hand; it is unvalidated and says so.
