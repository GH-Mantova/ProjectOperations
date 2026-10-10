# Station 04 — Scanner | 2026-10-10T02:10Z–2026-10-10T02:40Z

## GROUND

```
UTC            2026-10-10 02:10 UTC
origin/main    1dfb705b            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 1dfb705b     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md, read from origin/main)
bootstrap      1                   (station_doc_version: 1 in the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE (1 == 1). Run proceeded at full authority (read-only on the board).

## WHAT I MEASURED

**Reachability — NOT blind this run.**
- [MEASURED] `ToolSearch` keyword `desktop-commander` loaded the toolkit; ids resolved under the
  `mcp__plugin_desktop-commander_desktop-commander__*` prefix (NOT the bare `mcp__desktop-commander__*`
  form — the per-session prefix rule in the preflight held again).
- [MEASURED] `start_process` shell `powershell.exe` → `Process started with PID 19116`. Shell live on
  the Windows host. No CONNECT_TIMEOUT, no retry needed.

**Git guard — exit 2, INSTALLED BUT INERT (the expected station outcome).**
- [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → exit code **2**.
  Last line, verbatim:
  `   PATH="/sessions/laughing-wonderful-gauss/.local/bin:$PATH" git <args>`
  Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Controls it printed: `bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`.
  Treated as a FINDING, not a stop. **No `git` was run through the device bridge against the mount at
  any point in this run** — every git call went through the Windows-host PowerShell shell.

**Binding reads — all from `origin/main`, in the dev tree.**
- [MEASURED] `git show origin/main:docs/pipeline/stations/04-scanner.md`, `:docs/pipeline/DOCTRINE.md`,
  `:docs/pipeline/STATION-CAPABILITIES.md` — all three read in full.
- [MEASURED] `git diff --numstat origin/main -- docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/DOCTRINE.md docs/pipeline/stations/04-scanner.md`
  → **EMPTY output** = working copy not different from `origin/main` for those three. No piped
  `hash-object` comparison was made (DOCTRINE §9.2 — unsound in `powershell.exe`).

**Board state at run start — `scripts/pipeline/status-sweep.ps1`.**
- [MEASURED] `==== 7. VERDICT ====` → `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
- [MEASURED] `[LIVE] armed (*-ready.md): 0` · `[LIVE] OPEN PRs: 1` — **#2294** BEHIND, CI 13 pass / 2 fail,
  labelled `do-not-merge`, open 6h. `[LIVE] main CI on 1dfb705b: 4 success / 0 failed (trunk green)`.
- [MEASURED] `[LIVE] git index.lock interactive/clone: False / False` — no lock to measure, stale or otherwise.
- [MEASURED] `[LIVE] auto-restart wrapper: ANOMALY -- 2 wrappers alive (expected 1). WRAPPER_COUNT_ANOMALY_V1`
  (pids 2068 and 35512). Machine-side; 03's lane, already a named condition — recorded, not acted on.
- [MEASURED] `[LIVE] worktree-registry-escapees: 3 found` and 33 non-main worktrees, several holding
  unpushed commits. 03's lane. Recorded, not acted on.

**Sweep selection.**
- [MEASURED] `node scripts/pipeline/next-sweep.mjs` → `SWEEP: instruction-drift` (rotation position 4 of 4;
  previous run 2026-10-09T22:10:05Z), exit 0. This run covered that sweep and no other.
- [MEASURED] `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-10T02:10:00Z` → exit 0,
  `advanced: last_index=3 last_run_utc=2026-10-10T02:10:00Z`, and the script itself printed
  `LEFT DIRTY: name this file in your breadcrumb.`
  `git status --porcelain docs/pipeline/sweep-rotation.json` → ` M docs/pipeline/sweep-rotation.json`.
  **Station 00: this file is left modified in the dev tree for you to commit. 04 may not.**

### Sweep: instruction drift — the three checks

**1. Bootstrap ↔ station doc version parity.** [MEASURED]
Every live bootstrap under `C:\Users\Marco\Claude\Scheduled\*\SKILL.md` and every station doc on
`origin/main` declares the same pair:

| bootstrap | boot `station_doc_version` | repo station doc | doc_ver / contract_version |
|---|---|---|---|
| 00-supervisor | 1 | `00-supervisor.md` | 1 / 5 |
| 02-board-driver | 1 | `02-board-driver.md` | 1 / 5 |
| 03-machine-minder | 1 | `03-machine-minder.md` | 1 / 5 |
| 04-scanner | 1 | `04-scanner.md` | 1 / 5 |
| 05-sot-keeper | 1 | `05-sot-keeper.md` | 1 / 5 |
| *(no bootstrap folder)* | — | `01-code-writer.md` | 1 / 5 |
| *(no bootstrap folder)* | — | `06-pr-master.md` | 1 / 5 |
| weekly-security-audit | **none** | *(not a station)* | — |

**Zero version drift.** All seven station docs carry `station_doc_version: 1` and `contract_version: 5`.

**2. `lint-station.mjs`.** [MEASURED] `node scripts\pipeline\lint-station.mjs` → **exit 0**,
`ADMIT: all 10 docs clean`, plus `ADMIT .claude/agents/*.md (9 agent definitions, encoding clean)`
and `ADMIT bootstraps/*/SKILL.md (5 bootstrap(s) checked, all clean)`. One NOTE, not a failure:
`bootstraps: weekly-security-audit has no STEP block — not checked`. The `!` lines it prints about
Windows paths outside the known folder map are advisory and did not change the verdict.

**3. Do the paths the binding docs name still resolve?** [MEASURED], and the first attempt was an
instrument lie — recorded here because DOCTRINE §7 says to.
- v1 of my probe reported **145 unresolved** paths across the 11 binding docs. That number is
  **FALSE**. Three defects, all mine: it compared trailing-slash directory mentions (`docs/qa/`)
  against a set of slash-less directory names; it treated gitignored and runtime-generated paths as
  missing; and it counted prose fragments (`sot/05`, `docs/tests`, `apps/api/`) as paths. This is
  §9.6 exactly — the probe was measuring its own normalisation, not the corpus.
- v2 normalises the trailing slash, resolves against **both** `origin/main` and the dev tree on disk,
  and separates the classes. Negative control, fresh needle minted this run:
  `docs/pipeline/ZZPROBE-1791598559554.md → inGit=false onDisk=false`. Positive control:
  `docs/pipeline/DOCTRINE.md → inGit=true`.
- v2 result: **379 distinct mentions · 243 resolve in `origin/main` · 37 resolve on disk only
  (gitignored state files, by design) · 94 skipped as globs or extension-less prose · 5 candidates.**
- All 5 candidates run down to **zero real path drift**:
  1. `scripts/pr-watcher/.queue-state.json` — **resolves, my probe looked in the wrong tree.** The
     doc says it lives beside the script *in the watcher clone*. [MEASURED] anchor
     `const QUEUE_STATE_FILE = path.join(__dirname, ".queue-state.json")` present in
     `origin/main:scripts/pr-watcher/index.mjs`; the file exists at
     `C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json`, size 167,
     mtime 2026-10-10T02:15:08Z. The instruction is correct and current.
  2. & 3. `docs/pr-reviews/pr-1850-review.md`, `pr-1852-review.md` — quoted inside DOCTRINE-REFERENCE
     as the two `??` untracked files *observed in a past incident*. A measurement record, not a path
     instruction. `docs/pr-reviews/` itself holds 185 tracked files on `origin/main`, 217 on disk.
  4. `docs/pr-prompts/00-00-...md` — a filename template in prose, not a path.
  5. `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` — absent, and `04-scanner.md` **already
     says so**, with its own `[MEASURED] 2026-08-29` note that the file was deleted in the 2026-08-17
     cleanup and the rebuild instruction re-pointed. Correctly annotated; nothing to fix.

**4. Live schedule vs the documents.** [MEASURED] from the scheduled-tasks MCP, which
`STATION-CAPABILITIES.md` §4C names as the only authority for this:
enabled tasks are **00-supervisor** (`5 * * * *`, last 02:14:02Z), **03-machine-minder**
(`0 9 * * *`, last 2026-10-09T23:02:54Z), **04-scanner** (`0 */4 * * *`, last 02:09:41Z),
**05-sot-keeper** (`10 0 * * *`, last 2026-10-09T14:22:42Z); **weekly-security-audit** is
`enabled: false`, last run 2026-09-06T21:32:44Z. **Live enabled count = FOUR**, which is what
§1's 2026-09-15 correction and §5's row say. `02-board-driver` has a folder on disk and **no live
task** — also what §5 records. No drift in either line.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No
label changed. No merge. No `/sot/` edit. No `git commit`, no `git push`, no branch operation
anywhere.

Two files written, both of them the ones this station is told to write:
- `docs/qa/.qa-run.lock` — claimed at run start (it was **absent**: `LOCK=absent`), released at the
  end. Gitignored by its own line under the `# Overnight-QA scheduled task` comment in `.gitignore`.
- `docs/pipeline/sweep-rotation.json` — advanced by `next-sweep.mjs --advance` and **left dirty in
  the dev tree for Station 00 to commit**, per the station doc's own instruction.
- this breadcrumb, at a tracked path in the dev tree. Untracked until a board PR commits it.

## FINDINGS

### F1 — The device-bridge git guard reports INSTALLED BUT INERT (exit 2)

[MEASURED] exit code 2; the shim is byte-correct and not on the station shell's `PATH`, because the
installer writes its export into `~/.bashrc` / `~/.profile` and a station's shell is non-interactive
and non-login. So the device-bridge git ban is **remembered, not mechanical**, for this run — the
state DOCTRINE §9.2 records as having failed seven times. No `git` was run through the bridge against
the mount this run; every git call went through the Windows host.

This is the documented, expected outcome for a station (04-scanner.md preflight, the three-outcome
table), not a new defect.

**DISPOSITION: DEFERRED.** Real, and not actionable by 04 — the cure is a change to how a station's
shell is invoked (a login shell, or the installer writing to a file a non-login shell sources), which
is 03's or Marco's call. What would make it urgent: any run that *does* need git against the mount, or
a fresh 0-byte `index.lock` with no owning process appearing in a sweep.

### F2 — `station-03-cadence-bootstrap-says-4h-cron-says-daily` is STILL TRUE, re-verified live

[MEASURED] `03-machine-minder`'s bootstrap line reads *"Cadence: every 4 hours, or manually after any
crash or reboot"*; the live cron from the MCP is `0 9 * * *` — **once daily**. A factor-of-six
disagreement between an instruction a run reads and the schedule that actually fires it.
04's and 05's bootstraps match their crons (`0 */4 * * *` / every 4 hours; `10 0 * * *` / daily);
00 deliberately declares no fixed cadence.

Angle 4 (history): already filed at
`docs/pr-prompts/needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`.
Per DOCTRINE §7.1's re-read rule I re-verified its central claim against the live MCP rather than
quoting the file: it holds.

**DISPOSITION: DEFERRED.** Open with Marco since 2026-09-03 and re-verified rather than re-filed.
Which side is right is Marco's to say (RULE 1: the complete-and-additive fix is to make the bootstrap
read its cadence from the MCP rather than assert one, which solves it for every station now and
later and destroys no state; editing 03's line to "daily" fixes today only and silently re-breaks the
moment Marco changes the cron). What would make it urgent: 03 reasoning about freshness or heartbeat
age from the 4-hour figure and declaring a healthy machine wedged.

### F3 — A needs-marco escalation's central claim is now FALSE and it is still filed as live

[MEASURED] `docs/pr-prompts/needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`
asserts that stations 00, 03 and 05 have not fired for nine to eleven days. Live from the
scheduled-tasks MCP, this run: 00 last ran **2026-10-10T02:14:02Z** (minutes ago), 03 last ran
**2026-10-09T23:02:54Z**, 05 last ran **2026-10-09T14:22:42Z**. All three are firing on their crons.
The escalation is **spent**; whatever stopped them has resolved.

Blast radius: this is the shape §7.1's re-read rule exists for — a stale escalation in `needs-marco/`
reads as a live hard stop to the next run that opens the folder, and `needs-marco/` is the one real
stop in the pipeline (DOCTRINE §5b). A spent file there costs attention and can park live work.

**DISPOSITION: DISPATCHED to Station 00.** 04 is read-only on the board and does not move, rename or
retire prompts, so I have not touched the file. Station 00: re-measure the three `lastRunAt` values
yourself (they are live and cheap) and retire this escalation by moving it, per §10.5 — nothing is
deleted. Note that `git ls-files -- docs/pr-prompts/needs-marco/` must be consulted before touching
anything in that folder: it is gitignored by rule and partly tracked in fact.

### F4 — The 2-wrapper anomaly and 3 worktree-registry escapees are live on the box

[MEASURED] from `status-sweep.ps1` this run: `auto-restart wrapper: ANOMALY -- 2 wrappers alive
(expected 1). WRAPPER_COUNT_ANOMALY_V1`, pids 2068 (started 10-08 07:28 local) and 35512 (10-10 11:35
local); `worktree-registry-escapees: 3 found`; 33 non-main worktrees, of which several hold commits on
no remote branch and two hold uncommitted work. Watcher node itself RUNNING pid 34996, heartbeat 34
min (empty queue ⇒ idle, not wedged).

**DISPOSITION: DISPATCHED to Station 03.** Machine repair is 03's lane and 04 may not run a mutating
machine script. Re-measure before acting — a wrapper count and a worktree's dirtiness both expire.
Nothing here is new drift; it is named state, surfaced so it is not discovered a fourth time.

## WHAT I DID NOT DO

- **Did not run Part 0, Part 1 or Part 2 of the legacy brief.** The contract says take ONE named sweep
  per run and cover it completely, and the rotation named `instruction-drift`. A shallow pass over
  everything is the failure the rotation exists to prevent.
- **Did not stage a prompt.** The sweep found no actionable code defect; F2 is a design question for
  Marco, F3 and F4 are other stations' moves. Staged-prompt budget unused (0 of 2).
- **Did not touch the board.** 0 armed prompts, and #2294 carries `do-not-merge` — RULE 2 territory,
  and 04 has no merge authority in any case.
- **Did not clear any lock, prune any worktree, or kill any wrapper.** No lock existed to judge; the
  worktrees and wrappers are 03's, dispatched above.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** The authority matrix gives 04 no commit, and
  the dev tree is on `main`. Left dirty and named above for Station 00.
- **Did not run `git` through the device bridge against the mount**, the guard being inert (F1).
- **Did not go near Azure, Entra or SharePoint.** Nothing in this sweep approached them.
- **Did not re-file F2 as a new escalation.** It exists; re-verifying beat duplicating it (§10.5).
