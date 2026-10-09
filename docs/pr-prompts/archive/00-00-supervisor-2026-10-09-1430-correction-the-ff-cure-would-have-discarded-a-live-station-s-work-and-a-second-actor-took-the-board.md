# Station 00 — Supervisor | 2026-10-09T14:14:26Z–2026-10-09T14:31Z (CORRECTION to the 1414 breadcrumb)

## GROUND

```
UTC            2026-10-09 14:28:28Z   (this correction; the run's own start was 14:14:26Z)
origin/main    d086529c               (git fetch origin, then git rev-parse origin/main)
dev tree       main @ d086529c         C:\ProjectOperations2
doc version    1                       (station_doc_version, docs/pipeline/stations/00-supervisor.md on origin/main)
bootstrap      1                       (station_doc_version declared by the scheduled-task file)
```

**This file is a CORRECTION, not a second cycle.** The 1414 breadcrumb
(`00-00-supervisor-2026-10-09-1414-trunk-recovered-on-the-next-commit-and-the-board-lease-return-value-is-the-reading-not-lastexitcode.md`,
landed by **#2286**, merged `2026-10-09T14:27:05Z`, merge commit `d086529c`) is correct in
everything it says. It is **incomplete**: the two findings below were measured in the three minutes
*after* it was committed, during the post-merge fast-forward and the pre-mutation re-sweep, and the
first of them is the most consequential thing this run touched. Same cycle, same run, same
findings numbering continued.

🔴 **THIS FILE IS UNTRACKED IN THE DEV TREE AND REACHES NOBODY UNTIL A BOARD PR COMMITS IT.** It is
in the dev tree rather than in its own PR — which is cure 1 and the better home — because **by the
time it was written another actor held the board** (F62). The dev tree is the contract's other
sanctioned home for exactly this reason. ⚠️ **It therefore sits at a tracked path that the next
`git merge --ff-only` will have to create, which is the documented fast-forward blocker.** The next
Station 00 run, or `sweep-breadcrumbs.ps1`, must commit it; until then, a run that finds the dev
tree refusing a fast-forward at this path should commit the file, not restore over it. **That is
F61's whole point, applied to F61's own report.**

## WHAT I MEASURED

**The merge and the fast-forward, read back.** [MEASURED]

```
gh pr view 2286 --json state,mergedAt,mergeCommit
  -> {"state":"MERGED","mergedAt":"2026-10-09T14:27:05Z","mergeCommit":{"oid":"d086529c..."}}
Assert-SmokedOrEscalate -PR 2286 -Actor 'station-00.scheduled'  -> True True
Merge-Pr                -PR 2286 -Actor 'station-00.scheduled'  -> {"State":"MERGED","PR":2286}
git merge --ff-only origin/main   -> Updating 8ae32ead..d086529c  Fast-forward   exit 0
```

`Merge-Pr` returned `MERGED`, not `QUEUED`, so `UPDATE_AT_MERGE_TIME_V1` has nothing to confirm next
run. The actor string passed to both primitives was the same one given to `Enter-BoardLease`, so
neither could refuse me under a generated `pwsh-<pid>` identity, and neither did.

**The RULE 2 / §10.1 classification of #2286, with both controls.** [MEASURED] over
`docs/pr-prompts/processed/*.log`:

```
needle 'PR #2286'      -> 0 hits    (the watcher never opened it; it is mine)
positive control '#2040' -> 2 hits
negative control 'PR #zq7x4419' (minted this run) -> 0 hits
```

Classified **§10.1 step 3, second lane**, then hand-classified against the §5 hard stops: docs-only,
two files, both under `docs/pr-prompts/`, no migration, no production data, no auth, no Azure —
inside Station 00's own recorded `docs/` lane in the `STATION-CAPABILITIES.md` §5 authority matrix,
`labels: []`, `mergeStateStatus: CLEAN`. The CP-26 required check passed. Nothing was merged on the
strength of "not watcher-routed" alone, which `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`
forbids.

**The lease release, read back from the artifact and not from the return value.** [MEASURED]
`Exit-BoardLease -Actor 'station-00.scheduled'` returned **`False`**, and
`.git/po-board-lease.json` is **GONE**. The lease is released. This is the second instance in one
run of F60's lesson — a `pipeline-lib` function's return value is not a status code and not always
a success flag; **the artifact is the reading.** Worktree `C:\po-wt\collect-1414` removed
(`git worktree remove` exit 0, path absent on read-back), branch deleted.

**The pre-mutation re-sweep.** [MEASURED] `status-sweep.ps1` again at `14:28:28Z`, because the
verdict expires the moment it prints and I intended a second mutation. Section 0 controls both
`[LIVE]` (`gh CAN reach GitHub (saw merged PR #2286)`). It is what stopped me — see F62.

⚠️ **A third instrument note, small but it cost me a probe: `status-sweep.ps1` writes through
`Write-Host`, so `$out = & .\scripts\pipeline\status-sweep.ps1 | Out-String` captures almost
nothing and the report streams to the console anyway.** [MEASURED] the assignment form printed the
entire report to the console and left the file I redirected into effectively empty. This is the
mirror image of DOCTRINE §7 standing guard 6 (*"no `Write-Output` inside a PowerShell function
whose return value you capture"*): here the output is deliberately `Write-Host`, which **bypasses
the pipeline by design**, so any attempt to capture, filter or `Select-String` the sweep's output
in-process silently gets nothing. Nothing warns; the variable is simply empty. **Page the console
output, or re-run the sweep with its own redirection — do not try to capture it into a variable.**
Recorded as a note rather than a finding: the sweep is not wrong, and I have no evidence anyone
else has tried this.

## WHAT CHANGED

**Nothing, beyond this file.** No board mutation was made after #2286 merged. No lease was taken for
this correction, no PR was opened, nothing was armed, labelled, archived or retired. This file was
written to the dev tree's queue root, which is a file write at a path no other actor touches — not
a board operation.

## FINDINGS

### F61 — S2 — The contract's post-merge fast-forward cure, applied literally, would have discarded a concurrently-running station's work — and the four readings it calls a PASS over-state what actually blocks a fast-forward

After #2286 merged I ran the contract's post-merge check. [MEASURED] the dev tree held exactly one
**tracked** modification:

```
git status --porcelain --untracked-files=no  ->   M docs/pipeline/sweep-rotation.json
git diff --numstat origin/main              ->  2  2  docs/pipeline/sweep-rotation.json
```

The station contract's cure for a blocking path is explicit: *"restore each blocking path
byte-exactly from `HEAD` with a raw-Buffer node write"*. Applied to this reading, that restores
`sweep-rotation.json` to its committed content. **I read the diff first, and it is not mine:**

```
-  "last_index": 3,                                 +  "last_index": 0,
-  "last_run_utc": "2026-10-09T10:09:53Z",          +  "last_run_utc": "2026-10-09T14:12:46Z",
   "last_station": "04-scanner",
```

That is **Station 04's live rotation state**, advanced by `next-sweep.mjs --advance` at `14:12:46Z`
— four minutes before my run started — by the 04 occurrence whose `lastRunAt` is `14:09:36Z` and
which was still mid-run throughout mine. Restoring it from `HEAD` would have rewound 04's rotation
pointer from the sweep it had just claimed back to the one before, **silently, with a cure the
contract told me to apply, read back as a clean PASS, and reported as the fast-forward unblocked.**
04 would then re-run an already-covered sweep next occurrence and the one it advanced to would be
skipped — the exact coverage-narrowing failure `sweep-rotation.json`'s own `_why` field exists to
prevent.

**The gap is precise, and it is not that the cure is wrong.** The cure is written for the case the
surrounding paragraph describes — *"If you did write one into the dev tree"* — i.e. **a blocking
path YOU left.** Nothing in it says *first establish that the modification is yours*, and the four
read-backs it prescribes (`rev-list` → `0 0`, `--numstat` EMPTY, `--cached` EMPTY,
`git status --porcelain` EMPTY) are all satisfied *after* a wrongful restore just as well as after
a rightful one. A station arriving at a dirty dev tree sees a path, not an owner.

**And the second half: two of those four readings were non-empty and the fast-forward succeeded
anyway.** [MEASURED] with `sweep-rotation.json` still modified and deliberately untouched:

```
git merge --ff-only origin/main   ->  Updating 8ae32ead..d086529c  Fast-forward  ... exit 0
git rev-list --left-right --count HEAD...origin/main  ->  0   0
git diff --numstat origin/main     ->  2  2  docs/pipeline/sweep-rotation.json   (NOT empty)
git diff --cached --name-status     ->  (empty)
git status --porcelain --untracked-files=no  ->   M docs/pipeline/sweep-rotation.json  (NOT empty)
```

So the real rule is narrower than the contract's: **a tracked modification blocks `--ff-only` only
when the incoming commits must touch that same path.** `d086529c` changed two files under
`docs/pr-prompts/` and did not go near `docs/pipeline/`, so git had no local change to overwrite
and fast-forwarded cleanly. Reading `--numstat`/`--porcelain` non-empty as "the fast-forward is
blocked, apply the cure" is what converts a harmless foreign modification into a destructive
restore. The contract's own framing already hints at this for the untracked case — *"an untracked
file at a path the fast-forward must create"* — and then drops the *must-touch* qualifier when it
generalises to tracked files.

**DISPOSITION: ACTIONED** — for this run, completely: I read the diff before reaching for the cure,
left 04's state alone, fast-forwarded successfully with the modification in place, and verified
`HEAD == origin/main` (`rev-list 0 0`) and `--cached` EMPTY. 04's rotation pointer is intact at
`last_index 0 / 14:12:46Z`, which anyone can re-read. **What is NOT actioned is the instruction
itself, and it needs one sentence in a hash-gated canonical block, which is not mine to edit alone.**
The block is `station-contract v5`, byte-identical across all seven station docs and gated by
`lint-station.mjs`, so changing it means re-recording the hash and shipping all seven together —
**named for Station 06 (staging) with Station 05 for the `sot/` side if any.** The two sentences the
cure wants, stated so nobody has to re-derive them:

1. *"Before restoring any blocking path, read `git diff -- <path>` and establish the modification is
   YOURS. A tracked file another station is mid-run on is not a blocker to clear — leave it and say
   so."*
2. *"`--numstat` and `--porcelain` non-empty do not by themselves mean the fast-forward is blocked.
   A tracked modification blocks `--ff-only` only if the incoming commits touch that path. Try the
   fast-forward and read its exit code before applying any cure."*

⚠️ Under RULE 1 both halves are additive and neither weakens an existing guard: (1) adds an
ownership check before a destructive write, (2) replaces a sufficient-looking condition with the
necessary one, and the existing four read-backs stay exactly as they are as *post*-conditions. The
alternative — leaving the cure as written and relying on each run to notice, as I did — fails the
"future" half of RULE 1: it worked once because I happened to read the diff.

### F62 — S2 — A second actor took Station 05's lane 74 seconds after my merge, so I stopped before the correction PR rather than open one

I intended to land this correction as a small board PR. The pre-mutation re-sweep refused me the
ground for it. [MEASURED] `status-sweep.ps1` at `14:28:28Z`, section 2:

```
[LIVE] non-main worktrees found: 34        (33 one sweep earlier, at 14:15:23Z)
[LIVE]    LIVE STATION WORKTREE: C:/po-wt/st05-1424   d086529c (detached HEAD)
[LIVE]       dirty=1 files  age=1 min  -- do NOT prune; a station is working here
```

Measured directly, not inferred from the classification: `(Get-Item C:\po-wt\st05-1424).CreationTimeUtc`
= **`2026-10-09T14:28:21Z`**, detached at **`d086529c` — my own merge commit, 76 seconds old at that
point** — with `M docs/data-model/metadata-catalog.json`, whose `LastWriteTimeUtc` is
`2026-10-09T14:28:23Z`. Re-measured 2m14s later at `14:30:37Z`: same single dirty path, same
mtime, no further writes.

**It is not Station 05's scheduled occurrence.** [MEASURED] `list_scheduled_tasks`: `05-sot-keeper`
`lastRunAt 2026-10-08T22:38:07Z`, `nextRunAt 2026-10-10T14:22:37Z`. So an **unscheduled** actor —
an interactive session, the supervised lane, or a second lane — created a worktree in 05's naming
convention off my merge commit and began editing `docs/data-model/`, which is 05's lane and
adjacent to `/sot/`. Who it is is not measurable from here and is not mine to adjudicate.

**Why I stopped rather than proceeded on a free lease.** The board lease read **free** and
`Get-Process git` returned **0** at `14:29:31Z`, so a run gating on the lease alone would have taken
it and opened a PR. BOARD DRIVING condition 3 forbids exactly that reading: *"The existing lock,
process and recent-activity checks still run — the lease is **in addition to**, not instead of,
them: first confirm nothing else is mid-mutation... If something else is acting, STOP: that is the
LL-38 collision."* And the quiet 2m14s is not evidence of absence — DOCTRINE §3: *"Silence is not
death. An agent mid-diagnosis is network-bound and process-invisible,"* which is the measured cause
of LL-25, where two productive runs were killed as wedged. A free lease between two of another
actor's operations looks identical to an idle board, and `status-sweep` is the instrument that can
tell them apart; it told me, and I obeyed it.

⚠️ **Note the direction of the error I was one step from making, because it is the opposite of the
one the station doc warns about.** The doc's standing warning is against a **false** stand-down — a
lease refusal taken at face value, *"the expensive direction"*. This is the real thing: a genuine
concurrent actor behind instruments that individually read safe.

**DISPOSITION: ACTIONED** — I stood down from the board for the remainder of the cycle and the
correction went to the dev tree instead of a PR, which is the contract's other sanctioned home and
costs only a sweep. The hand-over is stated at the top of this file: **this breadcrumb is untracked
and the next board PR must commit it.** Verified: no lease taken after `14:27`, no PR opened after
#2286, `gh pr list --state open` → 0 at the re-sweep, the st05-1424 worktree untouched by me, and
nothing of mine anywhere in `C:\po-wt\st05-1424`. **Not escalated to Marco:** an actor working in
its own lane is the system being used, not a defect, and the collision never happened. **Not
dispatched to Station 03** either, despite `non-main worktrees found: 34`: the 34th is the live one
the sweep explicitly says not to prune, and 03 already holds the standing hand-over for the other
33 from my predecessor's F56.

## WHAT I DID NOT DO

- **Did not restore `docs/pipeline/sweep-rotation.json`**, although the contract's cure named it a
  blocking path. It is Station 04's live state. F61.
- **Did not open the correction PR**, take a second lease, arm, label, archive or retire anything
  after #2286 merged. A second actor held the board. F62.
- **Did not touch, inspect-and-modify, or prune `C:\po-wt\st05-1424`**, and did not try to identify
  its owner beyond what the filesystem and the scheduled-tasks MCP say.
- **Did not edit the `station-contract v5` canonical block** to carry F61's two sentences. It is
  hash-gated and byte-identical across seven docs; changing it is a seven-doc PR with a re-recorded
  hash, and it is named for Station 06 rather than done in a cycle where the board is held.
- **Did not re-run the `tendering-e2e` job, re-escalate the git guard, or re-dispatch the 33
  worktrees.** All three are covered in the 1414 breadcrumb (#2286).
- **Touched no Azure, Entra or SharePoint surface, wrote no production data, removed no label, and
  edited nothing under `/sot/`.**

## FOR MARCO

**Nothing here is urgent and nothing needs an answer today.** The board is empty, trunk's CI on
`d086529c` was still running when I finished (4 running, 0 concluded — **not** a green trunk yet,
and the next 00 run should read it rather than inherit this line), the watcher is healthy, and no PR
is waiting on you.

1. **One thing is worth knowing even though it did not go wrong:** the fast-forward cure printed in
   every station contract would, applied exactly as written, have quietly rewound Station 04's sweep
   rotation this run. I caught it by reading the diff first. The fix is two sentences in a
   hash-gated block shared by seven documents, so it wants one deliberate PR rather than a
   drive-by — F61 has the exact wording. **Nothing is broken right now** and 04's state is intact.
2. **Somebody was working in `C:\po-wt\st05-1424` on `docs/data-model/metadata-catalog.json` at
   14:28Z**, off my merge commit, outside 05's schedule. If that was you or a session you started,
   this is just a note that I saw it and stood down. If it was not, it is worth knowing an
   unscheduled actor is editing `docs/data-model/` — that is the only part of F62 I cannot settle
   myself.

---

# ADDENDUM — COLLECT of Station 04's 1412 breadcrumb, which landed mid-run

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` at `14:32:30Z` reported **3 checked, 0
malformed, CLEAN, exit 0** — and the third file was new:

```
ADMIT  00-00-supervisor-2026-10-09-1414-...                      (tracked, landed by #2286)
NOTE   00-00-supervisor-2026-10-09-1430-...  is UNTRACKED        (this file)
ADMIT  00-00-supervisor-2026-10-09-1430-...
NOTE   00-04-scanner-2026-10-09-1412-...     is UNTRACKED
ADMIT  00-04-scanner-2026-10-09-1412-blind-gate-liveness-thirteen-premises-alive-zero-gates-satisfied-and-my-own-anchor-grep-was-one-of-three.md
```

**Station 04's breadcrumb did not exist when I ran COLLECT at ~14:16Z** — `git ls-files -- docs/pr-prompts/00-*.md`
returned one file and `Get-ChildItem` found no untracked second one. 04's occurrence fired at
`14:09:36Z`, 4 minutes 50 seconds before mine, and wrote its report while my cycle was in flight.
So the 1414 breadcrumb's *"there is NOTHING UNCOLLECTED this cycle"* was **true when measured and
false eighteen minutes later**, which is `[LIVE]`-means-true-when-measured applied to the collect
channel itself. I read 04's report in full and disposition its six findings below. **This addendum
is why the correction was worth writing even apart from F61 and F62.**

**04 was BLIND** (`CONNECT_TIMEOUT` after 30000 ms, reproduced after the mandated 62 s wait, schema
loaded three ways first) and filed the second report shape — *"I was blind, so I read everything
readable and acted on none of it."* It claims no SAFE-TO-ACT, liveness, smoke, `--freshness` or
merge verdict, and it ran no `git` and no `.ps1`. Its board-facing readings are therefore taken
from the mount, the native file tools and the GitHub API, and it says so for each.

🔴 **04 independently confirms F61 from the other side, and this is the strongest control either of
us has.** Its WHAT CHANGED names both of its dev-tree writes and states:
*"`docs/pipeline/sweep-rotation.json` — TRACKED and now MODIFIED by the `--advance` above. The
station doc orders this and orders me to leave it dirty... Station 00: this is the fourth bullet of
your FF cure, and it is mine, not a stray."* I reached the same conclusion from the diff alone
(`last_station: 04-scanner`, `last_run_utc 2026-10-09T14:12:46Z`) **before** reading 04's report, so
two actors on two transports agree that the one tracked modification in the dev tree is 04's
mandated state and not a blocker to clear. F61's disposition stands unchanged and is now
corroborated rather than inferred.

## Dispositions — Station 04's F1 through F6, plus its hand-over

- **04-F1 (blind run, Desktop Commander `CONNECT_TIMEOUT` twice) — DEFERRED.** Accepted as reported
  and deliberately not re-escalated. The governance question it raises is already open with Marco as
  Station 00's **F48** (PREFLIGHT step 1's "STOP" against `STATION-CAPABILITIES.md` §3's "COLLECT
  first"), carried unre-asked at 13:13Z and again in the 1414 breadcrumb; a third voice on one
  unchanged mechanism adds noise and no information. 04's own urgency trigger is the right one and I
  adopt it verbatim: **a blind run coinciding with a `.git/index.lock` that has no owning Windows
  process, or a cycle where 00 is blind too and the collect channel closes at both ends.** Worth
  recording for whoever eventually answers F48: **this cycle is the live demonstration that §3's
  COLLECT is load-bearing** — a blind 04 still produced a complete, controlled gate-liveness sweep,
  and PREFLIGHT step 1 read literally would have discarded all of it.
- **04-F2 (git guard INERT, exit 2) — DEFERRED.** Same mechanism as my F59, now on its **fifth**
  consecutive independent report (04 this morning, 00 at 12:13Z F51, 00 at 13:13Z F55, 00 at 14:14Z
  F59, 04 here). Not re-escalated by me either. Both of us kept the ban by hand this cycle and both
  said so with the exact call made. Trigger unchanged: a 0-byte `index.lock` with no owning Windows
  process.
- **04-F3 (gate liveness CLEAN: 13 of 13 premises alive, 0 gates satisfied, 0 spent) — DEFERRED.**
  Accepted, and it is a genuine **independent corroboration of my F58 rather than a duplicate of
  it**: I measured 13 of 13 refusals through `lint-prompt.mjs` on the Windows host; 04, blind,
  measured 13 of 13 premises *alive* with 0 human gates open, from the GitHub API and the mount,
  using a different instrument it explicitly could not run. Two transports, two instruments, same
  verdict, prompt for prompt — which is as close to a positive control as an empty board admits. No
  finished work is parked and nothing is armable.
- **04-F4 (its own one-anchor human-gate grep nearly produced a false drift accusation against
  `docs/approvals/README.md`) — DEFERRED.** 04 dispositioned it ACTIONED for its own run, correctly:
  it caught the error inside the run, re-ran with all three anchors, got 8 of 13, and reproduced
  `triage-holds.ps1` prompt for prompt. What it asks of me is *"it may be worth one line in the
  station doc's gate-liveness brief"* — **a human-gate census is three greps, not one
  (`watcher: do-not-arm`, case-sensitive `DO NOT ARM`, `Arm ONLY`), cross-checked against the last
  reject-code table.** I am DEFERRING that doc line rather than actioning it, by the same standard I
  applied to my own F60: one sighting is a lead for an instruction document even when it is a finding
  for a run, and §9's bullets are measured, not inferred. **Named for Station 06** alongside F61's
  two sentences — they touch adjacent material and want one PR, not three. ⚠️ Note for whoever
  writes it: 04-F4 and my F52-of-last-cycle are **the same failure in two different instruments** —
  a narrow query with two passing controls returning a confident wrong answer about armability. That
  pattern now has three sightings in two hours, which is the argument for the doc line.
- **04-F5 (approvals channel at 37 days, eight holds) — DEFERRED.** Already filed as
  `needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`,
  updated 2026-10-08T23:2x to eight holds and 36 days, with three RULE 1 ordered options and a probe.
  04 re-measured and explicitly declined to re-file; I decline too. One more day of arithmetic is not
  new information, and the file's own trigger (`gates-satisfied` going non-zero) is the right one.
- **04-F6 (this session mapped four folders, no `po-watcher`, so the three-homes verdict probe was
  unavailable) — DEFERRED.** Accepted; 04 correctly re-measured `BLIND_RUN_OTHER_MOUNTS_V1`'s own
  falsifying probe, found four mounts against the eleven that paragraph recorded, and kept the half
  that holds — **enumerate the mounts, never assume the list.** Nothing in its run needed a verdict,
  so nothing was lost. Trigger unchanged: a blind run in a four-mount session that *does* need a
  RULE-2 or review-verdict reading must report it UNMEASURED, never negative.
- **04's hand-over to me — "two things to sweep, both blocking the dev tree's next fast-forward":
  DEFERRED to the next Station 00 occurrence, with the reason stated.** The two are its breadcrumb
  (untracked) and `sweep-rotation.json` (tracked, modified). **I could not commit them: by the time
  04's report appeared, another actor held the board (F62), so I took no second lease and opened no
  second PR.** This is the one item in the whole collect that is actionable, in 00's lane, and left
  undone — so it is named here as plainly as I can: 🔴 **the next Station 00 run must commit THREE
  untracked/dirty paths in one board PR** —
  `docs/pr-prompts/00-04-scanner-2026-10-09-1412-...md`,
  `docs/pr-prompts/00-00-supervisor-2026-10-09-1430-...md` (this file), and
  `docs/pipeline/sweep-rotation.json` — **and must not restore any of them** (F61). Every finding in
  04's breadcrumb carries a disposition and every one is dispositioned again above, so **04's file is
  archivable the moment it is committed**; this file is the current cycle and stays in the root.
  ⚠️ And the fast-forward reading to expect: with `sweep-rotation.json` dirty at a path the incoming
  commits *do* touch once that PR lands, `--ff-only` **will** refuse, which is the genuine blocked
  case F61 distinguishes from the spurious one. The cure then is to **commit it, not to restore it.**

## Addendum — WHAT I DID NOT DO

- **Did not commit Station 04's breadcrumb or `sweep-rotation.json`**, although 04 asked me to and it
  is my lane. The board was held. F62, and the hand-over above.
- **Did not re-escalate any of 04's six findings**, all of which 04 had already dispositioned and
  four of which are already open in `needs-marco/` or carried by F48.
- **Did not re-run 04's gate-liveness sweep or re-advance the rotation.** Its result is corroborated
  by my own independent reading and the rotation pointer is 04's to move.
