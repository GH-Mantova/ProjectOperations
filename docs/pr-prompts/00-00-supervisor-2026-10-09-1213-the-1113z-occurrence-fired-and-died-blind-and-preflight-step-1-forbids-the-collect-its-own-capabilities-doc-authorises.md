# Station 00 — Supervisor | 2026-10-09T12:14:26Z–2026-10-09T12:4xZ

## GROUND

```
UTC            2026-10-09T12:14:26Z
origin/main    f01c95d2            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ f01c95d2     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter, contract_version 5)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. Run proceeded with full authority.

**Sighted run.** Desktop Commander loaded by one keyword `ToolSearch` for `desktop-commander`;
`start_process` shell `powershell.exe` returned a live prompt on the first call, PID 14804, with a
second shell PID 14620 opened later for parallel probes. Not blind. No `CONNECT_TIMEOUT`, so
BOOTSTRAP_CONNECT_RETRY_V1's 60 s retry was not needed.

## WHAT I MEASURED

**Git guard — the installer's own last line and its own exit code, not a pipeline's.**
[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → exit **2**.
Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Last line: `   PATH="/sessions/ecstatic-busy-wright/.local/bin:$PATH" git <args>`.
Controls printed by the installer itself: `bash -lc 'command -v git'` →
`/sessions/ecstatic-busy-wright/.local/bin/git` (the shim); `bash -c 'command -v git'` →
`/usr/bin/git` (the real git). This is the contract's EXPECTED station outcome — a FINDING, not a
stop. The device-bridge git ban is therefore REMEMBERED, not mechanical, for this run. I ran no
`git` through the mount; every `git` and `gh` in this report ran in `powershell.exe` on the Windows
host.

**Binding reads.** [MEASURED] All three read with `git show origin/main:<path>` in the DEV tree
after `git fetch origin` (exit 0), never from the working copy: `00-supervisor.md` (64,870 B),
`DOCTRINE.md` (60,566 B), `STATION-CAPABILITIES.md` (98,898 B) — the two cores in full,
STATION-CAPABILITIES in full, per BOOTSTRAP_CORE_REFERENCE_V1. No piped
`git show … | git hash-object --stdin` comparison was made anywhere in this run (§9.2).

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1` ran to completion. Section 0 positive
controls both `[LIVE]` (`gh CAN reach GitHub (saw merged PR #2283)`, `node runs`), **no
`[BROKEN]`**. Board: **OPEN PRs 0**, **WAITING ON MARCO 0**, ALL OPEN (non-draft) 0. `main` CI on
`f01c95d2`: **4 success / 0 failed / 0 running (trunk green)**. Watcher node **RUNNING pid 8848**,
auto-restart wrapper alive (1), heartbeat age 164 min — stale **with an empty queue, which is idle,
not wedged** (§9.5: the heartbeat ticks only mid-run). Watcher clone `branch=main
tracked-dirty=0 untracked=3`. 33 non-main worktrees.

🔧 **A second sweep in the same shell drained ~20 lines per `read_process_output` call and cost
most of this run's wall clock. The capture I attempted to avoid that did not work and I am
recording why, because the obvious cure is the broken one:** `& status-sweep.ps1 2>&1 | Out-String
| Set-Content <file>` captured **nothing** — the script reports through `Write-Host`, which writes
to the host console and is not in the pipeline at all in PS 5.1 (§7 standing guard 6 is the same
mechanism seen from the other side). The sweep is not redirectable by that form. `2>&1` does not
help because `Write-Host` is neither stdout nor stderr. I read the first sweep's output with
explicit offsets until it stabilised instead, which is what §9.1 prescribes.

**Safe-to-act, re-measured immediately before mutating, per the four board-driving conditions.**
[MEASURED] at `2026-10-09T12:20:39Z`: `C:\ProjectOperations2\.git\index.lock` **False**,
`C:\po-watcher\ProjectOperations\.git\index.lock` **False**, `MERGE_HEAD` **False**. Newest remote
PR activity `#2283 updatedAt 2026-10-09T10:30:07Z` — **110 minutes old**, so nothing was touched in
the last ~2 min. Armed prompts **0**, so no watcher build was in flight. Condition 3 satisfied:
`Enter-BoardLease -Actor 'station-00.scheduled'` returned **True** with `$env:PO_ACTOR` set to the
same string, per the 2026-10-09 `-Actor` measurement in my own station doc.

**COLLECT — two breadcrumbs in the queue root.** [MEASURED] `node
scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **2**:

```
00  last 2026-10-09T10:14:00Z   2.1h ago  (cadence 1h + grace 0.5h)  MISSED
02  dispatch-only — no cadence to miss
03  last 2026-10-08T23:06:00Z  13.2h ago  (cadence 24h + grace 3h)   ok
04  last 2026-10-09T10:10:00Z   2.2h ago  (cadence 4h + grace 1h)    ok
05  last 2026-10-08T22:38:00Z  13.7h ago  (cadence 24h + grace 3h)   ok
```

`structure: 2 checked, 0 malformed, 0 skipped as pre-contract`, both `ADMIT`, with
`NOTE 00-04-scanner-…1010… is UNTRACKED`. **MISSED is a lead, not a verdict** — classified in F47.

- `00-00-supervisor-2026-10-09-1014-…` (TRACKED, landed by #2283): F44 ACTIONED, F45 ACTIONED,
  F46 DEFERRED — every finding dispositioned by its author, nothing left for me. Its `FOR MARCO`
  section carries two standing questions already with him (the `REVIEWED-SHA` anchor; who runs
  Codex) and the note that 33 worktrees go to Station 03 at 23:02Z. **I re-ask none of them.**
  ARCHIVED to `docs/pr-prompts/archive/` in this PR.
- `00-04-scanner-2026-10-09-1010-…` (UNTRACKED): F1 **DISPATCHED to me**, F2 DEFERRED, F3
  DEFERRED. Swept into this PR at its tracked path. F1 is ACTIONED below; F2 and F3 I confirm as
  their author dispositioned them.

**Live schedule, from the scheduled-tasks MCP — never from a file, never from the folder list.**
[MEASURED] **FOUR** enabled tasks: `00-supervisor` `5 * * * *` (lastRunAt `2026-10-09T12:13:56Z` —
**this run**, nextRunAt `13:13:52Z`, jitter 532 s), `04-scanner` `0 */4 * * *` (`10:09:34Z`),
`05-sot-keeper` `10 0 * * *` (`2026-10-08T22:38:07Z`), `03-machine-minder` `0 9 * * *`
(`2026-10-08T23:06:07Z`). `weekly-security-audit` **`enabled: false`**, lastRunAt
`2026-09-06T21:32:44Z` — STATION-CAPABILITIES §1's falsifying probe still reads `false`, so that
correction is still current and the live enabled count is still four.

**Arming — 13 of 13 HOLDs refuse, each with a NAMED gate, re-measured at `f01c95d2`.** [MEASURED]
`node scripts/pipeline/lint-prompt.mjs` per file. **0 armed prompts** at depth 1, and none tracked.

| prompt | refusal |
|---|---|
| pr-524-rates-b-slice2-canonical | HUMAN_GATE_PRESENT — line 3 `DO NOT ARM` |
| pr-fv2-ai-digests | FILE_GATE_NOT_RELEASED — `ai-form-import.service.ts` not on main |
| pr-fv2-output-channels | FILE_GATE_NOT_RELEASED — `form-digests.service.ts` not on main |
| pr-nav-jobs-projects-merge | HUMAN_GATE_PRESENT — `do-not-arm` marker |
| pr-queue-layout-sot-entry | HUMAN_GATE_PRESENT — `do-not-arm` marker |
| pr-rates-s11c-drop-legacy-tables | FILE_GATE_NOT_RELEASED — Marco approval file absent |
| pr-retire-tenderclientnote-s2 | HUMAN_GATE_PRESENT — line 4 `DO NOT ARM` |
| pr-scopecards-s8b-azure-maps-travel | HUMAN_GATE_PRESENT — `do-not-arm` marker |
| pr-sec-a2-email-codes-and-reset-links | HUMAN_GATE_PRESENT — `do-not-arm` marker |
| pr-siteid-notnull-backfill | HUMAN_GATE_PRESENT — `do-not-arm` marker |
| pr-tenant-mt4-s2-ownership-migration | FILE_GATE_NOT_RELEASED — Marco approval file absent |
| pr-tipid-s3-retire-the-name-guard-for-an-id-check | GATE_NOT_RELEASED — `waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` absent |
| pr-vendor-invoice-ocr | HUMAN_GATE_PRESENT — `do-not-arm` marker |

**MARCO_QUEUE_LINE_V1 figures, copied as the rule requires:** `OPEN PRs: 0` ·
`WAITING ON MARCO: 0 open PR(s) labelled do-not-merge`. I armed nothing, so neither figure moved.

**Dev tree, all four contract readings.** [MEASURED] `git rev-list --left-right --count
HEAD...origin/main` → `0 0`; `git diff --numstat` → **`2 2 docs/pipeline/sweep-rotation.json`**;
`git diff --cached --name-status` → EMPTY; `git status --porcelain` → 34 lines (1 ` M`, 33 `??`).
The one tracked modification is 04's rotation advance, which it left for me on purpose — committed
in this PR. The untracked set is `.codex/`, `AGENTS.md`, 4 `Claude Design/` paths, 04's breadcrumb
(swept here) and 27 `docs/pr-reviews/pr-*-review.md`.

**04's F1 re-verified against the live system before I acted on it (§7.1 re-read rule), not taken
on its word.** [MEASURED] `git show origin/main:docs/pipeline/SCRIPT-REGISTRY.md` line **100** reads
`` `C:\po-watcher\ensure-watcher.ps1:10` names the same file as its launcher. ``. The target file,
read as bytes with `[System.IO.File]::ReadAllLines` and never through `Get-Content` piping (§9.3),
is **110 lines**: line 10 = `$LogPath   = 'C:\po-watcher\ensure-watcher.log'`, line 12 =
`$Launcher  = 'C:\po-watcher\watcher-launcher-singlelane.ps1'`. **The citation points at the log
and claims to point at the launcher.** Confirmed independently of 04's reading.

## WHAT CHANGED

One board PR, from a disposable worktree off `origin/main` on the Windows FS
(`C:\po-wt\sup-1213`, branch `board/collect-2026-10-09-1213`, created at `f01c95d2`), torn down at
the end of the run. Never the dev tree, never `C:\po-watcher`, never the sandbox tree.

1. **`docs/pipeline/SCRIPT-REGISTRY.md`** — 04's F1, option (a) verbatim: the line citation replaced
   by the anchor form `03-machine-minder.md` already uses. Applied with a raw-Buffer node write
   (`fs.writeFileSync(p, Buffer.from(txt, 'utf8'))`), never `Set-Content`/`Out-File` (§9.3, BOM).
   Read back: `ensure-watcher.ps1:10` → **0** remaining in the file, `(anchor: ``$Launcher =``)` →
   **1**, `U+FFFD` → **0**, `git diff --numstat` → `2 1` (the one-line sentence became two lines).
   The inserted newline arrived as a lone `LF` in a 145-CRLF file; I measured that
   (`before crlf=145 lone_lf=1`) and normalised it (`after crlf=146 lone_lf=0`) rather than ship a
   mixed-EOL blob — the exact hazard the contract's fast-forward cure warns about.
2. **`docs/pipeline/sweep-rotation.json`** — committed from the dev tree as 04 explicitly handed
   over (`last_index=3`, `last_run_utc=2026-10-09T10:09:53Z`, `last_station=04-scanner`). 04 is
   read-only on the board and the dev tree is on `main`, which nobody commits to. **Without this
   commit the next 04 run repeats `instruction-drift` and the rotation silently stops.**
3. **`docs/pr-prompts/00-04-scanner-2026-10-09-1010-…md`** — swept from the dev tree into this PR
   at its tracked path, so it reaches somebody.
4. **`docs/pr-prompts/00-00-supervisor-2026-10-09-1014-…md`** — `git mv` to
   `docs/pr-prompts/archive/` (exit 0), every finding in it already dispositioned.
   `check-breadcrumb.mjs` matches by basename, so it still counts for `--freshness`.
5. **This breadcrumb**, written inside the PR worktree — Cure 1, so it needs nobody to sweep it up
   and leaves no untracked file in the dev tree to block the next fast-forward.

Nothing armed, disarmed, renamed or moved in the queue. Nothing merged. No label added or removed.
No `gh pr update-branch` on anything. No `/sot/` path in this PR (CP-24). No scheduled task
enabled, disabled, run, re-run or edited. Scratch `.mjs` probes written to
`C:\po-sup-fix-scripts\`, the sanctioned scratch folder, not into the repo.

## FINDINGS

### F47 — S3 — The 11:13Z occurrence FIRED AND DIED BLIND, which is why `--freshness` reads `00 MISSED`; it is not a never-fired and not a dead schedule

`--freshness` exit **2** with `00 … 2.1h ago (cadence 1h + grace 0.5h) MISSED`. The station doc's
own table says MISSED is a lead and must be classified before it is dispositioned, so I crossed two
further instruments against it.

[MEASURED] **`lastRunAt` from the scheduled-tasks MCP is `2026-10-09T12:13:56Z` — this run** — and
it holds only the most recent occurrence, so it cannot answer for 11:13 by itself (§9.5). I
therefore scanned the local-agent-mode session directory at depth with **no name filter** (the
directory name changed 2026-09-15) and took `CreationTimeUtc`:

| session dir | CreationTimeUtc | station |
|---|---|---|
| `33044e5a` | 2026-10-09 09:13:54 | 00 supervisor |
| `e2dae388` | 2026-10-09 10:09:34 | 04 scanner |
| `3e700b3b` | 2026-10-09 10:13:54 | 00 supervisor |
| **`73f0427b`** | **2026-10-09 11:13:55** | **00 supervisor** |
| `a6efb39d` | 2026-10-09 12:13:56 | 00 supervisor (this run) |

**A session folder exists for 11:13:55.** The occurrence fired. I then read its transcript
(`local_73f0427b-140d-435a-923d-efb2ce61de6f`, "00 supervisor", idle). Its first assistant turn is
not an API error — it is a correct, complete blindness report whose first line is
`BLIND: MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms`
`(CONNECT_TIMEOUT)`, aborted at STEP 1 at `11:15:40Z`. It loaded the schemas first, searched
`desktop-commander` by keyword three times, waited 62 s per BOOTSTRAP_CONNECT_RETRY_V1, searched
once more, and the toolkit never materialised — **a failure after a successful load attempt, i.e.
genuine blindness, not an unloaded schema**. It armed, merged, labelled and committed nothing, and
it explicitly refused to substitute GitHub-side reads as coverage.

**Classification: `fired and died`** — the second row of the station doc's three-way
FRESHNESS_ONE_CADENCE_V1 split. **Not `never fired`**, so the two-consecutive-occurrences
escalation trigger does not fire: the schedule is healthy (`nextRunAt 13:13:52Z`) and this run, one
cadence later on the same surface, reached the box on its first call. Blindness remains intermittent
with an unknown cause, exactly as STATION-CAPABILITIES §2 records, and it must never be inferred
from a quiet result in either direction.

**DISPOSITION: ACTIONED** — classified from three independent instruments (breadcrumb dates, MCP
`lastRunAt`, session-directory `CreationTimeUtc` + transcript) and recorded here so the next run
does not re-derive it or read the `MISSED` row as a dead station. Forbidden on this reading alone
and not done: disabling, enabling, running, re-running or editing any scheduled task.

### F48 — S2 — PREFLIGHT step 1 orders a blind run to END THE RUN, and the correction authorising it to COLLECT first lives in a document step 1 stops before reading

This is the live cost of F47, and it is structural rather than anybody's mistake.

[MEASURED] The bootstrap's STEP 1 and the hash-gated station-contract block in
`00-supervisor.md` both say, of a post-load Desktop Commander failure: *"**STOP.** Write one
paragraph saying you are blind, name what you could not reach, and end the run."* Neither mentions
that a blind run can still read anything. The corrections that say otherwise are **all in
`STATION-CAPABILITIES.md` §3** and all landed:

- the 2026-09-05 correction: *"THE STOP STANDS. WHAT IS FALSE IS 'A BLIND RUN CAN SEE NOTHING' —
  and that error costs every blind run its COLLECT"*; the Cowork mount `/sessions/<id>/mnt/
  ProjectOperations2/` **is** the live dev tree;
- `BLIND_RUN_OTHER_MOUNTS_V1` (2026-09-08): eleven mounts, `po-watcher` among them;
- `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1` (2026-09-10): with Desktop Commander at `CONNECT_TIMEOUT`
  — **the identical failure to 11:13Z** — the Cowork native file tools read the binding documents,
  the breadcrumb corpus and the queue census, and are read-WRITE, which is how a blind run leaves
  a breadcrumb at a tracked path;
- and the explicit instruction: *"A blind run therefore reports blindness as loudly as ever, and
  stops before acting — but it COLLECTS first, and says which of the two it did. 'I was blind, so I
  did nothing' and 'I was blind, so I read everything readable and acted on none of it' are
  different reports, and until this correction the second one was unavailable."*

**PREFLIGHT's steps are numbered and step 1 is terminal on failure, so the 11:13Z run ended before
step 2 — which is the step that reads the file carrying all four corrections.** Its own report says
so plainly: *"No station docs read … I did not read them from the working copy and did not
improvise behaviour from the bootstrap."* That was the correct reading of the instruction it had.
The result is that the retired report shape was produced, one full hourly cadence of COLLECT was
lost, and 04's F1 dispatch sat unactioned an extra hour. [INFERRED] Any future blind run reading the
same instruction does the same thing, because nothing in the terminal step points forward.

⚠️ **The falsifying probe:** `Select-String -Pattern 'COLLECT' ` over the four live bootstraps'
STEP 1 blocks and over the station-contract PREFLIGHT step 1. If either ever names COLLECT or
points at STATION-CAPABILITIES §3, this finding is wrong and must be re-measured.

**RULE 1 options.** Complete-and-additive FIRST:

- **(a) Add one forward pointer to PREFLIGHT step 1's stop paragraph, in both layers, saying what a
  blind run does before it stops** — e.g. *"Before you end the run: a blind run is not a dead run.
  Read `STATION-CAPABILITIES.md` §3 through the Cowork mount or the native file tools, COLLECT every
  breadcrumb, and say which of the two reports you are filing."* Solves it **immediately** (the next
  blind run is told, in the only step it reaches) and **in future** (the pointer does not rot — it
  names a section, not a line), damages no data entry, and takes nothing away: the STOP, the
  no-GitHub-substitution rule and the whole ceiling in §3 are untouched. Cost: the station-doc half
  sits **inside the hash-gated `station-contract v5` canonical block**, so it is byte-identical in
  all seven station docs and `lint-station.mjs` fails any partial edit — it must ship as all seven
  plus a re-recorded hash, one PR. The bootstrap half is the **scheduled-task layer, which only
  Marco can paste**, so the two halves cannot land together and the docs will be ahead of the
  bootstraps for one paste cycle.
- (b) Edit only the four bootstraps. Fails the **future** half: the bootstrap is the layer that
  drifts, the station doc is the versioned one, and STATION-CAPABILITIES §1's standing instruction
  is to prefer the repo doc precisely because it is the only layer an agent can change.
- (c) Leave it; rely on each blind run reaching for the mount on its own. Fails the **immediate**
  half, and it has now been measured failing: this is at least the second blind run to file the
  retired shape, and the 2026-09-10 run that landed the correction had to discover the transport
  itself mid-run.

**DISPOSITION: ESCALATED.** Not because I could not write option (a) — I could write the
seven-doc half — but because it crosses two hard boundaries at once: a **hash-gated canonical block
shared by every station**, where a partial edit fails CI and a wrong one changes what every station
does on its worst day; and the **scheduled-task layer, which no agent may edit**. §5's design
question also applies: whether a blind run should COLLECT before stopping is Marco's call about how
much a blind actor is trusted to do, and only he knows his intent. The question for him is in
`FOR MARCO` below, with the two halves priced.

### F49 — S3 — 04's F1 citation rot: ACTIONED

The last surviving pathful line-number citation in the pipeline docs
(`SCRIPT-REGISTRY.md:100` → `C:\po-watcher\ensure-watcher.ps1:10`) pointed two lines off and named
the log where the sentence claims the launcher. Re-verified against the live file before acting
(see WHAT I MEASURED), fixed with option (a) verbatim, read back with controls (see WHAT CHANGED).

Post-fix verification, exactly as 04 specified it: `ensure-watcher.ps1:10` in
`docs/pipeline/SCRIPT-REGISTRY.md` → **0**; the anchor form present → **1**; and the two
`ensure-watcher.ps1:10` hits in `DOCTRINE-REFERENCE.md` **left untouched at 2** — they are that
document quoting the citations it retired, which is correct text and must not be swept.

**DISPOSITION: ACTIONED** — one line, one file, `docs/pipeline/`, inside 00's recorded docs lane,
landing in this PR.

### F50 — S4 — The board is legitimately empty for a third consecutive cycle, and every HOLD refusal names its own gate

[MEASURED] 0 open PRs, 0 labelled `do-not-merge`, 0 armed, trunk green on `f01c95d2`, and 13 of 13
HOLDs refuse with a named gate re-measured at that SHA (table above). Six are HUMAN_GATE_PRESENT
(Marco's marker), five are FILE_GATE_NOT_RELEASED or GATE_NOT_RELEASED on a file that genuinely is
not on `main`, and two of the five are the Marco-approval class that drops database tables. There
was no ADMIT to weigh, and lint ADMIT would have been necessary rather than sufficient anyway
(§9.5). `check-backlog.mjs` still reports `[P2] rates-11c-blocked-consumers` READY TO STAGE; I left
it for the same reason 04 did, and recorded in WHAT I DID NOT DO why.

**DISPOSITION: DEFERRED** — real, and not now. What would make it urgent: a HOLD whose named gate
has in fact been met (a run finding an ADMIT on this table), or
`docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` reaching `main` and the
`pr-tipid-s3` prompt staying blocked afterwards. Neither holds.

### F51 — S4 — The git guard reports INERT, so the device-bridge git ban is remembered, not mechanical

Exit **2**, quoted in full with both of the installer's own controls in WHAT I MEASURED. This is the
contract's documented EXPECTED station outcome, recorded for the count rather than as a defect, and
nothing in this run reached for the absent protection as a licence.

**DISPOSITION: DEFERRED** — identical to 04's F2 this morning, and I am not double-counting it as a
new defect. It becomes urgent the moment a run is blind, because a blind run has no Windows shell
and the remembered ban is then the only thing between it and the 0-byte `index.lock` that freezes
every station (§9.2) — and F47 shows a blind run happened **one hour ago on this surface**. The
structural fix (a wrapper putting the shim on the `PATH` of the non-interactive, non-login shell a
station is actually given) is a `scripts/pipeline/` change, outside 00's docs lane and outside the
instrument lane's NEVER-list rules, so it is Marco's. It is named in `FOR MARCO` as the cheaper half
of the same blind-run question F48 asks.

## WHAT I DID NOT DO

- **Did not arm anything.** 13 of 13 refuse with a named gate (table above). 0 armed before, 0
  after; the WAITING ON MARCO line did not move.
- **Did not stage `rates-11c-blocked-consumers`** although `check-backlog.mjs` reports it READY TO
  STAGE. Its own register note says 11c must not merge until `pr-rates-11b2-c-parity-proof` has RUN
  and come back clean and the prep corrections have landed — preconditions I cannot verify this run
  — and the two `needs_marco` backlog items (`model-merge-slices-rehomed`,
  `map-locations-waste-rate-coupling`) are his and are not re-asked. Reported, not run.
- **Did not merge anything.** `OPEN PRs: 0` — there was nothing on the board, so
  `Assert-SmokedOrEscalate` → `Merge-Pr` had no subject, no instrument-lane merge was possible, and
  no receipt was owed. No QUEUED PR from a previous run to confirm either.
- **Did not re-dispatch the 33 stale worktrees.** F42 of the 09:13 breadcrumb dispatched them to
  Station 03 for tonight's `23:02Z` occurrence and the 10:14 run deliberately did not re-dispatch;
  doing so now would double-count an open handover for the third time. I pruned, force-removed and
  `git clean`ed none of them — repairing the machines is 03's lane, and a supervisor pruning another
  station's trees is LL-38 reproduced. The sweep names several holding unpushed commits and
  `C:/po-worktrees/sup-cwd-paths` holding 2 uncommitted files; all are inside that set.
- **Did not clear any lock.** Both `index.lock` probes read `False` — there was nothing to assess as
  stale, and clearing one is 03's on 00's dispatch in any case.
- **Did not retire any escalation.** No `[STALE]` row appeared: every `needs-marco/` file the sweep
  cross-checked cites merged PRs **as evidence, not as premise**, which the sweep itself states does
  not clear them, and the ones with no PR ref are explicitly unreadable as current. So
  `retire-escalation.mjs` was not called, and `docs/pipeline/discharges/` was not written.
- **Did not edit the station-contract canonical block or any bootstrap** over F48 — see that
  finding for why both halves are escalations rather than edits.
- **Did not touch `/sot/`** (Station 05 only) and mixed no `sot/` path into this PR (CP-24).
- **Did not run `check-breadcrumb.mjs` before writing this file** — it validates a breadcrumb that
  exists. Its post-write result is quoted below, and I have written `breadcrumb-clean` nowhere else.
- **Touched nothing in Azure, Entra or SharePoint, no production data, no secrets, no deploy
  config.** Absolute, and no part of this run went near them.

---

### FOR MARCO

The board needs nothing from you: **0 open PRs, 0 waiting on you, 0 armed**, trunk green on
`f01c95d2`, watcher running, all four enabled stations accounted for. One hour was lost to a blind
run, and that is the question below.

**New this cycle — one question, two halves, both yours.**

At **11:13Z** a Station 00 occurrence fired on this surface and died at STEP 1: Desktop Commander
timed out at connect. It behaved correctly by its instructions and produced no breadcrumb, so the
hour's COLLECT was lost and 04's dispatched citation fix waited an extra cycle. The instruction it
followed — *"write one paragraph, end the run"* — is terminal at step 1, while the corrections
saying a blind run **can** still read the dev tree through the Cowork mount and COLLECT every
breadcrumb all live in `STATION-CAPABILITIES.md` §3, which is step **2**. A blind run cannot reach
the page that tells it what it can still do.

1. **Should a blind run COLLECT before it stops?** If yes, the complete-and-additive fix is one
   forward pointer added to PREFLIGHT step 1's stop paragraph in both layers. The repo half is
   mine to write but it sits inside the **hash-gated `station-contract v5` block that is
   byte-identical in all seven station docs**, so it ships as one PR touching all seven plus a
   re-recorded hash — I will not open that without your word, because it changes what every station
   does on its worst day. The bootstrap half only you can paste, so the docs would lead the
   bootstraps by one paste cycle.
2. **And the cheaper half of the same problem:** `vm-git-guard.sh` has now reported `INERT` (exit 2)
   on every run that quotes it, because it writes its `PATH` export into `~/.bashrc` / `~/.profile`
   and a station's shell is non-interactive and non-login, so it sources neither. A blind run has no
   Windows shell, so that remembered-not-mechanical ban is the only thing standing between it and
   the 0-byte `index.lock` that freezes every station. A wrapper that puts the shim on the `PATH` of
   the shell a station is actually given would make it mechanical. That is `scripts/pipeline/`, which
   is outside my docs lane.

**Still open from earlier cycles, unchanged, both yours** (restated for continuity, not re-asked):
the `REVIEWED-SHA` content-aware anchor question
(`needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`), and **who runs Codex against
this repo** — which settles both whether `.codex/agents/*.toml` joins `lint-station.mjs`'s encoding
sweep and whether `AGENTS.md` and `.codex/` should be tracked or gitignored. Both paths are still
untracked and still not ignored.

And the standing note: **33 stale worktrees reach Station 03 tonight at 23:02Z.** 03 is report-only
on the machines, so if it reports that a prune would discard unpushed work, that decision is yours.
