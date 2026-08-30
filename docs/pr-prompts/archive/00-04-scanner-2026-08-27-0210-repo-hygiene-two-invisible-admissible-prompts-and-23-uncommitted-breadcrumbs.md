# Station 04 — Scanner | 2026-08-27T02:09:49Z–2026-08-27T02:16Z

## GROUND

```
UTC            2026-08-27T02:10:21Z
origin/main    47f9c73d            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 549537a4     C:\ProjectOperations2   (BEHIND origin/main)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — run proceeded with normal (read-only-on-board) authority.
Sweep assigned by `node scripts/pipeline/next-sweep.mjs`: **repo-hygiene** (rotation position 3 of 4;
previous run 2026-08-26T22:18:12Z). Not chosen by me.

## WHAT I MEASURED

Every line below is `[MEASURED]` at origin/main `47f9c73d` / dev tree `549537a4` unless tagged
otherwise. All probes ran as `.ps1` files via `-File` through Desktop Commander on the Windows host.

### Instrument calibration performed BEFORE trusting any negative (DOCTRINE §7)

| Instrument | Control run | Result |
|---|---|---|
| `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` | count of all tracked files, plus `-- CLAUDE.md` | 440 files / 1 — **can see tracked files**, so "0 ready-files" is real |
| `git merge-base --is-ancestor` | `origin/main~1` vs `origin/main`, and a known-unmerged tip | rc=**0** and rc=**1** — **can say MERGED and UNMERGED** |
| `lint-prompt.mjs` exit 3 | ran it against a prompt whose filename claims its premise is dead | rc=**3** printed `STALE … The work is ALREADY DONE` — **exit 3 is reachable**, so "0 of 49" is real |
| untracked-breadcrumb diff | asserted two breadcrumbs I expected to BE on main | both `ONMAIN-OK` — the set-difference is not a blind grep |

Three instruments lied to me during this run and are recorded under FINDINGS 6.

### Sweep coverage — every repo-hygiene item the rotation names

| Item | Measurement | Verdict |
|---|---|---|
| Orphaned worktrees + locks | `git worktree list --porcelain` both trees; `.git/worktrees` dirs; `*.lock` recurse | **4 dev-tree worktrees, 1 lock** → F1, F2 |
| Stash growth in the clone | `git stash list` both trees | dev **11**, clone **41** (unchanged vs 41 @ 2026-08-27T00:27Z) → F3 |
| Superseded prompt files in queue root | 158 depth-1 files censused by pattern | **5 suffix-less, 2 of them live** → F4 |
| Tracked `*-ready.md` at depth 1 (THE BOARD TRAP) | `git ls-tree -r` filtered `^docs/pr-prompts/[^/]+-ready\.md$` | **0 — CLEAN**, with control | 
| Branches merged but not deleted | 21 non-main remote heads, each `--is-ancestor origin/main` | **0 merged-but-undeleted — CLEAN**, with control |
| HOLDs on main whose work already shipped | `lint-prompt.mjs` over all 49 `pr-*-HOLD.md` | **0 exit-3 — CLEAN**, with control |

Queue-root census, depth 1, dev tree: **158 files** = 49 `pr-*-HOLD.md` · 1 `pr-*-ready.md` ·
0 `rev-*-ready.md` · 93 `00-*` breadcrumbs · 15 other.
Gitignored subfolders (disk only, no git impact): `processed` **3498** · `superseded` 236 ·
`needs-marco` 228 · `no-pr-opened` 107 · `archive` 105 · `failed` 20 · `paused` 20 · `blocked` 7.

Board context (not my lane, recorded so 00 need not re-measure): **1 open PR — #1347, `BLOCKED`,
`labels=[]`**, "feat(nav): gate folded Pipeline item on tenders.view OR crm.view (any-of)".
One prompt armed at depth 1 — `pr-pipeline-fold-s3-nav-any-permission-ready.md` — and a live
`claude` agent **pid 27880, started 01:56:34Z**, holds the clone worktree
`.claude/worktrees/agent-a8d44b7358d1ec946` on `feat/nav-pipeline-any-permission`. That lane is
healthy and mid-run; nothing in this report should be acted on in a way that disturbs it.

🔴 **`[INFERRED]` from Station 00's 02:08Z artifact, NOT measured by me — but load-bearing, so recorded:**
00 ran concurrently with this sweep and recorded that #1347 carries
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/components/ShellLayout.tsx"}`
⇒ **RULE 2, DO NOT MERGE**, despite `labels=[]`. My own probe read only `mergeStateStatus` and
`labels` and would have shown it as unlabelled. **A label-only read of #1347 says "free to merge" and
is wrong** — the third such PR in twelve hours. Anyone merging on my `labels=[]` line alone would
breach RULE 2; re-run the `processed/*.log` `"marco":true` probe before touching it.

00 also independently found the F5 lock at 02:07:36Z and dispatched it to 03, assessing that it
"fails the next `git mv`/`git add`". That was an inference; **F5 below is the measurement that
confirms it.**

`[CANNOT MEASURE]` — I attempted an independent grep control for the `defaultDashboardId` premise
and my `Select-String -Recurse` call was invalid (no such parameter in PS 5.1). I did **not**
substitute an inference: the exit-3 evidence in F4 comes from `lint-prompt.mjs` itself, not from that
failed grep.

## WHAT CHANGED

Nothing on the board. No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No label
changed. No worktree removed, no branch deleted, no stash dropped, no lock cleared.

Written this run, **all three ON DISK ONLY — the commit FAILED, see F5**:

- this breadcrumb (17,709 bytes, filename all-lowercase, verified against `^[a-z0-9.\-]+$`);
- `docs/pipeline/sweep-rotation.json` — rotation advanced to `last_index=2`,
  `last_run_utc=2026-08-27T02:10:21Z`, `last_station=04-scanner`; `next-sweep.mjs` now correctly
  reports the following sweep as **instruction-drift**;
- scratch `.ps1` under `C:\po-sup-fix-scripts\scan-0827-*.ps1`.

🔴 **`git add` returned exit 128 — `Unable to create '.git/index.lock': File exists`.** So neither
the breadcrumb nor the advanced rotation is committed. Read back per DOCTRINE §1:
`breadcrumb in HEAD tree: 0`, HEAD still `549537a4`. **The rotation advance is therefore uncommitted
state: if anyone checks that file out, the next run repeats repo-hygiene instead of running
instruction-drift.** The 5 pre-existing staged entries from other chats were left exactly as found —
verified identical before and after.

## FINDINGS

### F1 — TWO LINT-CLEAN, ADMISSIBLE PROMPTS ARE TRACKED ON MAIN AND INVISIBLE TO EVERY GLOB (S2)

`pr-permission-role-reconciler.md` and `pr-smoke-share-worker-tokens.md` sit at
`docs/pr-prompts/` depth 1, are **tracked on origin/main**, carry valid front matter with executable
premises, and **lint ADMIT**:

```
pr-permission-role-reconciler.md -> rc=0   ADMIT (size 8)
pr-smoke-share-worker-tokens.md  -> rc=0   ADMIT (size 3)
```

Neither ends in `-HOLD.md` nor `-ready.md`. Every audit, triage and arming path in this pipeline
globs one of those two suffixes — `triage-holds.ps1`, the HOLD lint sweep above, the armed-count
probe, and the watcher itself. **A suffix-less prompt is therefore permanently unseeable: it can
never be armed, never triaged, and never binned.** It is not parked; it is lost. Both have been on
disk since 2026-08-17T04:52:11Z — ten days.

Blast radius: 5 suffix-less `pr-*.md` files at depth 1 in total. The other three are dead by their
own filename (F4) — these two are the live ones.

RULE 1 options for Marco, complete-and-additive first:

- **(A) Rename both to `-HOLD.md` AND add a guard that fails on any suffix-less `pr-*.md` at depth 1.**
  Solves it now (the two become visible and triageable) and forever (no future prompt can go
  invisible). Additive — no prompt content changes, no data touched. **Passes both halves.**
- **(B) Rename both to `-HOLD.md` only.** Fixes today; fails the *future* half — the next
  suffix-less file is invisible again with no signal.
- **(C) Delete both as stale.** Fails the *no-damage* half outright: they lint ADMIT, so this
  discards admissible work on a guess.

**DISPOSITION: ESCALATED** — (A) needs a naming rule Marco owns, and arming is 00's on his
authority. I am read-only on the board and did not rename them.

### F2 — 23 STATION BREADCRUMBS EXIST ONLY ON ONE DISK; THE TRACKED CHANNEL HAS BEEN OPEN 18 HOURS (S2)

93 `00-*` breadcrumbs on disk at depth 1; **70 tracked on origin/main**; **23 missing**. Set-difference
controlled — two breadcrumbs I expected on main were confirmed present.

Every missing one is dated **2026-08-26T08:08Z or later**; every breadcrumb older than that is
committed. So the channel did not degrade — it stopped, cleanly, ~18 hours ago. The 23 span all five
stations: 9 × supervisor, 6 × pr-master, 4 × scanner, 1 × machine-minder, 1 × sot-keeper.

**This breadcrumb makes 24** — my commit of it failed on the F5 lock. That is coincidence, not cause:
these 23 stopped being committed ~18 hours ago and the lock is 11 minutes old. Two independent
faults producing the same symptom is exactly the situation in which fixing the loud one and
declaring victory leaves the quiet one running.

This is the exact failure the REPORT CONTRACT was written to prevent, one layer up: the contract
fixed *"findings written to a gitignored path"*, and these are at the tracked path — but nobody has
committed them. `docs/pr-prompts/00-*.md` is only a durable channel once a board PR carries it, and
none has since 2026-08-26 ~06:00Z. Included in the 23 are my own last two sweeps and 03's
clone-diverged report.

**DISPOSITION: ESCALATED** — the fix is a commit of 23 tracked-path files, which is a board mutation
outside my authority. RULE 1: the complete-and-additive move is **one docs commit carrying all 23
plus a CI check that fails when depth-1 `00-*.md` files exist untracked** (fixes now and prevents
recurrence, adds nothing destructive); committing the 23 alone fixes today but not tomorrow; leaving
them fails both halves and loses them on any fresh clone.

### F3 — FOUR ORPHANED DEV-TREE WORKTREES; TWO HOLD WORK THAT HAS SINCE SHIPPED BY ANOTHER ROUTE (S3)

`git worktree list --porcelain` on `C:\ProjectOperations2` shows four worktrees besides the tree
itself. **None of the four branches exists on origin** (`git ls-remote --heads origin` returned 22
heads; none of these four — instrument controlled, it listed `refs/heads/main` and 21 others). Each
holds exactly **one** commit not on `origin/main`, and each is 40–60 commits behind.

| Worktree | Branch | Commit (three-dot, merge-base) | Behind main | Already on main? |
|---|---|---|---|---|
| `C:/po-worktrees/sot-readme-fetch` | `docs/sot-readme-fetch-plain1` | `sot/README.md` +22/−9 | 49 | **YES — redundant** |
| `C:/po-worktrees/sot-d-register` | `docs/sot-05-d-register` | `sot/05` D1–D55 register | 60 | **YES — redundant** |
| `C:/po-worktrees/sotk-03-ledger` | `docs/sot-03-merged-pr-ledger-2026-08-24` | `sot/03` +837, 1 breadcrumb +62 | 40 | **partly** |
| `C:/po-wt-h` | `hygiene` | retire 3 shipped prompts + EVIDENCE.md | 57 | **partly** |

Decisive content premises rather than a diff (the diff instrument lied — see F6):

```
sot/README.md   on origin/main: contains 'plain=1' = True, 'raw CDN lags' = False, 'web_fetch' = False
sot/05          on origin/main: contains 'D55' = True, 'D1 ' = True
sot/03          on origin/main: contains '#1304' = True; the branch's breadcrumb is tracked on main
pr-sor-s9-register-to-progress-claim-HOLD.md on main: 0   (the file `hygiene` renames FROM is gone)
superseded/cleared-2026-08-20-verified-shipped/ on main: 7 files (branch adds 4)
```

So the two `sot/` fixes were re-done and landed by another route; their worktrees are now pure
overhead holding a stale duplicate commit. The other two overlap main but are not byte-identical and
are 40–57 commits behind, so neither can be judged "safe to drop" from content alone.

Note the second-order cost of the top row: `docs/sot-readme-fetch-plain1` exists because the
"fetch the blob URL, the raw CDN lags" advice was wrong. That fix is now **on main**
(`plain=1` present, `raw CDN lags` absent) — but `STATION-CAPABILITIES.md` §1 records the same stale
advice still living in four Cowork account skills, which no agent can edit. The repo is correct; the
layer above it is not.

**DISPOSITION: DISPATCHED to Station 05 (SoT-keeper).** Three of the four branches are `sot/`-scoped
and `/sot/` is 05's exclusively; the fourth (`hygiene`) is queue-scoped. Handing over: the two
redundant worktrees are removable (`git worktree remove` + `prune`) with no content loss, proven
above; the other two need 05 to decide whether the residue is worth rebasing before removal. I
removed nothing — removing a worktree that holds the only copy of a commit is irreversible, and
DOCTRINE §5.4 puts that behind Marco.

### F4 — THREE DEAD PROMPT FILES ARE TRACKED ON MAIN, ONE PROVEN DEAD BY THE LINTER ITSELF (S3)

```
pr-user-default-dashboard-ui-RETIRED-premise-cannot-die-2026-08-18.md -> rc=3
    STALE  Premise no longer holds … The work is ALREADY DONE. Binned before spawning an agent.
pr-settings-home-slice0-DISARMED-premise-dead-2026-08-18.md          -> rc=1  [NO_FRONT_MATTER]
pr-doctrine-s9-four-false-traps-LOOPING.md                            -> staged in index, not on main
```

The first two are **tracked on origin/main**. The `-RETIRED-` one is not a judgement call: the
pipeline's own linter returns exit 3 on it. The `-DISARMED-` one has no front matter at all, so it
can never be linted, only read by eye. Both encode their death in the filename, which is precisely
the kind of state the pipeline has been moving out of names and into measurable premises.

Also untracked and unignored in the queue root, so they surface as `??` noise forever:
`.queue-sync-ledger.txt.bak-2026-08-18` (10 days old) and `queue-watch-state.md`.
And `pr-rates-consumers-s3-persona-export-b-ready.md.log` — a `.log` in the queue root, ignored by
`.gitignore:26` but sitting where prompts live.

**DISPOSITION: DEFERRED.** Real litter, none of it load-bearing, and no station is currently
mis-reading it — the linter correctly refuses all three. It becomes urgent the moment anything
globs `pr-*.md` without a suffix filter, which is the same defect class as F1; if Marco takes option
(A) on F1 these should be swept in the same commit. I stage no deletion prompt because F1 already
carries the decision and a second prompt would fragment it.

### F5 — 0-BYTE `index.lock` IS BLOCKING INDEX WRITES **RIGHT NOW** — PROVEN, NOT INFERRED (S1)

This started the run as a watch item and became the run's hardest finding, because I stopped
inferring from the lock's metadata and let it fail an operation I actually needed.

**The functional proof.** At 02:17Z, committing my own breadcrumb:

```
git add -- <breadcrumb> docs/pipeline/sweep-rotation.json
  fatal: Unable to create 'C:/ProjectOperations2/.git/index.lock': File exists.
  Another git process seems to be running in this repository, or the lock file may be stale
  add exit=128
```

**The metadata, measured five times, mtime never once advanced:**

```
C:\ProjectOperations2\.git\index.lock   bytes=0   mtimeUTC=2026-08-27T02:07:36Z  (frozen)
  02:11:19Z 3.7 min · 02:14:15Z 6.6 min · 02:15:40Z 8.1 min · 02:17Z 10.5 min · 02:18:35Z 11.0 min
```

At 02:18:35Z, measured from a **process that had run no git of its own** (my own F6 lie 3):
**no `git.exe` running anywhere on the host.** It is the only `.lock` in either tree — the watcher
clone has none. No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` /
`rebase-apply` / `sequencer` / `BISECT_LOG` in the dev tree, checked twice. It predates my first
shell (02:09:49Z), so it is not mine.

Read operations are unaffected — `fetch`, `ls-tree`, `diff`, `rev-parse` all succeeded throughout.
**It gates exactly the index writes the board runs on: `add`, `mv`, `commit`, `checkout`.**
`git mv` is how a prompt is armed. So while this lock stands, **Station 00 cannot arm anything and
cannot commit anything**, and it will discover that only at the moment it tries.

**What I am careful NOT to claim.** DOCTRINE §4's clearance bar is 0-byte **and hours old** **and**
no git process. At 11 minutes it fails the middle test, so I am **not** declaring it stale and I have
**not** cleared it. §9.6 also warns that "no process is holding it" is weak evidence on its own — a
lock left by a destroyed Linux VM has no Windows process by construction, forever. What is beyond
argument is the functional half: **it is blocking index writes now, with no git process and no
in-progress operation to justify it.**

**DISPOSITION: DISPATCHED to Station 03 (Machine-minder), and this one should not wait for the next
4-hour tick.** 03 owns locks and is the only station that may clear one, on 00's dispatch. The exact
handover: **re-measure `bytes` and `mtimeUTC` first.** If it is still 0 bytes with `mtime` still
`2026-08-27T02:07:36Z`, it has crossed the hours bar with the signature of the known
VM-git-over-the-mount lock and is safe to clear. If `mtime` has moved or the file is gone, a live
actor owned it and nothing was wrong — the correct outcome is then to do nothing and say so.

Two consequences to carry: this run's breadcrumb and rotation advance are **uncommitted** because of
it (WHAT CHANGED), and F2's 23 uncommitted breadcrumbs are **not** explained by this lock — those
stopped ~18 hours ago and this lock is 11 minutes old. Same symptom, different cause; do not let the
lock's discovery close F2.

### F6 — THREE OF MY OWN INSTRUMENTS LIED THIS RUN (S3, recorded so the next run does not repeat them)

1. **`git diff --stat origin/main..<branch>` is meaningless for a branch that is behind.**
   For `docs/sot-05-d-register` (60 behind) the two-dot form printed
   `260 files changed, 2878 insertions(+), 26313 deletions(-)` — that is *main's* history reported
   backwards, not the branch's work. The three-dot form printed the truth: `sot/README.md, 1 file
   changed`. Two-dot and three-dot disagreed by two orders of magnitude and **both looked plausible**.
   The tell was that `--name-only` (three-dot) listed 1 file while `--stat` (two-dot) listed 260.
   **Always three-dot when comparing a branch to a moving main.** Not currently in DOCTRINE §9.2.

2. **Grepping a script's source for its exit codes gives a false negative.**
   `[regex]::Matches($lint, "exit\(3\)")` over `lint-prompt.mjs` returned **0 occurrences** — which
   reads exactly like "exit 3 does not exist, so my 0-of-49 result is meaningless." Running the tool
   against a known-stale prompt returned **rc=3** with the STALE banner. The source grep was wrong;
   the live run was right. **Prove an exit code by provoking it, never by grepping for it.**

3. **`Get-Process git` counted my own subprocesses.** In the same script that ran three
   `git fetch` calls I then asked whether any git process was running, and got two PIDs — which
   would read as "a process holds the lock." They were mine. **Measure liveness in a separate
   process from the one doing the work.**

Also re-confirmed live, both already in DOCTRINE §9.1, both hit on the first attempt this run:
`$` is stripped from `-Command` strings (my first ground probe died with
`You must provide a value expression following the '+' operator`), and PS 5.1 `Select-String` has no
`-Recurse` parameter.

**DISPOSITION: DEFERRED.** Lie 1 is worth a DOCTRINE §9.2 line and lies 2–3 a §7 line, but §9.2 and
§9 are canonical blocks gated by `lint-station.mjs` — editing them means re-recording the block hash
and shipping all six station docs together, which is a prompt, not a scanner edit. The immediately
preceding scanner run (2026-08-26T22:18Z) already staged `pr-doctrine-s9-four-false-traps-HOLD.md`
against §9, that prompt looped into two PRs, and one was closed. **Staging a second §9 prompt while
the first is unresolved is how the loop repeats.** It becomes urgent once the §9 prompt settles.

## WHAT I DID NOT DO

- **Removed no worktree, deleted no branch, dropped no stash, cleared no lock.** All are irreversible
  or 03/05-owned. F3 and F5 name the owner and the exact next measurement instead.
- **Renamed nothing in `docs/pr-prompts/`.** F1's fix is a rename, and a rename in that folder is an
  arming operation — 00's, on Marco's authority. Read-only on the board means read-only even when the
  fix is one `git mv`.
- **Staged no fix prompt**, though I am allowed up to two. F1 and F2 need a decision from Marco before
  a prompt can be authored honestly; F4 is subsumed by F1; F6 would collide with the still-unsettled
  §9 prompt from the previous sweep. Staging a prompt whose scope Marco has not chosen would put a
  guess into the queue.
- **Did not touch PR #1347 or the live agent's lane** (pid 27880, clone worktree, mid-run).
- **Did not run Part 0 / Part 1 / Part 2** of the older station brief. The rotation assigned exactly
  one sweep — repo-hygiene — and the AUTHORITY section requires covering that one completely rather
  than a shallow pass over everything.
- **Did not `git checkout` / `reset` / `stash pop` / `clean` anywhere**, and did not run git through
  the device bridge.
- **Did not `git reset` the 5 pre-existing staged entries** in the shared index (another chat's
  breadcrumb, the LOOPING prompt, 3 `R100` renames). Unstaging another chat's work is the LL-38
  collision. I committed with an explicit pathspec instead.
