# Station 00 — Supervisor | 2026-09-04T02:09:03Z–2026-09-04T02:26Z

## GROUND

```
UTC            2026-09-04T02:09:03Z
origin/main    57b956c7 at start  ->  cd06e4d1 at exit  (this run merged #1561)
dev tree       main @ 10fcce53 at start -> cd06e4d1 at exit   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Version match, so this run was NOT read-only. **All three binding documents were read in the DEV
TREE after fast-forwarding it to `origin/main`** — never in the watcher clone (station-contract v2,
per-tree `origin/main`). SIGHTED, not blind: `start_process` shell `powershell.exe` returned
`2026-09-04T12:09:03.5624519+10:00` / `LAPTOP-E6NHU4E4` on the first call.

## WHAT I MEASURED

- **[MEASURED] Reachability.** `powershell.exe -NoProfile -Command "Get-Date -Format o; hostname"` →
  `2026-09-04T12:09:03.5624519+10:00`, `LAPTOP-E6NHU4E4`. Not blind.
- **[MEASURED] Dev tree was 5 commits behind at start.** `git rev-parse --short HEAD` = `10fcce53`,
  `origin/main` = `57b956c7`, `git log --oneline HEAD..origin/main` = 5 lines. Converged to
  `57b956c7`, then to `cd06e4d1` after the merge below.
- **[MEASURED] The binding-doc hash cure reported all three docs stale; only ONE had changed.**
  `git show origin/main:<p> | git hash-object --stdin` vs `git hash-object <p>` differed for
  DOCTRINE.md, STATION-CAPABILITIES.md **and** 00-supervisor.md, while
  `git diff --stat 10fcce53 57b956c7 -- docs/pipeline/` = *1 file changed, 10 deletions*
  (00-supervisor.md only). See FINDING 1.
- **[MEASURED] Board census, `status-sweep.ps1` 02:11:52Z → 02:12:22Z, verdict `CAUTION`.**
  3 open PRs — `#1562` BLOCKED (13 pass / 0 fail / 1 pending), `#1561` CLEAN (9/0/0 green),
  `#1544` BLOCKED (13/0/1). Watcher node RUNNING pid 24744, wrapper alive (1), heartbeat 4 min.
  armed 0 · in-progress prompts 0 · `index.lock` dev/clone False/False · git processes 0 ·
  no PR touched in the last 2 min. CAUTION was raised solely by one LIVE-classified worktree,
  `C:/po-queue` (see FINDING 5).
- **[MEASURED] RULE 2 probe, pinned to the LIVE tree.**
  `C:\ProjectOperations2\docs\pr-prompts\processed` — **1871** logs, newest
  `2026-09-04T02:08:22Z` (`rev-1562-ready.md.log`), i.e. younger than the oldest open PR
  (`#1544`, opened 2026-09-03T11:18:52Z), which is the control that separates it from the dead
  decoy in the watcher clone. POS control `marco.:true` = **606**. NEG control `marco.:false` = 0
  (that string does not exist — 00:09Z FINDING 3; the working negative control is a PR the watcher
  did open). **Controls both directions in one query:** `#1536` →
  `{"ok":false,"marco":true,"reason":"escalates:true — held for Marco, labelled do-not-merge"}`;
  `#1561`, `#1562`, `#1544` → **NO LOG**. So `NO LOG` here means *second lane*, not *broken probe*.
- **[MEASURED] Hand-classification of the three open PRs** (`classifyPolicyFiles`: any path outside
  `^(tests|docs)/`, or any `(^|/)migrations/`, is Marco's) — `[NO LANE VERDICT — hand-classified]`:
  - `#1561` — `docs/pr-prompts/*.md` ×2 → **not Marco's** → mergeable by 00.
  - `#1562` — `.github/workflows/ci.yml`, `docs/pipeline/DOCTRINE.md`,
    `docs/pipeline/STATION-CAPABILITIES.md` → `.github/` is outside `docs/` → **MARCO'S**.
  - `#1544` — `.claude/agents/**` ×6, `docs/pipeline/STATION-CAPABILITIES.md`,
    `scripts/pipeline/lint-station.mjs`, `scripts/pipeline/next-sweep.mjs` → **MARCO'S**.
- **[MEASURED] `check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`.** structure 10 checked,
  0 malformed. `00` 2.1h ok · `02` dispatch-only · `03` 3.2h ok · `04` 4.1h ok · `05` **4.3h ok**.
  It also printed `NOTE … 0009 … is UNTRACKED — it reaches nobody until a board PR commits it`.
- **[MEASURED] `list_scheduled_tasks` crossed against the freshness table.** `00` lastRunAt
  `2026-09-04T02:08:47Z` (this run), cron `5 * * * *` — **hourly, while `check-breadcrumb.mjs`
  records 00's cadence as 2h** (standing escalation, unchanged). `03` `2026-09-03T23:01:39Z`,
  cron `0 9 * * *` = 23:00Z daily — **still contradicts its own bootstrap's "every 4 hours"**
  (open with Marco). `04` **`2026-09-04T02:10:26Z` — 04 started 100 seconds after this run**.
  `05` `2026-09-03T14:11:26Z`, next `2026-09-04T14:10:37Z` — on schedule, nothing missed.
- **[MEASURED] The 05 breadcrumb entered `main` four hours after 05 wrote it.**
  `git log --diff-filter=A -1 -- docs/pr-prompts/00-05-sot-keeper-2026-09-03-2154-…md` →
  `44dd974b 2026-09-04T11:55:14+10:00` (= 01:55Z) `(#1554)`. Content is dated 2026-09-03T21:54Z.
  See FINDING 2.
- **[MEASURED] DOCTRINE §9.5 cites a line number that is now 92 lines wrong.**
  `git show origin/main:scripts/pipeline/lint-prompt.mjs | Select-String 'single gh call'` →
  **line 1610**; negative control `zzzNoSuchNeedle` → 0. `git show origin/main:docs/pipeline/DOCTRINE.md
  | Select-String ':1518'` → **1**. See FINDING 3.
- **[MEASURED] RULE 4 arming detector on `pr-doctrine-s95-cite-symbol-not-line-HOLD.md`.**
  Instrument 1 — `lint-prompt.mjs` → `ADMIT (size 2)`, exit 0. Instrument 2 — union of all THREE
  literal markers (`DO_NOT_ARM_COMMENT` /i, `DO_NOT_ARM_CAPS` case-sensitive, `ARM_ONLY`) → **0**
  on the target, with POS control `pr-524-rates-b-slice2-canonical-HOLD.md` → **2** hits on two
  distinct regexes (L27 `DO NOT ARM`, L29 `Arm ONLY`). Instrument 3 — body read in full: no prose
  gate; `## STANDING AUTHORITY` is the boilerplate that sits on ~51 of 61 prompts. Gate
  `requires_on_main: scripts/pipeline/lint-prompt.mjs :: NOT_A_PROMPT` → **3** hits on
  `origin/main`, neg control 0. Not shipped: premise `:1518` still true on main; no
  `processed/*doctrine-s95*` log; no merged PR matching the subject.
- **[CANNOT MEASURE] Who opened `#1562`.** `author` is `GH-Mantova`, which attributes nothing;
  `C:\po-queue` was `dirty=0`, `age=15 min`, HEAD `b63da097` = that PR's own commit, with 0 git
  processes running. Nothing on this box records which actor drove it.

## WHAT CHANGED

1. **Dev tree fast-forwarded twice**, `10fcce53` → `57b956c7` → `cd06e4d1`. Both times
   `merge --ff-only` **aborted** on untracked working-tree files a board PR had just landed
   (9 files from `#1558`, then the 00:09Z breadcrumb from `#1561`). Cure applied both times:
   byte-compare every named file against `origin/main` first — `SUMMARY same=9 diff=0`, then
   `same=1 diff=0` — then delete and re-run the ff. Read back: `git rev-parse --short HEAD` =
   `cd06e4d1` = `origin/main`.
   Also restored `docs/data-model/metadata-catalog.json` (`git diff --numstat` **empty** — a
   CRLF-only dirty read, the sanctioned cure).
2. **`#1561` MERGED** via `Assert-SmokedOrEscalate -PR 1561` → `Merge-Pr -PR 1561` (both `True`).
   Read back three ways: `gh pr view 1561` → `state=MERGED mergedAt=2026-09-04T02:15:17Z
   sha=cd06e4d1…`; `git fetch` → `57b956c7..cd06e4d1 main -> origin/main`; `git ls-tree -r
   origin/main -- docs/pr-prompts/` now lists **both** the 00:09Z and 01:09Z breadcrumbs. The
   breadcrumb channel is unsilted for the first time since 23:09Z.
3. **ARMED exactly one prompt** — `pr-doctrine-s95-cite-symbol-not-line-HOLD.md` →
   `-ready.md`, via `arm-prompt.ps1` (never a bare `git mv`). Read back: `-ready.md` present at
   5110 bytes, `-HOLD.md` gone, armed count **0 → 1**, `git diff --cached --name-status` **empty**
   (`ARM_INDEX_RELEASED` fired, so no staged `R100` is left for a later commit to carry),
   `.arming-log.txt` tail → `2026-09-04T02:18:14Z ARMED pr-doctrine-s95-cite-symbol-not-line
   escalates=false`.
4. This breadcrumb, and the board PR that carries it.

## FINDINGS

### FINDING 1 — the contract's own freshness cure still reports every doc stale on this checkout, and the fix dispatched two hours ago has no home yet

The `station-contract v2` cure — hash the blob from `origin/main`, hash the working copy, compare —
returned a MISMATCH for all three binding documents while only one of them had actually changed.
`git hash-object <file>` hashes the CRLF bytes on disk; `git show origin/main:<path> | git
hash-object --stdin` hashes the LF blob. On a checkout with CRLF conversion the two can **never**
agree, so the cure reads "stale" on a tree that is byte-current, and would read "stale" just as
loudly on one that genuinely is. It carries no information in either direction. The discriminating
instrument is `git diff --stat <old> <new> -- docs/pipeline/`, which named the one real change.

This is the 00:09Z run's FINDING 2, independently re-measured with the control it lacked. That run
disposed it **DISPATCHED → Station 06**. Two hours on, no `-HOLD.md` exists for it, and **Station 06
has no cadence** — the standing open question that DOCTRINE §9.5 already names in the abstract
("a disposition addressed to a FUTURE RUN outlives its own fix and bills a later run to
re-discover it"). This run is that bill, paid a second time.

**DISPOSITION: DISPATCHED → Station 06 (PR Master), re-stated with an expiry.** Same edit as
before — a `station-contract v2` canonical-block change, `lint-station.mjs --write-canonical`, all
seven station docs in one PR, pre-recording the `REJECT 7 of 8` control and confirming all eight
name the same new sha. **Added this run:** if a third Station 00 run re-measures this, the finding
stops being a dispatch and becomes an escalation about 06 having no cadence, not about CRLF.

### FINDING 2 — a station was called SILENT for four hours because its breadcrumb was sitting in an unmerged PR

At 00:09Z `--freshness` read `05 … 58.0h ago SILENT` and that run deferred on it; the 01:09Z run
carried the same claim forward as *"05 is still SILENT at 59 h and `/sot/` is unkept"*. At 02:12Z
the identical command reads `05 last 2026-09-03T21:54:00Z 4.3h ago (cadence 24h) **ok**`.

**Nothing about Station 05 changed.** 05 did its work at 21:54Z on 09-03 and wrote a conforming
breadcrumb. That breadcrumb reached `origin/main` only at `44dd974b` / **01:55Z** inside `#1554`
(`git log --diff-filter=A`). `check-breadcrumb.mjs` builds `trackedSet` from
`git ls-tree -r origin/main`, so for four hours the file existed, the work existed, the PR existed —
and the detector could not see any of it.

So the SILENT verdict is a function of **merge latency**, not of station liveness, and the error is
**unbounded**: a breadcrumb in an unmerged PR ages the station indefinitely. This is the same blind
spot `#1555` recorded ("freshness is blind to the breadcrumb home the contract calls best"), but
that entry described the mechanism; this is the first time it is measured **producing a false
SILENT on a live station and two consecutive runs acting on it.** It also inverts the standing
memory line that `/sot/` had gone ~55 h unkept: `#1554` burned the provenance-class `sot-refs`
entries 13 → 4. `/sot/` was kept; the instrument could not see it.

⚠️ Note the second-order trap this creates for the contract itself: the contract calls *"inside your
own run's PR"* the **best** home for a breadcrumb, and that is exactly the home the detector cannot
read. Following the contract is what triggers the false alarm.

**DISPOSITION: ESCALATED → Marco.** A false SILENT licenses destructive action (§7), and this one
survived two runs. RULE 1 — complete and additive first:
**(a) read the breadcrumb set from the union of `origin/main` AND every open PR's head** (`gh pr
list --json headRefName` → `git ls-tree -r <ref>`), so a breadcrumb counts the moment it is pushed.
Complete (closes the whole gap, now and in future) and additive (adds refs, removes nothing) —
**RULE-1 FIRST**. **(b)** fall back to the file's own `<YYYY-MM-DD>-<HHMM>` name on disk in the dev
tree when the tracked set has nothing newer — cheap, but *fails complete*: it is blind to a
breadcrumb written in a worktree or by a cloud lane, which is the case the contract warns about.
**(c)** require every station to also drop a zero-content receipt on `main` — *fails additive*: it
adds a second reporting channel that can itself go stale, and doubles the number of things a run
must do before it may exit. Filed at
`docs/pr-prompts/needs-marco/freshness-silent-is-merge-latency-2026-09-04.md`.

### FINDING 3 — DOCTRINE §9.5 is citing a line number that is 92 lines wrong, inside the hash-gated block

§9.5 says `checkFixesPrTargetOpen` is *"reached from … (`:1518` calls it 'a single gh call')"*. On
`origin/main` `cd06e4d1` that comment is at **line 1610**. The staged fix
`pr-doctrine-s95-cite-symbol-not-line-HOLD.md` predicted 1535 after `#1457`; further edits have
moved it again, which is precisely the prompt's own argument — a line number is a
stale-by-construction anchor. The hash gate protects the block from being *edited*, not from going
*wrong*.

**DISPOSITION: ACTIONED — armed.** Full RULE-4 detector above; scope is
`docs/pipeline/DOCTRINE.md` + `docs/pipeline/stations/_canonical-blocks.json`, i.e. **docs-only**,
`escalates: false`, size 2. Two things follow from that and are deliberate: it is the lowest-risk
change available on this board, and it is a live re-run of the falsifying probe for the open
`tests-docs` deadlock escalation — if the lane merges it inside `MERGE_TIMEOUT_MS` (90 min) the
deadlock note dies; if it times out, the next run gets a second measurement of the same defect at
no extra cost. **The next Station 00 run should read `processed/pr-doctrine-s95-cite-symbol-not-line-ready.md.log`
and record which happened.**

### FINDING 4 — the dev tree could not fast-forward, twice, because it held untracked copies of files the board had just landed

`merge --ff-only` aborts with *"untracked working tree files would be overwritten"* whenever a
board PR lands a file the dev tree already holds untracked — which is the normal end state of every
breadcrumb this station writes. It happened twice in seventeen minutes. The abort is loud and safe,
but the recovery is not obvious and the tempting cures (`checkout .`, `reset --hard`, `clean`) are
all on the hard-stop list because they resurrect consumed prompts.

The safe recipe, used twice this run and worth naming: parse the aborted merge's own file list,
`git hash-object` each against `git show origin/main:<path>`, and delete **only** those that come
back byte-identical (`same=9 diff=0`, then `same=1 diff=0`). A `diff` would mean real local content
and must never be deleted.

**DISPOSITION: DEFERRED** — real, mechanical, and recurring, but each occurrence costs one probe
and the safe cure is now written down. It becomes urgent if a run ever meets a `diff` case, because
that is the one shape where the obvious cure destroys work. Adjacent but **not** the same defect as
`pr-devtree-sync-ff-only-guard-HOLD.md`, which guards `git reset` as the convergence method; that
prompt would not have caught this, and its scope is `.claude/hooks/guard.mjs` — a code PR, so
Marco's, so not armed here.

### FINDING 5 — two stations and one unattributable lane were on the shared tree inside a three-minute window

`04-scanner` fired at `02:10:26Z`, **100 seconds** after this run began; `#1562` was opened at
`02:00:03Z` from `lane/station-authority-10-1` with a worktree at `C:\po-queue` that this run cannot
attribute to any actor. The sweep's `CAUTION` came from that worktree alone. Nothing collided:
`index.lock` False on both trees, 0 git processes, 0 in-progress prompts, `git diff --cached` empty
before and after the arm, and 04 is read-only by contract.

This is the already-open collision class (`needs-marco/station-schedule-collision-04-and-05-2026-09-03.md`,
`needs-marco/unattributed-arms-single-actor-2026-09-03.md`), now with a 00/04 instance: 00 is hourly
and 04 is 4-hourly, so they will overlap by construction roughly every four hours.

**DISPOSITION: DEFERRED** — folded into the two open escalations rather than raising a third. What
would make it urgent is a measured mutation collision (a staged path this station did not create,
or an arm it cannot account for), not the mere overlap.

## WHAT I DID NOT DO

- **Did not touch `#1562` or `#1544`.** Both hand-classify as **MARCO'S** (`.github/workflows/`,
  `.claude/agents/`, `scripts/pipeline/`), and neither carries a watcher verdict that could clear
  them. `#1562` additionally *proposes changing the classification rule itself* — current law is
  `classifyPolicyFiles`, and a PR arguing for its own exemption does not get one.
- **Did not arm a second prompt.** RULE 4 is one at a time, and the board's constraint is Marco's
  review queue, not the arming rate. 81 `-HOLD.md` remain at depth 1.
- **Did not archive dispositioned breadcrumbs.** The queue root holds ~12, not the 159 that made
  archiving worth a run; the current cycle is still live.
- **Did not act on any `[STALE]` line from sweep §5.** 40 of them fired this run against 13
  `needs-marco/` files, and that cross-check has a recorded false-positive history — a merged PR
  reference does not mean the escalation it sits in is discharged.
- **Did not prune `C:\po-queue`, `C:\po-1483-fix`, `C:\po-guard`, `C:\po-sa-fix`,
  `C:\po-work/s2-e2e`, or the two `C:\po-worktrees` registry escapees.** Worktree hygiene is
  Station 03's, and `po-queue` is 15 minutes old.
- **Did not restart or touch the watcher.** `restart-watcher-if-wedged.ps1`'s inputs all read
  healthy: node RUNNING pid 24744, wrapper alive, heartbeat 4 min, 0 armed at the time of the sweep.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, production data, or the watcher clone's git.**

## ADDENDUM — 2026-09-04T02:25Z, after the board PR was opened

The prompt armed at 02:18Z was consumed and built. **`#1563` — "docs(pipeline): DOCTRINE 9.5 cite
the symbol, not the line number"** opened at `2026-09-04T02:21:34Z`, head
`fix/doctrine-9-5-cite-symbol` @ `20a2e9e8`, touching exactly the two declared paths
(`docs/pipeline/DOCTRINE.md`, `docs/pipeline/stations/_canonical-blocks.json`), labels `[]`.
Three minutes from arm to open.

**[MEASURED] The §10.3 CI-creation-latency cause does NOT reproduce on this PR.**
`gh run list --commit 20a2e9e8389ebc7a4c5feefbe8c170c611dff0d0` (FULL 40-char sha — the short form
returns `[]` at exit 0) → **3 runs**, all `attempt=1`, all `completed / success`:

| run | created | lag from PR open |
|---|---|---|
| `33829221467` PR #1563 (CodeQL) | 2026-09-04T02:21:36Z | **0.0 min** |
| `33829223151` CI | 2026-09-04T02:21:37Z | **0.1 min** |
| `33829223189` Tendering Browser Smoke | 2026-09-04T02:21:37Z | **0.1 min** |

Negative control: `gh run list --commit 0000…0000` → **0 runs**, so an empty answer here would have
been distinguishable from a broken query. At 02:29Z `gh pr view 1563` reads `mergeState=CLEAN`,
**14 checks, 0 not-green**.

Against `#1500`'s measured **212.6 min**, this is ~6 seconds. So `MERGE_TIMEOUT_MS` (90 min, expiring
about **03:51Z**) is not being outrun by check creation on this PR, and `allGreen` was satisfiable
within four minutes of opening.

**This makes `#1563` a clean discriminator for the open `tests-docs` deadlock escalation**, and the
next Station 00 run should read it as one:

- **If `#1563` auto-merges** → the lane works, and cause (b) — CI-creation latency — is the whole of
  the deadlock. The escalation narrows to "latency only", and the cure is a longer or
  latency-aware `MERGE_TIMEOUT_MS`.
- **If `#1563` times out with all 14 checks green and CI created in 6 seconds** → cause (b) is
  REFUTED for this case and the deadlock is somewhere else entirely — the verdict-reader anchor
  (`verdictApproves`, `/^VERDICT:\s*MERGE\b/m` at column 0) and the verdict-guard path extractor are
  the two remaining candidates, and both are already staged.
- Either way the probe is: `docs/pr-prompts/processed/pr-doctrine-s95-cite-symbol-not-line-ready.md.log`,
  matching `PR #1563` in the BODY, against the pinned live tree.

**I deliberately did NOT hand-merge `#1563`, and did NOT merge my own `#1564` this run.** The
standing rule is that a watcher-opened docs PR inside its 90-minute window goes first, and
hand-landing this one would destroy the only clean measurement of the deadlock the board has
produced since `#1500`. `#1564` waits behind it.

**DISPOSITION (addendum): DEFERRED to the next Station 00 run** — with the exact probe, the exact
window (`03:51Z`), and both branches of the outcome written down so that run does not have to
re-derive any of it.

**[MEASURED] The lane is still holding the prompt — this is what "in the window" looks like on disk.**
At 02:25Z `pr-doctrine-s95-cite-symbol-not-line-**ready**.md` is still in the queue root and
`docs/pr-prompts/processed/*doctrine-s95*` is **empty**: the watcher has opened the PR and is in
`waitForPolicyMerge`, so the log that RULE 2 probes does not exist yet and will not until the lane
either merges or times out. **Do not read that absence as "no verdict, therefore free to merge"** —
it is a verdict still being computed.

Two live confirmations of standing traps, in passing:

- **`armed` read `2`, and the real count is `1`.** The second file is `rev-1563-ready.md`, an
  auto-generated REVIEW JOB with no front matter by design (DOCTRINE §9.5). Counting it would have
  reported an arm this station did not make.
- **The armed prompt's mtime is `2026-09-01T00:38:06Z`** — 3.1 days old — because `git mv` preserves
  mtime. It was armed at `02:18:14Z`, seven minutes before this reading. The only clock that dates
  an arm is `.arming-log.txt`, and that file is untracked, so it exists on this box and nowhere else.

**Also not done, and deliberately: project memory was NOT edited this run.** The correction it wants
(a SILENT verdict can be pure merge latency) is real, but `MEMORY.md` is at its stated read limit and
`project_memory_index_editing_rules.md` is 73 KB that this run did not read. Editing a load-bearing
index against rules I have not read is the shape of mutation this pipeline punishes. The finding is
durable without it: it is in this breadcrumb, on the tracked channel, inside `#1564`.
