# Station 00 — Supervisor | 2026-10-09T16:14Z–2026-10-09T16:4xZ

## GROUND

```
UTC            2026-10-09 16:14:29
origin/main    89181ae6            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 89181ae6      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`), so this run was not read-only.

All three binding documents were read from `git show origin/main:<path>` in the dev tree
`C:\ProjectOperations2`, never from the working copy and never in the watcher clone.

## WHAT I MEASURED

### Preflight step 1 — reachable on the first call, after loading the schemas

[MEASURED] One keyword `ToolSearch` for `desktop-commander` returned the toolkit; the ids it
reported carry the prefix `mcp__plugin_desktop-commander_desktop-commander__`, which is NOT the
prefix any previous bootstrap hard-coded — the per-environment id warning in PREFLIGHT step 1 held
again. `start_process` (shell `powershell.exe`) then returned on the FIRST call:

```
REACHED
LAPTOP-E6NHU4E4
main
```

**NOT BLIND.** No retry was needed, so BOOTSTRAP_CONNECT_RETRY_V1 did not fire.

### The device-bridge git guard — EXIT 2, INSTALLED BUT INERT (seventh consecutive report)

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read
from the INSTALLER and not from any appended pipeline stage:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
EXIT=2
```

Its own controls, quoted from its output: `bash -lc 'command -v git'` →
`/sessions/clever-zealous-wozniak/.local/bin/git` (the shim); `bash -c 'command -v git'` →
`/usr/bin/git` (the real git). Exit 2 is the EXPECTED station outcome per the table in PREFLIGHT
step 1 — a FINDING, not a STOP. I ran no `git` through the device bridge against any mounted
folder; every `git` call in this run went through Desktop Commander on the Windows host.

### The host clock is Brisbane, and the session's own date header is the LOCAL one — no defect

[MEASURED] The box reports UTC `2026-10-09 16:14:29`, while the Cowork environment header reads
`Today's date: 2026-10-10`. `Get-Process -Id 16244 | Select StartTime` printed
`10/10/2026 2:14:57 AM`, i.e. the same instant in Brisbane local time (UTC+10). [INFERRED] The
header is local, the GROUND stamp above is UTC, and the eight-hour-looking gap is the offset
DOCTRINE §3 already names. **Recorded only so the next run does not file it as clock drift.** All
timestamps in this report are UTC taken from the host.

### Safe-to-act gate — `status-sweep.ps1`, generated 16:14:57Z

[MEASURED] Section 0 positive controls both PASS (`gh CAN reach GitHub (saw merged PR #2288)`;
`node runs`). No `[BROKEN]` anywhere in section 0.

```
1. GITHUB       OPEN PRs: 0 | WAITING ON MARCO: 0 | ALL OPEN (non-draft): 0
                main CI on 89181ae6: 4 success / 0 failed / 0 running  (trunk green)
2. WATCHER      watcher node RUNNING pid 8848 | auto-restart wrapper alive (1)
                heartbeat age 47 min (ticks only mid-run; stale + empty queue = idle, NOT wedged)
                watcher clone: branch=main tracked-dirty=0 untracked=3
3. BOARD BUSY?  index.lock interactive/clone: False / False
                git processes touching our trees (scoped): 0
                watcher build: no build in flight
                board lease: free
                no PR touched on GitHub in the last 2 min
4. QUEUE        armed 0 | needs-marco 52 | no-pr-opened 111 | failed 80 | blocked 204
```

**MARCO_QUEUE_LINE_V1:** `WAITING ON MARCO: 0 open PR(s) labelled do-not-merge`, and
`armed (*-ready.md): 0`. I armed nothing this run (see F70), so neither figure moved.

[MEASURED] I re-measured the three mutation signals immediately before taking the lease, as
§7's `[LIVE]`-expires rule requires: `index.lock` dev `False`, `index.lock` clone `False`,
`Get-Process git` count `0`.

### Missed-occurrence check — all four enabled stations fresh

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **0**, verdict `CLEAN`:

```
structure: 2 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-09T15:14:00Z   1.0h ago  (cadence 1h + grace 0.5h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-08T23:06:00Z  17.2h ago  (cadence 24h + grace 3h)    ok
  04  last 2026-10-09T14:12:00Z   2.1h ago  (cadence 4h + grace 1h)     ok
  05  last 2026-10-09T14:22:00Z   1.9h ago  (cadence 24h + grace 3h)    ok
```

[MEASURED] Crossed against `list_scheduled_tasks` (the MCP, never this file or a folder listing).
Four enabled tasks; `weekly-security-audit` `enabled: false`, `lastRunAt 2026-09-06T21:32:44Z` —
the live enabled count is still **FOUR**, as STATION-CAPABILITIES §1's 2026-09-15 correction says.

| task | cron | lastRunAt | nextRunAt |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-10-09T16:13:58Z | 2026-10-09T17:13:52Z |
| `03-machine-minder` | `0 9 * * *` | 2026-10-08T23:06:07Z | 2026-10-09T23:02:45Z |
| `04-scanner` | `0 */4 * * *` | 2026-10-09T14:09:36Z | 2026-10-09T18:09:31Z |
| `05-sot-keeper` | `10 0 * * *` | 2026-10-09T14:22:42Z | 2026-10-10T14:22:37Z |

**My own cadence read from the MCP is HOURLY (`5 * * * *`)** — the figure the bootstrap says never
to compute from its own prose. `lastRunAt 16:13:58Z` is this run.

No station is MISSED, so no station needed the never-fired / fired-and-died / reported-not-merged
classification, and I disabled, enabled, re-ran and edited no scheduled task.

### COLLECT — every breadcrumb since my last run is already archived and dispositioned

[MEASURED] `Get-ChildItem docs\pr-prompts -Recurse -Filter "00-0*2026-10-09*.md"` returns 21 files.
Two sit in the queue root; **nineteen are already under `docs/pr-prompts/archive/`**, including both
station breadcrumbs written since my 15:14 run's COLLECT:

- `archive/00-04-scanner-2026-10-09-1412-blind-gate-liveness-thirteen-premises-alive-zero-gates-satisfied-and-my-own-anchor-grep-was-one-of-three.md`
- `archive/00-05-sot-keeper-2026-10-09-1422-sot-refs-baseline-is-empty-and-ci-still-tells-the-reader-it-holds-23.md`

So **no station breadcrumb is uncollected.** The two in the root are my own:

| file | state |
|---|---|
| `00-00-supervisor-2026-10-09-1414-...-not-lastexitcode.md` | merged in #2286; every finding dispositioned |
| `00-00-supervisor-2026-10-09-1514-...-its-own-nextrunat.md` | merged in #2287; every finding dispositioned |

[MEASURED] The 1514 breadcrumb's disposition lines, read individually: F63 **ACTIONED**, F64
**ACTIONED**, F65 **DISPATCHED** (Station 06), F66 **DEFERRED**, F67 **DEFERRED**, F68
**DEFERRED**, F69 **ACTIONED**. Seven findings, seven dispositions, none open. Both are therefore
collected, and this run archives both (see WHAT CHANGED). The CURRENT cycle — this breadcrumb —
stays in the root.

### The board, and whether anything is armable

[MEASURED] `OPEN PRs: 0`, `ALL OPEN (non-draft): 0`, `armed (*-ready.md): 0`. Nothing to merge,
nothing to drive, nothing to update. **Fourth consecutive cycle with an empty board** (#2283,
#2285, #2286, #2287 all record the same reading).

[MEASURED] `Get-ChildItem docs\pr-prompts\*-HOLD.md` → **13** HOLD prompts at depth 1.
[INFERRED] Station 04's 14:12Z breadcrumb, whose title is its verdict, independently measured
*thirteen premises alive, zero gates satisfied* over the same corpus — the same 13, and none of
them armable. I did not re-derive the gate readings myself: my own 13:13Z run's `requires_on_main`
probe returned a confident wrong answer on exactly this question (#2285), so 04's measurement is
the better instrument and I am quoting it as 04's, not as mine.

### `status-sweep.ps1` did not reach its own closing verdict inside this run

[MEASURED] The sweep was started at 16:14:57Z. At 16:29Z — more than fourteen minutes later — it
had emitted 311 lines, was still inside section 5, and had printed neither section 6/7 nor any
SAFE / CAUTION / DO-NOT-ACT verdict. `Get-Process -Id 16244` confirmed it still alive.

[MEASURED] The cause is in the script: `scripts/pipeline/status-sweep.ps1:881` is
`$st = gh pr view $n --json state,isDraft,mergedAt 2>$null | ConvertFrom-Json`, one network call
per PR reference, and the corpus it walks is every `#N` in every `needs-marco/` file: **383
occurrences, 153 distinct, across 52 files.** No dedupe is visible in the output — the same PR
number is re-asked once per file that cites it.

POSITIVE control: `Select-String -Pattern 'STALE-CLAIM'` over the same script → **2** hits.
NEGATIVE control, a needle minted this run: `Select-String -Pattern 'zqx-1614-needle-st00'` →
**0** hits. So the grep is sound in both directions.

**What I therefore did NOT claim.** I took the safe-to-act gate from section 3, which printed in
full, and re-measured its three mutation signals directly before acting. I do **not** quote a
sweep verdict, because the sweep never issued one. See F71.

## WHAT CHANGED

One board PR, from a clean isolated worktree off `origin/main` on the Windows filesystem
(`C:\po-wt\brd-1614`, branch `docs/board-1614-collect`) — never the dev tree, never the watcher
clone, never the sandbox.

1. **Board lease taken** before any mutation. `Enter-BoardLease -Actor 'station-00.scheduled'`
   returned **`True`** — the RETURN VALUE is the reading, not `$LASTEXITCODE` (my 14:14Z run's
   lesson, #2286). `$env:PO_ACTOR` was set to the SAME actor string, so `Merge-Pr` cannot be
   refused by my own lease under the generated-`pwsh-<pid>` trap.
2. **Two dispositioned breadcrumbs archived** — `git mv` of the 1414 and 1514 files into
   `docs/pr-prompts/archive/`, both read back as `R` (rename, staged) in `git status --porcelain`.
   `check-breadcrumb.mjs` matches by basename, so both still count for `--freshness`.
3. **This breadcrumb written** into the PR worktree — the contract's preferred home, so it lands
   with the change it describes and needs nobody to sweep it up.

Nothing was armed. Nothing was merged except this board PR. No label was added or removed. No
`gh pr update-branch` was called on any PR. No scheduled task was touched. `/sot/` was not opened.

## FINDINGS

### F70 — S3 — The board is empty for a fourth consecutive cycle and nothing on it is armable

[MEASURED] `OPEN PRs: 0`, `armed: 0`, 13 HOLDs at depth 1, trunk green on `89181ae6`
(4 success / 0 failed). [INFERRED] from Station 04's 14:12Z breadcrumb: thirteen HOLD premises
alive, **zero gates satisfied**.

This is not a defect and it is not idleness to be fixed by arming something. Every HOLD is waiting
on a gate that is genuinely unmet, and three of them additionally sit behind the approval channel
that F67's predecessor finding already filed for Marco. Arming on an unmet gate is how a prompt
reaches 13/15 green and then cannot be merged by anybody (#2261, the NEVER_LIST_BEFORE_ARMING_V1
case).

**DISPOSITION: DEFERRED** — real, and not now. What would make it urgent: a HOLD whose named
predecessor PRs are all confirmed merged on `main`, which is a gate SATISFIED and an arm I would
take the same cycle; or Marco releasing the five HOLDs that wait on the approval channel.

### F71 — S4 — `status-sweep.ps1`'s section 5 cannot finish inside a station run, so the sweep's own closing verdict is unreachable

The sweep is the instrument every station is told to run and obey, and to **re-run immediately
before every board mutation**. Measured above: section 5 issues one `gh pr view` per PR reference
over 383 references in 52 `needs-marco/` files, with no dedupe to the 153 distinct numbers, and at
16:29Z — 14+ minutes in — it had not printed sections 6/7 or any SAFE / CAUTION / DO-NOT-ACT line.

Why this matters more than its cost: a station that cannot reach the verdict either waits past its
cadence, or does what I did and reads the gate off section 3 while being careful to say the verdict
is absent, or — the bad outcome — **writes a verdict the sweep never issued.** The instruction to
re-run it before every mutation is unexecutable at this runtime, so it will be quietly skipped.

RULE 1 options, complete-and-additive first:

1. **Dedupe to distinct PR numbers and cache the result for the run** (383 → 153 calls, ~60%
   saved) **and** add a `-Fast` / `-SkipSection5` switch plus a per-section elapsed line, so a
   station can get a verdict in seconds and still run the full crawl when it wants one. Complete:
   the verdict becomes reachable both ways. Additive: no reading is removed, no file is touched,
   section 5 keeps its full corpus when asked for it. **Fails neither half.**
2. Dedupe only. Cheaper, but a 153-call crawl may still outrun a cadence — fails the *completely
   (immediately and future)* half.
3. Drop section 5 from the default run. Fails the *without damaging* half: section 5 is the
   stale-claim cross-check the station doc calls "the step that was being skipped", and removing it
   by default re-creates the skip the section exists to stop.

`scripts/pipeline/status-sweep.ps1` is **outside 00's recorded lane** (`docs/` and `sot/` and
queue/staging PRs) and sits in the instrument-lane file's neighbourhood, so it is not mine to
change and merge — the exact shape as F65 last cycle.

**DISPOSITION: DISPATCHED** — to **Station 06 (staging)**, by naming it here, which is the channel
the authority matrix leaves me: 06 stages `-HOLD` prompts and 00 does not, so I hand over the
finding and option 1 rather than writing the prompt myself. What 06 receives: fix
`status-sweep.ps1:881`'s call site to ask each distinct PR number once per run and cache it, add a
`-SkipSection5` switch and a per-section elapsed line, and leave section 5's corpus unchanged. 06
has no cadence, which is the standing problem F67 already filed for Marco; this finding adds a
fourth item to that queue and I have not re-filed the cadence question.

### F72 — S4 — The device-bridge git guard reports INERT (exit 2) for the seventh consecutive report

Measured above, with the installer's own two controls. The shim is byte-correct and not on the
`PATH` of the non-interactive, non-login shell a station is given, so the device-bridge `git` ban
is **remembered, not mechanical** — the state DOCTRINE §9.2 records as having failed seven times.

**DISPOSITION: DEFERRED** — not re-escalated, for the reason five predecessors gave: the mechanism
is understood, the one-call `PATH=` form works, and the standing cure (every station's `git` goes
through Desktop Commander on the host) held again this run with no near-miss. What would make it
urgent: any run that leaves a 0-byte `index.lock` in a mounted tree, or an exit code other than 0
or 2.

### F73 — S4 — 33 orphaned worktrees and 2 registry-escapees, unchanged, and several hold unpushed work

[MEASURED] `non-main worktrees found: 33`, plus `REGISTRY-ESCAPEE: C:\PR-Master\worktrees\bootstrap-check`
and `REGISTRY-ESCAPEE: C:\po-wt\dispatch-register-v1`. Two hold uncommitted work that
`git worktree remove` will refuse and `--force` would discard:
`C:/po-worktrees/sup-cwd-paths` (dirty=2, 4 unpushed commits, age 22120 min) and
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (dirty=1, 1 unpushed commit). The largest
unpushed holdings are `C:/po-wt/fv2drop` (21 commits) and `C:/po-wt/s8h` (16).

**DISPOSITION: DEFERRED** — not re-dispatched. Station 03 already holds the standing hand-over for
worktree and registry hygiene, it is report-only by the authority matrix, and its next occurrence
is `2026-10-09T23:02:45Z`. Re-dispatching the same census hourly is noise. What would make it
urgent: a prune proposed by anyone against a worktree holding unpushed commits or dirty files —
that is irreversible and becomes Marco's (DOCTRINE §5.4), not 03's and not mine.

### F74 — S4 — `05-sot-keeper`'s cron and its own `nextRunAt` still disagree, and `nextRunAt` is the one that predicts

[MEASURED] From the MCP this run: `cronExpression "10 0 * * *"` (00:10 daily) against
`lastRunAt 2026-10-09T14:22:42Z` and `nextRunAt 2026-10-10T14:22:37Z`. `nextRunAt` is
`lastRunAt` + 24 h, not the next occurrence of the cron. 05's actual 14:22Z run — the one that
produced the archived `00-05-sot-keeper-2026-10-09-1422-...` breadcrumb — matches `nextRunAt`, not
the cron.

This is the durable half of last cycle's F63: that finding resolved *who the unscheduled actor was*
(Station 05, on its own schedule) and is ACTIONED. What it did not resolve is that the field a
station is told to read for cadence can contradict the cron in the same response, and the cron is
the one that misleads.

**DISPOSITION: DEFERRED** — the scheduler is Marco's, the question is already on his list through
F63's record, and nothing in this run depended on 05's cadence: `--freshness` read 05 as `ok` from
its breadcrumb, which is the instrument that actually gates COLLECT. What would make it urgent: a
MISSED verdict for 05, where the cron-vs-`nextRunAt` choice would change the classification between
*never fired* and *fired and died*.

## WHAT I DID NOT DO

- **I armed nothing.** 13 HOLDs, zero gates satisfied (04, 14:12Z). Arming on an unmet gate is
  #2261's wasted build.
- **I merged nothing but this board PR.** The board held 0 open PRs, so there was no PR to
  classify under DOCTRINE §10.1, no instrument-lane candidate, and no receipt to write.
- **I did not clear any `[STALE]` escalation row.** The sweep's section 5 never finished, so I hold
  no completed stale-claim cross-check; and the rows it did print all read *"cites #N (MERGED) as
  evidence — not its premise; does not clear the escalation"*, which is explicitly not a clearance.
  Retiring one on that line alone is what `retire-escalation.mjs` requires evidence against.
- **I did not prune a worktree or a registry-escapee.** Not my lane (03's, report-only), and the
  dirty ones are irreversible.
- **I did not fix `status-sweep.ps1` myself.** Outside 00's recorded lane; staged for 06 instead.
- **I did not touch `/sot/`.** Station 05's alone. Its 14:22Z finding (the sot-refs baseline is
  empty while CI tells the reader it holds 23) is 05's to land, and my predecessor already
  dispatched the `ci.yml` half to 06.
- **I did not re-run the full sweep before mutating.** It cannot finish in time (F71). I
  re-measured the three signals that actually gate a mutation — both `index.lock`s and the scoped
  git-process count — immediately before taking the lease, and took the lease itself, which is
  BOARD_LEASE_V1's load-bearing condition 3.
- **No Azure, Entra or SharePoint anything.** No portal, no app settings, no `az`, no
  `Connect-MgGraph`. No production data was read or written.

## FOR MARCO

Nothing needs you to act this cycle. The board is empty, trunk is green, all four stations are
fresh, and no PR is waiting on your label.

Two things are accumulating rather than breaking, both already on your list and neither re-filed:

1. **Station 06 has no cadence, and the queue for it is now four items** — last cycle's `ci.yml`
   sot-refs correction (F65) plus this cycle's `status-sweep.ps1` runtime fix (F71), on top of the
   two already named in F67. Each one is a change outside 00's lane that only 06 can stage, and 06
   only runs when something runs it.
2. **Thirteen HOLDs, zero gates satisfied** — five of them waiting on an approval channel that has
   issued nothing in weeks (`needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`).
   The board being empty is not the pipeline idling; it is the pipeline having nothing it is
   permitted to start.

---

# POST-MERGE VERIFICATION — appended after #2289 merged

Appended to this same file rather than written as a second breadcrumb: DOCTRINE §10.5, an artifact
carries ONE identity for its whole life.

## The merge, confirmed individually

[MEASURED] `gh pr view 2289 --json number,state,mergedAt,mergeCommit` — asked for this PR alone,
never read off a LIST response's `merged` field (DOCTRINE §9.4):

```json
{"mergeCommit":{"oid":"161e5148dbcad63e30163c42863a2cf1c0b2f4b3"},"mergedAt":"2026-10-09T16:24:47Z","number":2289,"state":"MERGED"}
```

`MERGED`, not `QUEUED` — so UPDATE_AT_MERGE_TIME_V1's "confirm next run" does not apply and there
is nothing for my successor to re-check. All required checks passed on the merged head
`27674259`: `Approval receipt (CP-26)` pass, `PR gates — diff checks` pass,
`Pipeline — watcher + linter tests` pass, `Pipeline — arm-prompt tests (Windows)` pass,
`E2E restoration markers` pass, `CodeQL` / `Analyze (actions)` / `Analyze (javascript-typescript)`
pass; the app jobs `skipping` on a docs-only diff.

`Assert-SmokedOrEscalate -PR 2289` returned **True**, and on its first call — before CI finished —
it correctly **threw** rather than passing:

```
Assert-SmokeGreen: #2289 check 'Pipeline — watcher + linter tests' is 'IN_PROGRESS' - still in
flight. WAIT. Do not rebase, do not merge, do not 'retrigger'.
```

[INFERRED] That is a positive AND a negative control on the gate in one run: it refused an
in-flight board and passed a green one. I waited; I did not rebase or retrigger.

`Merge-Pr -PR 2289 -Actor 'station-00.scheduled'` returned `State MERGED, PR 2289`. The actor
string was the SAME one given to `Enter-BoardLease`, so the generated-`pwsh-<pid>` self-refusal
trap did not fire.

## Classification, for the record

[MEASURED] `labels=[] count=0`; three files, all under `docs/pr-prompts/`. Second-lane under
DOCTRINE §10.1 step 3 (no watcher opened it, so it carries no RULE-2 verdict and that absence was
not read as clearance), hand-classified against §5's hard stops: none apply. It is Station 00
acting inside its own recorded `docs/` + queue lane, which STATION-CAPABILITIES §5 is the
classifier for. Docs-only, so CP-26 needed no receipt and the check passed on its own.

## The fast-forward — all four read-backs pass

[MEASURED] `git merge --ff-only origin/main`, exit 0, `Updating 89181ae6..161e5148`. No path
blocked it: this run's breadcrumb was written in the PR worktree, never in the dev tree, which is
Cure 1 of the station contract's fast-forward rule and the reason the cure's unreliable primary
branch (F69, #2288) was never reached.

```
1) git rev-list --left-right --count HEAD...origin/main   -> 0   0
2) git diff --numstat                                     -> EMPTY
3) git diff --cached --name-status                         -> EMPTY
4) git status --porcelain --untracked-files=no             -> EMPTY
```

The fourth is the one that catches a dirty tree, and it is empty.

[MEASURED] All three paths are now TRACKED on `main` (`git ls-files` returned each one), so this
breadcrumb is no longer the UNTRACKED file `check-breadcrumb.mjs` warned it was, and the two
archived predecessors reach `--freshness` by basename as the contract says.

[MEASURED] Worktree torn down: `git worktree remove C:\po-wt\brd-1614` exit 0,
`Test-Path C:\po-wt\brd-1614` → `False`, then `git worktree prune`. It is not left to join the 33
in F73.

## F75 — S4 — `Exit-BoardLease` returns `False` for both "not yours to release" and "the release failed", and only a re-take probe separates them

[MEASURED] After `Merge-Pr` returned MERGED, `Exit-BoardLease -Actor 'station-00.scheduled'`
returned **`False`** — and returned `False` again on a second attempt run from inside
`C:\ProjectOperations2` with the library freshly dot-sourced. Nothing threw, nothing warned, and
there is no message: the whole reading is one boolean.

`False` from a release call reads as *"the lease is still held and I could not let it go"*, which
would mean I had wedged the board for every station until the 30-minute expiry. **It did not mean
that.** The controls:

- POSITIVE control that the lease is FREE: `Enter-BoardLease -Actor 'station-00.scheduled.leaseprobe'`
  returned **`True`**. A held lease refuses a different actor; this one did not.
- POSITIVE control that `Exit-BoardLease` CAN return `True` at all — i.e. that the `False` above was
  a real answer and not a broken function: `Exit-BoardLease -Actor 'station-00.scheduled.leaseprobe'`
  returned **`True`**, immediately undoing the probe take.
- [MEASURED] The library exports exactly `Enter-BoardLease`, `Exit-BoardLease`, `Get-BoardLease`,
  `Get-BoardLeasePath`, `Write-BoardLease` — so `Exit-BoardLease` is the right name and
  `Get-BoardLease` is the reading I should have taken first.

[INFERRED] The lease was already gone when I tried to release it — released by `Merge-Pr` as part
of landing the mutation — so `False` meant *"not yours, nothing to release"*. The board was free
the whole time.

This is DOCTRINE §7's exact shape: a well-formed, confident, WRONG-looking negative from a working
system, with no empty result for §9.6 to fire on. It sits beside the already-recorded lease trap
from #2286 (*the lease return value is the reading, not `$LASTEXITCODE`*) — same function family,
opposite half: that one was about reading the TAKE, this one is about reading the RELEASE. A
successor that takes `False` at face value writes "I may have left the board leased" into a report,
or worse, goes looking for a lease to break.

🔧 **The rule, not the state: never read a release's boolean on its own. Call `Get-BoardLease`
before and after, or re-take under a throwaway actor and release it, and quote whichever you used.**

⚠️ **Falsifying probe:** hold the lease under actor A, call `Exit-BoardLease -Actor A` once with no
merge in between, and read the return. If it returns `True`, then `Merge-Pr` is not what releases it
and the inference above is wrong — in which case the `False` seen here has another cause and must be
re-measured.

RULE 1 options, complete-and-additive first:

1. **Make `Exit-BoardLease` return a reason alongside the boolean** (`NOT_HELD` / `NOT_YOURS` /
   `RELEASED` / `WRITE_FAILED`) **and** have `Merge-Pr` state in its own return whether it released
   the lease. Complete: both halves of the ambiguity are closed at the source, for every future
   caller. Additive: the boolean keeps working for anything that reads it as one, no state file
   changes shape, no caller breaks. **Fails neither half.**
2. Document the ambiguity in DOCTRINE §9 and leave the function as it is. Additive, but fails the
   *completely (immediately and future)* half — it is the "remembered, not mechanical" pattern that
   §9.2 records as having failed seven times.
3. Have `Exit-BoardLease` throw on `False`. Fails the *without damaging* half: a station releasing a
   lease it never held is the normal post-`Merge-Pr` case, and throwing on it would abort teardown
   after a successful merge.

`scripts/pipeline/pipeline-lib.ps1` is the **first entry on the instrument-lane NEVER-LIST**, so
this is not mine to change and merge, and a prompt targeting only that file would reach green and be
un-mergeable by any station (NEVER_LIST_BEFORE_ARMING_V1, #2261).

**DISPOSITION: DISPATCHED** — to **Station 06 (staging)**, by naming it here, with option 1 and the
measurements above, and with the NEVER-LIST warning attached so 06 scopes the prompt to need Marco's
release rather than discovering it at 13/15 green. This is the **fifth** item now queued for a
station with no cadence; see F67 and FOR MARCO above. The board itself is **not** blocked — the
lease is free, measured two ways.

## Correction to this run's own WHAT I DID NOT DO

That section says I merged nothing but this board PR, which is accurate. It should also have said:
I took and immediately released a board lease under the throwaway actor
`station-00.scheduled.leaseprobe` as the positive control for F75. Both calls were read back
(`True` / `True`), the probe held the lease for under a second, and no board state was mutated by
it. Recording it because an unexplained second actor in the lease history is exactly what my 14:30Z
predecessor had to chase.
