# Station 03 — Machine Minder | 2026-09-23T23:04:06Z–2026-09-23T23:15:11Z

## FOR MARCO

**Nothing needs you. The machines are healthy and this run repaired nothing because nothing was broken.**

One thing worth knowing, and it is a good-news item: **the watcher died at 18:35:05Z last night, 59
seconds after starting a build, and the keepalive task had it running again 4 minutes 51 seconds
later with no work lost.** That is the eighth such death in fourteen days. Each one has self-healed.
The crash class is already on file as
`needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md`, so there is no new question for you
here — I am recording the *rate* (8 in 14 days) because no previous run had measured it, and a rate
is what tells you whether "it recovers" is luck or a working mechanism. On this evidence it is the
mechanism.

No question is being put to you in this run.

## GROUND

```
UTC            2026-09-23T23:04:06Z
origin/main    e3e3a471            (fetched in the dev tree, then rev-parse)
dev tree       main @ e3e3a471      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

**Doc version and bootstrap AGREE (1 = 1).** This run was READ-WRITE-eligible by that test and
read-only by authority: Station 03 is REPORT-ONLY regardless (STATION-CAPABILITIES §5).

**Which tree I read in:** the dev tree `C:\ProjectOperations2`, as PREFLIGHT step 2 requires.
`git rev-list --left-right --count HEAD...origin/main` → `0 0`, and
`git diff --numstat origin/main -- docs/pipeline/stations/03-machine-minder.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** at exit 0 — the
working copy is byte-identical to `origin/main` for all three binding documents, so the working-copy
reads are authoritative and no `git show` dump was needed. I used the `--numstat` form, not a piped
hash (§9.1 forbids the pipe in `powershell.exe`).

**THIS RUN WAS SIGHTED, NOT BLIND.** `start_process` shell `powershell.exe` returned a live
interactive REPL (PID 34928) on the Windows host on the first attempt after the tool schemas were
loaded. Stated explicitly because a blind run and a healthy quiet run both produce "no news", and
this is the healthy-quiet kind.

## WHAT I MEASURED

**Device-bridge git guard — the PREFLIGHT install, quoted as the contract demands.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/relaxed-loving-bohr/.local/bin:$PATH" git <args>
```

**EXIT CODE: 2** — read from the installer itself, not from a pipeline appended to it. That is the
middle outcome the contract names: `vm-git-guard INSTALLED BUT INERT - the shim is correct and
UNREACHABLE from your shell.` Its own controls printed in the output: `bash -lc 'command -v git'` →
the shim; `bash -c 'command -v git'` → `/usr/bin/git`. [MEASURED] So the device-bridge git ban was
REMEMBERED, not mechanical, for this run — and I honoured it: every `git` call in this report ran in
`powershell.exe` on the Windows host, none through the bridge against a mount.

**PREFLIGHT step 4 — the sweep.** `scripts\pipeline\status-sweep.ps1`, captured with `*>` and
decoded as `utf16le` in node. [MEASURED] the capture was **141,640 bytes opening `FF FE`** — §9.3's
`*>` UTF-16LE trap, reproduced exactly, in the cure PREFLIGHT itself prescribes. Decoded: 834 lines,
ten sections. `SWEEP_EXIT=10`. Section 7 verdict, verbatim:

> `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`

**Section 0 instrument positive controls both PASSED** (`gh` reached GitHub, saw merged #2138; node
runs). No `[BROKEN]` anywhere, so the report is usable.

### The watcher chain — resolved by COMMAND LINE, never by image name

[MEASURED] `Get-CimInstance Win32_Process` filtered on command line, not on `Name`:

| PID | PPID | what it is |
|---|---|---|
| 30116 | 14324 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\po-watcher\watcher-launcher-singlelane.ps1"` |
| 33408 | 30116 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1` |
| 38776 | 33408 | `node.exe --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs` |

**All three links present and correctly parented.** [MEASURED] **15 `node.exe` were running
machine-wide** and exactly one is the watcher — DOCTRINE §9.5's "never count or kill by image name",
illustrated rather than merely quoted.

**The launcher is `watcher-launcher-singlelane.ps1`, confirmed at its source anchor.**
`Select-String -Path C:\po-watcher\ensure-watcher.ps1 -Pattern 'Launcher\s*='` →
line 10: `$Launcher  = 'C:\po-watcher\watcher-launcher-singlelane.ps1'`. [MEASURED] The running
process agrees with the anchor. ⚠️ Note for §9.5's citation sweep: the station doc's raw citation
`ensure-watcher.ps1:10` **resolves correctly today** — it is the live one that table predicts.

**Keepalive task.** `Get-ScheduledTask` → `PO Watcher Keepalive`, **STATE=Ready,
LASTRUN=2026-09-24 09:05:01 local, LastTaskResult=0, NEXT=09:15:00 local**. [MEASURED]
`ensure-watcher.log` tail shows unbroken 10-minute pings, `watcher alive, pid(s) 38776`, eight
consecutive, newest `2026-09-23T23:05:03Z`.

### The freeze probe — the only authoritative one, sampled twice as DOCTRINE requires

`<watcher clone>\scripts\pr-watcher\.queue-state.json` — **beside the SCRIPT, not beside the queue**
(the path I measured and 00 landed into §9.5 on 2026-09-22):

| sample | read at | `ts` |
|---|---|---|
| 1 | 2026-09-23T23:06Z | `2026-09-23T23:04:59.502Z` |
| 2 | 2026-09-23T23:11:34Z | `2026-09-23T23:09:59.708Z` |

[MEASURED] **`ts` advanced by 5 min 0.206 s across a 5.5-minute window — exactly one
`RESCAN_INTERVAL_MS`.** The rescan loop is alive and on cadence. Not frozen, and not `pauseQueue`d
(both observables die together under a pause; both are ticking). The live daily log corroborates it
independently: `[review] verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=171` at
`23:04:59.501Z` and `23:09:59.707Z` — the same two instants, from a different instrument.

Full state, sample 2: `{"ts":"2026-09-23T23:09:59.708Z","lane":null,"lanes":2,"armed":0,"owned":0,`
`"deferred":[],"runnable":0,"conflictedPrs":[1960]}`

### Locks, merge state, board busy-ness

[MEASURED] `index.lock` **absent in BOTH trees** (`Test-Path` → False / False), so there was no size
or age to measure and no stale-lock question to answer. Checked for `MERGE_HEAD`, `REBASE_HEAD`,
`CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` and `sequencer` in both trees — **none present**.
Sweep section 3: 0 git processes touching our trees, 0 machine-wide, no PR touched on GitHub in the
last 2 minutes.

### The queue — globbed at TOP LEVEL ONLY

[MEASURED] `Get-ChildItem docs\pr-prompts -File` (depth 1) matched against the watcher's real
`READY_PATTERN`, read from source on `origin/main`: `const READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i`

- **armed at depth 1: 0** — correct. The board holds three green PRs waiting on merge authority, and
  `.queue-state.json` independently reports `armed: 0`.
- **the same glob RECURSIVELY: 2,693 files.** [MEASURED] The station doc warns "1600+ inert
  retirement files"; the live number is now **2,693**. That figure is STATE — I am recording today's
  measurement, not correcting the doc's, because the doc's phrasing ("1600+") is a floor and remains
  true.

`PROMPT_DIR` is `resolvePromptDir(process.env, REPO_ROOT)` — the watcher's own repo root, which is
why a prompt copy sitting in a worktree arms nothing (F3 below turns on this).

### The daily clone log — name shape FIRST, mtime SECOND, never constructed

[MEASURED] `Get-ChildItem "$logDir\*" -Filter '*.log' | Where-Object { $_.BaseName -match
'^\d{4}-\d{2}-\d{2}$' } | Sort-Object LastWriteTimeUtc -Descending`:

- **48** files match the daily-log name shape; **5** in the same directory do not (the
  `supervisor.log` / `supervisor.rot-*` / `supervisor.crashed-*` family §9.5 names as structural).
- newest: **`2026-09-24.log`**, mtime `2026-09-23T23:04:59Z`, 20,632 bytes.

🔴 **§9.5's naming trap is LIVE right now, and this is the clean demonstration of it:** the live log
is named **`2026-09-24`** (fixed at launch from the Brisbane local date) while the current UTC date
is **2026-09-23** — and [MEASURED] **`2026-09-23.log` does not exist** (`Test-Path` → False). A run
that constructs the name in UTC, which is the clock every station report is written in, gets a
**confident false absence**. The landed cure — filter to the name shape, take the newest by mtime,
never construct — is what returned the right file. This re-confirms my own 2026-09-22 F1, which
Station 00 landed; it is a lead rather than a finding because it needs no disposition and the cure
is already binding.

**Live log health.** 202 lines. Launched `2026-09-24T04:39:56+10:00` = **2026-09-23T18:39:56Z**.
Counts: `[merge]`=2, `opened PR #`=1, `[start]`=8, `[queue]`=8, **`ERROR`=0, `Error`=0**.
NEGATIVE control, freshly minted needle `zzQq03x20260924` → **0**.

### The clone

[MEASURED] `C:\po-watcher\ProjectOperations` on `main` at `02c0e7e5`;
`git rev-list --left-right --count HEAD...origin/main` → **`0 4`** (0 ahead, 4 behind).

🔧 **And the count alone invites the wrong dispatch, so I resolved it:**
`git diff --name-only HEAD origin/main -- scripts/pr-watcher` → **0 files**. All four missing commits
(`e3e3a471`, `d6c086c8`, `1edd7454`, `9676874d`) are `docs/pr-prompts/**` breadcrumbs and one
`-HOLD.md`. **No restart is owed** — "a restart adopts nothing" only bites when the clone is behind
on `scripts/pr-watcher/**`, and it is not. The clone is 4 behind, and that is benign.

**The stash closed loop:** `git stash list` in the clone → **77**. DOCTRINE §9.5 records **71** at
2026-09-10 and correctly marks it as state to re-measure. Growth **+6 in 13 days**. See F2.

**Clone dirty, both forms, same minute** — §9.5's falsifying probe, re-run:

| form | anchor | result |
|---|---|---|
| `git status --short` | `status-sweep.ps1`, `$cdirty = @(git status --short` | **1** — `?? docs/pr-reviews/pr-2127-review.md` |
| `git status --porcelain --untracked-files=no` | `start-watcher.ps1` pre-flight | **0** |

[MEASURED] They still disagree, so the bullet stands. See F5.

### Sentinels

[MEASURED] `C:\po-watcher\STOP-WATCHER-LANE2` **present** (by design since 2026-08-15);
`C:\po-watcher\STOP-WATCHER` **absent**. Both checked at the load-bearing `C:\po-watcher\` path, in
the parent directory outside both git repos — not in either repo, where the pathless form returns
0 and 0 and reads as "the documented mechanism is gone".

### failed/ triage — nothing new since my last run

[MEASURED] `failed/` holds **59** files: **32** `rev-*` (auto-generated REVIEW JOBS, which §9.5 says
to exclude from prompt audits) and **27** `pr-*`. Newest entry by mtime: **`rev-2052-ready.md.log`,
2026-09-21T14:37:18Z.**

**My last breadcrumb is `00-03-machine-minder-2026-09-22-2329-…` (2026-09-22T23:29Z). The newest
`failed/` entry predates it by more than a day.** So there are **ZERO new entries to triage** this
run, and nothing is limit-parked awaiting a reset. One line per triaged file is therefore an empty
list, correctly.

### A closed loop from my own last run

My 2026-09-22 **F6** — *DOCTRINE names `.queue-state.json` as the authoritative freeze probe but
never says where it lives* — **LANDED**. §9.5 now carries the path
(`<watcher clone>/scripts/pr-watcher/.queue-state.json`, "and NOT beside the queue in
`docs/pr-prompts/`") and credits the 2026-09-22T23:3xZ measurement. I used the landed path this run
and it worked first time. Recorded so 00 can close it.

## WHAT CHANGED

**Nothing.** This station is REPORT-ONLY and this run mutated no board state, no queue state, no
labels, no prompts, no worktrees, no processes and no `/sot/`.

The only files this run created are outside the repo except one:

- `C:\po-sup-fix-scripts\sweep-03-20260923.txt`, `sweep-03-decoded.txt`,
  `live-log-copy-03.log`, `prev-log-copy-03.log`, `logcopies03\*` — scratch captures in the
  sanctioned scratch folder. The log copies exist because the live daily log is held open by the
  watcher and `Select-String` against it fails; copying first is §9.5's own prescription.
- **this breadcrumb**, at `docs/pr-prompts/` in the dev tree.

⚠️ **This breadcrumb is UNTRACKED until a board PR commits it.** Station 03 cannot open a PR
(STATION-CAPABILITIES §5: Create a PR ❌, Mutate the board ❌), so the dev tree is my sanctioned home
and **Station 00 must sweep it up.** Saying so is required by the contract, because a station that
believes it reported is indistinguishable from one that did. ⚠️ **And it will block the next
`git merge --ff-only` in the dev tree once a PR lands this exact path on `main`** — that is the known
cost of the dev-tree home for a station that cannot carry its own PR, not a new defect.
`git diff --cached --name-status` was **EMPTY** before I wrote (the dev-tree index is shared between
chats), so I have staged nothing and collided with nobody.

## FINDINGS

### F1 — The watcher died `raw node exit: -1` 59 seconds into a build, the keepalive had it back in 4 m 51 s, and the killed job's work survived. Eighth occurrence in fourteen days.

[MEASURED] from `2026-09-21.log` (the previous instance's log — named for the day *it* launched) and
`2026-09-24.log` (the current one), both copied before reading:

| | [MEASURED] |
|---|---|
| review job enqueued for #2129 | `2026-09-23T18:34:05Z` |
| `[start] rev-2129-ready.md (max-turns=240)` | `2026-09-23T18:34:06Z` |
| last rescan tick of the dying instance | `2026-09-23T18:34:16.454Z` |
| **`Watcher exited with code 1 (raw node exit: -1)`** | **`2026-09-23T18:35:05Z`** (logged local: `2026-09-24T04:35:05.6288019+10:00`) |
| keepalive relaunch — new log opens | `2026-09-23T18:39:56Z` |
| `pr-2129-review.md` written | `2026-09-23T18:42:09Z`, 2,926 B |
| `rev-2129-ready.md.log` filed to `processed/` | `2026-09-23T18:42:31Z` |

**Downtime: 4 minutes 51 seconds. Work lost: none.** I checked all three verdict homes rather than
one: `pr-2129-review.md` is **absent** from both `docs/pr-reviews/` trees and **present** in
`C:\po-watcher\verdicts-archive\` — so the verdict exists and was archived, it did not vanish.
POSITIVE control on the same three-home probe: `pr-2127-review.md` present in the clone and nowhere
else, proving the probe can distinguish homes rather than answering "absent" everywhere.
`rev-2129-ready.md` and its `.log` are both in `processed/`; NEGATIVE control, a minted needle
`rev-8x31q7*` over the same recursive search → **0**; POSITIVE control `rev-2052*` → **2**.

**The rate is the new information.** [MEASURED] `raw node exit` across the **10 newest daily logs**
(09-07 → 09-24), each copied first:

| log | deaths | launcher banners |
|---|---|---|
| 2026-09-24 | 0 | 1 |
| 2026-09-21 | **1** | 2 |
| 2026-09-18 | 0 | **269** |
| 2026-09-16 | **3** | 3 |
| 2026-09-15 | **2** | 3 |
| 2026-09-14 | **1** | 1 |
| 2026-09-13 · 2026-09-11 · 2026-09-07 | 0 | 1 · 4 · 1 |
| 2026-09-10 | **1** | 2 |

**Total: 8 deaths across 14 days**, every one followed by a recovery. (`2026-09-18`'s **269**
launcher banners are the kill-loop episode already on record; I am not re-diagnosing it.)

**Why this is DEFERRED and not ESCALATED.** The crash class is already on file — `raw node exit`
appears in `needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md` (1 of 31 `needs-marco`
files naming the watcher; NEGATIVE control, minted needle → 0 files). Filing a ninth instance of a
known class as a new question would be exactly the "re-diagnose a solved problem from scratch" the
brief forbids. What did not exist before is the **rate with its recovery times**, which is what
distinguishes "it happens to come back" from "the keepalive works". On 8 for 8 it is the mechanism.

**DISPOSITION: DEFERRED** — real, not now; the recovery mechanism is demonstrably working and the
cause is already Marco's, in `watcher-launcher-chain-unversioned-2026-09-04.md`.
**What would make it urgent:** a death whose recovery exceeds one keepalive interval (10 min), OR a
daily log whose launcher-banner count goes above ~5 (the kill-loop signature — 09-18 hit 269), OR any
death where the started job's verdict is absent from **all three** homes. Any of those three is a
different failure from the one measured here and should be escalated, not deferred.

---

### F2 — The clone's stash closed loop is at 77, up from the 71 DOCTRINE records, and still nothing pops.

[MEASURED] `git stash list` in `C:\po-watcher\ProjectOperations` → **77**. §9.5 records **71** at
2026-09-10 and correctly flags it as state. **Growth: +6 in 13 days**, ≈0.46/day, strictly
monotonic by construction — the launcher's pre-flight auto-stashes a tracked-dirty clone on every
start (anchor: `# --- Self-heal: AUTO-STASH a dirty tree instead of exiting 1 ---` in
`start-watcher.ps1`) and nothing ever pops. The 77 entries are that path's receipts.

This is not currently harming anything: the clone reads `--untracked-files=no` clean, the
fast-forward path is unobstructed, and the watcher is running. It is a slow leak with a real floor —
each stash pins the objects it references, so the loop costs disk monotonically and forever.

**DISPOSITION: DEFERRED** — real, not now. **What would make it urgent:** the count crossing ~150
(roughly double today's, ≈5 months at the measured rate), or any `git` operation in the clone
reporting a stash-related failure, or the clone's `.git` growth becoming a disk-space question.
**The safe remedy when it is time is `git stash drop`, never `pop`** (§9.2 — popping a closed-loop
stash reintroduces whatever dirtied the clone). Not mine to run: the clone is a shared tree and
Station 03 is report-only.

---

### F3 — #2138's "both orphan worktrees hold zero unlanded code" is CONFIRMED on re-verification — and the two instruments a run would naturally reach for both read the other way.

DOCTRINE 7.1's re-read rule says re-verify another artifact's central claim before acting on it.
`#2138` merged `2026-09-23T22:37Z`, **50 minutes before this run**, asserting both orphan worktrees
hold zero unlanded code. I re-measured it, and the claim **holds** — but two plausible instruments
contradict it, both in the direction that provokes a needless dispatch:

| instrument | `C:\po-wt\rel06` | `C:\po-wt\s9hex` | reads as |
|---|---|---|---|
| `git rev-list --count origin/main..HEAD` | **1** | **4** | "unlanded commits — do not prune" ❌ |
| `git diff --numstat origin/main HEAD` (two-dot) | **10 rows** | **42 rows** | "unlanded content — do not prune" ❌ |
| `git diff --numstat origin/main...HEAD` (three-dot, branch side only) | 4 rows | 16 rows | what the branch itself changed |
| **the two-dot rows for those branch-side paths** | **absent** | **absent** | **already on `main` — safe to prune** ✅ |

**Mechanism, and it is why both readings are wrong rather than merely noisy.** These branches are
**squash-merged**, so the merge-base never advances and `rev-list --count` keeps counting commits
whose *content* is on `main` — commit identity is not content identity. The two-dot diff then mixes
"ahead" with "behind": `s9hex`'s 42 rows are dominated by `0 N` rows (0 added, N deleted), i.e. files
the worktree **lacks** because `main` moved on — staleness wearing unlanded-work's clothes. Nothing
is empty and nothing warns at exit 0, so §9.6 cannot fire; both commands answered exactly what they
were asked, about a different quantity from the one a prune decision needs.

**The decisive reading.** `s9hex`'s own branch-side work is 16 files of production code — a Prisma
migration `20260923200000_transport_capacity_rig_type/migration.sql`, `schema.prisma`, the estimates
and tendering services, a 252-line spec, two web panels — and **not one of those paths appears in
the two-dot diff**, which means `origin/main` already holds every byte of it (S9 merged earlier the
same day). `rel06`'s single commit is the gate-release breadcrumb that landed as `#2133`; its
06-pr-master breadcrumb shows as a pure rename (`0 0`, `{archive => }`), i.e. identical content that
`main` has since filed into `archive/`. Both worktrees are `tracked_dirty=0`.

**One residual, and it is harmless — I measured that rather than assuming it.** `rel06` holds a
72-line `docs/pr-prompts/pr-devtree-sync-ff-only-guard-HOLD.md` that `origin/main` no longer has,
because that prompt was armed and consumed into `#2135`. Confirmed with both controls:
`git cat-file -e origin/main:<that path>` → **exit 128** (absent), identical to a minted negative
control, against `origin/main:CLAUDE.md` → **exit 0**. It **cannot arm anything**: the watcher's
`READY_PATTERN` is `/^(pr|rev)-.*-ready\.md$/i` so a `-HOLD.md` matches nothing, and `PROMPT_DIR`
resolves to the watcher's own repo root, not a worktree. A stale copy of a consumed prompt in an
orphan worktree is litter, not a live arming risk.

**DISPOSITION: DISPATCHED** — to **Station 00**, which owns both the worktree registry and the
prune; Station 03 is report-only and prunes nothing. Two separable pieces, in RULE 1 order:

1. **Complete-and-additive (do this one):** prune both worktrees —
   `C:\po-wt\rel06` (`ccb7bd84`, `board/release-gates-and-06-handover-2026-09-24`) and
   `C:\po-wt\s9hex` (`f878a0a1`, detached HEAD). **Evidence they are safe, re-measured at
   `e3e3a471`:** every branch-side path is absent from the two-dot diff against `origin/main`, both
   are `tracked_dirty=0`, and the only content `main` lacks is one consumed prompt that matches no
   watcher glob. This solves it immediately (the registry stops showing two orphans every sweep) and
   for the future (nothing regrows), and it damages no data entry — the worktrees hold no unlanded
   work. It does **not** need Marco: no production data, nothing irreversible beyond a worktree
   directory whose content is fully on `main`.
2. **Incomplete alternative, and which half it fails:** leave them and keep re-classifying them each
   sweep. This fails the **future** half of RULE 1 — every subsequent 03 and 00 run re-spends the
   four-instrument measurement above to reach the same verdict, and `#2138` plus this breadcrumb are
   now two runs deep into exactly that. It damages no data, so it passes the second half.

⚠️ **For whoever prunes: do not reach for `rev-list --count` or a two-dot diff to re-confirm
safety.** Both say "unlanded". The sound probe is the three-dot diff crossed against the two-dot
diff, as tabled above.

---

### F4 — `.queue-state.json` still carries #1960 in `conflictedPrs`; the PR has been closed 7.8 days and nothing garbage-collects it. Unchanged from my last run, and the list has not grown.

[MEASURED] per-PR and live, never from a list response (§9.4 — `merged` reads false on every list
entry): `gh pr view 1960 -R GH-Mantova/ProjectOperations --json number,state,closedAt,mergedAt` →
`{"closedAt":"2026-09-16T03:39:47Z","mergedAt":null,"number":1960,"state":"CLOSED"}`, exit 0.
NEGATIVE control on the same probe shape, `gh pr view 999997` → exit **1** with a GraphQL
resolution error, so the probe is not answering yes to every integer (§9.4's `--json number`
fabrication trap avoided by asking for server-supplied fields).

**Closed, never merged, 7 days 19.6 hours ago — and still in the live
`conflictedPrs` list.** This is my own 2026-09-22 F5 recurring at the same single entry. My trigger
then was "the list growing past a handful"; **it has not grown — still exactly `[1960]`** — so the
disposition is unchanged rather than escalated.

**DISPOSITION: DEFERRED** — real, not now; one stale integer in a diagnostic field, harming nothing.
**What would make it urgent:** the list reaching 5+ entries, or any evidence the watcher acts on
`conflictedPrs` rather than merely reporting it (I did not read that code path this run — it is
`[CANNOT MEASURE]` from what I probed, and I am not claiming otherwise).

---

### F5 — The sweep's `watcher clone: dirty=1 <-- the watcher may refuse to start` is one untracked review verdict the review lane creates by design. §9.5's falsifying probe re-run, and the two forms still disagree.

[MEASURED] both forms against the clone **in the same minute**, which is what §9.5 asks for:
`git status --short` → **1**, the single file being `?? docs/pr-reviews/pr-2127-review.md`;
`git status --porcelain --untracked-files=no` → **0**.

The one file is a `rev-<N>` verdict written into the clone **by design**, so this false warning
recurs on every reviewed PR whose verdict has not yet been mirrored. Both conjuncts of the sweep's
sentence remain false: untracked files do not make the clone dirty by `start-watcher.ps1`'s own
reckoning, and a tracked-dirty clone auto-stashes rather than refusing (the 77 stashes of F2 are
that path's receipts). **§9.5's falsifying probe asks whether the two forms ever agree; they do not,
so the bullet stands.**

**DISPOSITION: DEFERRED** — already documented in DOCTRINE §9.5 and already narrowed by `#2129`
("narrow the clone-dirty dispatch"). I am recording the re-run of the falsifying probe, not
re-filing the finding, because the cost of this one is a **mis-routed dispatch to Station 03** and
the correct response to meeting it is to recognise it and not dispatch — which is what I did.
**What would make it urgent:** the two forms ever agreeing (which kills the bullet), or the clone
going tracked-dirty, which is a different and real condition.

---

### F6 — The device-bridge git guard installed INERT (exit 2), which is the expected station outcome, not an anomaly.

Quoted in full under WHAT I MEASURED. Exit **2**, read from the installer and not from a pipeline
appended to it. The shim is byte-correct and off the `PATH` of the non-interactive non-login shell a
station is given, so the ban was remembered rather than mechanical for this run. I honoured it: no
`git` ran through the bridge against a mount.

**DISPOSITION: DEFERRED** — expected behaviour per the contract's own three-outcome table, and
already the subject of merged work (`#2065`). Recorded because the contract requires the exit code
and last line to appear in the report whichever outcome occurred — an install nobody can see in the
report is indistinguishable from one that never ran.
**What would make it urgent:** exit **0** (which would mean the ban became mechanical and the
remembered-discipline warnings can be relaxed), or a non-zero exit other than 2 (the shim was not
written at all).

## WHAT I DID NOT DO

- **Repaired nothing, dispatched the one actionable item.** Station 03 is REPORT-ONLY:
  STATION-CAPABILITIES §5 gives it ❌ on arm, merge, create-PR, edit-`/sot/`, mutate-board, and
  ⚠️ report-only on "repair the machines". The worktree prune in F3 is Station 00's to perform and I
  have handed it the evidence rather than performing it.
- **Did not prune, relaunch, restart, or stop anything.** The watcher is healthy (F1 self-healed 4.5
  hours before this run), so no relaunch was warranted. Had one been, I would have *proposed* it as a
  detached `Invoke-CimMethod -ClassName Win32_Process -MethodName Create` — `Start-Process` alone does
  not escape the job object — and left the execution to 00.
- **Did not open a PR or commit anything.** Hence the breadcrumb is untracked in the dev tree and
  Station 00 must collect it. This is stated under WHAT CHANGED as well, deliberately.
- **Did not clear the stale `conflictedPrs` entry, drop a single stash, or touch
  `docs/pr-reviews/`.** All three are shared state; two are the clone's.
- **Did not run `git` through the device bridge against either Windows `.git`**, and ran no
  `git checkout .` / `reset --hard` / `stash pop` / `git clean` in the dev tree — consumed prompts
  come back armed.
- **Did not touch Azure, Entra or SharePoint**, and did not write production data. Absolute, and not
  reasoned past.
- **Did not triage `failed/`**, because there is nothing new to triage: the newest entry
  (2026-09-21T14:37Z) predates my last breadcrumb (2026-09-22T23:29Z) by over a day. Stated as a
  measurement rather than passed over in silence.
- **Did not re-diagnose the 2026-09-18 kill-loop episode** (269 launcher banners) surfaced by F1's
  rate table. It is on record, it is outside this run's window, and re-deriving it would be the
  re-diagnosis the brief forbids.
- **Did not read the watcher's `conflictedPrs` consumer code**, so whether anything *acts* on that
  list is `[CANNOT MEASURE]` from this run. F4 says so rather than inferring it is inert.
- **Did not invoke another station's skill.** 03 invokes its own and no other (LL-38).

<run-summary>Sighted run: the machines are healthy — full watcher chain, freeze probe advancing on cadence, no locks, keepalive green, armed 0 correct — and the only actionable item is a worktree prune dispatched to Station 00 with the evidence that both orphans hold zero unlanded code.</run-summary>
