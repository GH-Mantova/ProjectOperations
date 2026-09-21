# Station 00 — Supervisor | 2026-09-21T00:04Z–2026-09-21T00:32Z

## GROUND

```
UTC            2026-09-21T00:04:02Z
origin/main    875e1076              (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 875e1076       C:\ProjectOperations2  (opened at 895bdefc, 1 behind; fast-forwarded this run)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

**Doc version and bootstrap AGREE.** This run is not read-only.

**Which tree the binding documents were read in, and why the working copy was sound.** All three
were read from `C:\ProjectOperations2` rather than through `git show origin/main:<path>`. That is
sound *this run only*, and it was proved before any of them was opened, with the probe PREFLIGHT
step 2 names — no pipe, no hash comparison:

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md
  -> EMPTY
```

EMPTY output is the real answer: the working copy of all three was byte-equal to `origin/main`
while the tree was still one commit behind. `00-supervisor.md` 1350 lines, `DOCTRINE.md` 2589 lines
and `STATION-CAPABILITIES.md` 545 lines were each read end to end.

**Device-bridge git guard — installed, last line quoted verbatim** (PREFLIGHT step 1 requires the
quotation pass or fail):

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS. No `git` was run through the VM mount at any point in this run.

## WHAT I MEASURED

**Reachability — SIGHTED.** `start_process` shell `powershell.exe` returned a live prompt on the
first attempt after a keyword `ToolSearch` for `desktop-commander` (the ids in this environment are
`mcp__plugin_desktop-commander_desktop-commander__*`, which no hard-coded `select:` list would have
found). Two persistent shells, PIDs 30700 and 9388, carried the whole run. [MEASURED]

**[MEASURED] NO SCHEDULED SESSION FIRED FOR 76 HOURS 56 MINUTES, AND THE BOX WAS UP THE WHOLE
TIME.** The session-directory instrument, scanned at depth 3 under
`…\Claude\local-agent-mode-sessions` with **no name filter** (the 2026-09-15 rename makes a
`local_*` glob structurally blind to everything newer):

| probe | result |
|---|---|
| directories at depth 3, any name | **1569** |
| of those matching the retired `local_*` glob | **1535** — every one created on or before `2026-09-15T23:01:20Z` |
| newest session **before** the gap | `b6315fba` — **2026-09-17T19:07:56Z** |
| next sessions after it | `3634f2fa`, `1b702ce3`, `1714148a` — all **2026-09-21T00:04:02Z** |
| gap | **76.94 h**, zero sessions of any name |

POSITIVE control that an absent directory is a real absence and not retention: the 09-15, 09-16 and
09-17 directories are all still on disk, and the 1535/1569 split reproduces DOCTRINE §9.5's recorded
rename measurement from the other side.

🔴 **The machine did not reboot and the watcher did not die.**
`(Get-CimInstance Win32_OperatingSystem).LastBootUpTime` → **`2026-09-15T13:32:45Z`** — continuous
uptime across the whole gap. The watcher node is pid **9744**, `CreationDate` **2026-09-20T21:14:06Z**,
i.e. it was restarted by its own supervisor **2 h 50 m before the gap ended**, with no station
present. So this was **not** a power, machine or watcher outage: the Windows host and the pipeline's
own daemon ran throughout, and only the Claude desktop app's scheduled-task runner stopped firing.

**Per-station cost of the gap** (`list_scheduled_tasks`, crons evaluated in Brisbane local):

| station | cron | `lastRunAt` | occurrences lost |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-09-21T00:04:02Z (this run) | ~76 hourly |
| `04-scanner` | `0 */4 * * *` | 2026-09-21T00:04:02Z (catch-up, not a `*/4` slot) | ~19 |
| `05-sot-keeper` | `10 0 * * *` | 2026-09-21T00:04:02Z (catch-up, not its 14:10Z slot) | 3 |
| `03-machine-minder` | `0 9 * * *` | **2026-09-16T23:01:15Z** | **4**, and it did NOT catch up |

`weekly-security-audit` remains `enabled: false` — unchanged, and already filed.

⚠️ **`lastRunAt` alone would have refuted this finding**, exactly as `00-supervisor.md` records: for
00, 04 and 05 it reads fresh-to-the-second right now. Only the session directory answers *"did an
EARLIER occurrence fire?"*, and only the unfiltered scan answers it after the rename.

**Freshness** — `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **2**:

```
  00  last 2026-09-17T19:08:00Z  77.0h ago  (cadence 2h)  SILENT
  03  last 2026-09-16T23:02:00Z  97.1h ago  (cadence 24h) SILENT
  04  last 2026-09-17T18:11:00Z  78.0h ago  (cadence 4h)  SILENT
  05  last 2026-09-17T14:11:00Z  82.0h ago  (cadence 24h) SILENT
```

All four silences have **one** cause and it is the gap above. `structure: 4 checked, 0 malformed`.
The four `UNTRACKED` NOTE lines it printed named the four breadcrumbs `#2016` had **archived** —
tracked under `archive/`, reported already, and NOT re-committed here (the archiving trap
`00-supervisor.md` records; the tracked set was asked, not the dev tree).

⚠️ `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` against a live cron of `5 * * * *`.
Re-confirmed, unchanged, already filed for Marco — quoted here only so the `77.0h` figure is read
against the right denominator (77 missed hourly runs, not 38).

**Sweep** — `scripts/pipeline/status-sweep.ps1`, captured with `*>` and decoded `utf16le` per §9.3
(the capture was `FF FE`, 150144 bytes, 436 lines):

- section 0 both instrument positive controls **PASS**
- section 7 **`SAFE TO ACT`** — no board mutation in progress, no `index.lock` in either tree, 0
  scoped git processes, no PR touched in the last 2 minutes
- section 5 produced **zero `[STALE]` rows** this run. The eleven PR-scoped dead escalations of
  2026-09-10 are gone; nothing to discharge into `needs-marco/discharged/`.
- section 6: `ready=1 needs-marco=2 blocked=4 broken=0`

**Board** — one open PR, and it is not work:

```
#2017  OPEN  BLOCKED  mergeable=MERGEABLE  labels=[do-not-merge]
       feat(crm): S6 - Review-and-link preview as the artboard's dialog on the s7 kit (CRM_PARITY_BULKLINK_V1)
       CI: 13 pass / 2 fail
```

The two failures are `Approval receipt (CP-26)` and `PR gates — diff checks`, which is the single
cause §9.4 names. Read from **column 3** of the job log (`gh run view 35267717655 --job 105358940274
--log`, 223 lines, split on tab, last column — never the whole line, §9.1):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
(escalates:true). A human must review and REMOVE the label; removing it is what releases the merge.
```

NEGATIVE control, a freshly minted needle over the same last-column set → **0**. The verdict token
is `[LABEL_PRESENT]`: **parked by design, not a red to fix, and there is no agent-side action behind
it.** Trunk on `875e1076` is **green** (4 success / 0 failed).

**Watcher** — the sanctioned probe, and only it:

```
scripts\restart-watcher-if-wedged.ps1
  armed prompts waiting: 0
  watcher process:       ALIVE (pid 9744)
  restart churn:         0 cycle(s) in 20 min
  VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
```

The sweep's `heartbeat age: 4593 min` is the gap, not a hang: the heartbeat ticks only mid-run and
the queue has been empty since `#2017` was built. No restart was attempted and none was warranted.

**Queue** — `armed: 0`, `HOLD: 27`, and `triage-holds.ps1` (GIT control PASS, SPENT control PASS)
admits exactly **two**, neither of which Station 00 may arm:

| ADMIT | why it is not armable |
|---|---|
| `pr-crmvis-s6-bulk-link-HOLD.md` | **3 of 3** scope entries overlap open `#2017`, and `#2017`'s TITLE carries the prompt's own marker `CRM_PARITY_BULKLINK_V1` — confirmed on the marker, not the head branch. It is the PR's own prompt. |
| `pr-queue-layout-sot-entry-HOLD.md` | front matter `station: '05'`, `scope: [sot/02-roadmap-and-status.md]`. Arming routes it to the watcher's code-writer, which may not edit `/sot/` — and CP-24 would hard-fail the result. |

`spent=0 of 27 · gates-satisfied=2 · still-gated=25 · unreadable=0`.

## WHAT CHANGED

**1. The dev tree was fast-forwarded, 895bdefc → 875e1076, and it took the documented two-cause
cure.** The first attempt refused on `docs/pr-prompts/.arming-log.txt` — the *modified-tracked*
blocker, not the untracked-breadcrumb one. The discriminator ran first:
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` was **EMPTY**, so the working
copy was not a strict superset of `main` and restoring to HEAD could not delete anyone's arm line.
Restored byte-exact with node (`git show HEAD:<path>` → `writeFileSync`, never
`git checkout -- <path>`): local 21913 B → HEAD blob 21750 B → written 21750 B. `--renormalize` was
**not** needed — `git diff --numstat` and `git diff --cached --name-status` were both already EMPTY
after the restore, which is the 2026-09-05 measurement's own discriminator. The fast-forward then
ran clean and restored the file to 21913 B. All three read-backs:

```
git rev-list --left-right --count HEAD...origin/main  ->  0	0
git diff --numstat                                    ->  EMPTY
git diff --cached --name-status                       ->  EMPTY
```

**2. `#2016` armed `crmvis-s6` but never committed the deletion of the prompt it consumed, and the
dev tree was carrying that deletion uncommitted.** `git diff --numstat origin/main -- docs/pr-prompts/pr-crmvis-s6-bulk-link-HOLD.md`
read `0 117` — deleted on disk, still tracked on `main`. It was **restored from HEAD**, not
committed as a deletion, because `#2017` is **OPEN and not merged**: QUEUE-LAYOUT enters `merged/`
only on a confirmed MERGED state, and nothing is deleted, only moved. The duplicate-arm hazard this
re-creates is the one `triage-holds.ps1` is built to catch, and it caught it in the same run (3 of 3
+ marker, above). The tree is now clean on every tracked path:
`git status --porcelain` minus `??` → **EMPTY**.

**3. A disposable worktree** at `C:\po-wt\00-board-20260921` off `origin/main`, branch
`docs/board-2026-09-21-0004`, carrying this breadcrumb. Written inside the PR worktree — cure 1 —
so no untracked copy is ever left in the dev tree to block the next fast-forward.

**Nothing else.** No arm, no merge, no label touched, no watcher restart, no `/sot/` edit.

## FINDINGS

### F-1 — A 76.9-hour all-stations outage, with the machine and the watcher up throughout

Every scheduled station stopped for three days and one hour. The Windows host has been up since
`2026-09-15T13:32:45Z`, and the watcher's own supervisor restarted its node at `2026-09-20T21:14:06Z`
with no station present — so the box, the network and the pipeline daemon were all healthy while the
Claude desktop app's scheduled-task runner fired nothing. This is the same class as the 17.8-hour
hole of 2026-09-02, four times longer, and the detector that would have caught it is itself a
scheduled station.

Nothing was lost on the board: the queue was empty, the watcher was idle-correct, `#2017` sat where
Marco left it, and the trunk is green. The cost is **coverage**, and 03's four missed occurrences
are where it lands (F-4).

Only Marco can answer why the app was down or keep it up. **DISPOSITION: ESCALATED** — filed as
`docs/pr-prompts/needs-marco/scheduled-task-runner-stopped-for-77h-while-the-box-stayed-up-2026-09-21.md`.
The question put to him there is: does he want an out-of-band detector (RULE 1 complete-and-additive:
something that is *not itself a scheduled Claude task*, e.g. a Windows Scheduled Task that writes a
heartbeat file the next station reads, or a watcher-side check), or is a manual restart acceptable?
The alternative — another Claude-scheduled watchdog — fails the "future" half of RULE 1 on its face,
because it dies in exactly the outage it exists to detect.

### F-2 — Nothing on this board is armable by Station 00, and that is structural, not a dry queue

27 held prompts, 2 ADMIT, both un-armable for reasons no future run will resolve by waiting:
`crmvis-s6` is `#2017`'s own prompt, and `queue-layout-sot-entry` is Station 05's lane. So the board
cannot move at all until Marco removes the `do-not-merge` label on `#2017` or 05 executes its
dispatch. Arming anything else means releasing a gate, which is not mine.

**DISPOSITION: ACTIONED** — measured, confirmed on the marker rather than the head branch, and
recorded. Nothing armed. I did not reach for a `still-gated` prompt to keep the board busy.

### F-3 — The dispatch to Station 05 has survived zero occurrences, not an unread one

The 2026-09-17T19:08Z run dispatched `pr-queue-layout-sot-entry-HOLD.md` to Station 05 (its F-2).
05's occurrences since that dispatch were 09-18, 09-19 and 09-20 — **all inside the outage, none
fired** — and 05's catch-up run is executing **right now**, in session `1714148a`, started the same
second as this one. So the correct reading is *not* "a dispatch went unread", which is what the bare
`SILENT` line invites; it is that the dispatch has not yet had an occurrence to be read in.

**DISPOSITION: DISPATCHED → Station 05**, restated unchanged. The prompt is complete, its gate
(`QUEUE_LAYOUT_V1` on `main` via `#1999`) is released, and its `done_when` is executable. If 05's
next run also leaves it in HOLD, the finding changes character and becomes an escalation about the
dispatch channel rather than about the prompt.

### F-4 — Station 03's two worktree defects are unchanged, and 03 has missed four occurrences

`restart-watcher-if-wedged.ps1` says the watcher is fine, but the sweep still reports both items the
09-17 run dispatched to 03, byte-for-byte:

- `C:/PR-Master/worktrees/po-vg` @ `23c91ba9` on `fix/no-rebase-while-checks-run`, **dirty=1**, age
  24013 min — it **holds uncommitted work**, so `git worktree remove` will refuse and `--force`
  would discard it. This is the worktree named in the open escalation
  `po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.
- registry escapee `C:\po-worktrees\po-fix-2005`, 0 KB, age 4827 min, no `.lock`.

Neither is mine to touch — machines, locks and worktrees are 03's, and the station doc's
`git status --short` in each before suggesting deletion is 03's step, not a supervisor's.

**DISPOSITION: DISPATCHED → Station 03**, and re-dispatched rather than escalated because 03's
next occurrence is `2026-09-21T23:00:45Z` and it now has an unbroken schedule again. The reason the
09-17 dispatch was not actioned is F-1, not 03.

### F-5 — `#2017` is parked on Marco, and its two reds are the same red

CP-26 returns `[LABEL_PRESENT]`, so the PR cannot go green while the label is on and there is
nothing here for an agent to fix or re-run. Three consecutive collect runs have historically listed
PRs in this state among "the reds"; this one does not. The board has no other work.

**DISPOSITION: ESCALATED** — it already sits where escalation puts it: the label is Marco's and only
Marco removes it. No new file is filed, because a fifth near-duplicate of
`label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` would be noise. This
breadcrumb is the record that `#2017` was waiting on him as of `875e1076`.

### F-6 — `#2016` armed a prompt and left its consumed `-HOLD.md` deletion uncommitted

The arming PR published the arming log and archived four breadcrumbs, but the `git mv` half of the
arm never reached `main`, so `origin/main` still carries a `-HOLD.md` for work that is an open PR —
§10.6's duplicate-arm hazard, for any reader of `main` or of a fresh clone rather than of this dev
tree.

**DISPOSITION: ACTIONED, with the retirement deliberately DEFERRED to the merge.** The disk copy was
restored so the tree is clean and the next fast-forward is unblocked; the prompt is **not** being
deleted or moved while `#2017` is open, because `merged/` is entered only on a confirmed MERGED
state and a closed-unmerged `#2017` (which has precedent on this board — `#2005`) would need the
prompt back. **The run that sees `#2017` merge owns moving it to `docs/pr-prompts/merged/`.** That is
named here so it is a hand-over and not a hope.

## WHAT I DID NOT DO

- **Did not arm anything.** Both ADMIT candidates are un-armable (F-2). I did not arm a `still-gated`
  prompt, and I did not release a gate to create an arming candidate — releasing a gate is not in
  this station's authority.
- **Did not touch `#2017`**: no label removal, no re-run of its two failing checks, no auto-merge.
  `[LABEL_PRESENT]` is not a failure to retry.
- **Did not restart the watcher.** The sanctioned verdict is `OK`; a restart on a healthy idle
  watcher is the 2026-07-13 incident.
- **Did not touch either worktree** (`po-vg` holds uncommitted work; both are 03's).
- **Did not commit the `pr-crmvis-s6-bulk-link-HOLD.md` deletion** — see F-6.
- **Did not re-commit the four archived breadcrumbs** at their root paths. They are tracked under
  `archive/` and were asked of the tracked set, not of the dev tree.
- **Did not edit `/sot/`**, and did not execute `pr-queue-layout-sot-entry` myself even though its
  content is settled and its `done_when` is one grep. It is 05's, and doing another station's work
  is LL-38.
- **Did not touch Azure, Entra or SharePoint**, and wrote no production data.
- **Did not run `git` through the VM mount.** The guard was installed first and its last line is
  quoted in GROUND.
- **Left alone:** the 109 `no-pr-opened/`, 55 `failed/`, 141 `blocked/` and 59 `needs-marco/` files
  beyond the one new escalation; the `rev-2016` quarantine in `failed/`; the `Claude Design` and
  `docs/pr-reviews/*` untracked files in the dev tree; and the backlog register's three
  Marco-gated items.

### Concurrency note

Stations 04 and 05 fired at the **same second** as this run (`2026-09-21T00:04:02Z`, sessions
`1b702ce3` and `1714148a`) as part of the post-outage catch-up. The sweep's section 3 read
`SAFE TO ACT` and `index.lock` was re-checked as absent immediately before the fast-forward; every
commit in this run is made in an isolated worktree with its own index, and `git diff --cached
--name-status` in the dev tree was verified EMPTY before and after. If a later run finds this PR
carrying a file it did not author, that is where to look.
