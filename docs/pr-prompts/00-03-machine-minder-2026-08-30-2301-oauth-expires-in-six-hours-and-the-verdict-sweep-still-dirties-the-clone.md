# Station 03 — Machine Minder | 2026-08-30T23:01Z–2026-08-30T23:07Z

## GROUND

```
UTC            2026-08-30T23:01Z
origin/main    b19f3db9            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ bce9d65e      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only-gated.

**SIGHTED.** `start_process` shell `powershell.exe` succeeded on the first call:
`hostname` = `LAPTOP-E6NHU4E4`, `whoami` = `laptop-e6nhu4e4\marco`. This was a device task and it
had Desktop Commander. Every `[MEASURED]` line below came off the box, not off GitHub.

Two instrument notes, both live this run:

- **Clock.** `(Get-Date).ToString('u')` returned `2026-08-31 09:01:41Z` — that is **Brisbane local
  with a `Z` glued on**. True UTC start is **2026-08-30T23:01Z**. DOCTRINE §7 lie #1, reproduced in
  my own opening call. Every timestamp in this report is `.ToUniversalTime()`.
- **Blob dumps.** My first `git show origin/main:<path> > file` produced 41006 / 25926 / 72266 bytes
  — roughly double — exactly the PS 5.1 UTF-16LE trap at DOCTRINE §9.3. Re-dumped with node
  (`readFileSync`/`writeFileSync`): 20217 / 12744 / 36681. All three binding docs were then read
  from `origin/main`, and `git diff --stat origin/main -- <the three>` returned **empty**, so the
  working copies are byte-identical to `main` and my earlier working-copy read was safe.

## WHAT I MEASURED

**Sweep.** `scripts\pipeline\status-sweep.ps1` at 23:02:39Z. Section 0 positive controls both
[LIVE] — `gh` reached GitHub (saw merged #1411), `node` runs. Section 7 verdict:
**SAFE TO ACT**. [MEASURED]

**Watcher — alive, and identified by command line, not by image name.** [MEASURED]
```
Get-CimInstance Win32_Process -Filter "Name='node.exe'"
  pid 6388 : "C:\Program Files\nodejs\node.exe" --no-deprecation
             C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```
11 `node.exe` were running; exactly one is the watcher. Wrapper pid 2056 =
`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File
"C:\po-watcher\watcher-launcher-singlelane.ps1"` — the correct single-lane launcher.
**Re-measured at 23:04:44Z immediately before writing: node 6388 and wrapper 2056 both still
present.** [MEASURED]

**Keepalive.** `C:\po-watcher\ensure-watcher.log` ticks every 10 min, last entry
`2026-08-30T22:55:01Z watcher alive, pid(s) 6388`. Windows task `PO Watcher Keepalive` = `Ready`.
All four restarter/launcher scripts present. [MEASURED]

**Locks — none, anywhere.** Scanned `.git\{index.lock, MERGE_HEAD, REBASE_HEAD, CHERRY_PICK_HEAD,
rebase-merge, rebase-apply, sequencer}` across BOTH `C:\ProjectOperations2` and
`C:\po-watcher\ProjectOperations`. Zero present, so the size-and-age cross-check was not needed.
`git processes running: 0` per the sweep. [MEASURED]

**Worktrees.** `git worktree list` returns one line: `C:/ProjectOperations2 bce9d65e [main]`.
Sweep agrees: `orphaned worktrees: none`. [MEASURED]

**Dev tree index is EMPTY.** `git --no-optional-locks diff --cached --name-only` → 0 entries.
The 13 dirty paths are 10 untracked breadcrumb/scratch files, 2 modified JSON state files, and the
one deliberate ` D docs/pr-prompts/pr-crm-s3-account-on-client-create-HOLD.md`. No shared-index
collision this run. [MEASURED]

**Host.** C: 205.4 GB free of 952. RAM 11.7 GB free of 31.6. [MEASURED]

**The `[WARN] found 14 claude.exe` in the watcher log is NOT a leak.** All 15 present now were
created 31/08 07:03–07:04 local except one at 07:29 and one at 09:01 — that last one is this
session. They are Claude-desktop children from this morning's app start, not orphaned watcher runs.
Closing the lead so nobody re-opens it. [MEASURED]

**Armed prompts: 0.** The watcher is idle *by design*, not wedged — heartbeat only ticks mid-run
(DOCTRINE §9.5), the launch log shows its 5-minute verdict sweep running normally through 22:40Z,
and the keepalive confirmed liveness at 22:55Z. [MEASURED] + [INFERRED]

## WHAT CHANGED

**Nothing.** This station is report-only. I mutated no file in either tree, cleared no lock, dropped
no stash, restarted nothing, armed nothing, and touched no PR. The only write this run is this
breadcrumb, in the dev tree at `C:\ProjectOperations2\docs\pr-prompts\`. It is **untracked** until a
board PR commits it — Station 00, please sweep it up.

## FINDINGS

### F1 — The OAuth token expires in 6.2 hours, and its last expiry killed the watcher three times

`C:\Users\Marco\.claude\.credentials.json` (no secret read or printed — field names and the expiry
only): [MEASURED]
```
file mtime UTC  2026-08-30 21:17:21Z     <- Marco re-authed here
expiresAt UTC   2026-08-31 05:17:16Z     <- 15:17 Brisbane today
hours left      6.22                     (as at 23:04Z)
fields          accessToken, expiresAt, rateLimitTier, refreshToken, scopes, subscriptionType
refreshToken present: True
```
An 8-hour token. **A `refreshToken` IS present and the headless path still did not refresh** — on
2026-08-29 three prompts were quarantined to `failed/` with
`API Error: 401 OAuth access token has expired` (`pr-crm-s3-account-on-client-create-ready.md`
07:03, `rev-1386-ready.md` 06:52, per the sweep's §4B). That is the measured proof that expiry
reaches the watcher as a hard failure, not as a silent renewal. [MEASURED]

New this run, and it makes the cost larger than three lost prompts — **the watcher process itself
dies on it.** `ensure-watcher.log`, the 40 minutes before Marco re-authed: [MEASURED]
```
20:45:03Z  watcher alive, pid(s) 26364
20:55:03Z  RELAUNCHED  -> node 43236     (26364 died)
20:58:24Z  RELAUNCHED  -> node 18788     (43236 lived ~3 minutes)
21:15:01Z  watcher alive, pid(s) 18788
21:25:01Z  RELAUNCHED  -> node 6388      (18788 died)
21:25:22Z  VERIFIED node pid 6388 ancestry ... detached=True
[then 21:35, 21:45, 21:55, 22:05, 22:15, 22:25, 22:35, 22:45, 22:55 — all "alive, pid(s) 6388"]
```
Three deaths in 40 minutes ending at 21:25Z; **zero deaths in the 1h40m since**, which begins 8
minutes after the 21:17Z re-auth. For scale, the whole log holds **6** relaunches ever — 08-24,
08-27, 08-28 one apiece, then this cluster of three. [MEASURED] The causal link to the expired
token is [INFERRED] from that timeline, not measured directly: I did not capture a crash stack, and
the keepalive logs deaths without a reason. It is a strong correlation with a known mechanism, and
I am flagging it as correlation.

The next expiry lands at 05:17Z / 15:17 Brisbane — **mid-afternoon on a working day**, not
overnight. Station 00's 02:07Z and 04:07Z runs are inside the token; its 06:07Z run is not.

**Options for Marco, complete-and-additive first (RULE 1):**

- **(a) Make the headless path actually use the refresh token — complete and additive.** The
  `refreshToken` is already sitting in the credentials file; nothing is missing, it simply is not
  being exercised before a run. A pre-run refresh in the launcher (or confirming why the CLI's own
  refresh does not fire under the wrapper's detached, hidden-window context) fixes today's expiry
  and every future one, and destroys no data — it only ever writes a fresher token into a file
  that is rewritten on every re-auth anyway. Passes both halves of RULE 1.
- **(b) Alarm on it — additive, but does not solve it.** Have the keepalive log `hours left` each
  tick and shout under a threshold. Damages nothing, and Marco still has to re-auth by hand at
  15:17 every day. Fails the *immediately-and-future* half.
- **(c) Marco re-auths before 15:17Z today and we look again tomorrow.** Solves nothing and future
  is unaddressed; it is only the stopgap if (a) needs design time. Fails the *future* half.

I cannot implement (a): it is an authentication credential path, which is a hard stop for every
station (DOCTRINE §5.3/§5.4, and CAPABILITIES §8 "authorization grants"). Diagnosis and the option
set is where my lane ends.

**Question for Marco, not a status update:** do you want (a) built as a launcher pre-run refresh, or
is the CLI meant to refresh itself and the real bug is that it cannot under a detached hidden
window? Those are two different fixes and only you know which behaviour you intended.

**DISPOSITION: ESCALATED**

### F2 — The verdict-archive sweep re-deletes 35 tracked files on every start; the stash is the exhaust

The clone reads `dirty=35`, which the sweep annotates *"NOT clean-on-main; the watcher may refuse to
start."* Measured, that warning is **not** what it looks like — all 35 are deletions of tracked
review files, and the watcher started fine: [MEASURED]
```
C:\po-watcher\ProjectOperations> git --no-optional-locks status --porcelain
 D docs/pr-reviews/pr-1007-review.md
 D docs/pr-reviews/pr-1158-review.md
 D docs/pr-reviews/pr-1165-review.md
 ... 35 lines, 35 of 35 matching 'pr-reviews', all " D"
```
The mechanism is in the launch log, in full, at the 20:55Z start: [MEASURED]
```
[20:55:09.188Z] [review] verdict-archive: moved pr-1007-review.md (state=MERGED) -> C:\po-watcher\verdicts-archive
[20:55:09.853Z] ... pr-1158 ... 1165 ... 1339 ... 739 ... 740 ... 741 ... 742 ...
   (continues through the same 35 tracked files, ~0.7 s apart)
```
Closed loop: **start → sweep deletes 35 tracked files → clone dirty=35 → next start's preflight
autostash stashes them → stash +1 → repeat.** [MEASURED] end to end.

Stash census in `C:\po-watcher\ProjectOperations`: [MEASURED]
```
total                 54
since 2026-08-24      19      (Station 03 trimmed on 08-24 — stash-trim-2026-08-24-station03.log)
since 2026-08-30       3
newest                2026-08-31 07:25:04 +1000  "watcher-preflight-autostash"
oldest                2026-07-14 08:44:31 +1000
```
~3/day, and it tracks watcher restarts exactly. Per DOCTRINE §9.2 this is drop-never-pop territory;
I dropped nothing.

**This is not new — it is five days old and mine.** My own breadcrumb
`docs/pr-prompts/archive/00-03-machine-minder-2026-08-25-2301-clone-dirtied-by-verdict-archive.md`
reported it on 08-25. The remedy is now **on `main`**: PR #1410 merged 2026-08-30T22:24:24Z adding
`docs/pr-prompts/pr-watcher-verdict-sweep-skips-tracked-HOLD.md`, and its review verdict was
**MERGE**. [MEASURED via `gh pr view 1410 --json files,mergedAt,state`] It is `-HOLD`, so it is
waiting on an arm — and **only Station 00 may arm** (CAPABILITIES §5).

Handing over: **arm `pr-watcher-verdict-sweep-skips-tracked-HOLD.md`.** Landing it stops the
deletions, which stops the dirt, which stops the stash growth — one fix, all three symptoms. The
54 existing stashes are cosmetic once the source is closed and can be trimmed afterwards by
whoever 00 dispatches, `drop` never `pop`.

*(Instrument note, because it nearly cost me this finding: my first search was
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/ | Select-String -SimpleMatch
'verdict-archive'`, which returned only my old breadcrumb — the prompt is named
`verdict-sweep`, not `verdict-archive`. The control saved it: the same `ls-tree -r` returns **571**
paths, so the instrument was working and the needle was wrong. DOCTRINE §9.6, live.)*

**DISPOSITION: DISPATCHED** — to Station 00, to arm `pr-watcher-verdict-sweep-skips-tracked-HOLD.md`.

### F3 — The clone is 32 commits behind main, and that is currently harmless. Do not restart for it.

[MEASURED]
```
C:\po-watcher\ProjectOperations   HEAD 181817aa   branch main   behind origin/main 32
C:\ProjectOperations2             HEAD bce9d65e   branch main   behind origin/main  1
```
The watcher executes `index.mjs` **from the clone**, so 32 commits of drift is normally the setup
for "the running watcher is not the merged code". I checked instead of assuming: [MEASURED]
```
git log --oneline HEAD..origin/main -- scripts/pr-watcher/     -> 0 commits
git diff --stat HEAD origin/main -- scripts/pr-watcher/        -> empty
```
**Zero of the 32 touch `scripts/pr-watcher/**`.** The running watcher's behaviour is identical to
`main`'s. There is nothing to adopt, so **a restart this run would buy nothing and would cost one
more crash window and one more autostash.** Recording it so the next station does not read
"behind 32" as a restart order.

It becomes urgent the moment any commit lands under `scripts/pr-watcher/**` — at which point the
sequence is fast-forward the clone *first*, then restart (a restart adopts nothing on its own,
DOCTRINE §9.5). The dev tree's 1-commit lag is `#1409`'s app code and is irrelevant to machine
health.

**DISPOSITION: DEFERRED** — re-fires when `git log HEAD..origin/main -- scripts/pr-watcher/`
stops returning 0.

### F4 — `#1409` is merged, so the dev tree's held-back deletion is now free to commit

Station 00's last state file says the ` D docs/pr-prompts/pr-crm-s3-account-on-client-create-HOLD.md`
in the dev tree is *"deliberately NOT committed while #1409 is open."* #1409 **merged at
2026-08-30T22:39Z** [MEASURED, sweep §1] and open PRs are now **0**. The condition that was holding
it has expired. The dev index is empty, so committing it is a clean pathspec commit whenever 00
next opens a board PR. Flagging only because a deliberate hold that outlives its reason is
indistinguishable from an accident by the next reader.

**DISPOSITION: DISPATCHED** — to Station 00, as housekeeping on its next board PR.

## WHAT I DID NOT DO

- **Did not restart the watcher.** It is alive (pid 6388, 1h40m and counting), the clone drift is
  behaviourally empty (F3), and a restart would have cost a fresh autostash. Restarting a healthy
  watcher on the strength of a `behind 32` reading is precisely the DOCTRINE §7 lie #1 shape.
- **Did not clear a lock, drop a stash, or trim `verdicts-archive`.** No lock existed to clear. The
  54 stashes are a symptom whose source is F2; deleting exhaust before closing the source is churn,
  and Station 00 dispatches repairs, not me.
- **Did not arm `pr-watcher-verdict-sweep-skips-tracked-HOLD.md`,** though it is the fix for F2.
  Arming belongs to Station 00 alone (CAPABILITIES §5). Dispatched, not done.
- **Did not commit the dev tree's held ` D`,** or touch its 13 dirty paths, including Station 04's
  untracked 22:10Z breadcrumb sitting beside mine. Both are 00's to sweep.
- **Did not touch `/sot/`, Azure, Entra or SharePoint,** and read no credential value — F1 was
  established from field *names*, a file mtime and one expiry integer.
- **Did not triage `failed/` (41), `no-pr-opened/` (107), `blocked/` (3), or the 14
  `needs-marco/` escalations.** Queue triage is board work; my lane is the machines. I note only
  that the newest three `failed/` entries are the 08-29 OAuth 401s that are F1's evidence, and that
  `[verdict-guard] PR #1409: verdict cites files not in PR — blocking mirror, moving to blocked/`
  fired at 21:52Z — a board finding for whoever owns the board, not a machine defect.
- **Did not re-run the sweep before finishing,** because I mutated nothing that could invalidate it.
  I did re-measure the watcher itself at 23:04:44Z, since that is the one `[LIVE]` fact this report
  leans on.
