# Station 00 — Supervisor | 2026-09-06T17:08Z–2026-09-06T18:15Z

## GROUND

```
UTC            2026-09-06T17:08:32Z
origin/main    eef272df            (fetch --prune, then rev-parse)
dev tree       main @ eef272df     C:\ProjectOperations2   (0 ahead / 0 behind)
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (station_doc_version declared by the scheduled task)
```

Doc version and bootstrap AGREE — this run was not read-only.
SIGHTED. Desktop Commander reached the box on the first call: `Get-Date -Format o` →
`2026-09-07T03:08:32.9492931+10:00`.

Device-bridge git guard, PREFLIGHT step 1, last line quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(and `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths, allows
everything else (both controls passed)`). PASS.

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` exit 10, §7 **SAFE TO ACT**: no board mutation in progress, no
  remote activity in the last 2 min, no live station worktrees. Captured to a file, not read from
  the early return.
- [MEASURED] Board, 3 open: **#1713** CLEAN, CI 15/0/0 green · **#1709** CLEAN, CI 15/0/0 green ·
  **#1699** BLOCKED, CI 13 pass / **2 fail**. `main` CI on `eef272df`: 4 success / 0 failed.
- [MEASURED] Queue: `armed (*-ready.md)` = **0**. needs-marco 29 · no-pr-opened 109 · failed 41 ·
  blocked 123.
- [MEASURED] `check-breadcrumb.mjs --freshness` exit 0, CLEAN. 00 1.0h · 03 18.2h · 04 3.0h ·
  05 3.0h, all `ok`. ⚠️ Its `CADENCE` map still carries `'00': 2` against a live cron of `5 * * * *`,
  so `ok` for 00 is the weak reading STATION-CAPABILITIES §6 already records — open with Marco.
- [MEASURED] `restart-watcher-if-wedged.ps1` (no `-Fix`): `VERDICT: OK — nothing armed and the
  watcher is alive`; node pid **27236**, restart churn **0 cycles in 20 min** (threshold 4).
- [MEASURED] Watcher family, by command line and parent chain:
  `24952 watcher-launcher-singlelane.ps1` → `28392 start-watcher.ps1` → `27236 node index.mjs`
  (`StartTime 11:49:57Z`). **Plus four more `watcher-launcher-singlelane.ps1` (35328, 23740, 25664,
  34940) and two orphaned `supervise-watcher.ps1` (28632, 23680 — both parents GONE).** Seven
  processes in the family; the sweep's `auto-restart wrapper: alive (7)` is that count, and it is
  not a health reading.
- [MEASURED] `C:\po-watcher\watcher-launch.log`: mtime **2026-09-06T05:27:31Z**, last line
  `Watcher exited with code 1 (raw node exit: -1)`; `opened PR #` POSITIVE control **167**, newest
  such line `02:01:30Z` (`opened PR #1685`).
- [MEASURED] `watcher-launcher-singlelane.ps1` line 27:
  `Start-Transcript -Path "C:\po-watcher\watcher-launch.log" -Append -Force`. The file is a
  PowerShell **transcript of the launcher process**, not the watcher's output.
- [MEASURED] `C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\2026-09-06.log`: mtime
  **17:15:01Z** (three minutes old at measurement), **121,518** bytes, `opened PR #` → **4** (newest
  `[2026-09-06T10:33:20.879Z] [merge] pr-watcher-verdict-home-resolver-ready.md: opened PR #1707,
  policy=tests-docs, waiting.`), POSITIVE control `[merge]` → **8**, NEGATIVE control
  (fresh needle `zzQq00Needle20260906T1732`) → **0**.
- [MEASURED] `C:\po-watcher\ensure-watcher.log`: mtime **17:05:03Z**, content is only
  `watcher alive, pid(s) 27236` rows every 10 min. `opened PR #` → 0, `[merge]` → 0, `[queue]` → 0,
  NEGATIVE control → 0. Fresh, and carries no lane information at all.
- [MEASURED] The four builds of `pr-watcher-verdict-home-resolver`: armed `09:20:50Z`
  (`.arming-log.txt`, `actor=station-00-scheduled-0908Z`); **#1703** CLOSED `11:04:29Z`, **#1707**
  CLOSED `11:04:33Z` ("Closing as a duplicate. **#1704 is the one being kept**"), **#1708** CLOSED
  `11:04:35Z`, **#1704 MERGED `11:41:36Z`**.
- [MEASURED] The fix is ON MAIN: `git grep -c VERDICT_HOME_RESOLVER origin/main --
  scripts/pr-watcher/index.mjs` → **6**; POSITIVE control `classifyPolicyFiles` → **2**; NEGATIVE
  control → exit 1. `scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs` is tracked on
  `origin/main`. `watchdog-restart-grace.test.mjs` is tracked there too.
- [MEASURED] `lint-prompt.mjs docs/pr-prompts/pr-watcher-verdict-home-resolver-LOOPING.md` →
  **STALE, exit 3**, "Premise no longer holds … The work is ALREADY DONE. Binned before spawning an
  agent." The tracked `-HOLD.md` is absent from `origin/main` — the arm consumed it correctly.
- [MEASURED] Watcher clone `C:\po-watcher\ProjectOperations`: HEAD **`16ddb58b`**, branch `main`,
  **18 commits behind** `origin/main`; `git stash list` = **69**; dirty = 2 untracked review
  verdicts (`pr-1709-review.md`, `pr-1713-review.md`).
- [MEASURED] `.arming-log.txt`: local **60** lines, `git diff --numstat origin/main -- <path>`
  **EMPTY** — the log is published, no gap this run.
- [MEASURED] `lint-station.mjs` → `ADMIT: all 8 docs clean`, exit 0, after re-recording
  `instruments v2` (`4542b0096c931f9e`).
- [MEASURED] Dev tree clean of modifications: `git diff --numstat` EMPTY, `git diff --cached
  --name-status` EMPTY. Untracked only (≈48 `docs/pr-reviews/*.md`, the `-LOOPING.md`, and the
  ledger/state files).
- [INFERRED] The launch-log freeze is transcript contention, not a stalled logger: five launcher
  processes each call `Start-Transcript` on one path, and the file stops at the exact moment its
  owning launcher's node exited. `supervise-watcher.ps1:130` records the same failure shape in its
  own comment ("When the host's transcript stream broke, every `Add-Content` here threw").
- [CANNOT MEASURE] Which launcher process currently owns the (dead) transcript handle. Nothing on
  the box reports transcript ownership, and I will not restart anything to find out — that is 03's.

## WHAT CHANGED

- `docs/pipeline/DOCTRINE.md` — two additions inside the `instruments v2` canonical block, edited in
  node by concatenation with the byte delta asserted on both (§9.3): §9.5 gains the correction that
  `watcher-launch.log` is a launcher transcript and the daily clone log is the watcher's real one
  (+3,722 B, expected 3,722); §9.1 gains the `-Include` wildcard trap (+1,008 B, expected 1,008).
  `git diff --numstat` = `45 0` then `12 0`, no deletions.
- `docs/pipeline/stations/_canonical-blocks.json` — `instruments v2` hash re-recorded via
  `lint-station.mjs --write-canonical`; `1 1`. Read back: `ADMIT: all 8 docs clean`, exit 0.
- This breadcrumb, written **inside this run's PR worktree** (REPORT CONTRACT cure 1), so no loose
  untracked copy is left in the dev tree to block the next fast-forward.
- **Nothing else.** No arm, no merge, no label, no process touched, no queue file renamed.

## FINDINGS

### F1 — `watcher-launch.log` is a LAUNCHER transcript, and reading it as the watcher's log declared a live instrument permanently dead

`#1725` landed the freshness precondition two hours before this run: assert the launch log's mtime
is younger than the PR's `createdAt`, else `[CANNOT MEASURE]`. Correct as far as it goes — but the
file is `Start-Transcript` output from `watcher-launcher-singlelane.ps1:27`, so it dies with the
launcher instance that opened it and can never recover on its own. Applied as written, every future
run reports the `opened PR #<n>` lane discriminator as unmeasurable **forever**, while the watcher's
actual transcript sits three minutes fresh in
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\<yyyy-MM-dd>.log`. `ensure-watcher.log` is
the trap for anyone who reaches for the freshest file instead: fresher than both, and every lane
count zero.

**DISPOSITION: ACTIONED** — the correction, with all three files, their controls and a falsifying
probe, is in this PR's DOCTRINE §9.5. Verified by re-reading the file after the edit: insert present
exactly once, anchor intact exactly once, byte delta equal to the inserted length.

### F2 — The 16:12Z dispatch to Station 03 would have built a FIFTH duplicate of already-merged work. COUNTERMANDED.

The 16:12Z collect read the frozen launch log and recorded that `pr-watcher-verdict-home-resolver`
"was armed, looped, and left NO LOG ANYWHERE", then dispatched 03 to (1) unfreeze the transcript,
(2) fast-forward and restart the clone, and **(3) re-arm the LOOPING prompt**. Step 3 is wrong.
The prompt was armed at `09:20:50Z`, the watchdog kill loop built it four times, it opened
#1703 · #1704 · #1707 · #1708, three closed as duplicates at `11:04Z`, and **#1704 merged at
`11:41:36Z`**. `VERDICT_HOME_RESOLVER_V1` is on `origin/main` (6 hits, with controls) and its test
file is tracked. `lint-prompt.mjs` on the `-LOOPING.md` returns **STALE, exit 3** — so the linter
would bin a re-arm anyway, but 03 would still burn a run reaching that answer.

**Steps (1) and (2) of that dispatch STAND and are re-stated in F3/F4 below. Step (3) is withdrawn:
Station 03 must NOT re-arm `pr-watcher-verdict-home-resolver`.**

**DISPOSITION: ACTIONED** — withdrawn here and recorded in DOCTRINE §9.5 so it survives this
breadcrumb. The `-LOOPING.md` is left on disk untouched: it is untracked, matches no watcher glob,
and the linter refuses it.

### F3 — SEVEN watcher-family processes, and that is the measured cause of the frozen transcript

Five `watcher-launcher-singlelane.ps1` (35328, 24952, 23740, 25664, 34940), two orphaned
`supervise-watcher.ps1` whose parents are GONE (28632, 23680), one `start-watcher.ps1` (28392).
Exactly one node (27236) — the single-instance guard is holding — but every launcher calls
`Start-Transcript` on the same path, and the transcript stopped at the instant its owner's node
exited. Restart churn is currently 0 in 20 min, so this is a latent hazard rather than an outage;
memory records `watchdog-kill churn: 4 kills in 20 min` earlier today, which is what it looks like
when it is not latent.

**DISPOSITION: DISPATCHED — Station 03.** Leave ONE launcher family. Kill the orphans (28632, 23680)
and the surplus launchers **after** reporting what each was (YOUR LIMITS 5), in an idle window, and
confirm afterwards that `watcher-launch.log` resumes — that is the read-back which proves the
contention diagnosis. Do this BEFORE anything is armed.

### F4 — Watcher clone is 18 commits behind main, stash depth 69, two verdicts only it holds

Clone HEAD `16ddb58b` ("00 collect 1008", merged 10:29Z local) against `origin/main` `eef272df` —
18 commits. `git stash list` = **69**, the closed loop DOCTRINE §9.2 names (the launcher preflight
stashes on every start and nothing ever pops). Dirty = `pr-1709-review.md` and `pr-1713-review.md`,
untracked in the clone; `pr-1713-review.md` also exists in the dev tree, `pr-1709-review.md` does
not, so one verdict currently lives in exactly one home. **A restart adopts nothing** (§9.5) — the
watcher runs `index.mjs` from the clone, so until the clone is fast-forwarded it is still running
pre-`#1704` code, i.e. **without** the verdict-home resolver that would have found those two files.

**DISPOSITION: DISPATCHED — Station 03.** Fast-forward the clone off `16ddb58b`; `git stash drop`,
**never `pop`**; preserve the two review verdicts before touching the tree; restart in an idle
window. 03 next fires `2026-09-06T23:00Z`.

### F5 — The board is stopped, and arming is the wrong move while F3 and F4 are open

0 armed, 3 open PRs, and all three carry `apps/api/prisma/migrations/` — `classifyPolicyFiles`
refuses them on its own migration clause and **no station lane covers migrations**, so all three are
Marco's under §10.1. RULE 2 probe on the LIVE tree (`C:\ProjectOperations2\docs\pr-prompts\processed`,
newest log younger than the oldest open PR) is unchanged from the 16:12Z reading and I did not
re-derive it, because I am not merging any of them. Arming now would hand a prompt to a watcher
running 18-commit-old code under seven competing launchers, with no transcript of what it did until
F3 is fixed. The 16:12Z run declined for one of these reasons; there are now three.

**DISPOSITION: DEFERRED** — arming resumes as soon as 03 reports F3 and F4 closed. What would make
it urgent sooner: `main` CI going red, or Marco releasing any of #1699/#1709/#1713.

### F6 — `Get-ChildItem -Recurse -Include` answered "no fresh log on this machine" while one was three minutes old

`Get-ChildItem C:\po-watcher -Recurse -Include '*.log'` returns zero at exit 0 because `-Include`
filters the path argument, which has no wildcard; `C:\po-watcher\* -Recurse -Include '*.log'`
returns the same query's real answer. I ran the broken form first and it printed an empty section,
from which the available conclusion was that no log had been written in two hours — three minutes
after the daily clone log was written. Caught only because the mechanism was already suspect.

**DISPOSITION: ACTIONED** — landed as a §9.1 bullet in this PR, with the measurement and the cure.

### F7 — #1699 is red on `RELEASED_NO_RECEIPT`, and no agent may clear it

Both failing jobs report the same cause; one cause, two reds. The receipt for a released PR may only
be written by Marco — an agent authoring one is the standing prohibition, and a colour change is not
a clearance.

**DISPOSITION: DEFERRED** — already open with Marco as `#1635`; re-raising it would be noise. Not
re-escalated.

## WHAT I DID NOT DO

- **Did not arm anything.** See F5. `armed = 0` is a state nobody is holding on purpose; it is the
  correct state while the machine the watcher runs on is in the condition F3/F4 describe.
- **Did not merge, label, or touch any of #1699 / #1709 / #1713.** All three are Marco's.
- **Did not touch a single process.** Seven watcher-family processes is 03's lane, the watcher is
  not WEDGED (the sanctioned probe says `OK`), and killing a healthy family to tidy a log is exactly
  the false-alarm-licenses-destructive-action shape the station doc records twice.
- **Did not clear the `-LOOPING.md`.** It is untracked, arms nothing, and the linter refuses it.
  Deleting queue files to tidy up is how consumed prompts and their history get lost.
- **Did not archive the 16:12Z breadcrumb.** Its central claim was refuted this run (F2); it stays
  in the queue root next to this one so the correction is visible beside what it corrects. Archive
  both together next cycle.
- **Did not re-run the RULE 2 `marco:true` probe.** I am merging nothing and classifying nothing new;
  running a gate probe I have no use for would only mint another spent needle.
- **Did not fix `check-breadcrumb.mjs`'s `'00': 2` cadence.** One character, but `scripts/` is
  outside 00's recorded merge lane and it is already filed for Marco.
