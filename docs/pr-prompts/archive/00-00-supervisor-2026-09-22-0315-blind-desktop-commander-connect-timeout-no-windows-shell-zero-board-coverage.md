# Station 00 — Supervisor | 2026-09-22T03:15Z–2026-09-22T03:20Z

**FIRST LINE: THIS RUN WAS BLIND. Desktop Commander failed to connect (`CONNECT_TIMEOUT` after
30000ms), so no shell was ever started on the Windows host. Zero board coverage this cadence. A
blind run and a healthy quiet run both produce "no news" — this was the blind one.**

## GROUND

```
UTC            2026-09-22T03:15:33Z
origin/main    [CANNOT MEASURE] — no shell; `git` against the mount is refused by the guard and
                                  forbidden by DOCTRINE §9.2
dev tree       [CANNOT MEASURE] — branch and SHA both unreadable without a shell
doc version    1   (read from the WORKING COPY only — see FINDING 2; not a freshness proof)
bootstrap      1
```

Doc version and bootstrap agree at `1`. **That agreement is worth nothing this run**: PREFLIGHT
step 2 requires all three binding documents be read via `git show origin/main:<path>` in the dev
tree, and I had no shell to run it in. I read the working copy, which my own station doc says is
"routinely several commits behind `main`" and which `station_doc_version` cannot catch. So the
version match below is self-reported by a possibly-superseded file.

## WHAT I MEASURED

**1. Device-bridge git guard — INSTALLED. [MEASURED]**

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
```

Last lines, quoted as the contract requires:

```
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/relaxed-charming-mayer/.local/bin/git - refuses mounted paths
and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS. Three controls passed, persistence confirmed. No `index.lock` risk was introduced by this
run, and no `git` was run against the Windows `.git` at any point.

**2. Windows shell — ABSENT after a correct load. [MEASURED]**

Schemas were loaded FIRST and by KEYWORD, never by hard-coded id, exactly as PREFLIGHT demands.
Three separate searches:

| Query | Result |
|---|---|
| `desktop-commander start_process interact_with_process` | no matching deferred tools; server listed as still connecting |
| `desktop-commander` (keyword, max 30) | no matching deferred tools; **`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT)`: "connection timed out after 30000ms"** |
| `start_process powershell shell command execute windows host` | 15 unrelated tools (Chrome, Shopify, PDF, computer-use). No process-starting tool for the host. |

This is **not** an `InputValidationError` and **not** an unloaded schema — the two conditions
PREFLIGHT explicitly says are NOT blindness. The server itself timed out at the transport layer.
Per the station contract: *"If Desktop Commander is absent, or the call fails after the load —
STOP."*

**3. Negative control on the one remaining candidate. [MEASURED]**

`computer-use` IS connected and could reach the desktop. It is not a substitute and was not used:
terminals and IDEs are granted at tier **"click"**, where `type` and `key` are blocked outright.
A terminal I can click but cannot type into cannot run `status-sweep.ps1`. Driving a shell by
screenshot would also be an unlogged, unverifiable channel for board mutations — the opposite of
what DOCTRINE §7 asks for.

**4. Positive control that the blindness is the SHELL, not the whole session. [MEASURED]**

The mount is readable: `ls` on `C:\ProjectOperations2` returned the full tree, and
`docs/pipeline/stations/00-supervisor.md` read back 1517 lines. `date -u` and a breadcrumb `ls`
both succeeded. Newest three breadcrumbs on disk:

```
00-00-supervisor-2026-09-22-0214-three-actors-were-live-and-2059s-fresh-head-went-red-six-minutes-after-the-sweep-read-it-green.md
00-04-scanner-2026-09-22-0211-lint-stations-own-neargitignore-guard-suppresses-all-thirty-gitignore-citations-the-item-2-check-would-validate.md
00-00-supervisor-2026-09-22-0135-released-2061-has-no-actor-and-both-instrument-prs-flipped-red-on-an-e2e-flake-while-waiting.md
```

My predecessor ran at **0214Z**, ~61 min ago, so this is a normally-fired occurrence of a 2 h
cadence and not a missed slot. **This paragraph is a timestamp, NOT coverage** — reading filenames
is not a sweep, not a freshness check, and not a board read.

**5. Everything the station actually exists to do — [CANNOT MEASURE].** No sweep
(`status-sweep.ps1`), no `check-breadcrumb.mjs --freshness`, no `list_scheduled_tasks` cross-check,
no watcher/queue health, no `gh pr list`, no section-5 `[STALE]` escalation clearing, no PR checks.
Not attempted, not inferred, not estimated.

## WHAT CHANGED

**Nothing.** No file in the repo was modified except this breadcrumb. No PR was opened, armed,
labelled, dispatched or merged. No prompt moved between `-HOLD.md` and `-ready.md`. No process was
started or killed. No escalation file was moved or discharged. The only side effect of this run is
the VM-side git guard shim at `~/.local/bin/git`, which lives in the sandbox and touches nothing on
the Windows box.

## FINDINGS

**FINDING 1 — Station 00 ran blind: Desktop Commander `CONNECT_TIMEOUT`, zero board coverage for
this cadence.**

The MCP transport timed out after 30 s, after a correct keyword load. Every station authority I
hold — ARM, DISPATCH, MERGE — routes through a PowerShell session I could not open. The board was
therefore unattended for this 2 h slot. Note the asymmetry the doctrine warns about: the
scheduled-task listing and `lastRunAt` will both record this run as having fired, and `--freshness`
will see a breadcrumb, so **every instrument except this paragraph will read healthy.** That is
precisely the §7 failure mode this section exists to defeat.

I cannot fix it from here: the failing component is the desktop app's own MCP server config on
Marco's machine, and diagnosing it needs the shell that is missing. Two honest load attempts plus a
third capability sweep is verification exhausted.

⚠️ Context for whoever reads this next: the station doc records blindness as **intermittent, at
roughly 40% of Station 00's recent runs, with cause NOT known.** This run supplies one new and
specific datum that earlier runs could not: **the failure has a name and a layer.** It is not a
silent absence and not an unloaded schema — it is `CONNECT_TIMEOUT` at 30000 ms on
`plugin:desktop-commander:desktop-commander`. Nine other plugin servers failed in the same session
with a *different* error (`does not support dynamic client registration`), which is an auth-shape
problem, not a timeout — so this is a distinct fault and not general MCP collapse. **A 30 s timeout
is a plausible race between the scheduled run starting and a heavy MCP server finishing its
handshake**, which would also explain intermittency and why interactive runs (where the app has
been up for a while) see it far less. That is a hypothesis with a cheap test, not a conclusion.

**RULE 1 options for Marco** — complete-and-additive first:

1. **Raise the Desktop Commander MCP startup timeout and/or pre-warm the server before the
   scheduled window.** Complete: attacks the measured failure at its layer. Additive: changes no
   station behaviour, no board state, no data — a config value and a warm process. Passes both
   halves of RULE 1. Needs Marco because it is his desktop app configuration.
2. **Make blindness self-reporting: have the station emit a machine-readable `BLIND` marker that
   `check-breadcrumb.mjs --freshness` and the sweep both surface.** Complete for *visibility*, not
   for the fault — the board still goes unattended; it just stops looking healthy while it does.
   Fails the "solves it immediately" half. Worth doing anyway, and doing it is in-scope for a
   station PR once a shell exists.
3. **Accept ~40% blind runs and lean on the 2 h cadence to cover the gaps.** Fails the complete
   half outright. Recorded only so the do-nothing option is priced: at a 2 h cadence, 40% blindness
   means a released PR can sit with no actor for ~4 h, and my predecessor's own filename at 0214Z
   ("released 2061 has no actor") says that is already happening.

**DISPOSITION: ESCALATED** — Marco. Option 1 is the ask, and it is a question about his MCP config,
not a status update. Deliberately NOT written to `docs/pr-prompts/needs-marco/`: that folder is
gitignored, the station doc records eleven of its files dead for ten days, and a blind run's finding
must not be filed where nothing reads it. This tracked breadcrumb is the loud channel.

**FINDING 2 — This run could not satisfy PREFLIGHT step 2, and the version match is not evidence.**

All three binding documents must be read from `git show origin/main:<path>` in the dev tree. Without
a shell that was impossible, and the `git` shim correctly refuses the mount, so I read the working
copy. `station_doc_version: 1` matched the bootstrap's `1` — but the doc itself states content gets
corrected without bumping the version, so **a match proves nothing about freshness.** I may have
been operating from a superseded copy of my own instructions for this entire run. Because the run
mutated nothing, the blast radius is zero — but the next reader should not mistake the clean GROUND
block for a validated one.

**DISPOSITION: DEFERRED** — resolves automatically on the first run that gets a shell, which must
re-read all three from `origin/main` before trusting anything. It becomes urgent the moment a run
with a shell finds `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md`
non-empty: that would mean blind runs have been reading stale instructions, and this cadence's
version match was a false all-clear.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for board coverage.** The GitHub MCP is connected and I
  could have listed PRs and checks. I did not, and the prohibition is explicit: `origin/main` is
  not the tree the watcher globs, and a read-only PR list dressed up as a sweep is how a blind run
  gets mistaken for a healthy one. Reporting blindness loudly beats reporting something.
- **Did not drive the board by GUI.** See measurement 3 — tier "click" blocks typing into a
  terminal, and an unverifiable channel is the wrong way to mutate a board.
- **Did not arm, merge, dispatch, or clear a single `[STALE]` escalation row.** All four need a
  live, re-measured sweep verdict immediately before acting. I have no verdict at all, and
  `[LIVE]` means "true when measured" — I measured nothing.
- **Did not run `git` against the Windows `.git`, and did not run `git clean` / `checkout .` /
  `reset --hard` / `stash pop` anywhere.** Hard stops observed.
- **Did not touch Azure, Entra or SharePoint.** Absolute, and nothing this run needed them.
- **Did not commit anything, anywhere.** This breadcrumb is left UNTRACKED in the dev tree per
  NO-DRIFT; `sweep-breadcrumbs.ps1` should batch it onto a branch and open one PR. **Station 00,
  next run: this file is untracked — sweep it up.**
- **Did not chase the nine `dynamic client registration` auth failures or the two other broken
  plugin servers.** Unrelated to the pipeline, and diagnosing someone else's connector auth is not
  this station's lane.
