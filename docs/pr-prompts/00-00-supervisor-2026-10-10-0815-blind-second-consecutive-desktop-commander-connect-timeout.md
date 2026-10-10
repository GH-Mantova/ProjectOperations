# Station 00 — Supervisor | 2026-10-10T08:15Z–2026-10-10T08:27Z

**BLIND: `MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms` (CONNECT_TIMEOUT)** — no shell on the Windows host this run. READ-ONLY, no board action taken. Reported loudly per the station contract: a blind run and a healthy quiet run both produce "no news", and this was the blind one.

**The one new fact this run carries: this is the SECOND CONSECUTIVE blind Station 00 occurrence, with the IDENTICAL named cause.** The 07:16Z run recorded the same `CONNECT_TIMEOUT` on the same server, and the same two sibling local servers timing out alongside it. Two cadences of the board have now gone undriven for a reason that is no longer "unknown" and is no longer a one-off.

## GROUND

```
UTC            2026-10-10T08:15:51Z (start, measured in the VM)  /  ~08:27Z (end, INFERRED)
origin/main    70991313                      (loose ref file + GitHub head; NOT via `git rev-parse` — no shell)
dev tree       main @ 70991313               C:\ProjectOperations2   (cleanliness UNVERIFIABLE — no git)
doc version    1                             (origin/main:docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                             (scheduled-task SKILL.md `station_doc_version: 1`)
```

Doc version and bootstrap **agree** (1 == 1). `contract_version: 5`. The READ-ONLY posture is forced by blindness, not by a version mismatch.

## WHAT I MEASURED

**1. Desktop Commander — ABSENT, after a successful-load attempt and a retry. [MEASURED]**

Schemas were loaded first per `BOOTSTRAP_PREFLIGHT_V1`, by keyword `ToolSearch` for `desktop-commander` — never by a hard-coded `select:` of assumed ids.

- Attempt 1 (~08:14Z): `No matching deferred tools found. Some MCP servers are still connecting: ... plugin:desktop-commander:desktop-commander`.
- Attempt 2, same keyword: still connecting.
- Waited (`BOOTSTRAP_CONNECT_RETRY_V1`).
- Attempt 3 (~08:16Z) and attempt 4 (`desktop-commander start_process`): `these configured MCP servers failed to connect, so their tools are unavailable for this session: ... plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`.

Not an `InputValidationError`, not an unloaded schema: the server never came up, so no id for `start_process` exists in this session to call. No PowerShell shell was started on the Windows host.

**Same blast radius as 07:16Z:** `plugin:prisma:Prisma-Local` timed out identically (`CONNECT_TIMEOUT`, 30000ms) and `plugin:pdf-viewer:pdf` was slow-connecting in the same window, while every remote server (GitHub MCP, Microsoft, Google) connected normally. The failure sits in this session's **local / stdio plugin MCP transport**, not in Desktop Commander alone. That is now a reproduced observation, not a hypothesis from one run.

**2. Device-bridge git guard — EXIT 2, INSTALLED BUT INERT. [MEASURED]**

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
```

Headline line, verbatim:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```

Last line, verbatim:

```
   PATH="/sessions/eager-vigilant-pascal/.local/bin:$PATH" git <args>
```

**EXIT CODE: 2** — read with `echo "EXIT=$?"` immediately after the installer, no pipeline appended (per the PREFLIGHT warning that `tail` / `Select-Object` masks the status). Exit 2 is the expected station outcome: a finding, not a stop. Controls it printed: `bash -lc 'command -v git'` → `/sessions/eager-vigilant-pascal/.local/bin/git` (shim); `bash -c 'command -v git'` → `/usr/bin/git` (real git, no protection). **The ban was remembered, not mechanical, and it was honoured: no `git` was invoked against the mount this run, in any form, including the one-call protected form.**

**3. Dev tree, by plain file read only — NOT a sweep, NOT coverage. [MEASURED]**

Filesystem reads of `C:\ProjectOperations2\.git\*` through the VM mount, no `git` invocation:

- `.git/HEAD` → `ref: refs/heads/main`
- `.git/refs/heads/main` → `70991313b82d…`
- `.git/refs/remotes/origin/main` (loose ref; wins over `packed-refs`) → `70991313b82d…`
- `.git/packed-refs` still carries the superseded `66194af6` for `origin/main` and `4ea28d6d` for `main` — expected, recorded so a future reader of `packed-refs` alone is not misled.
- `.git/FETCH_HEAD` mtime `2026-10-10 17:00:40 +1000` ≈ **07:00Z — the fetch is ~75 minutes old at run start.** It did not move between the 07:16Z run and this one, which is consistent with no station having had a shell in between.
- **`.git/index.lock` DOES NOT EXIST**; nor do `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`. No frozen-board lock to report.

Local fetched `origin/main` equals the GitHub head read this run (commit `70991313`, the same commit that serves the station doc blob `399d30f1`). **This says nothing about working-tree cleanliness** — `git status` / `--numstat` / `--cached` were all unavailable, so dirtiness is `[CANNOT MEASURE]`.

**4. Binding documents — station doc read from `origin/main` via the GitHub API. [MEASURED]**

`docs/pipeline/stations/00-supervisor.md` read at `refs/heads/main`, blob `399d30f1`, commit `70991313`. This is the API equivalent of the `?plain=1` blob fallback the contract permits, used because `git show origin/main:<path>` requires the shell I do not have.

`DOCTRINE.md` and `STATION-CAPABILITIES.md` were **not** read in full. That is a deliberate stop, not an instrument failure: step 1 says that when Desktop Commander is absent you write the blindness paragraph and end the run, and expressly forbids substituting GitHub-side reads and presenting them as coverage. Reading two more binding documents to drive a run I am not permitted to drive would be that substitution.

**5. Queue root, by directory listing only. [MEASURED]**

`docs/pr-prompts/` in the dev tree carries three breadcrumbs from this morning's cycle, newest first:

- `00-00-supervisor-2026-10-10-0716-blind-desktop-commander-connect-timeout.md` (the previous blind run)
- `00-00-supervisor-2026-10-10-0614-collect-archived-0315-and-0416-and-root-caused-2303s-nine-red-tests-to-a-fail-closed-gate.md`
- `00-04-scanner-2026-10-10-0624-gate-liveness-three-gates-released-one-premise-refuted-by-geoapify-and-my-own-blob-probe-lied-on-crlf.md`

Read to pick a non-colliding filename and to establish the consecutive-blindness fact. **They were NOT collected and NOT dispositioned** — see WHAT I DID NOT DO. All three are untracked in the dev tree and still awaiting a board PR to sweep them up; that backlog now spans two undriven cadences.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, no PR merged, updated or labelled, no branch created, no scheduled task touched, no file in `sot/`, no lease taken. The only write this run made anywhere is this breadcrumb, into the dev tree's tracked `docs/pr-prompts/` directory (untracked file, awaiting the sweep).

## FINDINGS

**F1 — Station 00 has been blind for two consecutive occurrences on the same named cause.**
07:16Z and 08:15Z both failed at `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT: 30000ms)`, both with `Prisma-Local` timing out in the same window and all remote MCP servers healthy. The board has therefore gone undriven for ~2 hours: nothing armed, nothing merged, and three breadcrumbs (including both blind reports) sitting untracked in the dev tree. The station doc's line that blindness' cause "is NOT known" is now outdated for this episode — the cause is a local/stdio plugin-MCP transport failure in the scheduled Cowork session, reproduced twice one cadence apart. What I cannot measure from here is *why* that transport is failing, because every diagnostic for it lives on the host I cannot reach.

RULE 1 options for Marco, complete-and-additive first:

1. **Make the shell dependency verifiable and self-healing at session start, and remove the single point of failure** — have the bootstrap's step 1, on a `CONNECT_TIMEOUT` for the local plugin transport, fall back to a *second* sanctioned host-shell route (a tracked helper the scheduled session can invoke directly) rather than ending the run, and record the timeout in a tracked counter file so the rate is measurable instead of anecdotal. Solves it immediately (this cadence gets a shell) and in future (the rate becomes visible and the ban stays mechanical), and damages no data entry — it adds a route and a counter, changes no board semantics. *Needs Marco: it touches how the scheduled session is launched on his machine.*
2. **Restart the Desktop Commander plugin / the Claude desktop app on the host and leave the rest alone.** Fixes it immediately, fixes nothing in future — the next transport timeout is silent again — and the only evidence it ever happened stays in breadcrumbs nobody has swept. Fails the "future" half.
3. **Accept intermittent blindness and widen the cadence or add a retry occurrence.** Damages nothing, but fails the "completely" half in both halves: it reduces the chance a cadence is lost without addressing why, and more occurrences of a session that cannot see the box is more "no news" that reads like health.

**DISPOSITION: ESCALATED** — Marco. The question is option 1 vs 2: *do you want the scheduled session given a second, tracked route to a host shell (plus a timeout counter), or is a plugin restart on the host the whole intended answer?* Everything needed to act on option 1 is code and a runbook I can write without touching Azure/Entra/SharePoint; what I cannot do is change how the scheduled session is launched on your machine.

**F2 — Three breadcrumbs are untracked in the dev tree and uncollected, and I am not permitted to collect them.**
COLLECT is Station 00's job and it requires `check-breadcrumb.mjs --freshness`, `list_scheduled_tasks` cross-referencing, `retire-escalation.mjs` and a board PR — all of which need the host shell. Collecting partially, from GitHub-side reads, is precisely the substitution step 1 forbids. The practical risk of leaving them is the one the contract names: once a PR lands those exact paths on `main`, the untracked copies in the dev tree block the next `git merge --ff-only` while `--numstat` and `--cached` both read EMPTY. The next sighted Station 00 run should expect to run the fast-forward cure.

**DISPOSITION: DEFERRED** — real, not now. It becomes urgent the moment a board PR lands any of these three paths on `main`, or at the third consecutive blind occurrence, whichever comes first.

**F3 — `vm-git-guard` reports INSTALLED BUT INERT (exit 2) in this shell, as documented.**
Quoted in full under WHAT I MEASURED. Expected station outcome, recorded because an install nobody can see in the report is indistinguishable from one that never ran. No action.

**DISPOSITION: DEFERRED** — already the documented expected outcome; it would become a finding worth acting on only if the station's shell were ever changed to a login shell, or if the exit code stopped being 2 without the shim becoming reachable.

## WHAT I DID NOT DO

- **No `git`, in any form, against the mounted `C:\ProjectOperations2\.git`** — not even the protected one-call `PATH=` form the installer printed. All git facts above come from reading ref files as plain files.
- **No `status-sweep.ps1`, no `pipeline-lib.ps1`, no `smoke-pr.ps1`, no `arm-prompt.ps1`, no `Enter-BoardLease`** — all require the PowerShell host shell.
- **No COLLECT, no dispositioning of other stations' findings, no `check-breadcrumb.mjs` run** (including against this file — so this breadcrumb is **not** claimed `breadcrumb-clean`; no validator has been run on it), **no `--freshness` read, no `list_scheduled_tasks` cross-reference, no archiving.**
- **No merge, no arm, no label change, no branch update, no PR opened** — a blind run has no RULE-2 verdict and no lease, and DOCTRINE §10.1 says the absence of a watcher verdict must never be read as "cleared for merge".
- **No scheduled task disabled, enabled, re-run or edited** — forbidden on a freshness/blindness reading alone.
- **Nothing written to `sot/`**, nothing in Azure / Entra / SharePoint, no production data.
- **This report was not left in the session's `outputs` folder.** It is in the dev tree at `docs/pr-prompts/`, untracked, for the sweep — the measured failure mode of 2026-09-22 was a blind run whose complete report reached nobody because it was written to `outputs`.
