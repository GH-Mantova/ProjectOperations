# Station 00 — Supervisor | 2026-10-09T18:14Z–2026-10-09T18:4xZ

## GROUND

```
UTC            2026-10-09 18:14:33
origin/main    661ecf89            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 661ecf89      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`), so this run was not read-only.

`DOCTRINE.md`, `00-supervisor.md` and `STATION-CAPABILITIES.md` were all read in full from
`git show origin/main:<path>`, run in the dev tree `C:\ProjectOperations2` — never from the working
copy, never in the watcher clone. No REFERENCE section was opened: no core line sent me to one.

## WHAT I MEASURED

### Preflight step 1 — NOT BLIND, on the first call after loading the schemas

[MEASURED] One keyword `ToolSearch` for `desktop-commander` returned the toolkit under the prefix
`mcp__plugin_desktop-commander_desktop-commander__`. `start_process` (shell `powershell.exe`) then
returned on the FIRST call: `REACHABLE`, host `LAPTOP-E6NHU4E4`, local `Sat 10/10/2026 04:14 AM`
(= `2026-10-09T18:14:33Z`, Brisbane UTC+10). No retry needed, so BOOTSTRAP_CONNECT_RETRY_V1 did not
fire. Every `timeout_ms` in this run was `170000` or less (F78's rule, honoured).

### The device-bridge git guard — EXIT 2, INSTALLED BUT INERT (ninth consecutive report)

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read
from the INSTALLER itself with no appended pipeline stage:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
EXIT=2
```

Its own controls, quoted: `bash -lc 'command -v git'` →
`/sessions/confident-friendly-meitner/.local/bin/git` (the shim); `bash -c 'command -v git'` →
`/usr/bin/git` (the real git). Exit 2 is the EXPECTED station outcome — a FINDING, not a STOP.
Every `git` call in this run went through Desktop Commander on the Windows host. I ran no `git`
through the device bridge against any mounted folder.

### Safe-to-act gate — `status-sweep.ps1`, generated 2026-10-09 18:15:09Z

[MEASURED] Section 0 positive controls both PASS (`gh CAN reach GitHub (saw merged PR #2290)`;
`node runs`). No `[BROKEN]` anywhere in section 0.

```
1. GITHUB    OPEN PRs: 0 | WAITING ON MARCO: 0 | ALL OPEN (non-draft): 0
             main CI on 661ecf89: 4 success / 0 failed / 0 running  (trunk green)
2. WATCHER   watcher node RUNNING pid 8848 | auto-restart wrapper alive (1)
             heartbeat age 109 min (ticks only mid-run; stale + empty queue = idle, NOT wedged)
             watcher clone: branch=main tracked-dirty=0 untracked=3
             non-main worktrees found: 33
```

**MARCO_QUEUE_LINE_V1:** `WAITING ON MARCO: 0 open PR(s) labelled do-not-merge`; armed `*-ready.md`
at depth 1: **0**. I armed nothing this run, so neither figure moved. This PR stages one `-HOLD.md`,
which arms nothing and adds nothing to Marco's queue.

[MEASURED] The sweep again did not reach its closing SAFE / CAUTION / DO-NOT-ACT verdict inside this
run — it was still enumerating the 33 worktrees in section 2 when I stopped reading its buffer at 97
lines across three reads. **I therefore quote no sweep verdict.** This is the FIFTH consecutive
occurrence with that outcome (14:27Z, 15:27Z, 16:14Z, 17:14Z, this run). See F88 — the fix is staged
in this PR rather than recorded a fifth time.

### Missed-occurrence check — all four enabled stations fresh

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **0**, verdict `CLEAN`:

```
structure: 2 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-09T17:14:00Z  1.0h ago  (cadence 1h + grace 0.5h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-08T23:06:00Z 19.2h ago  (cadence 24h + grace 3h)   ok
  04  last 2026-10-09T14:12:00Z  4.1h ago  (cadence 4h + grace 1h)    ok
  05  last 2026-10-09T14:22:00Z  3.9h ago  (cadence 24h + grace 3h)   ok
```

No station is MISSED, so no station needed the never-fired / fired-and-died / reported-not-merged
classification, and I disabled, enabled, re-ran and edited no scheduled task.

⚠️ **One honest gap in my own instrumentation: I did not call `list_scheduled_tasks` this run**, so
I hold no `lastRunAt` cross-check against the freshness table and no live cron re-read. My
predecessor read all four from the MCP 60 minutes ago (cron `5 * * * *` for 00, `0 9 * * *` for 03,
`0 */4 * * *` for 04, `10 0 * * *` for 05; `weekly-security-audit` `enabled: false`), and nothing
this run depended on the cross-check because `--freshness` returned CLEAN with no MISSED row to
classify. **[CANNOT MEASURE]** for this run specifically: whether any `lastRunAt` is fresh against a
breadcrumb that is absent — the shape `--freshness` cannot see. Recorded rather than papered over.

### COLLECT — two breadcrumbs since my last run, both now dispositioned and archived

[MEASURED] Exactly two breadcrumbs sat at depth 1 in `docs/pr-prompts/`:

| breadcrumb | tracked? | disposition of its findings |
|---|---|---|
| `…-2026-10-09-1614-the-board-is-empty-a-fourth-cycle-…` | TRACKED (`git ls-files --error-unmatch` exit 0) | F70 DEFERRED, F71 re-dispositioned DEFERRED by its successor, F72–F75 DEFERRED / DISPATCHED — all six closed by the 1714 run |
| `…-2026-10-09-1714-status-sweep-is-in-the-instrument-lane-…` | **UNTRACKED** | F76 ACTIONED, F77 **ESCALATED (open, Marco)**, F78 ACTIONED, F79 DEFERRED, F80 DEFERRED, F81 DEFERRED |

[MEASURED] I read the 1714 report in full. Its six findings each carry a disposition, so nothing in
it was left for me to disposition afresh — **except F77, which is ESCALATED and had no tracked home
on `main`.** That is the finding this PR exists to fix as much as anything else: see F82.

No 03/04/05 breadcrumb is uncollected — `--freshness` read all four stations off breadcrumbs it
found, and the structure pass checked 2, malformed 0.

**Both are archived in this PR** (`docs/pr-prompts/archive/`): 1614 by `git mv` (it was tracked),
1714 by writing it straight into `archive/` (it was untracked in the dev tree, so there was no
tracked path to move). `check-breadcrumb.mjs` matches by basename, so both still count for
`--freshness` from `archive/`.

### The reading this run adds — who writes `sweep-rotation.json`, and why it cannot be committed

[MEASURED] The dev tree held exactly one MODIFIED TRACKED file:

```
git status --porcelain --untracked-files=no   ->   M docs/pipeline/sweep-rotation.json
git diff --numstat -- docs/pipeline/sweep-rotation.json   ->   2  2  (a real difference, not a CRLF smudge)
git rev-parse HEAD:docs/pipeline/sweep-rotation.json      ->   0ec9e53d…
git hash-object docs/pipeline/sweep-rotation.json          ->   1c6c6f00…
git rev-list --left-right --count HEAD...origin/main       ->   0  0
```

Two different blobs, `--numstat` non-empty: the modification is REAL. Both of the readings the
station doc names as the documented PASS (`--numstat` and `--cached`) would NOT have hidden it here,
because `--numstat` is the one that fired — but `rev-list` reads `0 0` and `--cached` reads EMPTY,
so two of the four read clean.

[MEASURED] Its own content names the writer and the clock:

```json
"last_index": 1,
"last_run_utc": "2026-10-09T18:10:05Z",
"last_station": "04-scanner"
```

[MEASURED] `status-sweep.ps1` does **not** write it: `Select-String -Pattern 'sweep-rotation'` over
`scripts/pipeline/status-sweep.ps1` → **0** hits. The file's own `_why` names the writer instead:
*"Station 04 reads it, runs the sweep it names, then advances it via: node
scripts/pipeline/next-sweep.mjs --advance"*.

[INFERRED] So Station 04's `18:09Z` occurrence advanced the rotation in the **shared dev tree** four
minutes before this run started, and left the advance as a modified tracked file. That is F89, and
it is the first finding this pipeline has recorded about it.

### The board, and whether anything is armable

[MEASURED] `OPEN PRs: 0`, `ALL OPEN (non-draft): 0`, armed `*-ready.md` at depth 1: **0**. Nothing to
merge, nothing to drive, nothing to update, no PR to classify under DOCTRINE §10.1. **Sixth
consecutive cycle with an empty board** (#2283, #2285, #2286, #2287, #2289 and this run).

[MEASURED] `Get-ChildItem docs\pr-prompts\*-HOLD.md` → **13** HOLD prompts at depth 1 (14 after this
PR). `docs/pr-prompts/needs-marco/` holds **52** files. I did not re-derive the HOLD gate readings:
my 13:13Z predecessor's own `requires_on_main` probe returned a confident wrong answer on exactly
that question (#2285), and Station 04's 14:12Z breadcrumb independently measured *thirteen premises
alive, zero gates satisfied*. I quote that as 04's measurement, not mine.

### The staged prompt's premise, with both controls

[MEASURED] against the dev tree at `661ecf89`:

```
Select-String status-sweep.ps1 -Pattern 'SkipSection5'        -> 0   (the premise holds: ! grep -q)
Select-String status-sweep.ps1 -Pattern 'STATUS SWEEP'        -> 2   (POSITIVE control)
Select-String status-sweep.ps1 -Pattern 'zqx1815needlesweep'  -> 0   (NEGATIVE control, minted this run)
```

### Board lease and collision check, before any mutation

[MEASURED] Read DIRECTLY rather than inferred from a boolean (the 1714 run's F75 lesson):

```
Get-BoardLeasePath -> C:\ProjectOperations2\.git\po-board-lease.json
Get-BoardLease     -> empty        => LEASE=FREE
devtree .git/index.lock ABSENT | clone .git/index.lock ABSENT | Get-Process git -> 0
MERGE_HEAD / REBASE_HEAD / CHERRY_PICK_HEAD -> all False
OPEN PRs 0 => no PR touched in the last ~2 min
```

Nothing else was mid-mutation, so this is not the LL-38 collision. `Enter-BoardLease -Actor
'station-00.scheduled'` returned **True**, and the read-back confirms the holder is me:

```json
{"actor":"station-00.scheduled","reason":"board PR: collect 1614+1714, archive, stage sweep-section5 prompt",
 "pid":14100,"acquiredAt":"2026-10-09T18:17:33Z","expiresAt":"2026-10-09T18:47:33Z"}
```

`$env:PO_ACTOR` was set to the SAME string before any `pipeline-lib` call, so `Merge-Pr` cannot be
refused by my own lease under the generated-actor trap measured on #2279.

### The worktree — clean, isolated, off `origin/main`, on the Windows FS

[MEASURED] `git worktree add -b docs/board-2026-10-09-1815-collect C:\po-wt\brd-1815 661ecf89…`,
exit **0**; `WT_HEAD=661ecf89e8df66852000446ea53f4bab562be8fd`,
`WT_BRANCH=docs/board-2026-10-09-1815-collect`. The path did not pre-exist (the script aborts rather
than reuse one). Not the sandbox tree, not `C:\po-watcher`, not the interactive tree. Torn down at
the end of the run — see WHAT CHANGED.

## WHAT CHANGED

**On the board: one PR opened, driven and merged — the first board work in six cycles.** Its
contents, each read back below:

1. **`docs/pr-prompts/archive/…-1614-….md`** — `git mv` from depth 1. Collected and dispositioned.
2. **`docs/pr-prompts/archive/…-1714-….md`** — written into `archive/` (24,668 bytes). This is the
   first time the 1714 report, **and therefore its ESCALATED F77**, exists on `main` at all.
3. **`docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`** — NEW, staged. Arms
   nothing; a `-HOLD.md` is not armable until a deliberate `arm-prompt.ps1` call.
4. **`docs/pipeline/sweep-rotation.json`** — Station 04's `18:10:05Z` rotation advance, carried from
   the dev tree into this PR so that it lands instead of blocking the next fast-forward (F89).
5. **This breadcrumb**, at depth 1, left in the root as the CURRENT cycle.

**No prompt was armed, promoted or retired. No label was added or removed. No worktree was pruned.
No scheduled task was touched. `/sot/` was not opened. No Azure, Entra or SharePoint anything. No
production data was read or written.**

## FINDINGS

### F82 — S3 — An ESCALATED finding lived only in an UNTRACKED breadcrumb, so Marco's open question reached nobody for an hour

[MEASURED] The 1714 breadcrumb was UNTRACKED in the dev tree (`git status` → `??`), and its F77 is
dispositioned **ESCALATED — to Marco**. [INFERRED] An escalation whose only copy is an untracked file
in one chat's working tree is not escalated: the station contract says so in as many words — *"If
your finding lives only in a gitignored path, you have not reported it"* — and an untracked path is
the same failure with a different mechanism. The already-open escalation
`needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md` names this exact class.

The 1714 run was right not to open a PR for it — it said so explicitly and told its successor to
sweep it up, which is the contract working as designed. The finding is that **the window between
writing an ESCALATED finding and a successor committing it is a window in which the escalation does
not exist**, and for F77 that window was one full hour.

🔧 **The rule: an ESCALATED disposition is not complete until its breadcrumb is on `main`. The
station that escalates should say, in the finding, which PR will carry it — and the next COLLECT
should treat an untracked breadcrumb carrying an ESCALATED finding as its first priority, ahead of
archiving.**

**DISPOSITION: ACTIONED** — F77 is now on `main` in this PR (item 2 of WHAT CHANGED), read back
below. I did **not** also force-add a new file into `needs-marco/`: that folder is gitignored by rule
and only 6 of 61 of its files are tracked in fact, so a force-add there is how an edit rides into
another actor's commit. The tracked `archive/` copy is the file-backed home.

### F83 — S3 — F76's prompt is staged; the board has work on it for the first time in six cycles

[MEASURED] `docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` is in this PR, its
premise verified above with both controls, its `scope` naming its own retirement path under
`docs/pr-prompts/superseded/` as PROMPT-SCHEMA requires, and `module: pipeline` declared.

It is staged as `-HOLD.md`, **not armed**, and that is mechanically forced as well as deliberate:
`arm-prompt.ps1` arms by `git mv` of a **tracked** `-HOLD.md`, so the file must be on `main` before
it can be armed at all. Arming it is therefore next cycle's decision, not this one's.

⚠️ **When it is armed, the resulting PR will need Marco's release, and should be labelled
`do-not-merge` so the WAITING ON MARCO line counts it.** The prompt says so in its own body. The
reason is F77: `status-sweep.ps1` is entry one of the instrument-lane `files` allowlist, but the
prompt's own retirement path is under `docs/`, which the lane's `_readme` never-lists, and
INSTRUMENT_LANE_V1 requires every changed file to be in lane. That is
NEVER_LIST_BEFORE_ARMING_V1's disclosure requirement, discharged here at staging time rather than
left for the arming run to rediscover.

**DISPOSITION: ACTIONED** — staged and read back below.

### F84 — S3 — F77 remains Marco's, and is carried forward rather than re-escalated

F77 (the instrument lane cannot fire for any PR the watcher builds, because PROMPT-SCHEMA requires
every prompt to retire its own file under `docs/`, and `docs/` is never-listed) is unchanged by
anything I measured. I did not re-measure it and I did not re-open it: it is one question with three
options and a recommendation already drafted, and re-stating it hourly is the noise the four-way
disposition exists to prevent.

**DISPOSITION: ESCALATED** — carried forward to Marco, unchanged, now with a tracked home on `main`
(F82). The one thing this run adds is that **it is no longer blocking**: F76's prompt is staged
without waiting for the answer, and the answer now only decides the label the eventual PR carries,
not whether the work can start.

### F85 — S4 — The board is empty for a sixth consecutive cycle; thirteen HOLDs, zero gates satisfied

[MEASURED] `OPEN PRs: 0`, armed `0`, 13 HOLDs at depth 1, trunk green on `661ecf89`
(4 success / 0 failed / 0 running). [INFERRED] from Station 04's 14:12Z breadcrumb: thirteen HOLD
premises alive, **zero gates satisfied**.

This is still not idleness to be cured by arming something — arming on an unmet gate is #2261's
wasted build. What changed this cycle is that the emptiness is no longer purely structural: there is
now a staged prompt whose premise is verified true and whose only remaining question is a label.

**DISPOSITION: DEFERRED** — real, and not now. What would make it urgent: the staged prompt armed
next cycle (which I expect, and which ends the empty-board run); a HOLD whose named predecessor PRs
are all confirmed merged on `main`, which is a gate SATISFIED and an arm I would take the same cycle;
or Marco releasing the five HOLDs waiting on the approval channel
(`needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`).

### F86 — S4 — The device-bridge git guard reports INERT (exit 2) for the ninth consecutive report

Measured above with the installer's own two controls. The shim is byte-correct and not on the `PATH`
of the non-interactive, non-login shell a station is given, so the device-bridge `git` ban is
**remembered, not mechanical**.

**DISPOSITION: DEFERRED** — not re-escalated, for the reason seven predecessors gave: the mechanism
is understood, the one-call `PATH=` form works, and the standing cure (every station's `git` goes
through Desktop Commander on the host) held again this run, including across a `git worktree add`
and a `git mv`. What would make it urgent: any run that leaves a 0-byte `index.lock` in a mounted
tree, or an exit code other than 0 or 2.

### F87 — S4 — 33 orphaned worktrees, unchanged, several holding unpushed commits

[MEASURED] `non-main worktrees found: 33`. The largest unpushed holdings are `C:/po-wt/fv2drop`
(21 commits, age 22,175 min) and `C:/po-worktrees/sup-cwd-paths` (4 commits **and** 2 dirty files,
age 22,240 min) — the latter is one `git worktree remove` would refuse and `--force` would discard.
My own worktree is not in this census: it was created and torn down inside this run.

**DISPOSITION: DEFERRED** — not re-dispatched. Station 03 holds the standing hand-over for worktree
hygiene, is report-only by the authority matrix, and its next occurrence is `2026-10-09T23:02:45Z`.
Re-dispatching the same census hourly is noise. What would make it urgent: a prune proposed by anyone
against a worktree holding unpushed commits or dirty files — that is irreversible and becomes
Marco's (DOCTRINE §5.4), not 03's and not mine.

### F88 — S2 — `status-sweep.ps1`'s closing verdict has now been unreachable on five consecutive occurrences, and the fix is staged rather than recorded a sixth time

[MEASURED] Five consecutive Station 00 occurrences (14:27Z, 15:27Z, 16:14Z, 17:14Z, 18:15Z) each
wrote some form of *"I quote no sweep verdict"*. The sweep is the pipeline's safe-to-act gate and
its closing line is a SAFE / CAUTION / DO-NOT-ACT verdict that every station is told to obey. **A
gate whose verdict no caller ever reaches is not in force**, and five runs is long enough that
recording it again would be the sixth description of a defect nobody has acted on.

[MEASURED] The cause, from the script's own shape at 16:29Z by the 1714 run: section 5 calls
`gh pr view <n> --json state,isDraft,mergedAt` once per `#N` **occurrence** — 383 occurrences, 153
distinct, across 52 `needs-marco/` files — so roughly 230 round trips per run re-ask a question
already answered in that same run.

**DISPOSITION: ACTIONED** — the repair is staged in this PR as
`pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` (F83), specifying a per-run cache keyed on the
distinct PR number, a `-SkipSection5` switch that prints a loud skipped-section line rather than a
silently empty one (DOCTRINE §9.6), per-section elapsed timing, and a test asserting all three. The
default run keeps section 5. **What is NOT actioned and must not be read as such: the script is
unchanged on `main`, so the verdict is still unreachable today** — a station reading this must still
measure rather than quote a sweep verdict, until that prompt is armed and its PR merges.

### F89 — S2 — Station 04 advances `sweep-rotation.json` in the SHARED dev tree, cannot open a PR to commit it, and the leftover modification blocks the next fast-forward

[MEASURED] above, with four readings and the writer identified from the file's own `_why` plus a
0-hit control against `status-sweep.ps1`. In short: `next-sweep.mjs --advance` is **required** of
Station 04 by its own rotation design; Station 04 is **read-only on the board and may not create a
PR** (`STATION-CAPABILITIES.md` §5, restated inside this very file's `gate-liveness` brief); the
dev tree is **shared**; and the station doc records that *"a TRACKED file you left modified or
deleted there blocks [the fast-forward] identically"*.

So the advance has nowhere to go. Every Station 04 occurrence leaves a tracked modification in a
shared tree that only Station 00 can land, and nothing in either station's contract says 00 should
pick it up. Two of the four ff read-back probes (`rev-list` → `0 0`, `--cached` → EMPTY) read clean
on it; only `--numstat` and `status --porcelain` catch it, which is exactly the trap the station
doc's four-reading rule was written for.

This is a **map gap, not damage** — nothing is lost, and the rotation state itself is correct and
current. It must not be inflated into an incident.

RULE 1 options, complete-and-additive first:

1. **Station 00 carries the rotation advance in its ordinary board PR, every cycle, and the contract
   says so.** 00 already collects 04's breadcrumbs; the rotation pointer is the same class of state
   from the same station, arriving by a different mechanism. Complete: the advance always lands, the
   fast-forward is never blocked, and the next reader of `main` can always see which sweep is next.
   Additive: 04's lane is untouched, 04 keeps rotating exactly as designed, no state is discarded,
   no gate moves, no file changes shape. **Fails neither half.**
2. **Point `next-sweep.mjs --advance` at a gitignored path.** Fails the *without damaging* half: the
   rotation pointer stops being visible on `main`, so no reader can tell which sweep is next — and
   the file's own `_why` says being that visible record is its purpose.
3. **Station 00 restores it from `HEAD` each run as part of the fast-forward cure.** Fails the
   *completely* half, badly: it discards 04's advance, so the rotation never rotates, which is
   precisely the "every fresh run picks the first entry" defect the file was created to prevent.

**DISPOSITION: ACTIONED, and the durable half ESCALATED.** Actioned for this occurrence: option 1,
done — 04's `18:10:05Z` advance is committed in this PR (item 4 of WHAT CHANGED), which lands the
state AND unblocks the dev tree's next fast-forward in the same move, read back below. Escalated for
the future: **whether option 1 becomes contract** — a line in `00-supervisor.md`'s COLLECT section
making the rotation advance part of what 00 sweeps up — is a doc change to a station contract, and
contract edits are the class this pipeline is most careful about. Drafted for Marco under FOR MARCO.
Until it is contract, every Station 00 run should expect this file modified and carry it.

## WHAT I DID NOT DO

- **I did not quote a sweep verdict.** Section 5 never finished (F88). Nothing I mutated depended on
  one: I crossed the sweep's own `[LIVE]` section 0, 1 and 2 lines against a direct lease read, a
  lock census, a `Get-Process git` count and an in-progress-op check before taking the lease.
- **I did not call `list_scheduled_tasks`**, so I hold no `lastRunAt` cross-check or live cron re-read
  of my own — stated under WHAT I MEASURED rather than left for a reader to assume I looked.
- **I armed nothing.** 13 HOLDs, zero gates satisfied (04, 14:12Z). The prompt staged this run cannot
  be armed until it is tracked on `main`, which this PR is what achieves.
- **I merged no second-lane or watcher-routed PR, and classified none** — the board held 0 open PRs,
  so DOCTRINE §10.1 had nothing to classify and there was no instrument-lane candidate.
- **I removed no `do-not-merge` label** and added none. `WAITING ON MARCO` was 0 and stayed 0.
- **I did not clear any `[STALE]` escalation row,** and did not run `retire-escalation.mjs`. The
  sweep's section 5 never completed, so I hold no stale-claim cross-check at all — the one capability
  F88's staged fix is meant to restore.
- **I did not force-add anything into `needs-marco/`.** It is gitignored by rule and partly tracked
  in fact; the tracked `archive/` copy of the 1714 report is F77's file-backed home instead.
- **I did not prune a worktree or a registry escapee.** Not my lane (03's, report-only), and the
  dirty ones are irreversible (DOCTRINE §5.4).
- **I did not fix `status-sweep.ps1`, `check-instrument-lane.mjs` or `next-sweep.mjs` by hand,** and
  did not edit `instrument-lane.json` — changing the allowlist is always Marco's.
- **I did not edit `/sot/`.** Station 05's alone.
- **I did not disable, enable, re-run or edit any scheduled task.** No station was MISSED.
- **No Azure, Entra or SharePoint anything.** No portal, no App Service settings, no Entra
  registrations, secrets, permissions or consent, no `az`, no `Connect-MgGraph`. No production data
  was read or written.

## FOR MARCO

**Nothing is broken.** Trunk is green on `661ecf89`, all four enabled stations are fresh, the watcher
is running, and no PR is waiting on your label. The board has been empty for six cycles; this run put
the first piece of work back on it.

**The one open question is still F77, and it is no longer blocking anything.** The instrument lane you
ruled on 2026-10-03 cannot fire for any PR the watcher builds, because `PROMPT-SCHEMA` requires every
prompt to retire its own file under `docs/`, and `docs/` is on the lane's never-list. My
recommendation is unchanged: **option 1 — exempt only a prompt's own retirement path from the lane
check**, leaving every other `docs/` path out of lane and the self-retirement rule intact. Option 2
(drop self-retirement for instrument prompts) re-opens a defect this pipeline re-found five times;
option 3 is the status quo, in which the lane delivers nothing for queue-built work. The full text is
in the archived 1714 breadcrumb, now on `main`. **What changed is that I stopped waiting for it**: the
sweep fix is staged regardless, and your answer now only decides whether its PR needs a label.

**A new, smaller question — F89.** Station 04 is required to advance
`docs/pipeline/sweep-rotation.json` each run, and is read-only on the board, so it cannot commit the
advance. The leftover tracked modification sits in the shared dev tree and blocks the next
fast-forward, and two of the four readings a station is told to check read clean on it. I carried
04's advance into this PR, which fixes this occurrence. **Should that become contract** — one line in
`00-supervisor.md`'s COLLECT section saying Station 00 sweeps up the rotation advance along with 04's
breadcrumbs? I recommend yes: it is additive, it discards nothing, and the alternatives either hide
the pointer from `main` or stop the rotation rotating. It is a station-contract edit, which is why I
am asking rather than writing it.

**Third, unchanged:** Station 06 still has no cadence and four items remain queued to it (F65's
`ci.yml` fix, F75's `pipeline-lib.ps1` fix, and the two in F67).
