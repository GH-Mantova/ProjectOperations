# Station 00 — Supervisor | 2026-09-23T01:15Z–2026-09-23T01:22Z

## GROUND

```
UTC            2026-09-23T01:15:52Z
origin/main    d8e5e06              (⚠️ NOT fetched this run — see WHAT I MEASURED)
dev tree       main @ d8e5e06       C:\ProjectOperations2
doc version    1                    (sot station doc frontmatter, read from dev tree)
bootstrap      1                    (scheduled-task SKILL.md station_doc_version)
```

**doc version and bootstrap AGREE (1 == 1).** No version-mismatch read-only downgrade on that
account. The run is nonetheless read-only, for the reason in FINDING 1.

⚠️ **Both SHAs above were read as FILE BYTES out of `.git/refs/`, not from `git rev-parse`,** and no
`git fetch` ran. `origin/main` is therefore the value some *earlier* actor last fetched into this
tree, not a live answer. It happens to equal the local branch tip, which is consistent with a clean
tree but proves nothing about GitHub — an unfetched remote-tracking ref matching local `main` is
exactly what you would also see if `main` had moved five commits ago. **Do not read the matching
SHAs as `0 0` ahead/behind.**

## WHAT I MEASURED

**[MEASURED] Desktop Commander did not connect. There is no shell on the Windows host this run.**

Per the contract, the load was attempted FIRST and a validation error was not treated as blindness.
Three separate `ToolSearch` calls were issued (`select:` by full id, then keyword `desktop-commander`,
then keyword `start_process powershell shell terminal interact process`). The first two returned **no
desktop-commander tool of any id**; the third returned only unrelated tools (Chrome, PDF viewer,
computer-use, Shopify). The MCP layer then reported the cause directly:

```
plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

This is the contract's blindness condition, not the unloaded-schema false alarm it warns about: the
server itself timed out, so no `start_process` exists to call at any id. `powershell.exe` was never
reachable.

**[MEASURED] vm-git-guard: exit 2 — INSTALLED BUT INERT.** Quoted verbatim, last line and exit code:

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
  bash -lc 'command -v git' -> /sessions/<session>/.local/bin/git   (login shell: the shim)
  bash -c  'command -v git' -> /usr/bin/git                          (station's shell: real git)
...
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/<session>/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

The exit code is the **installer's own**, not a pipeline's — nothing was piped into `tail` or
`Select-Object`. Exit 2 is the expected station outcome per the contract table: a FINDING, carry on.
The practical consequence stands and was obeyed — **the device-bridge git ban was REMEMBERED, not
mechanical, and no `git` was run against the mount this run.**

**[MEASURED] The dev tree is readable, and it is quiet.** File-level reads (no `git` invocation) of
`C:\ProjectOperations2`:

- `.git/HEAD` → `ref: refs/heads/main`
- `.git/refs/heads/main` → `d8e5e06ac5c21e477499ca81a7e693321186de4a`
- `.git/refs/remotes/origin/main` → `d8e5e06ac5c21e477499ca81a7e693321186de4a`
- `.git/index.lock` → **absent** (`ls: cannot access '.git/index.lock': No such file or directory`)
- no `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / rebase-merge / rebase-apply / sequencer

No stale-lock escalation is open. ⚠️ This is a *file* reading, not a `status-sweep.ps1` verdict, and
it says nothing about the watcher, the queue, or the board.

**[MEASURED] Own cadence, from `list_scheduled_tasks` — not from any pasted number.**
`00-supervisor` → `cronExpression: "5 * * * *"`, hourly, `enabled: true`,
`lastRunAt: 2026-09-23T01:14:49Z` (this run), `nextRunAt: 2026-09-23T02:13:52Z`. This **confirms**
the bootstrap's own last-measured claim of hourly (measured 2026-09-22); the stale "every 2 hours"
line is not back.

Other stations, `lastRunAt` only — recorded as raw instrument readings, **deliberately not
dispositioned**, because the breadcrumb side of the cross-check could not be run (below):

| station | cadence | lastRunAt | vs now (01:15Z) |
|---|---|---|---|
| `04-scanner` | `0 */4 * * *` | 2026-09-22T22:10:01Z | 3.1 h — inside one cadence |
| `05-sot-keeper` | `10 0 * * *` | 2026-09-22T14:23:04Z | 10.9 h — inside one cadence |
| `03-machine-minder` | `0 9 * * *` | 2026-09-22T23:28:57Z | 1.8 h — inside one cadence |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | **`enabled: false`** |

**[CANNOT MEASURE] `check-breadcrumb.mjs --freshness` was NOT run, and no SILENT verdict exists for
this run.** `node` is present in the bridge VM (`v22.23.2`), so the script would *start* — but it
builds its tracked set with `git ls-tree -r`, which is `git` against the mounted folder. With the
guard INERT that call would reach the real `/usr/bin/git` and risk the 0-byte `index.lock` that
DOCTRINE §9.2 records as freezing every station. Running it under the shim's one-call `PATH` form
does not help either: the shim would refuse the child `git`, so the script fails rather than
answering. **It was therefore not run in either form.** The `lastRunAt` table above is consequently
ONE instrument with no second — and the contract is explicit that `lastRunAt` alone cannot tell
"ran and reported" from "ran and reported nothing" from "fired and died on a 529 before STEP 1". All
three read identically here. **Nothing above should be read as an all-clear for 03/04/05.**

**[CANNOT MEASURE] Everything Station 00 actually exists to do.** No host shell means no
`status-sweep.ps1`, no `bring-up-to-speed.ps1`, no `pipeline-lib.ps1`, no `gh` (board state, PR
checks, job logs), no `watcher-loop-check.ps1` / `restart-watcher-if-wedged.ps1`, no `arm-prompt.ps1`,
no `smoke-pr.ps1`, no `Assert-SmokedOrEscalate` / `Merge-Pr`. **The board and the watcher were not
observed at all this run.**

## WHAT CHANGED

**Nothing on the board, nothing in the queue, nothing in git, nothing on GitHub.**

Two writes, both outside those:

1. `vm-git-guard.sh` appended its `PATH` export to the bridge VM's `~/.bashrc` and `~/.profile`.
   That is the installer's own idempotent behaviour, inside the disposable VM, and it does not touch
   the Windows box.
2. This breadcrumb, written to the **dev tree** at
   `C:\ProjectOperations2\docs\pr-prompts\00-00-supervisor-2026-09-23-0115-blind-no-host-shell.md`.
   It is **untracked** — it needs `sweep-breadcrumbs.ps1` (or the next board PR) to reach `main`.

⚠️ **This breadcrumb is a fresh path and does not exist on `origin/main`, so it does not block the
next fast-forward today.** It will begin to once a PR lands this exact path — whoever sweeps it
should expect the contract's untracked-file-blocks-ff case and use the byte-exact restore, never
`git checkout --` and never `git clean`.

## FINDINGS

**FINDING 1 — Station 00 was BLIND this run: Desktop Commander timed out, so there was no shell on
the Windows host.**
This is the loud half of the contract's "a blind run and a healthy quiet run both produce no news".
This run produced no news because it could not look, **not** because the board is calm. The board,
the watcher, the prompt queue, the PR checks and every station breadcrumb were all unobserved. The
cause is not diagnosable from inside a session that cannot reach the box, and the contract records
this blindness as intermittent (roughly 40% of recent Station 00 runs) with an unknown cause — so
this occurrence is consistent with the standing condition rather than evidence of a new fault.
Mitigating: the next occurrence is hourly (`nextRunAt: 2026-09-23T02:13:52Z`), and blindness has not
been observed to persist across consecutive runs as a rule.
**DISPOSITION: ESCALATED** — see `## FOR MARCO`.

**FINDING 2 — `vm-git-guard` reported INERT (exit 2), so the device-bridge git ban was remembered,
not enforced.**
Expected per the contract's three-outcome table and not a defect in itself; recorded because an
install nobody can see in the report is indistinguishable from one that never ran. It is reported
rather than actioned because the fix is structural — the station's shell is non-interactive and
non-login, so it sources neither file the installer writes to — and changing that is not this run's
scope. It bit nothing this run: no `git` was run against the mount.
**DISPOSITION: DEFERRED** — it becomes urgent the first time a station reports exit 2 *and* a
0-byte `index.lock` with no owning process in the same run, which would mean the remembered ban had
finally been forgotten by someone.

**FINDING 3 — COLLECT did not happen. No breadcrumb was gathered and no finding but my own was
dispositioned this run.**
COLLECT is Station 00's job and the only channel that closes for 03/04/05 — and it is the part of
the lane that blindness removes silently, because a Station 00 run that reports *something* looks
like a Station 00 run that worked. Any finding another station wrote since the last successful
COLLECT is still outstanding and is now at least one 00-cadence older than its author believes.
**DISPOSITION: DEFERRED** — the next sighted Station 00 run must COLLECT across a window reaching
back past this run, not just since `lastRunAt`, or this hour's breadcrumbs fall in the gap between
"already collected" and "too old to look at".

## WHAT I DID NOT DO

- **I did not substitute GitHub-side reads for tree coverage.** The GitHub MCP is available in this
  session and was deliberately not called for board state. `origin/main` is not the tree the watcher
  globs, and the contract names presenting it as coverage as the specific failure to avoid. The
  board is reported as unobserved, which is what it is.
- **I did not run any `git` against the mounted folder** — not `fetch`, not `rev-parse`, not
  `ls-tree`, not `status`. With the guard INERT the ban was mine to keep, and I kept it. The two
  SHAs in GROUND are file reads and are labelled as such.
- **I did not run `check-breadcrumb.mjs --freshness`**, in either the plain or the shimmed form, for
  the reason under WHAT I MEASURED. **No station is called SILENT by this run, and no station is
  called healthy either.**
- **I did not arm, dispatch, merge, label, restart, or clear anything.** All of it needs the host
  shell, and every one of those is a board mutation that the contract requires a re-measured `[LIVE]`
  verdict immediately beforehand — which is precisely what was unavailable.
- **I did not clear any `[STALE]` `needs-marco/` escalation rows.** That requires `status-sweep.ps1`
  section 5 plus a per-PR `gh pr view`, both out of reach. Eleven such rows were live as of the
  2026-09-10 measurement recorded in the station doc; whether any remain is unknown this run.
- **I did not archive collected breadcrumbs**, since none were collected.
- **I did not validate this breadcrumb with `check-breadcrumb.mjs`.** The word `breadcrumb-clean`
  therefore does not appear in this report, and the five-section shape below is hand-matched against
  the contract, not certified. A `lint-prompt.mjs` result would not have been evidence either way.

## FOR MARCO

**One question, one decision — the rest of this run needs nothing from you.**

Station 00 has now been intermittently unable to reach your Windows box for weeks (~40% of recent
runs by the station doc's own measurement), and the cause has never been identified because the only
sessions that could diagnose it are the ones that can already reach the box. Tonight it was Desktop
Commander timing out after 30 s. Every blind hour is an hour where the board is unwatched and every
other station's findings go uncollected, and **it is invisible from the outside — a blind run and a
quiet board produce the same silence.**

RULE 1 says lean to what solves this completely, now and in future, without damaging existing or
future data entry. In that order:

1. **Make the blindness itself alarm — complete and additive.** Have the station emit a distinct
   machine-readable marker on the blind path (it already writes a breadcrumb), and have something
   you actually see — the sweep, or a cheap scheduled check — raise it when two consecutive
   `00-supervisor` occurrences produce a blind breadcrumb or no breadcrumb at all. This adds a
   signal and removes nothing; it does not fix the timeout, but it converts an invisible failure
   into a visible one, which is the half that is currently costing you. It also finally answers the
   "is the cause intermittent or drifting worse?" question with data instead of anecdote.
2. **Diagnose the Desktop Commander timeout directly** — from an interactive session on the box,
   while it is failing. Complete if it finds the cause; fails the *future* half if the cause turns
   out to be environmental and recurs under a new name, and fails the *immediate* half on its own
   because it needs you present and the failure is intermittent, so you may not catch it in the act.
3. **Do nothing and rely on the hourly retry.** Additive (nothing breaks) but not complete: it has
   been the de facto policy for weeks, and the gap it leaves is exactly the uncollected-findings
   hole in FINDING 3.

My recommendation is **1 now, 2 when you next have the box in front of you.** 1 needs no decision
from you beyond a yes, and it is the one that stops the failure mode being silent. I did not start
it this run because building the alarm is a board change, and a blind run is the wrong run to make
one from.
