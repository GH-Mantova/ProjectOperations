# Station 03 — Machine Minder | 2026-09-22T23:29:44Z–2026-09-22T23:45:10Z

## FOR MARCO

Nothing needs you. The machines are healthy: one watcher, rescanning on time, queue empty by
design, trunk green. No repair was performed — this station is report-only and Station 00
dispatches repairs.

The one thing worth knowing: **the watcher's live log is in a file named `2026-09-21.log`, and
no file named for today exists.** Any station (or you) looking for "today's watcher log" finds
nothing and can conclude the watcher is dead. It is not — that same file was written 30 seconds
before I read it. Detail in F1.

## GROUND

```
UTC            2026-09-22T23:29:44Z
origin/main    2cfd5b23            (fetch first, then rev-parse)
dev tree       main @ f3162a44      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **agree** (both `1`) — full authority run, which for this station is
report-only regardless.

⚠️ **Both HEADs moved during the run, and the ground block above is the START stamp, not the end
one.** [MEASURED] At `2026-09-22T23:40:21Z` a second fetch returned `2cfd5b23..ef0d8d0b main ->
origin/main`, and the dev tree had advanced `f3162a44` → `2cfd5b23` (0 ahead, 1 behind). Another
actor — Station 00 by the merge titles — was working the board throughout. Every finding below is
stamped with the SHA it was true at; §7's `[LIVE]` rule applies to all of them.

**Which tree I read my binding documents in.** The dev tree, `C:\ProjectOperations2`, per
PREFLIGHT's "never the watcher clone" rule. PREFLIGHT also says to read them from
`git show origin/main:<path>` rather than the working copy. I read the working copy, and proved
it equivalent with the sanctioned no-pipe probe rather than asserting it:
`git diff --numstat origin/main -- docs/pipeline/stations/03-machine-minder.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY output**, which §9.1
names as the real answer. The tree was 3 behind `origin/main` at the time and the three documents
were still byte-identical to it.

## WHAT I MEASURED

**Reachability — the step that decides whether this run exists.** [MEASURED] Desktop Commander
tools were loaded via `ToolSearch` FIRST (keyword `desktop-commander`, not a hard-coded id), then
`start_process` shell `powershell.exe` → PID 33600, prompt returned. `Test-Path
C:\ProjectOperations2\docs\pipeline\stations\03-machine-minder.md` → `True`. Host clock
`2026-09-23 09:29:24 +10:00` (Brisbane). **This was a SIGHTED run.** Not blind.

**Device-bridge git guard.** [MEASURED] `bash
"$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`. Last line:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/vigilant-wonderful-gates/.local/bin:$PATH" git <args>
```

**EXIT CODE 2** — the `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE
from your shell.` outcome, which the contract names as the EXPECTED one for a station, not an
anomaly. Its own controls printed in the output: `bash -lc 'command -v git'` → the shim;
`bash -c 'command -v git'` → `/usr/bin/git`. I ran no `git` through the bridge; every `git` below
is PowerShell on the Windows host.

**Sweep.** [MEASURED] `scripts\pipeline\status-sweep.ps1` captured with `*>` and decoded
`utf16le` per §9.3 — the capture opened `FF FE` at 154,410 bytes, confirming the trap rather than
assuming it. 925 lines. **Section 7 verdict: `SAFE TO ACT: no board mutation in progress, no
recent remote activity, no live station worktrees.`** Section 0 positive controls both passed
(`gh CAN reach GitHub`, `node runs`). `SWEEP COMPLETE 2026-09-22 23:30:47Z`.

⚠️ The sweep call returned `timed out after 180s` at the transport. Per §9.1 I treated that as a
claim to falsify rather than a fact: `read_process_output` on PID 33600 returned the pending
buffer and then `MARKER_SWEEP_DONE`. The shell was alive and the script completed. No second
shell was started.

**Locks and board-busy.** [MEASURED] from the sweep, section 3: `git index.lock
interactive/clone: False / False`; `git processes touching our trees (scoped): 0`. No lock exists,
so the byte-size-and-age stale-lock analysis had no subject this run.

**Watcher process — resolved by command line, never by image name (§9.5).** [MEASURED]
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` → **15** node processes. Exactly **one**
is the watcher:

```
pid=9744  start=2026-09-20T21:14:06Z
"C:\Program Files\nodejs\node.exe" --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```

The other 14 are this Cowork session's own MCP servers (`@wonderwhy-er/desktop-commander`,
`@modelcontextprotocol/*`), all started 22:14Z–23:29Z. A count by image name would have reported
15 watchers. Auto-restart wrapper: alive (1), per sweep section 2.

**Freeze probe — the authoritative one, sampled twice more than five minutes apart.** [MEASURED]
`.queue-state.json` `ts`:

| sample | ts | read at |
|---|---|---|
| 1 | `2026-09-22T23:34:13.195Z` | 23:39:01Z |
| 2 | `2026-09-22T23:39:13.319Z` | 23:40:05Z |

Delta **5 min 00.124 s** against `RESCAN_INTERVAL_MS` of 5 min. **The rescan loop is advancing on
cadence — not frozen, and not paused.** Corroborated independently by the live log tail, six
consecutive ticks at 23:14:12, 23:19:12, 23:24:13, 23:29:13, 23:34:13, 23:39:13. Full state:
`armed=0, owned=0, runnable=0, lanes=2, deferred=[], conflictedPrs=[1960]`.

⚠️ **My first probe for that file looked in the wrong place and returned a confident false
absence** — see F6. `docs/pr-prompts/.queue-state.json` → `False` in BOTH trees. The real path is
`scripts/pr-watcher/.queue-state.json`, confirmed at source (`index.mjs`, anchor
`const QUEUE_STATE_FILE = path.join(__dirname, ".queue-state.json")`).

**Heartbeat.** [MEASURED] sweep section 2: `heartbeat age: 117 min`. It ticks only mid-run, and
`armed=0`, so stale + empty queue = **idle, not wedged** — exactly the reading DOCTRINE §9.5
prescribes, and the freeze probe above is what actually settles it.

**Watcher clone.** [MEASURED] in `C:\po-watcher\ProjectOperations`, read-only git only:
`HEAD=a31e86d5`, branch `main`, `git rev-list --left-right --count HEAD...origin/main` → `0 37`
(**0 ahead, 37 behind**). `git status --porcelain` → exactly four lines, **all untracked**:

```
?? .codex/
?? AGENTS.md
?? docs/pr-reviews/pr-2100-review.md
?? scripts/pr-watcher/.conflict-notified-prs.json
```

Zero tracked modifications, zero deletions. `git stash list` → **77**.

**Does the clone's staleness matter?** [MEASURED] `git diff --name-only HEAD origin/main --
scripts/pr-watcher` → **0 files**. See F2 — this is the measurement that decides it, and it
points the opposite way from the "37 behind" count alone.

**Do the untracked files block a fast-forward?** [MEASURED] `git cat-file -e origin/main:<path>`
for each of the four → **False, False, False, False**. None exists on `origin/main`, so none is a
path a fast-forward must create. See F3.

**STOP sentinels.** [MEASURED] `C:\po-watcher\STOP-WATCHER-LANE2` → **True**, 1090 bytes, mtime
`2026-08-18T04:44Z` — present BY DESIGN since 2026-08-15, matching §9.5 exactly; not drift and not
a stop signal. `C:\po-watcher\STOP-WATCHER` → **False**. Freshly minted NEGATIVE control
`C:\po-watcher\zzQq03Needle20260923` → **False**. I checked the parent `C:\po-watcher` path that
§9.5 names as load-bearing, not the two git repos where the probe returns a false zero.

**Worktrees.** [MEASURED] `git worktree list`:

```
C:/ProjectOperations2  2cfd5b23  [main]
C:/po-wt/rets7         0abde556  [board/retire-scopecards-s7-hold]
```

One non-main worktree, `dirty=0`, age ~124 min at sweep time. See F4.

**Board.** [MEASURED] from the sweep, section 1: **3 open PRs** — #2102, #2101, #2100 — all
`CLEAN`, each `CI: 10 pass / 0 fail / 0 pending (green)`. `main CI on 2cfd5b23: 4 success /
0 failed / 0 running (trunk green)`. Eight most recent merges all Station 00 board PRs.

**Queue census.** [MEASURED] sweep section 4: `armed (*-ready.md): 0` · `needs-marco/: 61` ·
`no-pr-opened/: 111` · `failed/: 59` · `blocked/: 150`. Armed prompts were globbed at **top level
only**, per this station's brief.

**Arming log — the only clock that dates an arm.** [MEASURED]
`docs/pr-prompts/.arming-log.txt`, 144 lines. Last two rows:

```
2026-09-22T17:25:14Z  ARMED     pr-scopecards-s7-one-cutting-total  escalates=true  actor=station-00.sched
2026-09-22T17:26:49Z  DISARMED  pr-scopecards-s7-one-cutting-total  reason=prose-human-gate-'Arming is Marco''s'-missed-at-arm-time
```

Consistent with `armed=0`: the last arm was disarmed 95 seconds later and the HOLD restored
byte-exact. Nothing is armed and nothing is waiting to run.

**failed/ triage — NEW entries only.** [MEASURED] `failed/` holds 59 files. Newest four:
`rev-2052-ready.md.log` (2026-09-21T14:37Z), `rev-2052-ready.md` (14:30Z),
`rev-2040-ready.md.log` (09:08Z), `rev-2040-ready.md` (09:06Z). My previous breadcrumb is
`00-03-machine-minder-2026-09-21-2304-*`, i.e. **later than every entry in the folder**. Rather
than trust mtime alone — the mount can lie about moves — I checked its body on `origin/main`:
`PREV_MENTIONS[rev-2052]=1`, `PREV_MENTIONS[rev-2040]=1`; POSITIVE control `machine-minder` → 1,
freshly minted NEGATIVE control `zzQq03Needle20260923T2340` → 0. **Both newest entries were
already triaged last run. There are NO NEW failures to triage this run**, and nothing is
limit-parked awaiting a reset.

`rev-*` entries are auto-generated REVIEW JOBS, not prompts, and carry no front matter by design
(§9.5) — they are excluded from prompt audits rather than reported as malformed.

**Disk.** [MEASURED] `C:` free **180.3 GB** / used 772 GB. Not a constraint.

## WHAT CHANGED

**Nothing on the machines, the board or the queue.** This station is report-only: no repair, no
arm, no merge, no label, no prune, no restart, no file moved or deleted. Every `git` command run
against either tree was a read (`rev-parse`, `rev-list`, `diff`, `status`, `stash list`,
`cat-file -e`, `worktree list`, `ls-tree`, `show`, `merge-base`), plus `git fetch origin
+refs/heads/main:refs/remotes/origin/main` in the dev tree, which PREFLIGHT mandates and which
writes only the remote-tracking ref.

Two files were written, both outside the repo except the last: the sweep capture and a copy of the
watcher log, into this session's disposable `outputs` folder; and **this breadcrumb**, into the
dev tree at `docs/pr-prompts/`.

⚠️ **This breadcrumb is UNTRACKED until a board PR commits it.** Station 00 collects. It is
deliberately not in the session's `outputs` folder, which is disposable and reaches nobody, and
not in any of the five gitignored sinks.

## FINDINGS

### F1 — The watcher writes today's output into a file named for the day it launched, and no file named for today exists. The cure DOCTRINE §9.5 prescribes reads that as a dead watcher.

[MEASURED] at `origin/main` `2cfd5b23`. `start-watcher.ps1` (anchor: `$LogFile = Join-Path
$LogDir`) computes the name **once, at launch**:

```powershell
$LogFile = Join-Path $LogDir ("{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
```

and every subsequent write is `Add-Content -Path $LogFile` against that frozen value. The watcher
launched `2026-09-20T21:14:06Z` = **2026-09-21 Brisbane**, so two days of output have gone into
one file:

| probe | result |
|---|---|
| `logs\2026-09-21.log` mtime / size | **2026-09-22T23:39:13Z**, 197,425 bytes — 30 s old when read |
| `logs\2026-09-22.log` exists (today UTC) | **False** |
| `logs\2026-09-23.log` exists (today Brisbane) | **False** |

Tail of that live file, proving it is the current transcript and not an archive:

```
[2026-09-22T23:34:13.195Z] [review] verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=147
[2026-09-22T23:39:13.319Z] [review] verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=147
```

**Why this is a defect and not a curiosity.** DOCTRINE §9.5's 2026-09-06T17:5xZ correction exists
precisely to stop a station reading a frozen `watcher-launch.log` as a dead watcher, and its cure
names the replacement as `…\pr-watcher\logs\<yyyy-MM-dd>.log`. A station that follows that cure
literally on any day after launch day asks for a file that **does not exist**, gets no error and
no content, and the available conclusion is *"the watcher has written nothing today."* That is
§9.6 — an empty result read as an empty world — sitting inside the cure written for a previous
instance of the same shape. Nothing warns, and the longer the watcher stays up the wronger the
reading gets. This run's watcher has been up 50 hours.

⚠️ **Falsifying probe:** read `LastWriteTimeUtc` of the newest `*.log` under the clone's
`scripts\pr-watcher\logs\` and compare it against the date in its own filename. If they ever
match while the watcher has been up across a midnight, this finding is wrong and must be
re-measured.

**DISPOSITION: DISPATCHED** — to Station 00. Two separable pieces, RULE 1 order (complete-and-
additive first): **(a)** roll the log name per write — recompute the date inside the write helper
(anchor: the `Add-Content -Path $LogFile` in `start-watcher.ps1`) so each day gets its own file;
this solves it immediately and for the future and cannot damage existing data, since existing logs
are append-only files nothing rewrites. **(b)** doc-only: amend §9.5's cure to say the newest file
in that directory, not the file named for today. (b) alone fails the "future" half of RULE 1 — it
leaves the mechanism in place and relies on every future reader remembering the caveat. I did not
implement either: report-only.

### F2 — The watcher clone is 37 commits behind main, and NO restart is needed. The count alone invites exactly the wrong dispatch.

[MEASURED] `C:\po-watcher\ProjectOperations` at `HEAD=a31e86d5`: `git rev-list --left-right
--count HEAD...origin/main` → `0 37`. The watcher runs `index.mjs` **from this clone**, and
DOCTRINE §9.5 says a restart adopts nothing until the clone is fast-forwarded, while this
station's own brief says a restart is *required* after any `scripts/pr-watcher/**` change merges.
Read together with "37 behind", the available conclusion is *"the running watcher is executing
37 commits of stale code — fast-forward and restart it."*

It is wrong. `git diff --name-only HEAD origin/main -- scripts/pr-watcher` → **0 files**. Not one
byte of watcher code changed across those 37 commits; they are board PRs, breadcrumbs and pipeline
docs. The node at pid 9744 is running watcher code byte-identical to `origin/main`'s.

**A restart is the intervention with real cost here** — it is the operation that killed the
overnight queue in LL-38's neighbourhood and it can land mid-build — so a dispatch avoided on
measurement is the finding.

**DISPOSITION: DEFERRED** — real, not now. The clone should be fast-forwarded as routine hygiene,
but nothing depends on it today and the restart that would normally accompany it is unnecessary.
**What would make it urgent:** the next commit that touches `scripts/pr-watcher/**` on `main`. At
that moment the diff above stops returning 0, the running watcher genuinely is stale, and clone-ff
plus a detached relaunch becomes a real dispatch. Re-run that one-line diff before acting on the
behind-count, in either direction.

### F3 — The sweep's `watcher clone: dirty=4 <-- NOT clean-on-main; the watcher may refuse to start` is four UNTRACKED files, none of which blocks a fast-forward.

[MEASURED] `git status --porcelain` in the clone returns four lines, **every one prefixed `??`**:
`.codex/`, `AGENTS.md`, `docs/pr-reviews/pr-2100-review.md`,
`scripts/pr-watcher/.conflict-notified-prs.json`. Zero tracked modifications, zero deletions.

The risk a reader infers from "dirty" is the documented fast-forward blocker: an untracked file
sitting at a path `merge --ff-only` must create. I tested that directly rather than inferring it —
`git cat-file -e origin/main:<path>` for all four → **False** on all four. None exists on `main`,
so none can block. Two of the four are the watcher's and the review lane's own runtime artifacts
(`.conflict-notified-prs.json`, `pr-2100-review.md`) and one pair is a different tool's
(`.codex/`, `AGENTS.md`).

The sweep line is true as a count and misleading as a risk: it reports a number and attaches a
consequence ("may refuse to start") that does not follow from these four files.

**DISPOSITION: DISPATCHED** — to Station 00, low priority, doc/sweep wording. Have section 2
separate **tracked-dirty** (real: blocks ff, may block a start) from **untracked-dirty** (usually
benign), and where it reports untracked files, test them against `origin/main` — that is the
single `cat-file -e` above and it converts a standing yellow flag into a real answer. Complete-
and-additive, changes no behaviour, and removes a warning that has been trained into background
noise. I did not change the sweep: report-only, and `scripts/pipeline/` is not this station's lane.

### F4 — An orphaned worktree holds work that already shipped, and the ancestor test says the opposite.

[MEASURED] `git worktree list` → `C:/po-wt/rets7 0abde556 [board/retire-scopecards-s7-hold]`,
`dirty=0`, age ~124 min at sweep. The sweep classifies it `orphaned worktree (aborted run leftover
-- investigate/prune)`.

The obvious safety question is whether it holds unmerged work. `git merge-base --is-ancestor
0abde556 origin/main` → **exit 1**, i.e. *not* an ancestor — which reads as "unmerged, do not
prune". That reading is wrong, and §9.2 says why: every merge in this repo is a **squash**, so the
branch tip is never an ancestor of `main`. Asking the remote instead: `gh pr list --state merged
--search "head:board/retire-scopecards-s7-hold"` →

```
PR #2103  head=board/retire-scopecards-s7-hold  mergedAt=2026-09-22T21:49:02Z
docs(pr-prompts): retire the scopecards S7 HOLD - it shipped as #2093
```

**The work merged 95 minutes before the sweep saw the worktree.** The tree is clean, its PR is
merged, nothing is at risk, and it is safe to prune. This is a leftover from a completed Station
00 run, not an aborted one.

**DISPOSITION: DISPATCHED** — to Station 00, which owns both the worktree and the prune. Evidence
for the decision is above and needs no re-derivation; the prune itself is `git worktree remove` /
`prune` plus the remote head, and this station does not perform repairs.

### F5 — `.queue-state.json` has carried a PR closed seven days ago in `conflictedPrs`, and nothing garbage-collects it.

[MEASURED] live state: `conflictedPrs: [1960]`. `gh pr view 1960` → **state=CLOSED**, `mergedAt`
empty, `closedAt 2026-09-16T03:39:47Z`, head `feat/ratescol-s2-column-settings-move-delete`. The
clone's `scripts/pr-watcher/.conflict-notified-prs.json` still holds the matching record:
`{"1960": {"sha":"c196e10…","notifiedAt":"2026-09-16T03:09:25.203Z","consecutiveDirtyCount":2}}`.

The watcher notified the conflict at 03:09:25Z; the PR was closed unmerged 30 minutes later at
03:39:47Z; both state files have carried it for **seven days**. Neither file prunes entries whose
PR has left the board. `.queue-state.json` is the file DOCTRINE names as the authoritative freeze
probe, so stations read it — and a reader taking `conflictedPrs` at face value concludes there is
a conflicted PR needing attention when the board's three open PRs are all `CLEAN` and green.

Low severity today: nothing gates on the list, and it is one stale entry.

**DISPOSITION: DEFERRED** — real, not now. **What would make it urgent:** the list growing past a
handful, or any code beginning to gate on `conflictedPrs` (a merge guard, a sweep escalation, a
watchdog). Either turns monotonic stale state into a false block. The complete-and-additive fix
when it comes is to drop an entry once its PR's state is not `OPEN`, in the same pass that writes
the file — additive, and it cannot damage live data because a reopened PR is re-detected on the
next dirty check.

### F6 — DOCTRINE names `.queue-state.json` as the authoritative freeze probe but never says where it lives, and the natural guess returns a confident false absence.

[MEASURED] this run, first-hand. §9.5 prescribes *"the `ts` field inside `.queue-state.json`"* and
§9.5's surrounding text discusses it alongside the queue, so I probed
`docs/pr-prompts/.queue-state.json` — in **both** trees:

```
QS_EXISTS=False    (C:\po-watcher\ProjectOperations\docs\pr-prompts\.queue-state.json)
QS2_EXISTS=False   (C:\ProjectOperations2\docs\pr-prompts\.queue-state.json)
```

Two `False`s, no error, exit 0. The available conclusion is *"the watcher writes no queue state"*,
which retires the pipeline's only authoritative freeze probe on a path typo — and a run that then
falls back to heartbeat age alone reads `117 min` and has nothing to separate idle from wedged.

The real path is `C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json`, confirmed
at source rather than by search luck: `index.mjs`, anchor `const QUEUE_STATE_FILE =
path.join(__dirname, ".queue-state.json")` — i.e. **beside the script**, not beside the queue.
POSITIVE control that the file is live: mtime `2026-09-22T23:34:13Z`, 167 bytes, and the two
samples in WHAT I MEASURED.

This is §9.6's own shape inside a §9.5 cure, and it is cheap to close: the bullet needs the path,
not a new instrument.

**DISPOSITION: DISPATCHED** — to Station 00. One-line doc change: state the path
`scripts/pr-watcher/.queue-state.json` (or the `QUEUE_STATE_FILE` anchor) where §9.5 names the
freeze probe. `/sot/` is untouched and this is `docs/pipeline/`, so it is not this station's lane
to edit.

### F7 — The device-bridge git guard installed INERT, as the contract predicts.

[MEASURED] exit **2**, `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE
from your shell.` Quoted in full under WHAT I MEASURED with its own controls. The station contract
names exit 2 as the EXPECTED outcome for a station, because the shell a station is given is
non-interactive and non-login and sources neither `~/.bashrc` nor `~/.profile`.

Recorded so the report shows the guard ran and what it returned — an install nobody can see in the
report is indistinguishable from one that never ran, which is the stated reason the earlier
bullets failed to stop recurrences. **The consequence stands: the device-bridge git ban is
REMEMBERED, not mechanical.** I ran no `git` through the bridge this run.

**DISPOSITION: DEFERRED** — expected behaviour, not a defect to fix here, and already the subject
of standing instruction. **What would make it urgent:** an exit of 0 (meaning the shell changed
shape and the protection is now mechanical — worth knowing) or a non-zero exit other than 2
(meaning the shim was not written at all).

## WHAT I DID NOT DO

- **No repair, and that is the lane, not a limitation.** F1–F6 each name a fix and none was
  applied. This station is REPORT-ONLY; Station 00 dispatches repairs. Specifically: I did not
  fast-forward the watcher clone, did not restart the watcher, did not prune `C:/po-wt/rets7`,
  did not delete the remote head `board/retire-scopecards-s7-hold`, did not touch
  `.conflict-notified-prs.json`, did not edit `start-watcher.ps1` or `status-sweep.ps1`, and did
  not drop any of the 77 stashes.
- **I did not `git stash drop` anything**, though §9.5 records the clone's stash list as a closed
  loop and it now stands at **77**. Dropping is a deletion; this station does not delete, and the
  growth is recorded here for 00 rather than acted on. It is not currently costing anything but
  disk.
- **Azure / Entra / SharePoint: not touched, not read, not probed.** Absolute hard stop, and
  nothing this run came near it.
- **No production data read or written.**
- **Nothing armed, merged, labelled or moved.** `armed=0` was observed, not caused. No
  `do-not-merge` label was added or removed.
- **I did not triage the 58 older `failed/` entries.** The brief says triage NEW entries only, and
  the check in WHAT I MEASURED shows the two newest were already dispositioned last run. Re-
  triaging the backlog would manufacture duplicate findings against closed work.
- **I did not act on the sweep's section 5 `[FILE]` lines.** They are explicitly unverified, the
  sweep's own closing line says to report only from `[LIVE]`, and `needs-marco/` staleness is not
  this station's lane.
- **I did not open a PR for this breadcrumb.** Station 03 has no create-PR authority. The
  breadcrumb sits untracked in the dev tree for Station 00 to sweep up, and this section says so
  rather than leaving 00 to discover it.
- **I did not re-verify the three binding documents against a second transport.** The `--numstat`
  EMPTY reading against `origin/main` is the sanctioned probe and it was run; I did not
  additionally hash them, because §9.1 forbids comparing a piped hash against anything but another
  piped hash and the numstat answer is the real one.

<run-summary>Sighted run: the watcher is healthy — one node, rescan advancing exactly 5 minutes between samples, queue empty and nothing armed, board green, SAFE TO ACT — and six findings are dispatched or deferred, headed by a live watcher log sitting in a file named for the day it launched while no file named for today exists.</run-summary>
