# Station 00 — Supervisor | 2026-10-10T11:14Z–2026-10-10T11:35Z

**BLIND: `MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms` (CONNECT_TIMEOUT)** — no PowerShell shell on the Windows host this run. READ-ONLY, no board action taken. Reported loudly per the station contract: a blind run and a healthy quiet run both produce "no news", and this was the blind one.

**This is the FOURTH CONSECUTIVE blind Station 00 occurrence** (07:16Z, 08:15Z, 09:14Z, 11:14Z), with a fifth earlier marker at 00:00Z. The board has gone undriven for roughly four and a half hours.

**The two new facts this run carries, neither of which is a repeat:**

1. 🔴 **The workspace-bash VM is ALSO down** — `VM guest is not connected`, on two attempts. Every previous blind run in this episode still had the VM mount and used it to run `vm-git-guard.sh` and to read `.git` ref files. This run has **no shell of any kind**: not PowerShell on the host, not bash in the VM. The degradation has progressed beyond what 07:16Z–09:14Z reported.
2. ✅ **The native Cowork file tools (`Read` / `Glob` / `Grep`) still reach `C:\ProjectOperations2`, including `.git`, with both Desktop Commander AND the VM mount down.** This is operationally new and immediately useful: a blind run does **not** need the VM to COLLECT breadcrumbs or to read `.git` refs. Previous runs in this episode leaned on the VM mount for exactly those reads and would have reported total blindness without it.

## GROUND

```
UTC            2026-10-10T11:14:08Z (start, from lastRunAt)  /  ~11:35Z (end, INFERRED)
origin/main    70991313                      (.git ref file read natively; NOT via `git rev-parse` — no shell)
dev tree       main @ 70991313               C:\ProjectOperations2   (cleanliness UNVERIFIABLE — no git)
doc version    1                             (origin/main:docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                             (scheduled-task SKILL.md `station_doc_version: 1`)
```

Doc version and bootstrap **agree** (1 == 1). `contract_version: 5`. The READ-ONLY posture is forced by blindness, not by a version mismatch.

## WHAT I MEASURED

**1. Desktop Commander — ABSENT, after load attempts and a retry. [MEASURED]**

Schemas were loaded first per `BOOTSTRAP_PREFLIGHT_V1`, by keyword `ToolSearch` for `desktop-commander` — never by a hard-coded `select:` of assumed ids.

- Attempt 1, keyword `desktop-commander`: `No matching deferred tools found. Note: these configured MCP servers failed to connect … plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`
- Attempt 2, `select:mcp__desktop-commander__start_process,…`: identical `CONNECT_TIMEOUT`.

Not an `InputValidationError`, not an unloaded schema: the server never came up, so no id for `start_process` exists in this session to call. **No PowerShell shell was started on the Windows host.**

**Blast radius this run, for the falsifying probe the escalation file asks every run to record:**

| server | transport | this run |
|---|---|---|
| `plugin:desktop-commander:desktop-commander` | local stdio | **`CONNECT_TIMEOUT` after 30000 ms** |
| `plugin:prisma:Prisma-Local` | local stdio | **`CONNECT_TIMEOUT` after 30000 ms** |
| `plugin:pdf-viewer:pdf` | local stdio | `CONNECT_TIMEOUT` after 30000 ms |
| GitHub MCP, Microsoft Graph, Google, scheduled-tasks | remote | **connected and answered normally** |

Both local stdio servers fell together again. Note the `Prisma-Local` error string is `CONNECT_TIMEOUT` this run, not the `CONNECTION_CLOSED` recorded on 2026-09-01/06/22 — same direction, different string, recorded for the probe.

**2. Workspace-bash VM — ALSO UNREACHABLE. [MEASURED] — new this run**

```
mcp__workspace__bash: ls /sessions/sleepy-keen-thompson/mnt/ ; bash .../vm-git-guard.sh
→ bash failed on resume, create, and re-resume.
  resume: VM guest is not connected.; create: VM guest is not connected. (attempt 1 of 5)
```

Retried once per `BOOTSTRAP_CONNECT_RETRY_V1`; attempt 2 returned the identical error. **Two independent execution transports are down simultaneously** — the local stdio plugin bridge *and* the workspace VM guest. Every prior occurrence in this episode had the VM.

**3. Device-bridge git guard — COULD NOT BE INSTALLED. [CANNOT MEASURE] — no exit code exists**

The bootstrap requires the installer's last line and exit code be quoted "whichever outcome you got". There is no outcome to quote: `vm-git-guard.sh` runs *inside the VM*, against the VM's mount, and the VM guest is not connected. No shell existed in which to invoke it, so there is **no exit code, no headline line, and no shim**.

🔴 **This is a FINDING, not a stop, and the ban it encodes was honoured anyway for the strongest possible reason: there was no `git` binary reachable to misuse.** No `git` was invoked against `C:\ProjectOperations2\.git` this run in any form — not the protected one-call `PATH=` form, not via the VM, not natively. Every git fact below comes from reading ref files as **plain files**.

**4. Dev tree, by native plain-file read only — NOT a sweep, NOT coverage. [MEASURED]**

Via the Cowork `Read`/`Glob` tools directly against `C:\ProjectOperations2` — no VM, no `git`:

- `.git/HEAD` → `ref: refs/heads/main`
- `.git/refs/heads/main` → `70991313b82d3e8facaa9c26600c34dea39c921e`
- `.git/refs/remotes/origin/main` → `70991313b82d3e8facaa9c26600c34dea39c921e`
- **`.git/index.lock` DOES NOT EXIST**; nor do `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`. **No frozen-board lock to report** — nothing for Station 03 to clear.

**Local `main` == fetched `origin/main` == `70991313`, which is the SAME commit the 09:14Z blind run recorded.** `main` has not moved in the ~4.5 h spanning four blind occurrences. Independent corroboration, from an instrument unrelated to the MCP transport, that no station has driven the board since ~07:00Z.

**This says nothing about working-tree cleanliness** — `git status` / `--numstat` / `--cached` were all unavailable, so dirtiness is `[CANNOT MEASURE]`.

**5. Binding documents — station doc read from `origin/main` via the GitHub API. [MEASURED]**

`docs/pipeline/stations/00-supervisor.md` read at `refs/heads/main`, blob `399d30f1`, commit `70991313`. This is the API equivalent of the `?plain=1` blob fallback the contract permits, used because `git show origin/main:<path>` requires the shell I do not have.

`DOCTRINE.md` and `STATION-CAPABILITIES.md` were **not** read in full. That is a deliberate stop, not an instrument failure: PREFLIGHT step 1 says that when Desktop Commander is absent you write the blindness paragraph and end the run, and expressly forbids substituting GitHub-side reads and presenting them as coverage. Reading two more binding documents to drive a run I am not permitted to drive would be that substitution.

**6. Scheduled-task cross-reference — the freshness table, read but not acted on. [MEASURED]**

`list_scheduled_tasks` (cloud-side, unaffected by the local transport failure), crossed against breadcrumbs on disk:

| station | cron | `lastRunAt` | newest breadcrumb | verdict |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` (hourly) | **2026-10-10T11:14:08Z** (this run) | 09:14Z (blind) | **fires reliably, goes BLIND** — not MISSED |
| `04-scanner` | `0 */4 * * *` | 2026-10-10T10:09:45Z | 06:24Z | on cadence; next 14:09Z |
| `05-sot-keeper` | `10 0 * * *` (daily) | 2026-10-09T14:22:42Z | — | on cadence; next 14:22Z today |
| `03-machine-minder` | `0 9 * * *` (daily) | 2026-10-09T23:02:54Z | — | on cadence; next 23:02Z today |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32Z | — | `enabled: false` — disabled by design, not a MISS |

**No station is MISSED.** Cadence confirmed live per the bootstrap's own warning not to trust a pasted cadence: `cronExpression: 5 * * * *` — hourly. `jitterSeconds: 532` explains `lastRunAt` reading 11:14 against a `:05` cron.

⚠️ **Station 04 fired at 10:09:45Z and its newest breadcrumb is still the 06:24Z one.** On the doc's freshness table that is the row *"`lastRunAt` fresh, no breadcrumb"* — which resolves to either mid-run, or started-and-died, or ran-and-did-not-report. Confirming it requires `list_sessions` plus a transcript read; I have left it as a **lead**, not a finding, because a blind run should not be the thing that dispositions another station's health on a partial reading.

**7. Board state, GitHub-side — labelled as such, NOT watcher-tree coverage. [MEASURED]**

`list_pull_requests(state=open)` — **two** open PRs, and **both carry `do-not-merge`**:

| PR | title | head | labels |
|---|---|---|---|
| #2303 | fix(pipeline): refuse a HOLD whose own PR is already open | `01b79c9e` | `do-not-merge` |
| #2294 | fix(pipeline): dedupe section 5 PR crawl and add -SkipSection5 fast switch | `191a6e2a` | `do-not-merge` |

**WAITING ON MARCO: 2.** Recorded per `MARCO_QUEUE_LINE_V1`, which asks for the figure whenever arming is considered — nothing was armed this run.

**8. Queue root and escalation folder, by directory listing. [MEASURED]**

`docs/pr-prompts/` carries **six** breadcrumbs from this cycle, newest first:

- `00-00-supervisor-2026-10-10-0915-blind-third-consecutive-desktop-commander-connect-timeout.md`
- `00-00-supervisor-2026-10-10-0815-blind-second-consecutive-desktop-commander-connect-timeout.md`
- `00-00-supervisor-2026-10-10-0716-blind-desktop-commander-connect-timeout.md`
- `00-00-supervisor-2026-10-10-0614-collect-archived-0315-and-0416-and-root-caused-2303s-nine-red-tests-to-a-fail-closed-gate.md`
- `00-04-scanner-2026-10-10-0624-gate-liveness-three-gates-released-one-premise-refuted-by-geoapify-and-my-own-blob-probe-lied-on-crlf.md`
- `00-00-supervisor-2026-10-10-0000-blind-no-shell.md`

Read to establish the consecutive-blindness count and pick a non-colliding filename. **They were NOT collected and NOT dispositioned** — see WHAT I DID NOT DO. All are untracked in the dev tree awaiting a board PR; that backlog now spans four undriven cadences.

`docs/pr-prompts/needs-marco/` holds **54** escalation files, including `station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` — **this exact escalation, OPEN since 2026-09-01, now 39 days old.**

**9. Tracked-ness of the escalation file, established without `git ls-files`. [MEASURED]**

The contract warns `needs-marco/` is gitignored by rule and **partly tracked in fact** (6 of 61 files on 2026-09-22), that `git check-ignore` cannot answer the question, and to run `git ls-files` before appending. I have no shell, so I answered it the only other sound way: `get_file_contents` at `refs/heads/main` for that path returned **"the file does not exist in the repository"** → **not on `main`, therefore not tracked there, therefore an append cannot ride into another actor's commit.** Recorded because it is a reusable substitute instrument for a blind run.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, no PR merged, updated or labelled, no branch created, no scheduled task touched, no file in `sot/`, no lease taken, no archive.

**Two additive file writes, both outside the board:**

1. This breadcrumb, into the dev tree's tracked `docs/pr-prompts/` directory (untracked file, awaiting the sweep).
2. One appended occurrence block to `docs/pr-prompts/needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`, under the section that explicitly invites it (*"append one block per recurrence — do not rewrite the analysis above"*). The analysis above it was not altered. Tracked-ness verified first per measurement 9.

## FINDINGS

**F1 — Station 00 has been blind for FOUR consecutive occurrences, and this run both execution transports are gone, not just one.**

07:16Z, 08:15Z, 09:14Z and 11:14Z all failed at `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT: 30000 ms)`. This run adds that `mcp__workspace__bash` returned `VM guest is not connected` on both attempts — **the first occurrence in this episode with no shell of any kind.** Corroboration from an unrelated instrument: `origin/main` and local `main` both still read `70991313`, the same commit the 09:14Z run recorded, so `main` has not moved across the whole 4.5 h window. Meanwhile `list_scheduled_tasks` shows every enabled station's `lastRunAt` advancing on cadence and every remote MCP server answering normally — so this is **not** a scheduler fault and **not** a pipeline-wide fault. It is this session's **local execution transports**.

**The ask is 39 days old and unchanged.** `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` has been OPEN since 2026-09-01 and already carries the RULE 1 options, Station 04's two independent requests for the same instrument, and a counter-example. **Adding a 55th escalation file for the same question would violate §10.5 (one artifact, one identity).** I appended the occurrence instead.

RULE 1 options for Marco, complete-and-additive first, unchanged in substance from the existing file and restated only because the blast radius widened:

1. **Lift the local stdio MCP connect timeout and pre-warm those servers before the station body runs, and record every run's step-1 outcome to a tracked append-only file.** Complete immediately (the cadence gets a shell) and in future (the blind rate becomes a measured series instead of archaeology across breadcrumb filenames); additive — it adds a route and a counter, changes no board semantics and touches no data entry. **This is the RULE 1 option**, and it is what Station 04 asked for on 2026-09-25 and again on 2026-10-06.
2. **Restart the Desktop Commander plugin / the Claude desktop app on the host.** Fixes it immediately, fixes nothing in future — the next timeout is silent again. **Fails the "future" half.**
3. **Leave it.** **Fails both halves**: an hourly station producing no coverage while reporting normally is a monitoring system reporting on itself.

**DISPOSITION: ESCALATED** — Marco, via an appended occurrence block on the existing 2026-09-01 file rather than a new one. The question is one line and unchanged: **option 1 (raise the timeout + pre-warm + a tracked step-1 probe), option 2 (a host-side restart is the whole intended answer), or neither for now?** Nothing in this repo configures the MCP connection or the VM guest, so no prompt, PR or station fix can reach it — this is yours to decide and yours to apply.

**F2 — NEW AND IMMEDIATELY USEFUL: the native Cowork file tools reach the dev tree when both Desktop Commander and the VM mount are down.**

[MEASURED] this run: `Glob` and `Read` against `C:\ProjectOperations2` returned real content — the pipeline doc tree, the queue root, `needs-marco/`, and `.git/HEAD`, `.git/refs/heads/main`, `.git/refs/remotes/origin/main`, plus a negative existence check on `index.lock` / `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` — with **no VM and no `git`**. Every prior blind run in this episode read those same facts *through the VM mount* and would have reported itself totally blind had it tried this run's conditions.

**Why it matters:** it means blindness has two distinguishable degrees, and the worse one is still not total. A blind run can always COLLECT (read every breadcrumb), read `.git` refs to prove whether `main` moved, check for a frozen-board lock, and resolve tracked-ness via the GitHub API (measurement 9). What it still cannot do is **mutate**: every sanctioned primitive (`status-sweep.ps1`, `pipeline-lib.ps1`, `Enter-BoardLease`, `Merge-Pr`, `arm-prompt.ps1`, `check-breadcrumb.mjs`, `retire-escalation.mjs`) is a PowerShell or node call on the host. The READ-ONLY stop is therefore correct and unaffected — what changes is how much a stopped run can still *see* and report.

This belongs in `00-supervisor.md` as a note on PREFLIGHT step 1, alongside the fourth MISSED-taxonomy row the 09:14Z run proposed (*fired and blind*). I cannot open that PR this run.

**DISPOSITION: DEFERRED** — real, not now; it needs a PR and a host shell. It is already actionable by the next blind run **through this breadcrumb**, which is the channel that works. It becomes urgent if a blind run reports total blindness without first trying native file reads, since that would be a §7 instrument lie in the one step every run begins with.

**F3 — Six breadcrumbs are untracked and uncollected across four undriven cadences.**

COLLECT is Station 00's own first duty and it requires `check-breadcrumb.mjs --freshness`, `retire-escalation.mjs`, `git mv` to `archive/` and a board PR — all of which need the host shell. Collecting partially from GitHub-side reads is exactly the substitution PREFLIGHT step 1 forbids. The contract's named risk stands: once a PR lands any of these exact paths on `main`, the untracked copies in the dev tree block the next `git merge --ff-only` while `--numstat` and `--cached` both read EMPTY — the documented PASS reading. **The next sighted Station 00 run should expect to run the fast-forward cure** (`00-supervisor-REFERENCE.md` §POST-MERGE-FF-CURE: raw-Buffer restore from `HEAD`, never `git checkout --`, never `git clean`) **and should treat COLLECT of this backlog as its first duty, ahead of any arm.**

**DISPOSITION: ESCALATED** — folded into F1's single question rather than deferred a fourth time, following the 09:14Z run's reasoning: deferring the same finding each hour while its trigger passes is how a real backlog turns into "no news". The backlog needs no decision from Marco — it needs one sighted run — so the only thing escalating is the shell.

**F4 — The cost of this outage is bounded, and that bound is worth stating: both open PRs are parked on Marco's label, so no merge window has been lost.**

[MEASURED] `list_pull_requests(state=open)` returns exactly #2303 and #2294, **both labelled `do-not-merge`**. Station 00 never removes that label and never merges such a PR, so even a fully sighted run could have merged nothing this hour. **The four blind cadences have cost arming and COLLECT — not merges.** This is the direct counterpart to the 2026-09-23 occurrence recorded in the escalation file, where a blind hour *did* coincide with Marco releasing labels and he merged two PRs by hand. The urgency trigger that fired then has not fired now.

**DISPOSITION: DEFERRED** — nothing to act on; it bounds F1's urgency rather than adding to it. It becomes urgent the moment a `do-not-merge` label comes off #2303 or #2294, because from that moment a blind hour is a lost merge window rather than a lost no-op.

**F5 — `vm-git-guard` has no exit code this run, because the VM it installs into does not exist.**

The bootstrap and PREFLIGHT both require the installer's last line and exit code be quoted whichever outcome occurred, on the premise that the three outcomes are non-zero / 2 / 0. **There is a fourth: no shell to run it in.** Quoted as `[CANNOT MEASURE]` under WHAT I MEASURED rather than silently omitted, because an install nobody can see in the report is indistinguishable from one that never ran — and that ambiguity is the exact reason the quoting rule exists. The ban it encodes was honoured absolutely: no reachable `git` binary existed.

**DISPOSITION: DEFERRED** — a one-line doc clarification (a fourth row: *no shell — guard not installable; record `[CANNOT MEASURE]`*), to ride along with the F2 doc change on the next sighted run.

## WHAT I DID NOT DO

- **No `git`, in any form, against `C:\ProjectOperations2\.git`** — not natively, not via the VM, not the protected one-call `PATH=` form. Every git fact above comes from reading ref files as plain files.
- **No `status-sweep.ps1`, no `pipeline-lib.ps1`, no `smoke-pr.ps1`, no `arm-prompt.ps1`, no `Enter-BoardLease`** — all require the PowerShell host shell. **No `[LIVE]` verdict exists for this run**, so nothing here should be read as one.
- **No COLLECT, no dispositioning of other stations' findings, no `check-breadcrumb.mjs` run** (including against this file — so this breadcrumb is **not** claimed `breadcrumb-clean`; no validator has been run on it), **no `--freshness` read, no `retire-escalation.mjs`, no archiving.** The `list_scheduled_tasks` read above is a freshness *cross-reference*, not COLLECT.
- **No `[STALE]` escalation row cleared or retired.** `retire-escalation.mjs` needs the shell, and `gh pr view` per-PR confirmation is unavailable.
- **No disposition of Station 04's 10:09:45Z run**, which fired with no newer breadcrumb. Left as a lead under WHAT I MEASURED; confirming it needs `list_sessions` and a transcript read, and a blind run should not call another station's health on a partial reading.
- **No scheduled task disabled, enabled, re-run or edited** — forbidden on a freshness/blindness reading alone, and expressly so on the reading I have.
- **No merge, no arm, no label change, no branch update, no PR opened** — a blind run has no RULE-2 verdict and no lease, and DOCTRINE §10.1 says the absence of a watcher verdict must never be read as "cleared for merge".
- **No 55th `needs-marco/` file for a question that already has one.** §10.5 gives an artifact one identity for its whole life; I appended an occurrence block to the 2026-09-01 file after verifying it is untracked.
- **No `sot/` edit**, nothing in Azure / Entra / SharePoint, no production data.
- **This report was not left in the session's `outputs` folder.** It is in the dev tree at `docs/pr-prompts/`, untracked, for the sweep — the measured failure mode of 2026-09-22 was a blind run whose complete report reached nobody because it went to `outputs`.
