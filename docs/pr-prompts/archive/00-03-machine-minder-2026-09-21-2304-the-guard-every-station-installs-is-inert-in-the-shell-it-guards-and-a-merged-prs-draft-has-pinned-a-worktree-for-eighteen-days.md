# Station 03 — Machine Minder | 2026-09-21T23:04Z–2026-09-21T23:14Z

## GROUND

```
UTC            2026-09-21T23:04:15Z
origin/main    cfe8816d              (fetched, then rev-parse)
dev tree       main @ 4e0d4087       C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only-gated.

SIGHTED RUN. Desktop Commander reached the host on the first call after the
`ToolSearch` load: `powershell.exe -NoProfile -Command "…"` → `HOSTPROBE … 2026-09-22 09:03`
(host-local Brisbane). This was **not** a blind run and nothing below is a GitHub-side
substitute for a tree read.

Preflight read-freshness: all three binding documents were read from the dev tree after
confirming they are byte-identical to `origin/main`.
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/03-machine-minder.md`
→ **EMPTY** (the real answer, §9.1). Blob ids at `origin/main`: DOCTRINE `27223f6f`,
STATION-CAPABILITIES `06977321`, this station doc `f9a4cb61`. Run in the DEV TREE, never the
watcher clone.

Git-guard installer, quoted verbatim as the contract requires, pass or fail:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

It reported PASS. **It is not in force** — see F1.

## WHAT I MEASURED

**Session mount inventory.** `ls -1 /sessions/<id>/mnt/` → **3** entries:
`ProjectOperations2`, `outputs`, `uploads`. [MEASURED] The watcher clone and
`C:\po-watcher\verdicts-archive` were **not** mounted this session, so every clone-side and
archive-side reading below came through Desktop Commander, which is not restricted by the
Cowork mapping (STATION-CAPABILITIES §3).

**Sweep.** `scripts\pipeline\status-sweep.ps1` captured with `*>` to
`C:\po-sup-fix-scripts\sweep-03-20260921T2304.txt` (158,068 B, `FF FE` — the UTF-16LE trap,
§9.3) and decoded `utf16le` in node. 944 lines, all ten sections present. Section 0 instrument
controls: `gh CAN reach GitHub (saw merged PR #2066)` and `node runs` — **no `[BROKEN]`**.
Section 7 verdict: `SAFE TO ACT`.

**Watcher liveness — re-measured after the sweep, because `[LIVE]` means "true when
measured".** [MEASURED] `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on
a `*pr-watcher*` command line → **pid 9744, CreationDate 2026-09-20T21:14:06Z** (uptime ≈25.8 h).
Auto-restart wrapper alive (1). Heartbeat age 34 min against `armed: 0` — idle, **not** wedged
(§9.5: the heartbeat only ticks mid-run).

**No restart is required, and this is the measurement that decides it.** The clone is **6
behind, 0 ahead** of `origin/main` (`git rev-list --count a31e86d5..cfe8816d` → 6; reverse → 0;
clone HEAD `a31e86d5`, taken from the clone, compared in the dev tree whose `origin/main` was
freshly fetched — §9.5's per-tree-remote trap). Of those six commits, those touching
`scripts/pr-watcher/**` → **0**. POSITIVE control, same range restricted to `docs/` → **6**;
NEGATIVE control, a path that cannot exist → **0**. The running watcher is therefore executing
current code and the FIX-LANE restart rule does not fire.

**Board.** 3 open PRs — `#2065` CLEAN green, `#2061` BLOCKED 13 pass/2 fail, `#2059` CLEAN
green. `main` CI on `cfe8816d`: 4 success / 0 failed — trunk green. Queue: `armed: 0`,
`needs-marco/ 61`, `no-pr-opened/ 109`, `failed/ 59`, `blocked/ 150`.

**Locks and concurrency.** `index.lock` ABSENT in both trees; `Get-Process git` → **0**; no PR
touched on GitHub in the last two minutes. Checked *after* F1's probe ran a real `git` against
the mount, specifically to prove that probe left nothing behind.

**Clone dirty — the sweep's own §9.5 defect recurred, and it cost nothing because it is already
documented.** [MEASURED] in the same minute, both forms against
`C:\po-watcher\ProjectOperations`: the sweep's form `git status --short` → **5**, printed as
`dirty=5  <-- NOT clean-on-main; the watcher may refuse to start`; the form
`start-watcher.ps1` actually uses, `git status --porcelain --untracked-files=no` → **1**, and
that one file is `M docs/data-model/metadata-catalog.json`, which a prior 00 run explicitly
LEFT ALONE. The four extras are `?? docs/pr-reviews/pr-2059-review.md`, `pr-2061-review.md`,
`pr-2065-review.md` and `?? scripts/pr-watcher/.conflict-notified-prs.json` — review verdicts
the `rev-<N>` job writes into the clone **by design**, one for each of the three open PRs. This
is DOCTRINE §9.5's clone-dirty bullet reproducing exactly; it is recorded here as a recurrence
datum, not re-diagnosed.

**Stashes.** Clone **77** (the launcher's closed loop, §9.5 — growing as designed, nothing pops).
Dev tree **1**.

**Lane classification, with controls (§10.1 step 1, prompt logs only, `rev-*` excluded).**
Corpus `docs/pr-prompts/processed/pr-*.log` = **940** logs, newest written inside the hour
(`pr-scopecards-s5-…-ready.md.log`), so the corpus is the live one and not the clone's
seventeen-day-stale decoy. `#2040` → **1** hit carrying
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/App.tsx"}` ⇒
**watcher-opened**. `#2051` → **1** hit (POSITIVE control) carrying a real verdict. `#2052` →
**0** hits ⇒ **second lane**, hand-classified. NEGATIVE control `PR #999995` → **0**.

**Verdict homes for the two new `failed/` entries — all three homes, with controls.**
[MEASURED] via node `readdirSync` over `C:/ProjectOperations2/docs/pr-reviews` (161 files),
`C:/po-watcher/ProjectOperations/docs/pr-reviews` (150) and `C:/po-watcher/verdicts-archive`
(788): `pr-2040-review.md` present in **verdicts-archive only**; `pr-2052-review.md` present in
**none of the three**. POSITIVE control `pr-2051-review.md` → found in the dev tree and in
verdicts-archive. NEGATIVE control `pr-999997-review.md` → 0 in all three.

**Both PRs merged regardless.** `gh pr view … --json number,state,title,mergedAt,headRefName`
with `-R` on every call and `$LASTEXITCODE` tested (§9.4): `#2040` MERGED 2026-09-21T10:19:28Z,
`#2052` MERGED 2026-09-21T15:19:59Z. Two fields requested, never `number` alone (§9.4's
fabricated-row trap).

**Stale state summary.** Sweep §4C names `queue-watch-state.md (08-31 20:26Z)` as the
"freshest station summary" — **21 days old** — and quotes eleven lines of it as `[FILE]`. PR
`#2059` ("4C refuses to quote a state summary older than 3 days") is open and green on the
board and is exactly this. No separate finding is raised.

## WHAT CHANGED

**Nothing on the machines, nothing on the board, nothing in the queue.** This station is
report-only. No worktree was pruned, no directory removed, no prompt armed or disarmed, no
label touched, no PR merged, no process started or killed, no file moved.

Two writes were made, both outside every one of those categories: the git-guard installer
`scripts/pipeline/vm-git-guard.sh` was run once in the Linux VM as the preflight requires (it
writes only into `/sessions/<id>/.local/bin` and the VM's `~/.bashrc` / `~/.profile`, never
into a mounted folder), and this breadcrumb was written to the dev tree.

This breadcrumb is **untracked** until a board PR commits it — Station 00 should sweep it up.

## FINDINGS

### F1 — The git guard every station installs at the top of its run is INERT in the shell it exists to guard, and it prints three PASSING controls while inert

`GUARD_INERT_IN_NONINTERACTIVE_BASH_V1`

The PREFLIGHT block instructs every station to run `scripts/pipeline/vm-git-guard.sh` first,
and to quote its last line pass or fail. It printed:

```
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Three controls passed, then two persistence controls passed. [MEASURED] 2026-09-21T23:0xZ at
`cfe8816d`, immediately afterwards, in `mcp__workspace__bash` — the transport a station
actually uses, which runs `bash -c` non-interactively and therefore sources neither `.bashrc`
(non-interactive) nor `.profile` (non-login):

| probe | result |
|---|---|
| `which git` | **`/usr/bin/git`** — the real binary, not the shim |
| `PATH` | `/usr/local/lib/node_modules_global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` — **the shim's directory is absent** |
| `git -C /sessions/<id>/mnt/ProjectOperations2 rev-parse --short HEAD` | **`4e0d4087`, exit 0** — the forbidden call SUCCEEDED |
| `ls -l /sessions/<id>/.local/bin/git` | present, 1149 B, executable |

The shim exists and is correct. It is simply never on `PATH` in the shell that matters. The
installer's own controls are the trap: they verify the file, verify `.bashrc` idempotency, and
verify that a **login** shell resolves the shim — and a login shell is not the one any station
gets. So the guard's self-certification is sound about everything except the only question it
is asked.

**This is the premise of open PR `#2065`** ("fix(pipeline): vm-git-guard self-certifies success
while inert in the shell every station gets"), CLEAN and 15/0/0 green on the board right now,
and of merged `#2066` which records a second session reproducing it. **This run is a third
independent reproduction, from a different station and a different session**, and it adds the
one row the earlier two did not have: not merely that the shim is unreachable, but that a real
`git` command against the Windows `.git` **through the device bridge completed at exit 0 and
returned a SHA**. That is the call DOCTRINE §9.2 names as leaving a 0-byte `index.lock` with no
owning Windows process, which never expires and freezes every station.

**It left no lock, and I checked rather than assumed** — `index.lock` absent in both trees and
`Get-Process git` → 0, measured after the probe. A `rev-parse` does not take the index lock and
the call was not cut short. **The exposure is unchanged by that luck**: any station following
the preflight today believes it is protected and is not.

**DISPOSITION: DISPATCHED** → Station 00. `#2065` is the fix, it is open, green and CLEAN, and
merging it is 00's lane, not mine. What is handed over is the third reproduction and the
exit-0-against-the-mount row above, to be attached to `#2065` so the merge is not argued again.

### F2 — A worktree has been pinned live for eighteen days by one untracked file whose own PR merged twenty minutes after that file was last written

`PO_VG_PINNED_BY_A_SUPERSEDED_DRAFT_V1`

The sweep reports `C:/PR-Master/worktrees/po-vg 23c91ba9 [fix/no-rebase-while-checks-run]`,
`dirty=1 files age=25391 min` (≈17.6 days), and marks it
`<-- HOLDS UNCOMMITTED WORK. PRESERVE OR COMMIT BEFORE PRUNING`. That warning is why it has
survived: it is the correct default, and it carries no evidence either way, so every run that
meets it leaves the worktree alone and the age grows by four hours. My own 2026-09-04 breadcrumb
is titled *"one untracked file pins a dead worktree live forever"* — this is that same shape,
eighteen days on.

[MEASURED] at `cfe8816d`, and it settles the question the warning cannot:

| probe | result |
|---|---|
| `git -C …\po-vg status --porcelain` | `?? scripts/pipeline/check-pipeline-heartbeat.mjs` — **one** untracked file, nothing else |
| does that path exist on `origin/main`? | `git cat-file -e origin/main:<path>` → **exit 0, yes** (POSITIVE control on `status-sweep.ps1` → exit 0; NEGATIVE control on a minted path → exit 128, loud) |
| is the worktree copy identical to main's? | `git hash-object <file>` → `9c4587fb`; `git rev-parse origin/main:<path>` → `84ec92d4`. **NOT identical** — no pipe on either side, §9.1 |
| which way does it differ? | `git diff --stat 84ec92d4 9c4587fb` → **2 insertions, 10 deletions** — main's copy is the fuller one |
| worktree copy mtime | **2026-09-04T07:55:32Z**, 6144 B |
| main's copy, last commit to that path | **2026-09-04T21:38:04Z** — 13.7 h LATER |
| the branch on the remote | `git ls-remote --heads origin fix/no-rebase-while-checks-run` → **1** row, `23c91ba9…` |
| its PR | `gh pr list --head … --state all` → **`#1577` MERGED 2026-09-04T08:15:06Z** |
| `merge-base --is-ancestor 23c91ba9 origin/main` | exit **1** (not an ancestor) — expected, every merge here is a squash (§9.2); POSITIVE control, `origin/main` against itself → exit 0 |

So the file pinning this worktree is a **working draft written twenty minutes before its own PR
merged**, and main moved past it thirteen hours later the same day. The work is on `main` via
the squash of `#1577`. There is nothing here to preserve.

**DISPOSITION: DISPATCHED** → Station 00. The worktree is dead and the evidence for saying so is
above; pruning it is a mutation and this station is report-only. Note for whoever executes it:
`git worktree remove` will refuse while the untracked file is present, and `--force` discards
it — given the table above that discard is now a known-safe loss rather than a gamble, but the
complete-and-additive move is to copy `scripts/pipeline/check-pipeline-heartbeat.mjs` out to
`C:\po-sup-fix-scripts\` first and prune second, which costs one command and forecloses the
argument permanently.

### F3 — The registry escapee reads `size=0KB`, which says "empty husk, safe to delete"; it is 6,079 empty directories and it is not a git worktree at all

`ESCAPEE_IS_EMPTY_DIRS_NOT_A_WORKTREE_V1`

The sweep reports
`REGISTRY-ESCAPEE: C:\po-worktrees\po-fix-2005  size=0KB  age=6206min  .lock=False` and
`Station 03 should review and prune if confirmed dead`. The `0KB` is true about bytes and
misleading about everything a reader needs. [MEASURED]:

| probe | result |
|---|---|
| `Get-ChildItem -Recurse -File -Force` | **0 files** |
| `Get-ChildItem -Recurse -Directory -Force` | **6,079 directories** (`apps`, `node_modules`, `packages`, …) |
| POSITIVE control, files under `C:\ProjectOperations2\scripts\pipeline` | **91** — the file probe can return a count |
| `Test-Path …\po-fix-2005\.git` | **False** |
| `git worktree list`, dev tree | `C:/ProjectOperations2` and `C:/PR-Master/worktrees/po-vg` — **po-fix-2005 is not listed** |
| `git worktree list`, clone | the clone alone |

It is the husk of a half-deleted `node_modules` tree: every file removed, every directory left.
Two consequences the `0KB` line hides. First, **no `git worktree` command can ever clear it** —
there is no `.git` file, so it is not a worktree in either registry, and a run dispatched to
"prune the escapee" with `git worktree prune` will report success and change nothing, which is
§9.6's shape. It needs a plain recursive directory removal. Second, 6,079 directory entries is
a real filesystem object that every recursive sweep over `C:\po-worktrees` must walk — the
cost is traversal time, not disk.

**DISPOSITION: DISPATCHED** → Station 00, with the correction attached: the remedy is
`Remove-Item -Recurse`, not `git worktree prune`, and the target is confirmed dead (no `.git`,
no files, in no registry, 4.3 days idle). Separately, the sweep's escapee line reporting a
directory-only tree as `size=0KB` is a `scripts/pipeline/status-sweep.ps1` change and therefore
outside my lane and outside 00's merge lane; it is 00's to decide whether to stage.

### F4 — Two review jobs were filed to `failed/` having exited 0 and reported a verdict written; one verdict is in the archive and one is in no home at all

`REV_JOBS_FILED_FAILED_AT_EXIT_ZERO_V1`

The only two entries added to `docs/pr-prompts/failed/` since my last breadcrumb
(`…-2026-09-21-0021-…`) are `rev-2040-ready.md` (+`.log`) and `rev-2052-ready.md` (+`.log`).
Both logs read `Exit: 0`, and both bodies state the verdict was written —
*"Verdict written: **MERGE** for PR #2052 to `docs/pr-reviews/pr-2052-review.md`"* and
*"Verdict written to `docs/pr-reviews/pr-2040-review.md`"*. Neither `.log` records a failure
reason; the sweep's §4B prints `(no reason captured -- open the file)` for both.

Against the three homes, with controls (counts and controls under WHAT I MEASURED):
`pr-2040-review.md` is in **`C:\po-watcher\verdicts-archive\` only** — the review lane worked
and the archive sweep collected it, so the `failed/` filing is simply wrong about that job.
`pr-2052-review.md` is in **none of the three**.

The lane probe decides what that second miss means, and it is the cheap half of this finding:
`#2040` is **watcher-opened** (1 prompt-log hit carrying a real `marco:true` verdict);
`#2052` is **second lane** (0 hits, POSITIVE and NEGATIVE controls both passing). Under
DOCTRINE §10.3's `REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1`, a missing verdict on a second-lane PR
is a **review nobody commissioned and nothing would have read** — `verdictApproves` has one call
site and it is inside `waitForPolicyMerge`, which never ran for `#2052`. **No gate was bypassed.**
Both PRs merged anyway, `#2040` at 10:19:28Z and `#2052` at 15:19:59Z, each about an hour after
its review finished.

**DISPOSITION: DEFERRED.** Nothing was lost this time and neither PR was delayed, so this does
not earn a dispatch today. **What would make it urgent:** the same signature on an OPEN
*watcher-opened* PR under the `tests-docs` policy. There the missing verdict is the starved
conjunct of `"timeout waiting for green checks + MERGE verdict"`, it is written byte-identically
to a genuine policy routing, and it permanently human-gates a PR that needed no human — the live
defect `needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md` already names. The
cheap standing check is the one run above: establish the lane first, then ask which of the three
homes holds the verdict, and never read `failed/` plus exit 0 as agreement.

## WHAT I DID NOT DO

- **Pruned nothing.** Neither `po-vg` nor `po-fix-2005` was touched, despite both being
  measured dead. Station 03 is report-only by the authority matrix; 00 dispatches the repair.
- **Did not restart the watcher, and this was a decision, not an omission.** The restart rule
  fires on unadopted `scripts/pr-watcher/**` changes; that count is 0 with both controls
  passing. A restart on a healthy 25.8-hour-old node would have cost an idle window for nothing.
- **Did not clear the clone's 77 stashes.** The launcher's preflight stash is a closed loop by
  design (§9.5); the count and its growth are reported, and `git stash drop` — never `pop` —
  is a mutation that is not mine.
- **Did not touch `#2065`.** It is the fix for F1, green and open, and merging it is 00's lane.
  I added a reproduction, not a merge.
- **Did not re-diagnose the sweep's `dirty=5` clone warning or the 21-day-stale §4C state
  summary.** Both are already documented — the first in DOCTRINE §9.5, the second as open green
  PR `#2059` — and re-deriving a recorded defect is the cost this pipeline keeps paying.
- **Did not run `git` through the device bridge deliberately as work.** The one such call was
  F1's falsifying probe against an open PR's premise, read-only, and I verified it left no
  `index.lock` in either tree rather than assuming it.
- **Left `/sot/` alone** (Station 05's, CP-24), **left the board alone** — no arm, no disarm, no
  label, no merge — and **did not go near Azure, Entra or SharePoint**, which is absolute.
