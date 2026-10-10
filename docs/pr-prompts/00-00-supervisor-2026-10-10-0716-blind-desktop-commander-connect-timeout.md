# Station 00 — Supervisor | 2026-10-10T07:16Z–2026-10-10T07:33Z

**BLIND: `MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms` (CONNECT_TIMEOUT)** — no shell on the Windows host this run. READ-ONLY, no board action taken. Reported loudly per the station contract: a blind run and a healthy quiet run both produce "no news", and this was the blind one.

This run has a **named cause**, which previous blind runs did not: the Desktop Commander MCP server itself failed to connect at the session level, twice, with a >60s wait between. That is new information against the station doc's line that blindness' cause "is NOT known".

## GROUND

```
UTC            2026-10-10T07:16:55Z (start, measured)  /  ~07:33Z (end, INFERRED — clock unreachable at close)
origin/main    70991313                      (ref file + GitHub head; NOT via `git rev-parse` — no shell)
dev tree       main @ 70991313               C:\ProjectOperations2   (cleanliness UNVERIFIABLE — no git)
doc version    1                             (origin/main:docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                             (scheduled-task SKILL.md `station_doc_version: 1`)
```

Doc version and bootstrap **agree** (1 == 1). The READ-ONLY posture this run is forced by blindness, not by a version mismatch.

## WHAT I MEASURED

**1. Desktop Commander — ABSENT. [MEASURED]**

Tool schemas were loaded first, per `BOOTSTRAP_PREFLIGHT_V1`. A keyword `ToolSearch` for `desktop-commander` was run (not a hard-coded `select:` of assumed ids):

- Attempt 1 (~07:15Z): `No matching deferred tools found. Some MCP servers are still connecting: ... plugin:desktop-commander:desktop-commander`
- Attempt 2, same keyword, immediately after: still connecting.
- Waited 60s (`BOOTSTRAP_CONNECT_RETRY_V1`).
- Attempt 3 (~07:16Z): `No matching deferred tools found. Note: these configured MCP servers failed to connect, so their tools are unavailable for this session: ... plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`

This is **not** an `InputValidationError` and **not** an unloaded schema. The server never came up, so no tool id for `start_process` exists in this session to call. `start_process` was therefore never reachable; no PowerShell shell was started on the Windows host.

Two sibling servers timed out identically in the same window — `plugin:pdf-viewer:pdf` and `plugin:prisma:Prisma-Local` — so the failure looks like the local (stdio/plugin) MCP transport in this session, not Desktop Commander alone. Remote servers in the same session connected normally (GitHub MCP worked throughout).

**2. Device-bridge git guard — EXIT 2, INSTALLED BUT INERT. [MEASURED]**

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
```

Last line, verbatim:

```
   PATH="/sessions/epic-wizardly-cray/.local/bin:$PATH" git <args>
```

Headline line, verbatim:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```

**EXIT CODE: 2** — read from the installer itself (`echo "EXIT=$?"` directly after it, no pipeline appended, per the §PREFLIGHT warning about `tail`/`Select-Object` masking the status). Exit 2 is the expected station outcome, a finding and not a stop. Controls it printed: `bash -lc 'command -v git'` → `/sessions/epic-wizardly-cray/.local/bin/git` (shim); `bash -c 'command -v git'` → `/usr/bin/git` (real git, no protection). **The ban was remembered, not mechanical, and it was honoured: no `git` was run against the mount this run, in any form.**

**3. Dev tree, by file read only — NOT a sweep, NOT coverage. [MEASURED]**

These are plain filesystem reads of `C:\ProjectOperations2\.git\*` through the VM mount — no `git` invocation. They are recorded because they are cheap and true, **not** as a substitute for `status-sweep.ps1`:

- `.git/HEAD` → `ref: refs/heads/main`
- `.git/refs/heads/main` → `70991313b82d3e8facaa9c26600c34dea39c921e`
- `.git/refs/remotes/origin/main` (loose ref, wins over `packed-refs`) → `70991313b82d3e8facaa9c26600c34dea39c921e`
- `.git/packed-refs` still carries the superseded `66194af6` for `origin/main` — expected; noted so a future reader of `packed-refs` alone is not misled.
- `.git/FETCH_HEAD` mtime 2026-10-10 17:00 host-local (UTC+10) ≈ 07:00Z — the fetch is ~17 minutes old at run start.
- **`.git/index.lock` DOES NOT EXIST.** `ls: cannot access '.git/index.lock': No such file or directory`. No frozen-board lock to report.

Cross-check on `origin/main`: GitHub `list_commits` on `main` returns head `70991313b82d3e8facaa9c26600c34dea39c921e`, `docs(board): retire the duplicate 0315 queue-root copy; archive/ keeps the one identity (#2306)`, committed 2026-10-10T07:00:28Z. Local fetched ref and GitHub agree, so the dev tree's `origin/main` was current at run start. **This says nothing about the working tree's cleanliness** — `git status` / `--numstat` / `--cached` were all unavailable, so dirtiness is `[CANNOT MEASURE]` this run.

**4. Binding documents — read from `origin/main` via the GitHub API, not the working copy. [MEASURED]**

`docs/pipeline/stations/00-supervisor.md` was read at `refs/heads/main` (blob `399d30f1`, commit `70991313`). This is the API equivalent of the `?plain=1` blob fallback the contract permits, used because `git show origin/main:<path>` requires the shell I do not have. `station_doc_version: 1`, `contract_version: 5`.

`DOCTRINE.md` and `STATION-CAPABILITIES.md` were **NOT** read in full this run. `[CANNOT MEASURE]` is not the honest tag here — it was a deliberate stop: the station doc's step 1 says that when Desktop Commander is absent, you write the blindness paragraph and **end the run**, and explicitly forbids substituting GitHub-side reads and presenting them as coverage. Reading two more binding documents to drive a run I am not permitted to drive would have been exactly that substitution.

**5. Queue root, by `Glob` only. [MEASURED]**

`docs/pr-prompts/00-*.md` in the dev tree holds two breadcrumbs, both from this morning's cycle:

- `00-00-supervisor-2026-10-10-0614-collect-archived-0315-and-0416-and-root-caused-2303s-nine-red-tests-to-a-fail-closed-gate.md`
- `00-04-scanner-2026-10-10-0624-gate-liveness-three-gates-released-one-premise-refuted-by-geoapify-and-my-own-blob-probe-lied-on-crlf.md`

Read only to pick a non-colliding filename for this breadcrumb. **They were NOT collected and NOT dispositioned** — see WHAT I DID NOT DO. The 06:14Z Station 00 run merged #2305 and #2306, so **that** occurrence was sighted; blindness remains intermittent, one cadence apart.

## WHAT CHANGED

**Nothing on the board.** No arm, no dispatch, no merge, no label, no branch update, no lease taken, no scheduled task touched, no `/sot/` edit, no production data, no Azure / Entra / SharePoint.

One file written, untracked, in the dev tree: **this breadcrumb**, at `docs/pr-prompts/00-00-supervisor-2026-10-10-0716-blind-desktop-commander-connect-timeout.md`. It is the second of the two sanctioned homes — the preferred one (inside the run's own PR worktree) needs a shell I did not have, and the session `outputs` folder is the measured black hole a blind run already fell into on 2026-09-22. **Station 00's next sighted run, or `sweep-breadcrumbs.ps1`, must sweep it up.** `check-breadcrumb.mjs` has **not** been run against it — no Node, no shell — so this breadcrumb is **not** certified `breadcrumb-clean`; treat the five-section structure as hand-checked only.

## FINDINGS

**F1 — Station 00 was blind this cadence, with a named transport cause.**

`plugin:desktop-commander:desktop-commander` returned `CONNECT_TIMEOUT` after 30000ms and never offered a tool; `plugin:pdf-viewer:pdf` and `plugin:prisma:Prisma-Local` failed identically in the same session, while every remote MCP server connected. The 06:14Z occurrence one cadence earlier was sighted and merged two PRs, so this is the intermittent blindness the station doc describes — but the doc records its cause as unknown, and this run has a candidate: **the local plugin MCP transport, not Desktop Commander specifically.** Three local servers down together is the kind of evidence that distinguishes "Desktop Commander is flaky" from "stdio plugin servers do not come up in some scheduled sessions", and those have different fixes. Worth capturing in `00-supervisor-REFERENCE.md` or `05-decisions-and-lessons.md` once a second instance confirms the pattern; one measurement is not a playbook.

**DISPOSITION: ESCALATED** — Marco, this is a question, not a status update. Station 00 cannot arm, dispatch or merge without a Windows shell, so every blind cadence is a lost hour of board motion, and the board cannot tell a blind run from a quiet one without reading this file. Which of these do you want?

1. **Complete and additive — make blindness mechanical and visible, and keep the diagnosis.** Have the scheduled-session launcher health-check the local plugin MCP servers before the station prompt runs, retry the transport, and record `desktop-commander: up/down` into a tracked counter that `check-breadcrumb.mjs --freshness` reads, so a blind cadence shows up as a *named defect* on the next run's freshness table rather than as silence. Passes both halves of RULE 1: it fixes it now (retry recovers most intermittent timeouts), it fixes it in future (the counter makes the residue measurable instead of anecdotal), and it writes no data and removes no capability. Costs launcher work neither you nor I can do from a blind session.
2. **Retry-only.** Add a bounded reconnect attempt for the local plugin servers and nothing else. Fails the *future* half: when it still times out, the run is silently blind again and the only trace is a file nobody is required to read.
3. **Leave it; accept ~40% blind cadences.** Fails the *immediate* half outright. Named here only so the option set is honest — the board has already paid for this twice today in one of two cadences.

I cannot measure the launcher side from inside a blind session, so I am not guessing at which local transport broke. Option 1 is the one I would take.

**F2 — The device-bridge git ban is still non-mechanical in a station's shell.**

Guard exit 2, shim byte-correct and off `PATH`, because a non-interactive non-login bash sources neither `~/.bashrc` nor `~/.profile`. Honoured by memory this run. This is the documented expected outcome and DOCTRINE §9.2 records the remembered form as having failed seven times.

**DISPOSITION: DEFERRED** — real, already documented, and not newly urgent: nothing ran against the mount this run and there is no `index.lock`. What would make it urgent: any station reporting a 0-byte `index.lock` with no owning process, or a guard exit other than 0 or 2. The known cure (a wrapper that exports `PATH` into the station's own non-login shell rather than into shell rc files) belongs to whoever owns the session launcher — the same owner as F1, which is why these two should be looked at together.

## WHAT I DID NOT DO

Deliberately, all of it because step 1 of the PREFLIGHT failed and the contract then makes me stop:

- **No COLLECT.** The two breadcrumbs in the queue root (00 @ 0614Z, 04 @ 0624Z) were **not** read and their findings carry **no disposition from me**. They are still owed one. `check-breadcrumb.mjs --freshness` needs Node on the host; `list_scheduled_tasks` alone cannot be crossed against breadcrumbs into a freshness verdict, and the station doc forbids reading a cadence verdict off the listing.
- **No sweep.** `status-sweep.ps1` was never run, so there is **no** `[LIVE]`/`[STALE]` reading, no watcher liveness verdict, no WAITING ON MARCO figure and no MARCO_QUEUE_LINE figures in this breadcrumb. Anyone asking "what is the board doing" must not read this run as an answer.
- **No arm.** No `-HOLD.md` → `-ready.md` `git mv`, no `lint-prompt.mjs`, no NEVER-LIST check.
- **No merge, no branch update, no label.** `Assert-SmokedOrEscalate` / `Merge-Pr` were unreachable, and `Enter-BoardLease` with them — BOARD_LEASE_V1 condition 3 cannot be satisfied without the shell, so acting would have been an unleased mutation. No QUEUED PR was confirmed; if the 06:14Z run left any pinned-and-queued, **that confirmation is still outstanding.**
- **No `[STALE]` escalation retirement**, no `retire-escalation.mjs`, no archive `git mv` of the two root breadcrumbs.
- **No GitHub-side stand-in for the tree.** I did not glob `origin/main` and present it as the dev tree the watcher reads. The GitHub API was used for exactly two things: confirming the `origin/main` head SHA, and reading this station's own doc at that SHA.
- **No commit, no push, no PR.** `main` in `C:\ProjectOperations2` was not committed to. A PR for this breadcrumb was not opened, even though the API could have: opening one is a board mutation I cannot take the lease for, and it would add to Marco's release queue from a run that measured nothing about that queue's depth. Left untracked for the sweep, which is the contract's other sanctioned route.
- **No scheduled task touched.** Not disabled, enabled, re-run or edited — DOCTRINE §7, and doubly so on a reading this thin.
