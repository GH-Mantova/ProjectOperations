# Station 03 — Machine Minder | 2026-08-29T23:01:52Z–2026-08-29T23:10Z

## GROUND

```
UTC            2026-08-29T23:01:52Z
origin/main    0182444e            (fetched, then rev-parse)
dev tree       main @ 0182444e     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE. This run was NOT read-only-locked.

**Not blind.** `start_process` shell `powershell.exe` succeeded on `LAPTOP-E6NHU4E4` at
2026-08-29T23:01:52Z. Desktop Commander present. Every claim below is from the box.

`git diff --stat origin/main -- docs/pipeline scripts/pipeline` returned **empty**, so the working
copy of DOCTRINE, STATION-CAPABILITIES and this station's doc is byte-identical to `origin/main`
and reading it was equivalent to `git show origin/main:<path>`.

## WHAT I MEASURED

### The watcher process — alive, and has been alive the whole time

`[MEASURED]` `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`, filtered on command line
(never by image name, DOCTRINE §9.5) — **exactly 1** watcher node:

```
ProcessId 26364   CreationDate 2026-08-29 00:33:33 (Brisbane) = 2026-08-28T14:33:33Z
cmd  "C:\Program Files\nodejs\node.exe" --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```

`[MEASURED]` Re-measured at 2026-08-29T23:05:18Z (the `[LIVE]`-expires rule): still 1, still 26364.

`[MEASURED]` `C:\po-watcher\ensure-watcher.log` ticks every 10 minutes without a gap, most recent
`2026-08-29T22:55:03Z  watcher alive, pid(s) 26364`. The restarter is present and working.

`[MEASURED]` Heartbeat age at sweep time: **1850 min** = last tick ≈ **2026-08-28T16:11Z**.
`[MEASURED]` armed `*-ready.md` at `docs/pr-prompts` **top level only**: **0**.
`[MEASURED]` `git index.lock` in dev tree: absent. In watcher clone: absent. Git processes: 0.
No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer`
in the clone. Registered worktrees: 1 in each tree, its own. Disk C: 195.2 GB free.
`[MEASURED]` `STOP-WATCHER` absent; `STOP-WATCHER-LANE2` present — **by design since 2026-08-15**
(DOCTRINE §9.5), not drift.

**So the process-level picture is green.** The defect is one layer up, and a process check cannot
see it.

### Why nothing has run for 31 hours

`[MEASURED]` `C:\Users\Marco\.claude\.credentials.json`, `claudeAiOauth.expiresAt` = `1787933615984`:

```
expiresAt_utc    2026-08-28T16:13:35.984Z
now_utc          2026-08-29T23:04:48.559Z
EXPIRED          True
subscriptionType max
file mtime       2026-08-29 02:13:26 (Brisbane) = 2026-08-28T16:13:26Z
```

No secret value was read or printed — only the expiry field.

`[MEASURED]` The last four watcher runs all died on the same line, quoted from
`docs/pr-prompts/failed/*.log`:

> `Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.`

| quarantined prompt | log mtime (Brisbane) | UTC |
|---|---|---|
| `rev-1384-ready.md` | 2026-08-29 02:20:56 | 2026-08-28T16:20:56Z |
| `rev-1385-ready.md` | 2026-08-29 06:17:07 | 2026-08-28T20:17:07Z |
| `rev-1386-ready.md` | 2026-08-29 06:52:27 | 2026-08-28T20:52:27Z |
| `pr-crm-s3-account-on-client-create-ready.md` | 2026-08-29 07:03:55 | 2026-08-28T21:03:55Z |

`[MEASURED]` Token expiry **16:13:35Z**; last heartbeat tick **≈16:11Z**; first 401 quarantine
**16:20:56Z**. `[INFERRED]` The heartbeat froze because the token died, not the other way round —
the three timestamps are inside nine minutes of each other and every run after is a 401.

`[MEASURED]` Positive control on the 401 grep: it returns 8 files in `failed/` spanning
2026-06-29 to 2026-08-29, so the query can find non-recent matches and the recent cluster of four
is a real cluster, not the whole population. Same grep over `no-pr-opened/`: 0.

### Watcher clone drift — real, and smaller than it looks

`[MEASURED]` `C:\po-watcher\ProjectOperations`: branch `main`, HEAD `181817aa`, origin/main
`0182444e`, `git rev-list --left-right --count origin/main...HEAD` = **22  0**. Twenty-two behind,
zero ahead.

`[MEASURED]` `git log --oneline HEAD..origin/main -- scripts/pr-watcher/` = **0 commits**.
`[MEASURED]` Positive control, same query over `docs/pipeline/` = **13 commits**, so the query is
not silently empty (DOCTRINE §9.6). All 22 are docs and pipeline-instruction commits.

`[INFERRED]` A restart would therefore adopt **no behaviour change** in `scripts/pr-watcher/**`.
The drift is real bookkeeping debt but it is not what is stopping the queue, and "22 behind, restart
urgently" would have been the wrong headline.

### The clone's dirty tree is a closed loop, and the watcher's own feature drives it

`[MEASURED]` `git status --porcelain` in the clone: **35 entries, all ` D docs/pr-reviews/pr-*-review.md`**
(unstaged deletions).
`[MEASURED]` Positive control: `git ls-tree -r --name-only HEAD -- docs/pr-reviews/` returns **35** —
those exact paths *are* tracked at clone HEAD, so this is genuine deletion, not a phantom.
`[MEASURED]` `C:\po-watcher\watcher-launch.log` at 2026-08-28T14:32Z:
`[review] verdict-archive sweep: archived=35 kept=0 skipped=0`, one `moved pr-NNN-review.md
(state=MERGED) -> C:\po-watcher\verdicts-archive` line per file.
`[MEASURED]` `C:\po-watcher\verdicts-archive` holds **408 files**; the newest 35 are stamped
2026-08-29 00:42:56 Brisbane.
`[MEASURED]` `git stash list` in the clone: **51 entries**. Newest
`watcher-preflight-autostash on 'docs/station-contract-breadcrumb-validator' at 2026-08-29T00:42:55+10:00`;
oldest `stash@{50}: WIP on feat/sharepoint-folder-mappings`.
`[MEASURED]` `start-watcher.ps1:55-96` self-heals a dirty tracked tree by `git stash push`. Nothing
anywhere pops or drops.

`[INFERRED]` The loop: `verdict-archive` **moves tracked files out of the clone without committing**
-> the tree is dirty -> the next preflight stashes it -> `checkout main` restores the files ->
the next archive sweep moves them out again. 51 stashes is the accumulated receipt. DOCTRINE §9.2
already names the stash loop; this run names the **mover**.

### Three launcher wrappers are alive at once

`[MEASURED]` `Get-CimInstance Win32_Process` filtered on command line — **3** copies of
`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\po-watcher\watcher-launcher-singlelane.ps1"`:
PIDs **10364** (2026-08-24 15:35), **23100** (2026-08-27 10:15), **2984** (2026-08-28 15:05).
The sweep's `auto-restart wrapper: alive (3)` is that count, not a health grade.

`[MEASURED]` `watcher-launcher-singlelane.ps1` (42 lines) contains **zero** matches for
`SINGLE-INSTANCE|ADOPT|Mutex|already running`. Positive control: a `'.'` grep on the same file
matched 42 lines, so the grep works. The guard lives one layer down —
`scripts/pr-watcher/start-watcher.ps1:136-140`, `# --- Single-instance guard ---`.

`[INFERRED]` The three wrappers cannot produce three watcher nodes (the inner guard holds, and only
one node is measured). What they *do* produce: three `while` loops each `git fetch --prune`-ing the
clone, three `Start-Transcript -Append` writers on one 1.73 MB `watcher-launch.log`, and three
independent preflight-stash paths feeding the loop above. The 2026-08-29T00:42:56 log line
`ADOPT: a watcher node is already running and no wrapper was supervising it` was written while three
wrappers were alive — so the adopt logic cannot see its siblings.

### Instruments that lied to me this run

`[MEASURED]` DOCTRINE §9.1's `$`-expansion trap fired twice: `'diff-exit=' + $LASTEXITCODE` arrived
as `'diff-exit=' + ` and died as a parser error. Every probe after that went in a `.ps1` run with
`-File`. Confirmed still true on this Desktop Commander build.
`[MEASURED]` `Compare-Object` between the `origin/main` copy of the station doc and the working copy
reported **100 differences** across two 285-line files that `git diff --stat` proves are identical.
Line-ending/sync-window artefact. Not currently in §9 — a candidate for §9.3.

## WHAT CHANGED

One mutation, declared:

- `git fetch origin +refs/heads/main:refs/remotes/origin/main` **inside the watcher clone**, which
  advanced `refs/remotes/origin/main` from `873b3ef6` to `0182444e`. Read back: `git rev-parse
  --short origin/main` = `0182444e`. **No working tree, HEAD, branch, index or stash was touched**;
  the clone is still `main @ 181817aa`. Declared because it is a ref write in a shared tree, even
  though it is the same fetch the launcher does on every loop.
- Six scratch probes written to `C:\po-sup-fix-scripts\st03-probe-{a..g}.ps1` (sanctioned scratch).
- This breadcrumb, written to the dev tree at `C:\ProjectOperations2\docs\pr-prompts\`.

Nothing else. **No repair, no arm, no merge, no label, no board mutation, no restart, no stash
drop, no fast-forward.**

## FINDINGS

### F1 — The Claude Code OAuth token expired 31 hours ago; the queue cannot run at all. THIS IS THE SEVENTH REPORT OF IT.

🔴 **Not a new finding. The reporting channel is working; the fix has not happened.**
`[MEASURED]` Six prior breadcrumbs name this same expiry, and all six are **tracked on
`origin/main`** (`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` filtered on
`oauth|401`), so they reached the repo, not just a disk:

```
00-00-supervisor-2026-08-28-1809-execution-lane-down-on-expired-oauth.md
00-00-supervisor-2026-08-28-2009-oauth-expiry-measured-directly-and-03-ran-without-reporting.md
00-00-supervisor-2026-08-28-2209-oauth-still-dead-and-it-burned-a-real-feature-prompt.md
00-00-supervisor-2026-08-29-0208-oauth-still-dead-and-the-clone-ff-is-not-actually-blocked.md
00-00-supervisor-2026-08-29-1409-blind-but-the-mount-cannot-see-the-oauth-token.md
00-03-machine-minder-2026-08-28-2302-oauth-401-burns-armed-prompts.md
```

`[MEASURED]` Positive control: 152 `00-*` breadcrumbs on disk, 7 match `oauth|401` — the filter is
selective, not matching everything. `[INFERRED]` Station 00 has escalated this every two hours for
31 hours and nothing has changed, which is the definition of "verification exhausted" (DOCTRINE
§5.6): **no further agent-side reporting will move this.** I am filing the seventh not to add
information but so the record is unbroken and the elapsed time is on it. Every hour of this is an
hour the whole pipeline produces nothing.

Expired `2026-08-28T16:13:35Z`, measured expired at `2026-08-29T23:04:48Z`. Four prompts —
`rev-1384`, `rev-1385`, `rev-1386`, `pr-crm-s3-account-on-client-create` — were quarantined to
`failed/` by a 401, not by any defect in the prompts themselves. The watcher process is healthy and
the restarter is ticking, which is exactly why this is dangerous: every process-level probe reads
green while the machine is incapable of doing work. The armed count is currently 0, so nothing is
burning right now — **the moment Station 00 arms anything, it quarantines instantly.**

Re-authentication requires a real human identity at a real keyboard (DOCTRINE §5.3). No agent has
one. This is not something I can work around and not something 00 can dispatch.

**Marco — the question, with options, RULE 1 applied:**

- **(A) Re-authenticate, then re-stage the four burned prompts by copy-with-fresh-letter.**
  Run `claude` (or `claude login`) on `LAPTOP-E6NHU4E4` as your own account and complete the browser
  flow; then Station 00 copies the four quarantined prompts back to `docs/pr-prompts/` with a fresh
  letter suffix (`rev-1384-ready.md` -> `rev-1384b-ready.md`), originals left in `failed/` as the
  paper trail. **Complete and additive: passes both halves.** It restores the capability *and* the
  four prompts' work is recovered rather than silently lost. Recommended.
- **(B) Re-authenticate only, and let the four burned prompts stay quarantined.** Passes the
  "immediate" half; **fails the "future data entry" half** — four real pieces of staged work are
  discarded with no marker saying why, which is the shape of the nine-day `docs/qa/` loss.
- **(C) Add a preflight token-expiry check to `start-watcher.ps1` that refuses to start on an expired
  token.** Passes the "future" half — it converts a silent 401 burn into a loud refusal — but
  **fails the "immediate" half** on its own: it fixes nothing today and, without (A), it stops the
  watcher rather than starting it. Correct as a *follow-up* to (A), not as an alternative.

**DISPOSITION: ESCALATED** — needs Marco at the keyboard. Station 00 cannot dispatch this.

### F2 — `verdict-archive` moves tracked files out of the clone without committing, and the preflight stash loop has reached 51

35 unstaged deletions of `docs/pr-reviews/pr-*-review.md` are permanently present in the watcher
clone because the watcher's own `verdict-archive` sweep moves those tracked files to
`C:\po-watcher\verdicts-archive` (408 files there now). Every start then stashes them; nothing pops
or drops; 51 stashes. This is why `status-sweep.ps1` prints `watcher clone: dirty=35 <-- NOT
clean-on-main; the watcher may refuse to start` on every run — a permanent amber that trains readers
to ignore it.

The complete-and-additive fix is for the archive sweep to **commit the deletions** (or to archive by
copy and `git rm` in the same commit) rather than leave the tree dirty; the stash backlog is then a
one-off trim. I am report-only and did not touch it.

**DISPOSITION: DISPATCHED** to Station 00 — hand to 02 or a `rev-` prompt against
`scripts/pr-watcher/` (the archive sweep) plus a one-off `git stash drop` loop in the clone,
**never `pop`** (DOCTRINE §9.2). Blocked behind F1: no prompt can run until the token is fixed.

### F3 — The watcher clone is 22 commits behind, and none of them change its behaviour

HEAD `181817aa` vs origin/main `0182444e`. `git log HEAD..origin/main -- scripts/pr-watcher/` = 0
(positive control over `docs/pipeline/` = 13). The running node is executing current
`scripts/pr-watcher/**` code. Fast-forwarding is bookkeeping, not an unblock, and it should ride
along with whatever restart follows F1 rather than justify a restart of its own.

**DISPOSITION: DEFERRED** — becomes urgent the moment any commit lands in `scripts/pr-watcher/**`,
at which point a clone fast-forward plus a detached relaunch is required for the change to take
effect at all (DOCTRINE §9.5, "a restart adopts nothing").

### F4 — Three `watcher-launcher-singlelane.ps1` wrappers are alive; the launcher has no guard of its own

PIDs 10364, 23100, 2984, started on three different days. They have not produced duplicate nodes —
the guard at `start-watcher.ps1:136-140` holds and exactly one node is measured — but the launcher
itself has zero instance-guarding, so the count only ever grows, and the 2026-08-29T00:42:56 log line
`ADOPT: ... no wrapper was supervising it` proves the adopt path is blind to its siblings. Three
loops also multiply the preflight-stash rate in F2.

**DISPOSITION: DEFERRED** — no live harm measured, and killing two wrappers is a repair, which is
outside my lane. If Station 00 wants it closed, the additive fix is a named mutex in
`watcher-launcher-singlelane.ps1` so a second copy exits immediately; the two stale wrappers can then
be retired at the next relaunch window rather than killed ad hoc.

### F5 — `Compare-Object` reported 100 differences between two provably identical files

Measured this run against `docs/pipeline/stations/03-machine-minder.md`: `Compare-Object` on two
285-line copies returned 100, while `git diff --stat origin/main -- docs/pipeline` returned empty.
Had I trusted it I would have opened this report with a false "your station doc is not what
`origin/main` says it is." Exactly the §7 shape: a broken instrument handing over a confident,
coherent, wrong verdict about a healthy system.

**DISPOSITION: DISPATCHED** to Station 00 for a one-line addition to DOCTRINE §9.3 —
*"`Compare-Object` on two text files reports phantom differences from line-ending and sync-window
handling; use `git diff` / a byte hash to decide whether two files differ."*

## WHAT I DID NOT DO

- **Did not re-authenticate anything, and did not read or print a token value.** Only
  `expiresAt`, `scopes` and `subscriptionType` were read. Re-auth needs a real human identity
  (DOCTRINE §5.3).
- **Did not restart the watcher, kill the two stale wrappers, fast-forward the clone, drop a stash,
  or clean the 35 deletions.** All four are repairs. Station 03 is report-only; Station 00
  dispatches the repair.
- **Did not re-stage the four 401-burned prompts.** Restaging is an arm, and arming is 00's alone
  (STATION-CAPABILITIES §5). It is also pointless before F1 is fixed — they would 401 again.
- **Did not touch the board, any PR, any label, `/sot/`, production data, or anything
  Azure / Entra / SharePoint.**
- **Did not act on section 5 of the sweep.** It lists 13 `[STALE]` dead escalations in
  `needs-marco/`; clearing them is 00's or 05's call, not mine, and I did not verify them
  independently.
- **Did not run `git` from the device bridge against either `.git`.** Every git call went through
  Desktop Commander PowerShell on the Windows host (DOCTRINE §9.2, the 0-byte `index.lock` trap).

---

**This breadcrumb is UNTRACKED until a board PR commits it. Station 00: sweep it up.**
Stamped `2026-08-29T23:10Z`, true at `origin/main 0182444e`, dev tree `main @ 0182444e`,
watcher clone `main @ 181817aa`.
