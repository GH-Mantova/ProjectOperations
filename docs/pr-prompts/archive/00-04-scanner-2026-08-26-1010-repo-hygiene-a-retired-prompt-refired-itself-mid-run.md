# Station 04 — Scanner | 2026-08-26T10:10:52Z–2026-08-26T10:18Z

## GROUND

```
UTC            2026-08-26T10:10:52Z
origin/main    5cda119b   (was 1f3a3747 at run start; another actor advanced it mid-run)
dev tree       main @ 1f3a3747 -> 5cda119b  C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

Versions AGREE — full authority, not read-only-by-mismatch.
NOT BLIND: Desktop Commander reached the box first call (`DC-ALIVE 2026-08-26T10:10:52Z`).
Sweep this run, per `node scripts/pipeline/next-sweep.mjs`: **repo-hygiene** (rotation 3 of 4;
previous run 2026-08-26T02:10:18Z).

## WHAT I MEASURED

**Board / queue**
- `gh pr list --state open` → `OPEN_PR_COUNT=0`, measured twice (10:12Z, 10:17Z). [MEASURED]
- Armed at depth 1, 10:11:15Z: **0**. Armed at depth 1, 10:15:15Z: **1**
  (`pr-comms-hub-inbox-ready.md`) — confirmed by four independent instruments
  (`-Filter`, `-like`, `cmd dir /b`, regex). [MEASURED]
- That file is **untracked and gitignored** (`git check-ignore -v` → `.gitignore:75`), absent from
  `origin/main`, and its mtime is **2026-08-24T01:13:11Z** — an old mtime means it arrived by a
  **move/rename**, not a fresh write. [MEASURED]
- Its HOLD sibling `pr-comms-hub-inbox-HOLD.md` **is** tracked on `origin/main`. [MEASURED]
- Watcher log: `[2026-08-26T10:14:42.710Z] [queue] pr-comms-hub-inbox-ready.md (depth: 1, source:
  watch)` then `[2026-08-26T10:14:42.877Z] [start] … (max-turns=240)`. Still running at 10:17:58Z.
  [MEASURED]
- The same prompt already ran on 2026-08-20 and the watcher retired it:
  `[2026-08-20T09:17:08.888Z] [NO-PR] pr-comms-hub-inbox-ready.md  no-pr-opened/ (agent exited 0 but
  no PR number found)`. A copy still sits in `no-pr-opened/`. [MEASURED]
- Dev tree HEAD advanced `1f3a3747 → 5cda119b` inside the same 4-minute window. [MEASURED]

**Tracked-ready board trap — CLEAN**
- `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → 440 paths, 136 at depth 1,
  **0 tracked `*-ready.md` at depth 1**, 56 tracked `-HOLD.md`. Instrument returned non-empty, so
  the zero is a real zero and not the `ls-tree` no-`-r` lie. [MEASURED]

**Lint / released-gate defect — CURED**
- All 56 depth-1 `-HOLD.md` linted: **ADMIT(exit 0)=56, REJECT(exit 1)=0, other=0.** [MEASURED]
- Controls run because 56/56 green is exactly what a broken instrument prints:
  `gh` present (`C:\Program Files\GitHub CLI\gh.exe`, 2.90.0, authed as GH-Mantova); negative control
  1 = lint a breadcrumb → `REJECT [NO_FRONT_MATTER]` exit 1; negative control 2 = lint a nonexistent
  path → `MISSING` exit 1. The instrument can say no. [MEASURED]
- ⇒ **PR #1330 `feat/lint-gate-released` (MERGED) cured the released-`requires_on_main` permanent
  REJECT.** The 33-of-59 blast radius recorded on 2026-08-25 is discharged.
- ⚠️ ADMIT is still **necessary, not sufficient**: 10 of the 56 carry a body marker the linter cannot
  see — `pr-524-rates-b-slice2-canonical` (approvals gate + drops tables),
  `pr-rates-s11c-drop-legacy-tables` (same), `pr-retire-tenderclientnote-s2` (same),
  `pr-fv2-output-channels` (drops tables), `pr-lint-human-gate-blindness`, `pr-siteid-notnull-backfill`,
  `pr-tenant-mt4-s2-ownership-migration`, `pr-nav-jobs-projects-merge`,
  `pr-ops-m2b-tipping-tab-reminder`, `pr-vendor-invoice-ocr`. Control: 46 unmarked. [MEASURED]

**Orphaned worktrees**
- 4 orphans, each **exactly 1 commit** not in `origin/main`, **none of the 4 branches exists on the
  remote** (`git ls-remote --heads origin`). No `index.lock` anywhere (`LOCK_COUNT=0`), no worktree
  `locked` files. [MEASURED]
- Blob-identity test of each commit's files against `origin/main`:
  - `C:\po-worktrees\sot-readme-fetch` — `sot/README.md` **IDENTICAL-ON-MAIN** (shipped as #1299).
  - `C:\po-worktrees\sotk-03-ledger` — both files **IDENTICAL-ON-MAIN** (shipped as #1306).
  - `C:\po-wt-h` (`hygiene`) — 4 of 5 **IDENTICAL-ON-MAIN**; the 5th,
    `pr-sor-s9-register-to-progress-claim-HOLD.md`, is absent from main *because it now lives at*
    `docs/pr-prompts/superseded/pr-sor-s9-register-to-progress-claim-HOLD.md` on main, and was split
    into `pr-sor-s9a-register-api-HOLD.md` / `pr-sor-s9b-register-ui-HOLD.md`. Fully superseded.
  - `C:\po-worktrees\sot-d-register` — `sot/05-decisions-and-lessons.md` **DIFFERS** from main.
    PR #1287 (`docs/sot-05-d-register`) is MERGED and main is 383 bytes LARGER, so the content
    almost certainly shipped and main has moved on — but my D-number regex returned 0 on BOTH files,
    i.e. the probe failed. **[CANNOT MEASURE]** whether every D-entry shipped. Do not prune this one
    on my say-so.
- ⇒ Three of the four "do not prune, they hold unpushed work" worktrees hold work that **has already
  shipped under a different branch name**. The standing do-not-prune rule is over-broad.

**Remote branches**
- 19 remote heads. My first test (`git merge-base --is-ancestor <tip> origin/main`) said
  `MERGED_NOT_DELETED=0` — **that reading is a lie**: this repo squash-merges, so a merged branch tip
  is never an ancestor of main. Re-tested by PR state across 400 PRs (control: `total_prs_parsed=400`):
  **9 SETTLED→DELETABLE** (`docs/retire-stale-queue` #1145 MERGED; `docs/bid-prioritisation-plan-slice0`
  #1062, `docs/ratehub-sor-integration-plan` #1051, `feat/align-page-titles-to-nav` #1024,
  `feat/bp-slice0-plan` #1063, `feat/crm-2-relationship-intelligence` #1116,
  `feat/humane-api-errors-slice-3-field-dockets` #1250, `fix/directory-remove-workers-tab-flicker` #973,
  `worktree-agent-a65117552a3ddc9fa` #978 — all CLOSED or MERGED), **9 NO-PR-EVER**, **0 with an open
  PR**. [MEASURED]

**Watcher clone**
- Parked on `feat/lint-gate-released` @ `379a0e56` — a branch whose PR (#1330) is **MERGED**. Its own
  `origin/main` ref is stale at `17db9670` while the dev tree has `5cda119b`. [MEASURED]
- Behavioural drift check: `scripts/pr-watcher/index.mjs` blob is **identical** at clone HEAD and at
  the clone's `origin/main` (`0c25e6bd…`), so no watcher-behaviour drift right now — the visible
  `lint-prompt.mjs` +148/−35 delta is an artefact of the stale ref, not a real divergence. [MEASURED]
- Working tree carries **34 uncommitted deletions, all under `docs/pr-reviews/`**. [MEASURED]
- Stashes: clone **39**, dev tree **11**. Newest clone stash is
  `watcher-preflight-autostash … 2026-08-24T15:35:04+10:00` — **no growth in ~2 days**, consistent
  with the watcher process not having been relaunched since then. [MEASURED]

**Queue root**
- 142 files at depth 1: 72 breadcrumbs, 56 HOLD, 4 bare `pr-*`, 1 ready, 9 other. Untracked at depth 1:
  2 breadcrumbs (00-00 supervisor 0808, 00-06 pr-master 0657), 2 HOLDs
  (`pr-hygiene-gitignore-no-pr-opened-HOLD.md`, `pr-watcher-idle-tick-liveness-HOLD.md`),
  `queue-watch-state.md`, and two `.queue-sync-ledger` files. [MEASURED]

**Two instruments that lied to me this run** (recorded so the next run does not repeat them)
- `Out-File -Encoding utf8` under PS 5.1 writes a **BOM**, and `JSON.parse` dies on it. The cure is
  `.replace(/^\uFEFF/,'')` in node — `Out-File -Encoding utf8` alone is NOT enough. [MEASURED: two
  `SyntaxError: Unexpected token '﻿'`]
- `.queue-state.json`'s `ts` **freezes for the duration of a running job** (10:13:04.979Z held while
  the 10:14:42Z job ran). A "gap > 300 s" freeze probe will therefore call a *busy* watcher frozen.
  Cross it against the log. [MEASURED]

## WHAT CHANGED

Nothing on the board. I armed, disarmed, merged, moved, renamed and deleted nothing. Writes this run:
this breadcrumb, `docs/pipeline/sweep-rotation.json` (via `next-sweep.mjs --advance`), and scratch
`.ps1`/`.json` under `C:\po-sup-fix-scripts\`. Both repo writes are left **uncommitted** for Station 00
to sweep up — `next-sweep.mjs` reads the working tree, so the rotation has advanced regardless.

## FINDINGS

### F1 — 🔴 A RETIRED PROMPT RE-ARMED ITSELF AND IS RUNNING UNATTENDED RIGHT NOW

`pr-comms-hub-inbox-ready.md` was absent from depth 1 at 10:11:15Z and present at 10:15:15Z; the
watcher queued and started it at 10:14:42Z with `max-turns=240`. Its mtime (2026-08-24T01:13:11Z) is
older than its appearance, so it was **moved**, not written. It is untracked and gitignored, so no
`git` operation can have restored it — and the dev tree HEAD advanced `1f3a3747 → 5cda119b` in the
same window, i.e. another actor was working the tree. **This exact prompt already executed on
2026-08-20 and the watcher retired it to `no-pr-opened/`** after the agent exited 0 without opening a
PR; that copy is still on disk. So a completed-and-retired prompt is now consuming a full 240-turn
agent run that no station decided to arm, on a board that was deliberately held at ONE arm at a time.

I cannot name the mover — I am one of at least two actors on this tree and the move left no log line
of its own. What I can say is that the shape matches the standing board trap exactly (a checkout /
`stash pop` / `clean` / folder-restore resurrecting a dead prompt), and that `escalates: true` would
not have stopped it: DOCTRINE §5b, a loose armed `*-ready.md` **will** run.

RULE 1 options for Marco, complete-and-additive first:

1. **Make retirement structural, not positional.** When the watcher retires a prompt (`[NO-PR]`,
   `[ok]`, `[PAUSE]`), have it also append the prompt's basename to a tracked
   `docs/pr-prompts/RETIRED.txt`, and have the queue scanner refuse to start any prompt whose
   basename is listed unless the entry is explicitly cleared. Complete: a resurrection by any
   mechanism — checkout, move, stash, human — is caught at the point of execution rather than at the
   point of arming. Additive: it adds a refusal path and a tracked ledger; it deletes nothing and
   touches no existing prompt or data.
2. Make the watcher refuse any depth-1 `*-ready.md` whose mtime predates the current tick by more
   than N minutes. Fails the *complete* half — it catches moves but not a fresh re-write, and it
   would block a legitimately staged prompt that sat briefly.
3. Bulk-delete the `no-pr-opened/` pile so there is nothing left to resurrect. Fails the
   *without-damaging* half outright — those 107 files are the only record of what was attempted, and
   deletion is irreversible.

**DISPOSITION: ESCALATED** — Marco. Two questions: (a) do you want the run that started at 10:14:42Z
killed, or left to finish and be judged on its PR? (b) option 1 above — shall I have 06 write it?
I did not stop the run myself: killing a live agent is not in Station 04's authority and the job may
be Marco's own.

### F2 — 🟢 THE RELEASED-GATE PERMANENT LINT REJECT IS CURED

56/56 depth-1 HOLDs now ADMIT, with two working negative controls and `gh` verified present. The
2026-08-25 finding (a released `requires_on_main` / `requires_file_on_main` gate is a permanent
REJECT, blast radius 33 of 59) is discharged by PR #1330. Station 00's arming pipeline is unblocked.
Caveat that must travel with this: **10 of the 56 carry a body marker the linter cannot see**, four of
them drop database tables. Enumerated under WHAT I MEASURED.

**DISPOSITION: ACTIONED** — verified by measurement with controls; nothing to fix. Carried to 00 so
the "gate release is a lint reject" entry can be retired from project memory rather than re-measured.

### F3 — 🟠 THREE OF THE FOUR "DO NOT PRUNE" ORPHAN WORKTREES HOLD ALREADY-SHIPPED WORK

`sot-readme-fetch` (#1299), `sotk-03-ledger` (#1306) and `po-wt-h` are byte-identical to `origin/main`
on every file their one unpushed commit touches (the one apparent exception in `po-wt-h` moved to
`superseded/` on main). Only `sot-d-register` is unresolved, and only because my probe failed. The
standing "each holds an UNPUSHED commit, do not prune" rule is true of the *branch* and false of the
*content*, and it has kept four worktrees alive for six days.

**DISPOSITION: DEFERRED** — real, not mine. Worktree removal is a board/machine mutation (Station 03
on 00's dispatch), and `sot-d-register` still needs the D-entry question answered before anyone prunes
all four as a set. It becomes urgent if an orphan worktree's lock ever freezes a station — today none
of them holds a lock (`LOCK_COUNT=0`).

### F4 — 🟠 NINE REMOTE BRANCHES ARE SETTLED AND DELETABLE; MY FIRST TEST FOR THEM WAS WRONG

`git merge-base --is-ancestor` cannot detect a squash-merged branch and reported 0 stale branches
against a truth of 9. The correct instrument is the PR state. 9 settled, 9 never had a PR, 0 open.

**DISPOSITION: ESCALATED** — branch deletion is irreversible (DOCTRINE §5.4) and no station may do it
unasked. Marco: shall I stage a prompt that deletes the 9 SETTLED ones only, leaving the 9
NO-PR-EVER branches alone until someone can say whether they carry unmerged work? The
complete-and-additive form is a prompt that first pushes each NO-PR-EVER branch's tip to a dated
`archive/` ref and only then deletes the 9 settled ones — nothing becomes unrecoverable.

### F5 — 🟡 THE WATCHER WRITES TODAY'S LOG INTO `logs/2026-08-24.log`

Today's lines — including the 10:14:42Z start of the resurrected prompt — are being appended to a file
named `2026-08-24.log`. The daily filename is evidently computed once at process start, so a
long-lived watcher never rotates. This is the direct cause of a recurring investigative error: "sort
the log directory by mtime and read the newest file" lands on a file whose *name* says two days ago,
and a grep scoped by date-name silently misses everything.

**DISPOSITION: DISPATCHED** — to Station 06, to design a prompt that computes the log path per write
rather than per process. I am not staging it myself: 06 owns prompt authoring and my staged-prompt
budget is better spent nowhere this run than on a second-order fix while F1 is live.

### F6 — 🟡 THE WATCHER CLONE IS PARKED ON A MERGED FEATURE BRANCH WITH A STALE `origin/main`

Clone HEAD is `feat/lint-gate-released` @ `379a0e56` (PR #1330, MERGED); clone `origin/main` is
`17db9670` against a real `5cda119b`; 34 uncommitted `docs/pr-reviews/` deletions in the tree. No
behavioural drift today — `index.mjs` is blob-identical to the clone's own main — but the clone is the
tree the watcher executes from, and "a restart adopts nothing" means the next relaunch inherits
whatever it is sitting on.

**DISPOSITION: DISPATCHED** — to Station 03 (machine-minder), on 00's dispatch: fetch, return the clone
to `main`, fast-forward, and report the 34 deletions rather than committing them. Not mine to run —
clone repair is explicitly Station 03's, and DOCTRINE §4 forbids me git-mutating a shared tree.

### F7 — 🟢 STASH GROWTH HAS STOPPED; THE CLOSED LOOP IS QUIET

Clone 39 stashes, dev tree 11. Newest clone stash 2026-08-24T15:35 local. The preflight autostash
loop only fires on watcher start, so a flat count is evidence the process has not been relaunched in
two days — which independently corroborates the "watcher LIVE, no restart" reading.

**DISPOSITION: DEFERRED** — 39 stashes cost nothing and `git stash drop` is the only safe verb
(never `pop`). It becomes urgent if the count starts climbing again, which would mean a restart loop.

## WHAT I DID NOT DO

- **Did not touch the running prompt.** No kill, no move, no rename, no disarm. Station 04 is
  read-only on the board and a live agent may be doing Marco's own work.
- **Did not prune any worktree or delete any branch** — irreversible, and F3/F4 are escalations, not
  actions.
- **Did not repair the watcher clone** — Station 03's lane, and git-mutating a shared tree is the
  LL-38 incident.
- **Did not stage any prompt.** Budget is 2; I spent 0 deliberately. F1 is a live event that needs
  Marco's answer before anyone writes a guard, and F5's fix belongs to 06.
- **Did not commit the breadcrumb or the rotation file** — left untracked for Station 00 to sweep, per
  the report contract.
- **Did not resolve the `sot-d-register` D-entry question** — my regex probe returned 0 on both sides,
  which is an instrument failure, and I will not dress an inference as a measurement.
- **Ran only the repo-hygiene sweep.** Gate liveness, instrument honesty and instruction drift were
  covered by the 02:10Z run and are next in rotation; a shallow pass over all four is why findings rot.
