# Station 00 — Supervisor | 2026-10-10T09:14Z–2026-10-10T09:28Z

**BLIND: `MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms` (CONNECT_TIMEOUT)** — no shell on the Windows host this run. READ-ONLY, no board action taken. Reported loudly per the station contract: a blind run and a healthy quiet run both produce "no news", and this was the blind one.

**The one new fact this run carries: this is the THIRD CONSECUTIVE blind Station 00 occurrence, with the identical named cause — and that crosses the trigger the 08:15Z run set for itself.** The 08:15Z breadcrumb dispositioned its uncollected-breadcrumb finding DEFERRED with the explicit condition *"it becomes urgent … at the third consecutive blind occurrence, whichever comes first."* That condition has now fired. 07:16Z, 08:15Z and 09:14Z all failed at the same server with the same error. The board has gone undriven for roughly three hours.

**New this run, and it narrows the diagnosis:** the scheduled-task cross-reference shows Station 00 is **firing reliably and going blind**, not missing its cadence — and no other station is MISSED. The fault is specific to this station's route to a host shell, not to the scheduler and not to the pipeline at large.

## GROUND

```
UTC            2026-10-10T09:14:07Z (start, from lastRunAt)  /  ~09:28Z (end, INFERRED)
origin/main    70991313                      (loose ref file + GitHub head; NOT via `git rev-parse` — no shell)
dev tree       main @ 70991313               C:\ProjectOperations2   (cleanliness UNVERIFIABLE — no git)
doc version    1                             (origin/main:docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                             (scheduled-task SKILL.md `station_doc_version: 1`)
```

Doc version and bootstrap **agree** (1 == 1). `contract_version: 5`. The READ-ONLY posture is forced by blindness, not by a version mismatch.

## WHAT I MEASURED

**1. Desktop Commander — ABSENT, after a successful-load attempt and a retry. [MEASURED]**

Schemas were loaded first per `BOOTSTRAP_PREFLIGHT_V1`, by keyword `ToolSearch` for `desktop-commander` — never by a hard-coded `select:` of assumed ids.

- Attempt 1 (~09:15Z), keyword `desktop-commander`: `No matching deferred tools found. Some MCP servers are still connecting: … plugin:desktop-commander:desktop-commander.`
- Attempt 2, keyword `desktop-commander start_process`: still connecting.
- Waited (`BOOTSTRAP_CONNECT_RETRY_V1`).
- Attempt 3, keyword `desktop-commander`: `these configured MCP servers failed to connect, so their tools are unavailable for this session: … plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`.

Not an `InputValidationError`, not an unloaded schema: the server never came up, so no id for `start_process` exists in this session to call. **No PowerShell shell was started on the Windows host.**

**Same blast radius as 07:16Z and 08:15Z, now reproduced a third time:** `plugin:prisma:Prisma-Local` and `plugin:pdf-viewer:pdf` both timed out in the same window with the identical `CONNECT_TIMEOUT` / 30000ms signature, while every remote server (GitHub MCP, Microsoft Graph, Google) connected normally and answered. **The failure sits in this session's local / stdio plugin-MCP transport, not in Desktop Commander alone.** Three independent cadences, one signature.

**2. Device-bridge git guard — EXIT 2, INSTALLED BUT INERT. [MEASURED]**

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh" > /tmp/guard.out 2>&1; echo "EXIT=$?"
```

**EXIT CODE: 2** — read with `echo "EXIT=$?"` on the installer itself, output redirected to a file rather than piped, so the status is the installer's and not a pipeline stage's (per the PREFLIGHT warning that `tail` / `Select-Object` masked a true exit of 2 as 0 twice on 2026-09-22).

Headline line, verbatim:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```

Last line, verbatim:

```
   PATH="/sessions/laughing-friendly-hopper/.local/bin:$PATH" git <args>
```

Exit 2 is the expected station outcome: a finding, not a stop. **The ban was remembered, not mechanical, and it was honoured: no `git` was invoked against the mount this run, in any form, including the one-call protected form.**

*Operational note for the next reader:* the guard's first invocation this run was issued with a pipeline appended and the workspace-bash call returned a 30-second client-side timeout while the script was still running, which then blocked the following call with `process … already running`. The redirect-plus-`$?` form above completed cleanly. Appending `| tail` to this installer is doubly bad on a mounted path: it masks the exit code *and* lengthens the call past the bash client timeout.

**3. Dev tree, by plain file read only — NOT a sweep, NOT coverage. [MEASURED]**

Filesystem reads of `C:\ProjectOperations2\.git\*` through the VM mount, no `git` invocation:

- `.git/HEAD` → `ref: refs/heads/main`
- `.git/refs/heads/main` → `70991313b82d…`
- `.git/refs/remotes/origin/main` (loose ref; wins over `packed-refs`) → `70991313b82d…`
- **`.git/index.lock` DOES NOT EXIST**; nor do `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`. No frozen-board lock to report.
- `.git/FETCH_HEAD` mtime `Oct 10 17:00` (+1000) ≈ **07:00Z — now ~2h15m old at run start, and UNMOVED across all three blind runs.** The 08:15Z run measured the same 17:00 stamp. Independent corroboration that **no station has held a host shell since ~07:00Z**, from an instrument that has nothing to do with the MCP transport.

Local fetched `origin/main` equals the GitHub head read this run (commit `70991313`, the same commit serving station-doc blob `399d30f1`), so the dev tree's view of `main` is not stale. **This says nothing about working-tree cleanliness** — `git status` / `--numstat` / `--cached` were all unavailable, so dirtiness is `[CANNOT MEASURE]`.

**4. Binding documents — station doc read from `origin/main` via the GitHub API. [MEASURED]**

`docs/pipeline/stations/00-supervisor.md` read at `refs/heads/main`, blob `399d30f1`, commit `70991313`. This is the API equivalent of the `?plain=1` blob fallback the contract permits, used because `git show origin/main:<path>` requires the shell I do not have.

`DOCTRINE.md` and `STATION-CAPABILITIES.md` were **not** read in full. That is a deliberate stop, not an instrument failure: PREFLIGHT step 1 says that when Desktop Commander is absent you write the blindness paragraph and end the run, and expressly forbids substituting GitHub-side reads and presenting them as coverage. Reading two more binding documents to drive a run I am not permitted to drive would be that substitution.

**5. Scheduled-task cross-reference — the freshness table, read but not acted on. [MEASURED]**

`list_scheduled_tasks` (a cloud-side tool, unaffected by the local transport failure), crossed against the breadcrumbs on disk:

| station | cron | `lastRunAt` | newest breadcrumb | verdict |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` (hourly) | **2026-10-10T09:14:07Z** (this run) | 08:15Z (blind) | **fires reliably, goes BLIND** — not MISSED |
| `04-scanner` | `0 */4 * * *` | 2026-10-10T06:09:44Z | 06:24Z | healthy, aligned; next 10:09Z |
| `05-sot-keeper` | `10 0 * * *` (daily) | 2026-10-09T14:22:42Z | — | on cadence; next 14:22Z today, not yet due |
| `03-machine-minder` | `0 9 * * *` (daily) | 2026-10-09T23:02:54Z | — | on cadence; next 23:02Z today, not yet due |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32Z | — | `enabled: false` — disabled by design, not a MISS |

**No station is MISSED.** Station 00's blindness is therefore a fourth classification the doc's three-way MISSED taxonomy does not have a row for: **fired, ran an instruction, and could not reach the box.** It is neither "never fired" (the session exists and `lastRunAt` advances every hour) nor "fired and died" (the run executes, reads, and reports) nor "reported, not merged" (the breadcrumbs are written, just untracked). Recording that gap so the next reader does not force this reading into the wrong row.

**Cadence confirmed live, per the bootstrap's own warning not to trust a pasted cadence:** `cronExpression: 5 * * * *` — hourly. The bootstrap's hourly claim is current. `jitterSeconds: 532` explains why `lastRunAt` reads 09:14 against a `:05` cron.

**6. Queue root, by directory listing only. [MEASURED]**

`docs/pr-prompts/` in the dev tree carries **four** breadcrumbs from this cycle, newest first:

- `00-00-supervisor-2026-10-10-0815-blind-second-consecutive-desktop-commander-connect-timeout.md`
- `00-00-supervisor-2026-10-10-0716-blind-desktop-commander-connect-timeout.md`
- `00-00-supervisor-2026-10-10-0614-collect-archived-0315-and-0416-and-root-caused-2303s-nine-red-tests-to-a-fail-closed-gate.md`
- `00-04-scanner-2026-10-10-0624-gate-liveness-three-gates-released-one-premise-refuted-by-geoapify-and-my-own-blob-probe-lied-on-crlf.md`

Read to pick a non-colliding filename and to establish the consecutive-blindness count. **They were NOT collected and NOT dispositioned** — see WHAT I DID NOT DO. All four are untracked in the dev tree and still awaiting a board PR to sweep them up; that backlog now spans three undriven cadences. Nothing new has appeared since 08:15Z other than the 08:15Z report itself, which is consistent with 04-scanner not being due until 10:09Z.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, no PR merged, updated or labelled, no branch created, no scheduled task touched, no file in `sot/`, no lease taken. The only write this run made anywhere is this breadcrumb, into the dev tree's tracked `docs/pr-prompts/` directory (untracked file, awaiting the sweep).

## FINDINGS

**F1 — Station 00 has now been blind for THREE consecutive occurrences on one named cause, and the diagnosis has narrowed: the scheduler and every other station are healthy.**

07:16Z, 08:15Z and 09:14Z all failed at `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT: 30000ms)`, each with `Prisma-Local` and `pdf-viewer:pdf` timing out in the same window and all remote MCP servers answering normally. Two instruments that share no machinery agree on the consequence: `FETCH_HEAD` has not moved since ~07:00Z, and no board mutation appears anywhere. `list_scheduled_tasks` adds the new half — `lastRunAt` advances on the hour for every enabled station, and 04/03/05 are all aligned with their cadences — so this is **not** a scheduler fault and **not** a pipeline-wide fault. It is the scheduled Cowork session's **local/stdio plugin-MCP transport**, reproduced three times at one-hour spacing. The station doc's line that blindness' cause "is NOT known" is outdated for this episode, though *why* that transport times out remains unmeasurable from here: every diagnostic for it lives on the host I cannot reach.

RULE 1 options for Marco, complete-and-additive first:

1. **Give the scheduled session a second, tracked route to a host shell, and make the timeout countable.** On a `CONNECT_TIMEOUT` for the local plugin transport, step 1 falls back to a sanctioned helper the scheduled session can invoke directly instead of ending the run, and the timeout is appended to a tracked counter file so the rate becomes evidence rather than anecdote. Solves it **immediately** (this cadence gets a shell) and **in future** (the rate is visible, the git ban stays mechanical), and damages no existing or future data entry — it adds a route and a counter and changes no board semantics. *Needs Marco: it touches how the scheduled session is launched on his machine.*
2. **Restart the Desktop Commander plugin / the Claude desktop app on the host, and leave the rest alone.** Fixes it immediately, fixes nothing in future — the next transport timeout is silent again, and the only trace is breadcrumbs nobody has swept. **Fails the "future" half.**
3. **Accept intermittent blindness; widen the cadence or add a retry occurrence.** Damages nothing, but **fails both halves of "completely"**: it lowers the chance a given cadence is lost without touching why, and more occurrences of a session that cannot see the box is more "no news" that reads like health.

**DISPOSITION: ESCALATED** — Marco. Second consecutive escalation of the same question, now with the scheduler and the other three stations measured healthy, which rules option 2 further out: *do you want the scheduled session given a second, tracked route to a host shell plus a timeout counter (option 1), or is a plugin restart on the host the whole intended answer (option 2)?* Everything option 1 needs is code and a runbook I can write without touching Azure / Entra / SharePoint; what I cannot do is change how the scheduled session is launched on your machine.

**F2 — The 08:15Z run's DEFERRED condition has FIRED: four breadcrumbs are untracked and uncollected at the third consecutive blind occurrence.**

The 08:15Z breadcrumb deferred this with the stated trigger *"the third consecutive blind occurrence, whichever comes first."* This is it. COLLECT is Station 00's own job and it requires `check-breadcrumb.mjs --freshness`, `retire-escalation.mjs` and a board PR — all of which need the host shell; collecting partially from GitHub-side reads is exactly the substitution PREFLIGHT step 1 forbids. The contract's named risk still stands: once a PR lands any of these four exact paths on `main`, the untracked copies in the dev tree block the next `git merge --ff-only` while `--numstat` and `--cached` both read EMPTY — the documented PASS reading. **The next sighted Station 00 run should expect to run the fast-forward cure** (`00-supervisor-REFERENCE.md` §POST-MERGE-FF-CURE: raw-Buffer restore from `HEAD`, never `git checkout --`, never `git clean`) **and should treat COLLECT of this four-breadcrumb backlog as its first duty, ahead of any arm.**

**DISPOSITION: ESCALATED** — folded into F1's question rather than deferred a third time. Deferring the same finding each hour while the trigger passes is how a real backlog turns into "no news". The backlog itself needs no decision from Marco — it needs one sighted run — so the only thing escalating is the shell.

**F3 — `vm-git-guard` reports INSTALLED BUT INERT (exit 2) in this shell, as documented.**

Quoted in full under WHAT I MEASURED, with the exit code read off the installer itself. Expected station outcome, recorded because an install nobody can see in the report is indistinguishable from one that never ran.

**DISPOSITION: DEFERRED** — already the documented expected outcome; actionable only if the station's shell were changed to a login shell, or if the exit code stopped being 2 without the shim becoming reachable.

**F4 — The station doc's MISSED taxonomy has no row for "fired, ran, and could not reach the box".**

`FRESHNESS_ONE_CADENCE_V1` requires every MISSED station to be classified as exactly one of *never fired* / *fired and died* / *reported, not merged*. A blind Station 00 is none of the three: the session exists, `lastRunAt` advances, the run executes and writes a breadcrumb — it simply cannot mutate. A future reader forcing this reading into *fired and died* would then read the transcript, find no turn-one API error, and be left with a contradiction; forcing it into *never fired* would trip the "escalate on two consecutive" rule for the wrong reason. A fourth row — **fired and blind: session present, `lastRunAt` fresh, breadcrumb written, host shell unreachable; evidence is the `CONNECT_TIMEOUT` plus an unmoved `FETCH_HEAD`** — would make the three blind runs classifiable instead of anomalous. This is a doc change in `docs/pipeline/stations/00-supervisor.md`, which I cannot open a PR for this run.

**DISPOSITION: DEFERRED** — real, not now. It becomes worth a PR at the next sighted Station 00 run, or sooner if another station files a blind report and has to guess at the classification.

## WHAT I DID NOT DO

- **No `git`, in any form, against the mounted `C:\ProjectOperations2\.git`** — not even the protected one-call `PATH=` form the installer printed. Every git fact above comes from reading ref files as plain files.
- **No `status-sweep.ps1`, no `pipeline-lib.ps1`, no `smoke-pr.ps1`, no `arm-prompt.ps1`, no `Enter-BoardLease`** — all require the PowerShell host shell.
- **No COLLECT, no dispositioning of other stations' findings, no `check-breadcrumb.mjs` run** (including against this file — so this breadcrumb is **not** claimed `breadcrumb-clean`; no validator has been run on it), **no `--freshness` read, no `retire-escalation.mjs`, no archiving.** The `list_scheduled_tasks` read above is a freshness *cross-reference*, not COLLECT.
- **No scheduled task disabled, enabled, re-run or edited** — forbidden on a freshness/blindness reading alone, and expressly so on the reading I have.
- **No merge, no arm, no label change, no branch update, no PR opened** — a blind run has no RULE-2 verdict and no lease, and DOCTRINE §10.1 says the absence of a watcher verdict must never be read as "cleared for merge".
- **No `sot/` edit**, nothing in Azure / Entra / SharePoint, no production data.
- **This report was not left in the session's `outputs` folder.** It is in the dev tree at `docs/pr-prompts/`, untracked, for the sweep — the measured failure mode of 2026-09-22 was a blind run whose complete report reached nobody because it went to `outputs`.
