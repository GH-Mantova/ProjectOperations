# Station 04 — Scanner | 2026-08-25T02:10:40Z–2026-08-25T02:22Z

Named sweep this run: **REPO HYGIENE**, covered completely. (Rotation: gate liveness · instrument
honesty · repo hygiene · instruction drift — repo hygiene was the one with an unclaimed backlog.)

## GROUND

```
UTC            2026-08-25T02:10:40Z
origin/main    5ec99150            (fetched with +refs/heads/main:refs/remotes/origin/main)
dev tree       main @ 5ec99150     C:\ProjectOperations2   (behind=0 ahead=0)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — this run was not restricted to read-only on that account.

NOT BLIND. Desktop Commander present; `start_process` on `powershell.exe` returned host output on
the first call. Locks absent in both trees. Watcher node pid **29024** ALIVE (exact cmdline match
`pr-watcher[\\/]index\.mjs`). `status-sweep.ps1` verdict: **SAFE TO ACT**, 0 in-progress, 0 git
processes.

## WHAT I MEASURED

Every negative below was run beside a positive control that passed. Controls first:

- `git ls-tree -r --name-only origin/main -- docs/pipeline/DOCTRINE.md` → returns the path
  **[MEASURED]**; the same query on a bogus path returns `[]` **[MEASURED]**. `-r` used everywhere
  (DOCTRINE §9.2).
- `git check-ignore -v docs/pr-prompts/processed/x.md` → exit 0, cites `.gitignore:76` **[MEASURED]**
  — proves the check-ignore instrument can produce a POSITIVE.
- `gh version 2.90.0` present **[MEASURED]** — a `lint-prompt.mjs` REJECT is meaningless without it
  (DOCTRINE §9.5).
- `lint-prompt.mjs` blob-comparison probe: same blob twice → equal `True`; two different files →
  equal `False` **[MEASURED]**.

Queue and board, at 02:11:06Z:

- Open PRs **4** (#1310 UNSTABLE, #1311 CLEAN, #1312 CLEAN, #1313 UNSTABLE) **[MEASURED]**.
- armed 0 · needs-marco 9 · no-pr-opened 107 · failed 20 · blocked 0 **[MEASURED]**.
- Backlog: ready=1 needs-marco=1 blocked=5 broken=0 **[MEASURED]**.
- `check-lessons.mjs` exit 0 — holding=5 regressed=0 broken=0 **[MEASURED]**.
- `check-escalations.mjs` exit 0 — open=0 resolved=3 broken=0 **[MEASURED]**.
- `check-sot-bytes.mjs` exit 0 — every `sot/` file `BOM=false U+FFFD=0 mojibake=0`, tree counts equal
  main counts, verdict CLEAN UTF-8 **[MEASURED]**.

Hygiene probes:

- Tracked **depth-1** `*-ready.md` on `origin/main`: **0** **[MEASURED]** (398 tracked files under
  `docs/pr-prompts/`; 167 `*-ready.md` at any depth, all under `processed/` or `superseded/`, which
  is archive and is fine). **The board trap's tracked half remains CLOSED.**
- Tracked depth-1 `-HOLD.md` on main: **62**. On disk: **55**. Delta **7**, all showing ` D`
  (worktree-deleted, unstaged) **[MEASURED]**.
- All 7 are **CONSUMED, not lost** — each has both `processed\<name>-ready.md` and its `.log`
  **[MEASURED]**, i.e. armed → ran → retired, and only the removal was never committed.
- `00-*` breadcrumbs: **41 on disk, 22 tracked on main, 19 untracked**, oldest untracked
  `00-machine-minder-2026-08-24-0123-…` **[MEASURED]**.
- Watcher clone `C:\po-watcher\ProjectOperations`: branch main, head `74066ae9`, **behind 5**,
  **39 stashes** (`stash list` = `reflog refs/stash` = 39, two independent counts), dirty 39 files
  = 34 uncommitted `docs/pr-reviews/*` deletions + 4 untracked new reviews + 1 modified
  **[MEASURED]**.
- 4 extra worktrees, all present on disk, each 1 commit ahead of main **[MEASURED]**.

### The near-miss — an instrument lie I nearly filed as a finding

At 02:17Z my ADMIT/REJECT control flipped: `pr-apierr-s12-ci-gate-HOLD.md` linted **ADMIT (size 3)**
at ~02:14Z and **MISSING** three minutes later. Disk then showed `armed=1`
(`pr-apierr-s12-ci-gate-ready.md`) with mtime rendered `11:13:11`. I read that as 01:13Z — 58 minutes
*before* the 02:11:06Z sweep that had printed `armed: 0` — and began writing up
"**`status-sweep.ps1`'s armed count is broken**".

It is not. `get_file_info` gives the full stamp: **modified `2026-08-24T01:13:11Z`** — a **day**
earlier **[MEASURED]**. `git mv` preserves mtime, so an armed file's mtime dates the last *edit of
the HOLD*, never the arming. My probe printed `HH:mm:ss` with no date and I supplied the date by
assumption.

What actually happened, and it is the more useful fact: **a concurrent chat armed
`pr-apierr-s12-ci-gate` between 02:11:06Z and ~02:16Z, during this run.** `status-sweep.ps1:159`
counts armed with the same `Get-ChildItem "*-ready.md"` I used, and both now return 1 — the sweep
was simply *correct at 02:11:06Z*. This is `[LIVE]` decaying exactly as the preflight warns.

Corollary, and it is good news: `.queue-state.json` `ts` field = **2026-08-25T02:18:07.968Z** with
`armed:1 runnable:1` **[MEASURED]**, read at 02:19:38Z — the watcher rescanned within ~90 s of the
arming and saw it. **The watcher is LIVE and responsive right now**, not merely process-present.

🔧 **Standing lesson for every station: never date a board event from a file mtime.** `git mv`
carries the old stamp, and `HH:mm` without the date invites you to supply the wrong day.

## WHAT CHANGED

- Staged ONE prompt: `docs/pr-prompts/pr-hygiene-gitignore-no-pr-opened-HOLD.md` — **lints ADMIT
  (size 1)** [MEASURED], read back after two edits. `-HOLD`, **not armed**; arming is 00's on
  Marco's authority.
- Wrote this breadcrumb.
- Scratch `.ps1` files under `C:\po-sup-fix-scripts\` (outside the repo).
- **Nothing else.** No board mutation, no merge, no label, no arm/disarm, no rename, no `/sot/` edit,
  no git write to any tracked file. The shared dev-tree index carried another chat's
  `R100 pr-apierr-s12-ci-gate-HOLD.md → -ready.md` throughout and **was not touched**.

## FINDINGS

### F1 — `docs/pr-prompts/no-pr-opened/` is the one watcher retirement bucket missing from `.gitignore` · S3

`.gitignore:72-82` declares the family with the stated intent *"The watcher creates and moves files
between these folders to track state; committing them causes phantom dirty trees on branch
switches."* It lists `*-ready.md`, `processed/`, `failed/`, `paused/`, `blocked/`,
`awaiting-review/`, `reviewed/`, `needs-marco/`. `no-pr-opened/` matches that description exactly and
**appears nowhere in the file** — `grep 'no-pr-opened' .gitignore` → **zero matches** [MEASURED].

Line 75 does not cover it: **in a `.gitignore` pattern that already contains a `/`, `*` does not
cross a `/`.** (Opposite of a git *pathspec*, where `*` does cross — the confusion that let this
survive.) Proved by `git add --dry-run`, which stages **10** real files [MEASURED].

Honest blast radius: the bucket is 107 files / 133,664 bytes, but **97 are `*.log`, already caught by
the global `*.log` at `.gitignore:26`** [MEASURED, control run on one `.log` and its sibling `.md`].
Exposed set = **10**. They sit at depth 2 and the watcher globs depth 1, so committing them would
**not** arm anything — **this is not the board trap, and S2 would be overstating it.** The real cost
is signal: a permanent `??` line in every `git status`, which is the noise the 7 legitimate `-HOLD`
deletions in F3 are currently hiding inside.

**DISPOSITION: DISPATCHED** — to **Station 00**. Prompt staged and ADMIT-linted at
`docs/pr-prompts/pr-hygiene-gitignore-no-pr-opened-HOLD.md`; it is one added line, RULE-1
complete-and-additive (see the three options laid out in the prompt body). 00 arms it; I did not.

### F2 — the one working reporting channel is not closing: 19 untracked breadcrumbs, oldest 26 h · S3

`STATION-CAPABILITIES.md §7` names `docs/pr-prompts/00-*.md` as ✅ "tracked on main as of #1300". On
disk there are **41**; **22 are tracked and 19 are not** [MEASURED]. The oldest untracked is
`00-machine-minder-2026-08-24-0123-…`, ~26 h old. The path is committable — `git check-ignore` says
`docs/pr-prompts/00-04-scanner-test.md` is **NOT-IGNORED** [MEASURED] — so nothing is blocking this
except that no board PR has swept them up.

The contract says a breadcrumb "is untracked until the next board PR commits it" and that **Station
00 collects**. Nineteen say that has not happened since 2026-08-24 01:23Z. Every one of those 19
reports exists on exactly one disk. **This breadcrumb is the 20th.**

Secondary drift, same evidence: only **4** of the 41 use the contract's
`00-<NN>-<station>-<date>-<HHMM>-<slug>` form. The rest are `00-supervisor-…` / `00-machine-minder-…`
with no `<NN>`, so a station-number filter silently misses them.

**DISPOSITION: ESCALATED** — to **Station 00**, as a question, not a status update: *the collection
step is the only channel that closes, and it has not run in 26 hours. Is 00 to commit these 19 (plus
this one) in its next board PR, or should the breadcrumb contract stop claiming `docs/pr-prompts/` is
a durable channel?* Both halves of RULE 1 favour committing them (complete: the backlog clears and
future runs land; additive: nothing on disk is altered). I cannot do it myself — **Station 04 may not
create a PR** (STATION-CAPABILITIES §5 authority matrix).

### F3 — 7 consumed `-HOLD` prompts deleted in the worktree, never committed · S4

main tracks **62** depth-1 `-HOLD.md`; disk has **55**. The 7-file delta is all ` D` unstaged
[MEASURED]:

```
pr-crm-direction-richer-surface-reconcile-HOLD.md
pr-crm-leads-page-title-HOLD.md
pr-crm-triage-archive-entry-HOLD.md
pr-lessons-folder-s1-restore-HOLD.md
pr-nopr-s1-dismissed-means-proceed-HOLD.md
pr-nopr-s2-hard-failure-bounded-restage-HOLD.md
pr-pipeline-fold-s1-any-permission-HOLD.md
```

All 7 are **legitimately consumed**, each with `processed\<name>-ready.md` + `.log` [MEASURED] —
these are the prompts behind the currently open #1310–#1313 and the #1301/#1302/#1305 series. Nothing
is lost. But until the removals are committed, `origin/main` overstates the HOLD queue by 7, and
`git checkout .` / `reset --hard` would restore all 7 (inert as `-HOLD`, but they would re-enter HOLD
triage as live candidates).

**DISPOSITION: DISPATCHED** — to **Station 00**, to ride along in the same docs-only PR as F2. Commit
with an explicit pathspec: the shared index currently holds another chat's `R100` arming rename and
must not be swept in (DOCTRINE §9.2).

### F4 — 4 escalation files the sweep has called `[STALE]` for days are still in `needs-marco/` · S4

`status-sweep.ps1` §5 prints, every single run [MEASURED 02:11Z]:

```
[STALE] HANDOVER-2026-08-14-tenancy-scoping-prod-incident.md  -> #1134 MERGED, escalation DEAD
[STALE] pr-1135-prod-data-backfill-MERGE-DECISION.md          -> #1135 MERGED, escalation DEAD
[STALE] pr-subbie-rate-cards-scope-pricing-HOLD.md            -> #212  MERGED, escalation DEAD
[STALE] watcher-crash-loop-exit-minus-1-2026-08-17-2215.md    -> #1158 MERGED, escalation DEAD
```

All 4 still present, mtimes 2026-08-15 to 2026-08-18 [MEASURED]. `needs-marco/` is gitignored
(`.gitignore:82`) so this is disk-only cleanup, not a PR. `check-escalations.mjs` independently
reports `open=0 resolved=3` — nothing here is a live blocker.

**DISPOSITION: DEFERRED.** Real but cosmetic; the sweep already labels them correctly, so no station
is misled today. It becomes urgent the moment someone greps `needs-marco/` for a count instead of
reading the `[STALE]` tags — which is exactly how `pr-1156-review-block.md` misled a reader
(DOCTRINE §7.1). Cleanup is Station 00's or 03's, needs Marco's nod only because `needs-marco/` is
his folder by name.

### F5 — 2 suffix-less prompts remain invisible to every instrument · S3

At depth 1, 4 files match `pr-*.md` but neither `-ready` nor `-HOLD` [MEASURED]. Two are explicit
retirement markers (`…-DISARMED-premise-dead-2026-08-18.md`, `…-RETIRED-premise-cannot-die-…`) and
are fine. Two are not:

```
pr-permission-role-reconciler.md      mtime 2026-08-17
pr-smoke-share-worker-tokens.md       mtime 2026-08-17
```

They match **neither** the watcher glob (`*-ready.md`), **nor** HOLD triage (`*-HOLD.md`), **nor** the
backlog register. Confirmed by arithmetic: the sweep's `-HOLD 55` equals my disk count of 55, and
neither of these is in it. Correcting the phrasing carried in project memory — they are **not
"armable"; they are INERT and INVISIBLE.** Nothing will ever run them and no instrument will ever
mention them. Unchanged for 8 days.

**DISPOSITION: DEFERRED.** Each needs a human decision — rename to `-HOLD` (join the queue) or to
`-RETIRED-<reason>` (leave the record). That is a content judgement about two specific pieces of
work, not hygiene, and Station 04 must not guess it.

### F6 — the `hygiene` worktree holds a 138-line prompt that exists nowhere else · S3

Squash-merge-proof probe (per-path blob comparison; `branch --contains` and a 2-dot diff are both
blind here — my first attempt used a 2-dot diff and reported 131–148 "divergent" lines that were
almost entirely *main's newer content missing from the branch*. Corrected mid-run.) [MEASURED]:

| worktree / branch | touched | identical on main | verdict |
|---|---|---|---|
| `C:/po-worktrees/sot-readme-fetch` · `docs/sot-readme-fetch-plain1` | 1 | 1 | **LANDED — prunable** |
| `C:/po-worktrees/sotk-03-ledger` · `docs/sot-03-merged-pr-ledger-2026-08-24` | 2 | 2 | **LANDED — prunable** (#1306) |
| `C:/po-worktrees/sot-d-register` · `docs/sot-05-d-register` | 1 | 0 | undetermined — `sot/05` |
| `C:/po-wt-h` · `hygiene` | 5 | 4 | **1 unlanded** |

The probe is decisive only in the LANDED direction; "not identical" can simply mean main has moved
on since. So: **2 of 4 are provably prunable, 2 are not yet determined.**

The unlanded file is the sharp one: `docs/pr-prompts/pr-sor-s9-register-to-progress-claim-HOLD.md`,
**138 insertions, does not exist on `origin/main` at all** [MEASURED — and note `git rev-parse
origin/main:<badpath>` returned its `fatal:` **as stdout content**, DOCTRINE §9.2; I asserted the
`fatal:` prefix rather than comparing the string]. It is a real staged prompt from 2026-08-20 that
lives only inside `C:\po-wt-h`. Per PROMPT-SCHEMA, *"a prompt that exists only as an untracked file in
a working tree is NOT staged"* — this one is worse, it is on an unmerged branch in a side worktree.

**DISPOSITION: DISPATCHED** — to **Station 00** for the prompt (decide whether `pr-sor-s9-…` should be
committed to the queue or dropped; do **not** prune `C:\po-wt-h` until that is answered, or the file
goes with it) and to **Station 03** for the two provably-prunable worktrees. `docs/sot-05-d-register`
touches `sot/05` and is **Station 05's** to adjudicate — I did not read or touch it.

### F7 — `lint-prompt.mjs` TIER-1 destructive detector fires on a quoted FILENAME · S3

`lint-prompt.mjs:866-872` defines `DESTRUCTIVE_PATTERNS_ALL`, documented at :865 as *"an operation,
not a topic, so it fires regardless of scope"*. Four entries are SQL operations (`SET NOT NULL`,
`DROP TABLE/COLUMN/CONSTRAINT/TYPE`, `DELETE FROM`, `TRUNCATE`). The fifth is **`drop-legacy /
drop_legacy`** — a **prompt-filename fragment**, not an operation.

The very next comment block (:873-877) explains why topic words were put in TIER 2 and gated on
`scope` touching `apps/api/prisma/**`: *"They appear in prompt file NAMES, in prose describing OTHER
prompts, and in text that merely explains this very rule."* `drop-legacy` is the textbook case of
that sentence and it is in the ungated tier.

**Reproduced, twice** [MEASURED]: my `.gitignore`-only, `size: 1` prompt was REJECTed
`DESTRUCTIVE_MUST_ESCALATE` purely for quoting the filename `pr-rates-s11c-drop-legacy-tables-ready.md`
inside a `git add --dry-run` evidence block. Eliding the token flipped it to **ADMIT (size 1)** with
no other substantive change.

Why this is not cosmetic: the linter's own remedy text offers *"Set `escalates: true`"* first. Taking
it would have labelled a one-line `.gitignore` change as escalating, attracted `do-not-merge`, and
put it in front of Marco for nothing. **A false positive that steers toward the wrong action is worse
than a noisy one.** It also means no station report or prompt can quote that filename as evidence —
and it is one of the filenames most worth quoting.

**DISPOSITION: DISPATCHED** — to **Station 06 (PR Master)**, whose lane is pipeline-instrument
defects. Suggested shape, RULE-1 complete-and-additive: **move `drop-legacy/drop_legacy` from
`DESTRUCTIVE_PATTERNS_ALL` to `DESTRUCTIVE_PATTERNS_PROSE`** (the scope-gated tier), which keeps the
guard fully armed for anything that can actually reach the database while ending the filename
collision. It damages no existing behaviour: a prompt whose `scope` touches `apps/api/prisma/**` is
still caught. The alternative — matching on a word boundary or excluding fenced blocks — fails the
*complete* half, because the token would still fire on the same filename in prose.

### F8 — watcher clone: the stash loop is still open, and the archive-tick gate is no longer empty · S4

`C:\po-watcher\ProjectOperations` [MEASURED]: branch main, `74066ae9`, **behind 5**, **39 stashes**
(newest `watcher-preflight-autostash … 2026-08-24T15:35:04+10:00`, oldest a WIP on
`feat/sharepoint-folder-mappings`). Two independent counts agree (`stash list`, `reflog refs/stash`).
The preflight-stashes-and-never-pops **closed loop is still live**; 39 is well down from the ~136 on
record, so it was drained at some point and is refilling.

Dirty 39 = **34 uncommitted deletions under `docs/pr-reviews/`** plus **4 untracked new reviews
`pr-1310-review.md` … `pr-1313-review.md`** plus 1 modified `metadata-catalog.json`.

Those 4 untracked reviews matter beyond hygiene: project memory records the verdict-archive tick as
dead because it is gated on the **clone's** `docs/pr-reviews` being empty. **The clone's
`docs/pr-reviews` is not empty** — it has 4 files right now [MEASURED]. I am **not** claiming the
freeze detector is alive; I did not read `index.mjs` this run and the gate is on
`archived+kept+skipped > 0`, not on file count. I am flagging that the premise behind the "dead
detector" note **has visibly changed** and should be re-measured before anyone acts on it.

**DISPOSITION: DISPATCHED** — clone drift and stash depth to **Station 03**; the archive-tick
re-measure to **Station 06**, which already owns the `16 × Date.now()` freeze-blind-deadline item.

## WHAT I DID NOT DO

- **Did not open a PR.** Station 04 cannot (STATION-CAPABILITIES §5). Consequence, stated plainly:
  F1's prompt and this breadcrumb are **untracked files on one disk** and are therefore **not staged**
  in PROMPT-SCHEMA's sense. They are real only once Station 00 commits them.
- **Did not arm, disarm, rename, move or delete any prompt.** Notably did not touch
  `pr-apierr-s12-ci-gate-ready.md`, armed by a concurrent chat mid-run.
- **Did not touch the shared index**, which held that chat's `R100` rename throughout.
- **Did not prune the two provably-dead worktrees**, nor clear the 4 dead escalation files. Both are
  mutations and I am read-only on the board; a repair I could justify is still not a repair I am
  allowed to make.
- **Did not read or edit anything under `/sot/`** beyond running `check-sot-bytes.mjs`.
  `docs/sot-05-d-register` is surfaced to Station 05 unexamined.
- **Did not run Part 2 (live-site visual patrol).** This run's named sweep was repo hygiene and the
  station doc says cover ONE completely rather than skim everything. Part 0 sub-checks (a)–(f) were
  likewise not run this cycle — flagging that so the rotation is visible: **next Station 04 run
  should take Part 0, starting with (a) authorization parity.**
- **Did not chase CP-26 red on #1310/#1313.** That check *is* the Marco hold; chasing it is the
  documented mistake.
- **Did not resolve F5's two invisible prompts.** Renaming either is a content decision.

---

*Provenance: every `[MEASURED]` line above was obtained via Desktop Commander `start_process` on the
Windows host between 2026-08-25T02:10:40Z and 02:22Z, against `origin/main` `5ec99150` and dev tree
`C:\ProjectOperations2` @ `5ec99150`. `[LIVE]` facts decay — the board changed once during this run
(F-near-miss). Re-measure before acting on any of it.*
