# Station 03 — Machine Minder | 2026-10-08T23:06Z–2026-10-08T23:24Z

## For Marco

The machines are healthy **right now** — watcher running, keepalive succeeding, no locks,
dev tree clean. Nothing needs you for liveness.

One thing is worth your attention because it is a repeating failure with a named cause and a
cheap permanent fix, and nobody has diagnosed it yet:

**Seven `WATCHER-CRASH-LOOP` escalations were written between 2026-10-03 and 2026-10-06, and
all seven are the same defect: `Get-CimInstance` is called without `-ErrorAction` in
`start-watcher.ps1`, so a transient Windows WMI hiccup kills the watcher child.** Five
identical child failures stop the supervisor entirely, which is how the queue goes quiet. See
**F2** — it carries the complete-and-additive option first, as RULE 1 requires.

**And the component that writes those escalations is not running any more** (F3), so the next
crash loop will produce silence instead of a report.

Two items already yours, re-measured and not re-raised: the cron collision and this station's
bootstrap-vs-cron cadence disagreement (F7).

## GROUND

```
UTC            2026-10-08T23:06:07Z  (scheduled-tasks MCP lastRunAt for 03-machine-minder)
origin/main    609a1602              (fetch first, then rev-parse)
dev tree       main @ 609a1602       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **agree** (1 == 1), so this run was not restricted to read-only by the
version-mismatch clause. `DOCTRINE.md` (core, 508 lines), `STATION-CAPABILITIES.md` (667 lines)
and this station's doc (401 lines) were all read in full from
`git -C C:\ProjectOperations2 show origin/main:<path>` in the **dev tree** — never the working
copy, never the watcher clone. **SIGHTED run**: Desktop Commander was present and PowerShell on
the Windows host answered. This is not a blind run.

⚠️ **This is the SECOND Station 03 run inside sixteen minutes.** The previous one
(`00-03-machine-minder-2026-10-08-2251-...`, origin/main `375f4386`) is 15 minutes old and was
read in full before this run measured anything. Everything it established that has not changed
is cited rather than re-derived; everything that moved is re-measured below.

## WHAT I MEASURED

**Device-bridge git guard — installed, INERT, exit 2.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read from the
installer itself and not from an appended pipeline. Last line:

```
   PATH="/sessions/compassionate-kind-rubin/.local/bin:$PATH" git <args>
EXIT=2
```

Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` Its own controls printed `bash -lc 'command -v git'` →
`/sessions/compassionate-kind-rubin/.local/bin/git` (the shim) and `bash -c 'command -v git'` →
`/usr/bin/git` (the real one). Exit 2 is the station doc's EXPECTED station outcome — a FINDING,
not a stop. **No `git` was run against the mount this run**; every git call below went through a
PowerShell shell on the Windows host.

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` returned
`2026-10-09T09:06:21.3363752+10:00` / `2026-10-08T23:06:21.3373706Z` — Brisbane, UTC+10, the
offset DOCTRINE §3 warns about. No retry was needed; no `CONNECT_TIMEOUT`.

**status-sweep.ps1.** [MEASURED] generated `2026-10-08 23:07:15Z`, completed exit 0 after
198.90 s, 472 lines. Section 0 positive controls both passed (`gh` reached GitHub, saw merged
#2266; `node` runs) — **no `[BROKEN]`**. Verdict section 7:

```
CAUTION: 1 LIVE STATION WORKTREE(s) detected (section 2):
   C:/po-worktrees/st05-sot-2026-10-09
A station may be mid-run. Prefer to wait and re-run; if you must act, use an ISOLATED worktree
```

Compatible with this station's lane: Station 03 is report-only and mutated nothing.
⚠️ The sweep's streamed output again returned early with output pending (DOCTRINE §9.1) and had
to be drained with repeated explicit `read_process_output` calls until `0 remaining`; sections 6
and 7 arrived only on the final drain.

**Watcher process chain — resolved by PID and command line, never by image name** (§9.5).
[MEASURED] `Get-CimInstance Win32_Process`, filtered on command line, at 23:09:30Z:

```
pid=2068   ppid=44460  powershell.exe  -WindowStyle Hidden -File "C:\po-watcher\watcher-launcher-singlelane.ps1"
pid=32176  ppid=2068   powershell.exe  -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1
pid=8848   ppid=32176  node.exe        --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```

Three generations intact, rooted in **`watcher-launcher-singlelane.ps1`** — the launcher the
station doc names. **Identical PIDs to the 22:51Z run**, so the watcher has not restarted in
between. Sweep section 2 independently: `watcher node: RUNNING pid 8848`,
`auto-restart wrapper: alive (1)`.

**The watcher was observed working, not inferred alive.** [MEASURED] from the clone's
`logs/2026-10-08.log`, read from log **CONTENT** and never from a mount `stat`:

```
[2026-10-08T22:59:15.413Z] [ok] rev-2265-ready.md  processed/
[2026-10-08T23:03:47.649Z] [review] verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=185
[2026-10-08T23:08:47.627Z] [review] verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=185
```

The newest line is 43 seconds before the probe that read it. Sweep `heartbeat age: 9 min` — and
§9.5 is explicit that heartbeat age alone cannot separate idle from wedged, so the log lines
above, not the age, are what carries this claim.

**Restarter presence.** [MEASURED] `Get-ScheduledTask` / `Get-ScheduledTaskInfo`:
`PO Watcher Keepalive  state=Ready  lastRun=2026-10-09 09:05:01 local (23:05:01Z)
lastResult=0  nextRun=09:15:00`. Enabled, succeeding, five-minute cadence.

**Locks and in-flight merge state — nothing anywhere.** [MEASURED] a scan over both
`C:\ProjectOperations2\.git` and `C:\po-watcher\ProjectOperations\.git` for `index.lock`,
`MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` and `sequencer`
printed **no PRESENT line at all**. Sweep section 3 independently:
`git index.lock interactive/clone: False / False`, `git processes touching our trees (scoped): 0`,
`board lease: free`. **Nothing to clear, and nothing was cleared.**

**Dev tree is now fast-forward-clean — all four readings, because the first three pass on a
dirty tree.** [MEASURED]

```
rev-list --left-right --count HEAD...origin/main  ->  0  0
diff --numstat origin/main                        ->  EMPTY
diff --cached --name-status                       ->  EMPTY
status --porcelain --untracked-files=no           ->  EMPTY
```

All four clean. The three dirty tracked paths the 22:51Z run measured mid-flight
(`sweep-rotation.json`, `.arming-log.txt`, a deleted HOLD prompt) were Station 00's live work and
landed in **#2266** at 23:04Z. Only untracked breadcrumbs remain — see F8.

**Clone drift is FOURTEEN, not thirteen, and still needs no restart.** [MEASURED] clone
`HEAD=65e7c22c`; true `origin/main=609a1602` read **in the dev tree** (the clone's own
`origin/main` reads `375f4386` — a per-tree ref, fetched only at launcher start, §9.2).
Measured against the dev tree's refs:

```
rev-list --left-right --count 65e7c22c...origin/main            ->  0  14
diff --name-only 65e7c22c origin/main -- scripts/pr-watcher/    ->  0 files
diff --name-only 65e7c22c origin/main                           ->  69 files   (positive control)
diff --name-only 65e7c22c origin/main -- scripts/mm03b-needle-20261008-2312/  -> 0  (negative control)
```

The fourteenth commit is `609a1602 docs(board): collect ... (#2266)`. The other thirteen are
#2251–#2264. **The running `index.mjs` is not stale in any way that matters**, so §9.5's
"a `scripts/pr-watcher/**` merge needs a restart" does not fire.

**Clone working state.** [MEASURED] `status --porcelain --untracked-files=no` → EMPTY;
untracked → exactly three files, all `Claude Design/proposed/*.html`. The sweep's
`tracked-dirty=0 untracked=3` agrees.

**`failed/` triage — NOTHING NEW.** [MEASURED] `failed/` holds **80** files; the newest
`LastWriteTimeUtc` across all of them is **2026-10-06 05:47:39Z**
(`pr-sweep-marco-queue-line-ready.md.report.md`). That cohort was tabulated by name in the
2026-10-06-2303 breadcrumb and re-confirmed by the 22:51Z run. **No file in `failed/` postdates
either breadcrumb, so there is no new entry to triage and no fresh diagnosis was written.**
Per the brief: only NEW entries are triaged.

**Armed prompts, globbed at TOP LEVEL ONLY** (deeper returns 1600+ inert retirement files).
[MEASURED] `*-ready.md` at depth 1 → **0**. Sweep section 4 agrees: `armed (*-ready.md): 0`.

**Queue census.** [MEASURED] sweep section 4: `needs-marco/ 54`, `no-pr-opened/ 111`,
`failed/ 80`, `blocked/ 201`.

**Scheduled tasks, read from the MCP and from no document.** [MEASURED] `list_scheduled_tasks`
at 23:0xZ:

| task | cron | enabled | lastRunAt | nextRunAt |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | true | 2026-10-08T23:07:07.113Z | 2026-10-09T00:13:52Z |
| `04-scanner` | `0 */4 * * *` | true | 2026-10-08T22:38:07.297Z | 2026-10-09T02:09:31Z |
| `05-sot-keeper` | `10 0 * * *` | true | 2026-10-08T22:38:07.635Z | 2026-10-09T14:22:37Z |
| `03-machine-minder` | `0 9 * * *` | true | **2026-10-08T23:06:07.485Z** | 2026-10-09T23:02:45Z |
| `weekly-security-audit` | `30 7 * * 1` | **false** | 2026-09-06T21:32:44.637Z | — |

Live enabled count is **FOUR**, as STATION-CAPABILITIES §1's 2026-09-15 correction records.
**The 41-hour station outage #2266 reported is OVER**: every enabled task has fired inside the
last half hour.

**`check-breadcrumb.mjs` — the only validator for a breadcrumb, run on the Windows host.**
[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` → `structure: 3 checked, 0 malformed,
0 skipped`, `CLEAN`, **exit 0**. `node scripts/pipeline/check-breadcrumb.mjs --freshness` →
`CLEAN`, **exit 0**, with every station `ok`:

```
  00  last 2026-10-08T22:38:00Z  0.6h ago  (cadence 1h + grace 0.5h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-08T22:51:00Z  0.3h ago  (cadence 24h + grace 3h)  ok
  04  last 2026-10-08T22:38:00Z  0.6h ago  (cadence 4h + grace 1h)  ok
  05  last 2026-10-08T22:38:00Z  0.6h ago  (cadence 24h + grace 3h)  ok
```

So **`breadcrumb-clean`** is claimed here with the command quoted, as the contract requires —
this is a sighted run, so the validator ran on the host and not from the mount (a blind run may
not claim it: it shells `git ls-tree`, `git ls-files` and `gh pr list`).

**Crash-loop escalations — seven, all machine-health, none previously triaged.** [MEASURED]
`docs/pr-prompts/needs-marco/WATCHER-CRASH-LOOP-*.md`, read in full:

| file | local timestamp inside the file | `FullyQualifiedErrorId` the child gave |
|---|---|---|
| `...2026-10-03-163756` | 2026-10-03T16:37:56+10:00 | `InvokeMethodOnNull` |
| `...2026-10-03-164455` | 2026-10-03T16:44:55+10:00 | `InvokeMethodOnNull` |
| `...2026-10-04-210548` | 2026-10-04T21:05:48+10:00 | `HRESULT 0x80041033,...GetCimInstanceCommand` |
| `...2026-10-06-030250` | 2026-10-06T03:02:50+10:00 | `HRESULT 0x80041033,...GetCimInstanceCommand` |
| `...2026-10-06-030334` | 2026-10-06T03:03:38+10:00 | `HRESULT 0x80041033,...GetCimInstanceCommand` |
| `...2026-10-06-041535` | 2026-10-06T04:15:35+10:00 | `HRESULT 0x80041033,...GetCimInstanceCommand` |
| `...2026-10-06-061418` | 2026-10-06T06:14:19+10:00 | `HRESULT 0x800700a4,...GetCimInstanceCommand` |

All seven say the same thing: *"The watcher child (start-watcher.ps1) exited non-zero 5 times in
a row with the identical reason ... the supervisor has stopped and is telling you instead."*
Every timestamp is **local** (+10:00) and is quoted as written, not converted.
`0x80041033` is `WBEM_E_SHUTTING_DOWN`; `0x800700a4` is `ERROR_MAX_THRDS_REACHED`.
Both are WMI-side, not watcher-side.

**`Get-CimInstance` call-site inventory in the launch chain.** [MEASURED]
`Select-String -Pattern 'Get-CimInstance|Get-WmiObject|InvokeMethod'`:

```
start-watcher.ps1       L137   $existing = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
supervise-watcher.ps1   L278   $proc = Get-CimInstance -ClassName Win32_Process `
supervise-watcher.ps1   L299   $wrapperParent = Get-CimInstance -ClassName Win32_Process `
supervise-watcher.ps1   L737   @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
supervise-watcher.ps1   L800   @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
supervise-watcher.ps1  L1047   $alive = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
ensure-watcher.ps1       L34   $alive = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
ensure-watcher.ps1       L91   $all  = Get-CimInstance Win32_Process
watcher-launcher-singlelane.ps1  (no match)
```

⚠️ **Instrument honesty: my chosen positive control returned 0.**
`Select-String -Pattern 'param'` over `start-watcher.ps1` → **0 hits**, and the negative control
(a needle minted this run, `mm03bNeedle20261008T2320Z`) → **0 hits**. So the control pair did not
separate. The instrument is nevertheless proven on that exact file by the real query itself,
which returned the `L137` hit — a positive from the same `Select-String` against the same path.
The call-site table is therefore `[MEASURED]`; the attribution of the failure to **L137
specifically** is `[INFERRED]` (it is the only `Get-CimInstance` in `start-watcher.ps1`, and all
seven escalations name `start-watcher.ps1` as the child that exited and
`GetCimInstanceCommand` as the failing cmdlet).

**WMI is healthy now.** [MEASURED] `Get-Service Winmgmt` → `Status Running`,
`StartType Automatic`. So the crash loops were transient WMI conditions, not a dead service —
which is precisely why an unguarded call is the defect rather than the symptom.

**The supervisor that writes those escalations is NOT running.** [MEASURED]
`Get-CimInstance Win32_Process -Filter "Name='powershell.exe'"` filtered on command line matching
`supervise-watcher` → **0 processes**, measured in the same call that returned the three live
launcher-chain PIDs above (so the instrument demonstrably finds processes). The live chain is
`watcher-launcher-singlelane.ps1` → `start-watcher.ps1` → `node index.mjs`, with
`supervise-watcher.ps1` nowhere in it. [CANNOT MEASURE] whether that is intended: the seven
escalation files prove it was running 2026-10-03 → 2026-10-06, and nothing on disk records a
decision to stop using it.

**The clone's stash list is a closed loop, and it is now 86 deep.** [MEASURED]
`git -C C:\po-watcher\ProjectOperations stash list` → `stash@{0}` … `stash@{85}`. The four
newest are `watcher-preflight-autostash on 'main'` dated 2026-10-04T16:57, 16:49, (one on a
feature branch) 16:47 and 07:41 **+10:00**; nine were created on 2026-10-04 alone — the same day
as two of the crash loops. DOCTRINE §9.2: *"`git stash` in the watcher clone is a CLOSED LOOP —
the launcher stashes on every start and never pops."* Measured, not quoted. **Nothing was
popped, dropped or cleared.**

**Worktrees.** [MEASURED] sweep section 2: `non-main worktrees found: 31` (the 22:51Z run
measured 32), classified by the sweep itself. One is live —
`C:/po-worktrees/st05-sot-2026-10-09  7f2badd1 [docs/sot-reconcile-2026-10-09]  dirty=0 age=23
min`, flagged *do NOT prune; a station is working here*. Two of the remaining 30 carry content
`--force` would destroy:

| worktree | branch | age (min) | holds |
|---|---|---|---|
| `C:/po-wt/fv2drop` | `wt-fv2-formrule-contract-drop` | 21,028 | **21 commits on no remote branch** |
| `C:/po-worktrees/sup-cwd-paths` | `fix/pipeline-scripts-resolve-state-paths-from-module` | 21,092 | 4 commits + **2 uncommitted files** |

**Two registry escapees, both confirmed dead build directories.** [MEASURED]
`C:\PR-Master\worktrees\bootstrap-check` (lastWrite 2026-10-02 23:27:05Z) and
`C:\po-wt\dispatch-register-v1` (lastWrite 2026-10-02 21:41:36Z) each contain exactly three
entries — `apps`, `node_modules`, `packages` — and **neither appears in
`git -C C:\ProjectOperations2 worktree list --porcelain`**, whose 32 entries were enumerated and
read. They are plain directories, not worktrees: `git worktree remove` has nothing to remove.

**One genuinely dead escalation.** [MEASURED] sweep section 5:
`[STALE] pr-2260-review-fix.md references #2260 which is MERGED -- escalation is DEAD, clear it.
Do NOT report it as pending.` Every other `needs-marco/` line in section 5 was `[FILE]`
("cites N MERGED PRs as evidence — not its premise"), which the sweep itself says does not clear
anything.

**Board state, for context only (not this station's lane).** [MEASURED] sweep section 1:
2 open PRs, both BEHIND and both RED — #2265 (9 pass / 1 fail) and #2261 (13 pass / 2 fail,
labelled `do-not-merge`, open 44h). `main` CI on `609a1602`: 0 success / 0 failed / **4 running**
— `[CANNOT MEASURE]`, not a green trunk.

## WHAT CHANGED

**Nothing on the machines, nothing on the board, nothing in the queue.** Station 03 is
report-only. Specifically: no lock cleared (none existed), no worktree pruned or removed, no
directory deleted, no stash popped or dropped, no prompt armed, disarmed, copied or restaged, no
PR touched, no label changed, no watcher stopped or relaunched, no `git` run against the mount,
no escalation retired, and nothing written outside the two locations below.

Files written this run:

- scratch probes in `C:\po-sup-fix-scripts\` (`mm03b-probe.ps1`, `mm03b-probe3.ps1`,
  `mm03b-probe4.ps1`) and their outputs plus the three binding documents under `%TEMP%\mm03\` —
  the sanctioned scratch tree, disposable, nothing reads them;
- **this breadcrumb**, in the **dev tree** at `C:\ProjectOperations2\docs\pr-prompts\`.

🔴 **This breadcrumb is UNTRACKED in the dev tree and Station 00 must sweep it up.** Cure 1 —
write the breadcrumb inside the run's own PR worktree — is **unavailable to Station 03**, which
has no authority to create a PR (STATION-CAPABILITIES §5 authority matrix). The dev-tree home is
therefore the only correct one left. See **F8**: the dev tree is otherwise fast-forward-clean,
so this file and two others are now the only things that can refuse the next `--ff-only`.

## FINDINGS

**F1 — The machines are healthy, and the watcher was proved by watching it work, not by reading
a number.** Three-generation chain under `watcher-launcher-singlelane.ps1` with the **same PIDs
as sixteen minutes ago** (2068 / 32176 / 8848), so no restart happened in between; keepalive
`Ready` with `lastResult=0` and `lastRun 23:05:01Z`; the clone log's newest line
(`[23:08:47.627Z] [review] verdict-archive sweep`) was 43 seconds old when read; no `index.lock`,
no `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD`/`rebase-merge`/`rebase-apply`/`sequencer` in
either tree; `git processes touching our trees (scoped): 0`; board lease free; dev tree clean on
all four readings. The sweep's `heartbeat age: 9 min` is reported but carries nothing — §9.5 is
explicit that age alone cannot separate idle from wedged.
**DISPOSITION: ACTIONED** — nothing to repair, and that is the measurement. Verified by the live
log line, the identical-PID re-measure, and the empty lock scan.

**F2 — All seven `WATCHER-CRASH-LOOP` escalations are ONE defect: `Get-CimInstance` is called
without `-ErrorAction` in the watcher's own start path, so a transient WMI condition kills the
child.** Seven escalations between 2026-10-03T16:37+10:00 and 2026-10-06T06:14+10:00, each
written after **five identical consecutive child failures**, at which point the supervisor stops
restarting and the queue goes quiet. The error ids are `HRESULT 0x80041033`
(`WBEM_E_SHUTTING_DOWN`, ×4), `HRESULT 0x800700a4` (`ERROR_MAX_THRDS_REACHED`, ×1) and
`InvokeMethodOnNull` (×2) — the first two name `GetCimInstanceCommand` explicitly, and the third
is the shape a null return from the same call produces downstream. `start-watcher.ps1:137` is the
**only** `Get-CimInstance` in that file and it carries no `-ErrorAction`; by contrast
`supervise-watcher.ps1` L737 and L800 already guard theirs with `-ErrorAction SilentlyContinue`,
so the safe pattern is established in the same codebase. `Winmgmt` is `Running` now, so this is
a transient-WMI-handling defect, not a dead service. **This is a diagnosis, not a nuisance
(DOCTRINE §2) — and it has not been diagnosed before: no prior Station 03 breadcrumb mentions
these files.**
**DISPOSITION: DISPATCHED to Station 00.** The fix is a code change under
`scripts/pr-watcher/**`; Station 03 is report-only and cannot create a PR or arm a prompt.
RULE 1 applied — *solve it completely, immediately and in future, without damaging existing or
future data entry*:

- **Complete and additive (recommended):** guard every `Get-CimInstance` in the watcher launch
  chain (`start-watcher.ps1:137`; `supervise-watcher.ps1` L278, L299, L1047; `ensure-watcher.ps1`
  L34, L91) with `-ErrorAction SilentlyContinue` plus an explicit null check, and treat a WMI
  failure as *"cannot determine — retry next tick"* rather than as a fatal child exit. Passes
  both halves: it fixes the seven observed occurrences and every future one, and it adds error
  handling without changing any data, any queue file or any behaviour on the success path.
  ⚠️ **Note the second-order trap it must avoid:** `-ErrorAction SilentlyContinue` alone turns
  "WMI is down" into "no node is running", which would invite a duplicate launch. DOCTRINE §7's
  *"a tool that cannot run must FAIL LOUD, never fail quiet"* applies — the null case must be
  distinguished from the empty case, not merged into it. **This is why the fix is a prompt for a
  code-writer and not a one-line edit.**
- *Alternative A:* raise the supervisor's identical-failure threshold above five so it keeps
  restarting through a WMI blip. Fails the **complete** half — it hides the defect, and the
  threshold exists precisely because an endless restart loop once left the queue dead for 2.5
  hours undiagnosed (the escalation file says so in its own words).
- *Alternative B:* leave it and rely on `PO Watcher Keepalive` to bring the chain back. Fails the
  **complete** half outright: it is the status quo, it produced seven outages in four days, and
  the keepalive cannot help once the supervisor has deliberately stopped.

**F3 — The component that writes those escalations is no longer in the live chain, so the next
crash loop will be silent.** `supervise-watcher.ps1` authored all seven files between 10-03 and
10-06; **zero** processes matching `supervise-watcher` are running now, measured in the same call
that successfully returned the three live chain PIDs. The live chain is
`watcher-launcher-singlelane.ps1` → `start-watcher.ps1` → `node`, with no supervisor layer.
[CANNOT MEASURE] whether this is a deliberate change: nothing on disk records a decision, and the
station doc's source of truth for the launcher (`ensure-watcher.ps1`, anchor `$Launcher =`) names
the singlelane launcher without mentioning a supervisor. **This matters more than F2's absolute
severity**: F2 is a bug that announces itself, and F3 removes the announcement.
**DISPOSITION: DISPATCHED to Station 00.** What 00 needs to settle, in order: (1) read
`ensure-watcher.ps1` and `watcher-launcher-singlelane.ps1` to determine whether
`supervise-watcher.ps1` is meant to be in the chain at all; (2) if it is, its absence is the
finding and relaunching it is a machine repair 00 dispatches; (3) if it is retired, the
crash-loop detection it provided needs a home, because nothing else writes those escalations.
Not escalated to Marco — no hard stop, nothing irreversible, and the question is answerable from
the repo.

**F4 — Clone drift is FOURTEEN commits and still requires NO watcher restart; the number in the
22:51Z breadcrumb was right when written and is now one short.** `65e7c22c` vs `609a1602`:
`0  14`. The filtered diff over `scripts/pr-watcher/` returns **0 files** against a positive
control of **69 files** changed overall and a freshly minted negative control of **0**. The
fourteenth commit is #2266, a `docs(board)` collect. The clone's *own* `origin/main` still reads
`375f4386`, which is why this had to be measured in the dev tree (§9.2: `origin/main` is a
per-tree ref). A station reading "14 behind" and dispatching a restart would stop a healthy
watcher for nothing.
**DISPOSITION: DEFERRED** — the clone fast-forwards itself on the next launcher start and nothing
is waiting on it. It becomes urgent the moment a commit lands under `scripts/pr-watcher/**` while
the clone is behind: at that point the running `index.mjs` is genuinely stale and a detached
relaunch via `Invoke-CimMethod -ClassName Win32_Process -MethodName Create` is required.
**Falsifying probe: re-run the filtered diff; a non-zero count retires this disposition
immediately.**

**F5 — The watcher clone's stash list has reached 86 entries and is still growing nine a day on
a bad day.** `stash@{0}`–`stash@{85}`; the four newest are `watcher-preflight-autostash` from
2026-10-04 (+10:00), nine of them on that date alone, which is also a crash-loop date — a start
that stashes and then dies leaves the stash behind. DOCTRINE §9.2 records this as a closed loop
by design: the launcher stashes on every start and never pops. Measured here, not quoted,
because the count is the new information.
**DISPOSITION: DEFERRED** — no one is waiting on it and the cure is forbidden to a station:
`git stash pop` against the queue resurrects consumed prompts (§9.2), and this is the clone,
where no agent may run `checkout`/`commit`/`push` (§4). It becomes urgent if the clone's `.git`
starts costing real disk or if a preflight stash is ever found to contain work that was not
disposable — the honest reading today is that nobody has inspected any of the 86.

**F6 — Thirty orphan worktrees, two of which hold work `--force` would destroy, plus two dead
build directories outside the registry.** Live count **31** non-main worktrees (down from 32 at
22:51Z), one of them Station 05's live tree. `C:/po-wt/fv2drop` holds **21 commits on no remote
branch** (age 21,028 min ≈ 14.6 days); `C:/po-worktrees/sup-cwd-paths` holds 4 commits **plus 2
uncommitted files**. Separately, `C:\PR-Master\worktrees\bootstrap-check` and
`C:\po-wt\dispatch-register-v1` contain only `apps`, `node_modules`, `packages`, were last
written 2026-10-02, and appear in **no** entry of `git worktree list --porcelain` — they are
plain directories, so `git worktree remove` has nothing to remove and a recursive delete is the
only action available.
**DISPOSITION: DISPATCHED to Station 00.** Pruning is a board mutation. Before touching either of
the two content-bearing trees, 00 confirms the branch is squash-merged
(`gh pr list --head <branch> --state merged`) and, for `sup-cwd-paths`, lists the dirty files
first (`git -C C:/po-worktrees/sup-cwd-paths status --porcelain`) and preserves them. The two
escapees are safe to delete as directories on the evidence above, but deleting is still a
mutation and still 00's. Not escalated — nothing is irreversible until someone types `--force`.

**F7 — Re-measured, not re-raised: the cron burst and this station's cadence disagreement.**
`00-supervisor`, `04-scanner` and `05-sot-keeper` show `lastRunAt` 23:07:07Z, 22:38:07.297Z and
22:38:07.635Z — 04 and 05 **338 milliseconds apart**, and 00 fired 29 minutes later. Separately,
**this station fired twice in sixteen minutes** (22:51:07Z and 23:06:07Z) against a `0 9 * * *`
daily cron, which is the catch-up burst following the 41-hour outage #2266 reported. And this
station's bootstrap still opens *"Cadence: every 4 hours"* against that daily cron.
**DISPOSITION: DEFERRED** — all of it is in the scheduled-tasks layer, which no station can
change, and both halves are already open with Marco
(`needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`,
`needs-marco/station-schedule-collision-04-and-05-2026-09-03.md`,
`needs-marco/scheduled-task-runner-stopped-for-77h-while-the-box-stayed-up-2026-09-21.md`). This
run adds one new datum to the last of those: **after an outage the runner fires missed
occurrences in a burst, so a station can run twice inside one cadence window.** It becomes urgent
if two instances of a *mutating* station ever overlap; today both 03 runs were report-only and the
board lease was free throughout.

**F8 — The dev tree is fast-forward-clean except for three untracked breadcrumbs, which is now
the only thing that can refuse the next `--ff-only`.** All four fast-forward readings are clean
(`0 0`, numstat EMPTY, `--cached` EMPTY, `--porcelain --untracked-files=no` EMPTY) — Station 00's
three dirty paths landed in #2266. `git ls-files` returns **nothing** for the 22:51Z breadcrumb
(positive control: the same query for the archived 2026-10-06 breadcrumb returns its path), so
both it and `00-04-scanner-2026-10-08-2238-...` are untracked, and `check-breadcrumb.mjs` flags
each with `NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`. This file is
the third. **#2266 committed Station 00's own breadcrumb and left 03's and 04's behind.**
**DISPOSITION: DISPATCHED to Station 00.** Sweeping breadcrumbs into a board PR is 00's
collect step and is the only channel that closes. Until it runs, three findings-bearing files sit
at tracked paths with nothing tracking them, and the station doc's warning applies: once a PR
lands these exact paths on `main`, an untracked file at the same path refuses
`git merge --ff-only` while `--numstat` and `--cached` both read EMPTY, which is the documented
PASS reading.

**F9 — One `needs-marco/` escalation is provably dead.** Sweep section 5:
`[STALE] pr-2260-review-fix.md references #2260 which is MERGED -- escalation is DEAD, clear it.`
#2260 is confirmed merged in section 1 (`2026-10-07 02:29Z`). Every other section-5 line was
`[FILE]` and the sweep says those do not clear anything.
**DISPOSITION: DISPATCHED to Station 00.** Retiring an escalation means moving the file
(nothing is ever deleted — DOCTRINE §8.5), which is a queue mutation outside this station's lane.

**F10 — The device-bridge git guard is INERT (exit 2), so the git ban is remembered, not
mechanical.** The installer's own controls show the shim byte-correct and off `PATH` for the
non-interactive, non-login shell a station is given. DOCTRINE §9.2 records this ban failing seven
times while it was only remembered.
**DISPOSITION: DEFERRED** — the station doc declares exit 2 the EXPECTED station outcome and
explicitly refuses to widen the stop contract for it, because turning a missing shell script into
a frozen board is the outcome the guard exists to prevent. Recorded, obeyed (no `git` touched the
mount this run), not repaired. It becomes urgent if any station is ever measured running `git`
against a mounted folder — the signature is a 0-byte `index.lock` with no owning Windows process.

## WHAT I DID NOT DO

- **Did not repair, prune, delete, arm, disarm, merge, label, restage or restart anything.**
  Station 03 is report-only (station doc AUTHORITY; STATION-CAPABILITIES §5), and the sweep's own
  verdict independently said CAUTION / prefer to wait while Station 05 holds a live worktree.
- **Did not relaunch `supervise-watcher.ps1`** (F3). A relaunch is a machine repair, Station 00
  dispatches those, and the prior question — whether it belongs in the chain at all — is
  unanswered. Launching a second supervisor over a healthy chain is how two watchdogs end up
  holding kill authority over one node, which this station recorded on 2026-09-16.
- **Did not fix `start-watcher.ps1:137`** (F2). It is production pipeline code under
  `scripts/pr-watcher/**`, Station 03 may not create a PR, and the fix needs the null-vs-empty
  distinction argued in F2 rather than a reflexive `-ErrorAction SilentlyContinue`.
- **Did not pop, drop or clear any of the 86 clone stashes** (F5). `git stash pop` against the
  queue resurrects consumed prompts (§9.2), and the clone is a shared tree where a live agent may
  be working (§4).
- **Did not prune `C:/po-wt/fv2drop` or `C:/po-worktrees/sup-cwd-paths`** — 21 unpushed commits
  and 2 uncommitted files respectively. Destroying either is irreversible (§5 hard stop 4).
- **Did not delete the two registry escapees**, although the evidence says they are dead build
  directories. Deleting is still a mutation and still Station 00's.
- **Did not restage the three `401 OAuth access token has been revoked` prompts in `failed/`.**
  The station brief describes restaging transient failures by copy-with-fresh-letter, but copying
  a prompt back into `docs/pr-prompts/` **is arming**, and the authority matrix gives arming to
  Station 00 alone. Where the brief disagrees with the contract, the contract wins.
  **DISPATCHED to Station 00** — one shared non-code root cause, three prompts; the 10-06 and
  22:51Z runs left it for the same reason.
- **Did not write a fresh diagnosis for anything in `failed/`.** Nothing in it postdates
  2026-10-06T05:47Z and that cohort is already tabulated by name in two prior breadcrumbs.
  Re-diagnosing a triaged cohort is what the known-incident ledger exists to prevent.
- **Did not retire `pr-2260-review-fix.md`** (F9) or any other `needs-marco/` file, and did not
  append to any file under `needs-marco/` — 6 of 61 files in that gitignored folder are tracked
  in fact, and an append there can ride into another actor's commit.
- **Did not run `git` against the mount**, in any form, the guard being inert. Every git reading
  in this report came from a PowerShell shell on the Windows host.
- **Did not touch Azure, Entra or SharePoint**, read or write. Absolute, every station, every run.
- **Did not re-run `status-sweep.ps1` before writing**, because this run mutates nothing — the
  re-run requirement is scoped to the moment before a board mutation, and there was none.
