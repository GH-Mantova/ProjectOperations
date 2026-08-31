# Station 04 - Scanner | 2026-08-31T02:10:32Z-2026-08-31T02:5xZ

## GROUND

```
UTC            2026-08-31T02:10:32Z
origin/main    c1244317            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ c1244317     C:\ProjectOperations2   (rev-list --left-right --count = 0 0)
doc version    1                   (station_doc_version, docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. Full authority run.

**END STATE, re-measured 2026-08-31T02:19:43Z:** `origin/main` **moved to 63b80368** mid-run - PR
**#1418** ("stage 06's two clusters before a watcher restart stashes them out of the queue", 17
files) merged while this sweep was running. The dev tree is now **1 behind** (`rev-list
--left-right --count origin/main...HEAD` = `1 0`) and needs a fast-forward. Every measurement below
was taken at c1244317 and is stamped as such; FINDING 2 and FINDING 8 record what #1418 changed
about it. `docs/pipeline/DOCTRINE.md`, `STATION-CAPABILITIES.md` and `stations/04-scanner.md` are
untouched by 63b80368, and `scripts/pipeline/status-sweep.ps1` is untouched by it, so nothing else
in this report is invalidated.

Sweep this run: **repo-hygiene** (`node scripts/pipeline/next-sweep.mjs` -> rotation position 3 of 4;
previous run 2026-08-30T22:10:19Z). Advanced with
`--advance --utc 2026-08-31T02:10:32Z` -> `last_index=2`; `docs/pipeline/sweep-rotation.json` is
modified and uncommitted, for 00 to commit with this breadcrumb.

The three binding documents were read from the working copy, which is legitimate ONLY because the
working copy is proven identical to `origin/main` for those paths this run:
`git rev-list --left-right --count origin/main...HEAD` = `0 0`, `git status --porcelain docs/pipeline/`
= empty, and `git diff --stat origin/main -- <the three paths>` = empty. [MEASURED]

`status-sweep.ps1` at 02:10:59Z: **SAFE TO ACT** - 0 in-progress prompts, 0 git processes, no
index.lock in either tree, no PR touched in the last 2 minutes, both instrument positive controls
green (`gh` reached GitHub, `node` runs). Armed prompts: 0.

## WHAT I MEASURED

All readings at `origin/main` c1244317 unless stated.

**Worktrees, two instruments over one population.** [MEASURED]
`git worktree list` in the dev tree returned ONE line (`C:/ProjectOperations2 c1244317 [main]`); the
same in the watcher clone returned one line. `.git/worktrees` is EMPTY in both trees. status-sweep
duly printed `[LIVE] orphaned worktrees: none`.
`Get-ChildItem C:\po-worktrees,C:\po-watcher-worktrees -Directory` returned **three** directories:

| path | files | bytes | last write | `.git` contents |
|---|---|---|---|---|
| `C:\po-worktrees\fix-followup-notes` | 0 | 0 | 2026-08-17 | absent |
| `C:\po-worktrees\po-scan-1787002207` | 2295 | 27,283,317 | 2026-08-18 | `gitdir: /sessions/funny-blissful-archimedes/mnt/ProjectOperations2/.git/worktrees/po-scan-1787002207` |
| `C:\po-worktrees\scan-1787220682` | 2458 | 28,965,402 | 2026-08-20 | `gitdir: /sessions/peaceful-gracious-knuth/mnt/ProjectOperations2/.git/worktrees/scan-1787220682` |

`Get-ChildItem C:\po-worktrees -Recurse -Filter index.lock` returned **nothing** - no locks. Total
56.2 MB. See FINDING 1.

**Board trap - tracked `*-ready.md` at depth 1: ZERO.** [MEASURED] `git ls-tree -r --name-only
origin/main -- docs/pr-prompts/` -> 574 tracked recursive (control), 72 at depth 1 (control), of
which 62 are `-HOLD.md` (control) and **0** are `-ready.md`. Per DOCTRINE 9.2 the query carries a
trailing slash and `-r`, and no glob is used in the pathspec. CLEAN.

**Index state - the consumed-prompt `R100` trap: NOT PRESENT.** [MEASURED]
`git diff --cached --name-status` is **empty** (index clean). Four consumed prompts show as
unstaged ` D` deletions, which is the safe state and free to commit:
`pr-crm-s4-no-history-proposal-HOLD.md`, `pr-crm-s4-review-and-link-preview-HOLD.md`,
`pr-crm-s5-accounts-crud-wiring-HOLD.md`, `pr-lint-frontmatter-block-scalar-collapse-HOLD.md`.
`git --version` = 2.55.0.windows.3, so this is a real reading, not a broken-git `[CANNOT MEASURE]`.

**HOLDs whose work has already shipped: ZERO.** [MEASURED] `triage-holds.ps1` exit 0:
`spent=0 gates-satisfied=32 still-gated=33 unreadable=0 of 65`, and it printed
`SPENT was additionally proved reachable by the fixture control` - i.e. the #1413 positive control
fired, so `spent=0` is an answer rather than an empty query.

**Remote branches.** [MEASURED] Asked the remote, not the cache: `git ls-remote --heads origin` =
**23** heads (control: `main` present). Local `git branch -r` = **37** - a 14-ref overcount, exactly
the DOCTRINE 9.2 cache lie. Cross-control: zero heads on the remote are missing from the cache.
Cross-referenced against `gh pr list --state all --limit 3000 --json ...` = **1417 rows**, and the
newest PR is #1417, so the list is complete rather than truncated (controls: OPEN count = 1,
matching status-sweep; #1417 headRef = `feat/crm-s4-no-history-basis`). Of the 22 non-main heads:
**1 OPEN** (#1417), **1 MERGED and undeleted** (`docs/retire-stale-queue`, #1145), **20 CLOSED
unmerged**. See FINDING 4.

**Watcher clone.** [MEASURED] dirty = **39**: 37 tracked deletions, all in `docs/pr-reviews/`
(grouped by parent dir - a single cause, not 37); 1 ` M docs/data-model/metadata-catalog.json`;
1 `?? docs/pr-reviews/pr-1417-review.md`. Stash entries: clone **54**, dev tree **11**.

**Queue root.** [MEASURED] 84 files at depth 1 on disk: 65 `-HOLD.md`, **0** `-ready.md`,
5 breadcrumbs, 14 other. `git ls-files --others --exclude-standard -- docs/pr-prompts/` returns
**13 untracked-not-ignored** files. `git ls-files --others --ignored --exclude-standard` over the
same path: `processed` 3599, `needs-marco` 227, `no-pr-opened` 107, `archive` 64, `failed` 41,
`paused` 20, `blocked` 16, `superseded` 12, plus 4 loose `*-ready.md.log`.
`processed/` alone: 3600 files, 6.6 MB, oldest 2026-05-29, newest 2026-08-31T12:07 local.

**Litter classification control.** [MEASURED] The four loose `pr-*-ready.md.log` files in the queue
root are gitignored at `.gitignore:26 (*.log)` - `git check-ignore -v` on the file returns that
line, and the known-ignored control (`docs/pr-prompts/processed/x.md` -> `.gitignore:76`) fires. They
also do not match the watcher's `*-ready.md` glob (`Get-ChildItem -Filter '*-ready.md'` = 0), so they
arm nothing. Harmless, ~3 KB total.

## WHAT CHANGED

Three writes, all of them files, none of them a board mutation. Nothing armed, renamed, moved or
deleted; no `git` write of any kind; no commit.

1. **Staged** `docs/pr-prompts/pr-statussweep-orphan-worktree-dirs-HOLD.md` (new, untracked).
   Read back: `lint-prompt.mjs` -> `ADMIT (size 1)` exit 0, with a working negative control on the
   same run (`pr-dns-s5-checker-flip-to-fail-HOLD.md` -> `REJECT [HUMAN_GATE_PRESENT]` exit 1), and
   `git --version` resolves, so the ADMIT is not a DOCTRINE 9.5 skipped-gate. Premise verified alive
   by hand: needle `orphanWorktreeDirs` occurs **0** times in `status-sweep.ps1`, positive control
   `orphaned worktrees` occurs **3** times.
2. **Advanced** `docs/pipeline/sweep-rotation.json` (`last_index=2`,
   `last_run_utc=2026-08-31T02:10:32Z`). Read back: `git status --porcelain` shows
   ` M docs/pipeline/sweep-rotation.json`.
3. **Wrote** this breadcrumb.

All three are untracked or unstaged in the dev tree and need Station 00 to commit them.

## FINDINGS

### FINDING 1 - `status-sweep.ps1` reports "orphaned worktrees: none" while 56 MB of abandoned worktrees sit on disk

`status-sweep.ps1:117` builds its orphan list from `git worktree list` alone. That command
enumerates `.git/worktrees/` admin entries, not directories. A worktree whose admin entry is gone -
pruned, or created from a sandbox VM whose `.git/worktrees/<name>` never existed on this
filesystem - is invisible to it. Two of the three trees found this run carry a `.git` file pointing
at `/sessions/<vm-id>/mnt/...`, a Linux path that cannot resolve here and never will. They have sat
for 11 and 13 days while every sweep in that window printed a clean line.

This is DOCTRINE section 7's shape exactly: the system is fine, the instrument is blind, and the
blindness renders as a green result. It is also the specific litter the 04 station doc names -
*"that is how `/tmp/po-scan-*` trees are orphaned, and an orphan's lock has no process by
construction, forever."* No locks are present today, which is luck, not design.

Fix staged as `pr-statussweep-orphan-worktree-dirs-HOLD.md` (ADMIT, size 1): keep the existing
`git worktree list` check untouched and ADD an independent disk-side scan of `C:\po-worktrees` and
`C:\po-watcher-worktrees`, reporting REGISTERED vs ABANDONED. Report-only; it removes nothing.
RULE 1: complete-and-additive on both halves - it closes the blindness permanently for any future
abandoned tree, and it adds a line rather than changing one, so nothing that reads this report
breaks.

**DISPATCHED** -> Station 00: commit the prompt (it is untracked and therefore not a queue entry per
PROMPT-SCHEMA), then arm it under RULE 4 when the one-at-a-time slot is free. Removing the three
directories is a separate decision and is NOT part of the prompt - see FINDING 4's reasoning.

### FINDING 2 - 13 untracked-not-ignored files at the queue root, 8 of them Station 06's 01:37Z output

`git ls-files --others --exclude-standard -- docs/pr-prompts/` returns 13. Seven are `-HOLD.md`
prompts (`pr-estpricing-s1..s4`, `pr-scopesub-s1..s3`) and one is a breadcrumb
(`00-06-pr-master-2026-08-31-0137-scope-sub-and-charging-methods.md`) - Station 06's staging run,
uncommitted. The remaining five are `.arming-log.txt`, `.queue-sync-ledger.txt`,
`.queue-sync-ledger.txt.bak-2026-08-18`, `queue-watch-state.md`, and
`superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`.

Per PROMPT-SCHEMA those seven prompts are **not staged** - they are a TODO on one disk. `triage-holds`
already lints them (65 on disk vs 62 tracked), which makes them look queued in a report while being
invisible to any station reading `origin/main`. The untracked-breadcrumb backlog was measured at ZERO
at 2026-08-30T22:1xZ, so this is new work from 01:37Z, not a regression.

**ACTIONED by another actor, mid-run.** At 02:19:43Z, re-measured: **PR #1418 landed all eight** -
the seven `-HOLD.md` prompts and 06's breadcrumb are on `origin/main` at 63b80368, and the four
older breadcrumbs were archived into `docs/pr-prompts/archive/` in the same commit. Nothing for 00
to sweep here. This finding is recorded as measured-then-overtaken rather than deleted, because the
02:10Z reading was true when taken and the way it stopped being true is FINDING 8.

**DISPATCHED** -> Station 00, on what is left: the dev tree is **1 behind** `origin/main` and must be
fast-forwarded, or those eight files stay untracked in the tree the watcher globs. Then commit my
three: `pr-statussweep-orphan-worktree-dirs-HOLD.md`, this breadcrumb, and the modified
`docs/pipeline/sweep-rotation.json`.

### FINDING 3 - the verdict-archive loop is GROWING: 35 -> 37 tracked deletions, stash 54

Station 03 root-caused this on 2026-08-25 (F1/F2) at **35** tracked deletions in
`C:\po-watcher\ProjectOperations`. The 2026-08-30T22:0xZ supervisor run recorded **37**. This run
measures **37 tracked deletions** and total dirty **39** (the extra two being the known
`metadata-catalog.json` line-ending modification and an untracked `pr-1417-review.md`). Stash count
is **54**, unchanged from the 2026-08-30 reading.

The clone's `dirty=NN` line is described in project memory as a "permanent amber". It is not
permanent - it is monotonic, and the number is the thing to watch. Every increment is one more
tracked file the pre-flight autostash will restore and the next startup sweep will move out again.

No new diagnosis is needed and no new prompt: the fix is already staged as
`pr-watcher-verdict-sweep-skips-tracked-HOLD.md` (03's F2 dispatch, tracked on `origin/main`, merged
as prompt in #1410), and it is already named as the next arm.

**DEFERRED** - real, and already owned. It becomes urgent if the deletion count crosses 45 or the
stash count crosses 60 before that prompt is armed, because the autostash pile is the mechanism that
would make a watcher start refuse.

### FINDING 4 - 21 settled branches still on the remote; 20 of them are CLOSED and UNMERGED

`git ls-remote --heads origin` returns 23 heads. One is `main`, one is #1417's open branch. The
other 21 belong to settled PRs: **`docs/retire-stale-queue` (#1145, MERGED)** and twenty CLOSED,
never-merged branches - `feat/sso-silent-autologin` (#396), `docs/backlog-stage-role-dash-site-picker-39c855`
(#599), `docs/scan-2026-07-16-mail-mi-stage` (#606), `docs/stage-role-default-dashboards-slice1`
(#605), `docs/ui-acceptance-chain` (#632), `feat/density-ratetable-migration` (#703),
`fix/tenders-settings-visual-consistency` (#730), `fix/public-form-api-origin` (#833),
`fix/user-dashboards-p2002-race` (#804), `fix/directory-remove-workers-tab-flicker` (#973),
`worktree-agent-a65117552a3ddc9fa` (#978), `feat/align-page-titles-to-nav` (#1024),
`docs/ratehub-sor-integration-plan` (#1051), `docs/bid-prioritisation-plan-slice0` (#1062),
`feat/bp-slice0-plan` (#1063), `feat/crm-2-relationship-intelligence` (#1116),
`feat/humane-api-errors-slice-3-field-dockets` (#1250), `feat/rates-consumers-slice-3-persona-export`
(#1337), `feat/doctrine-section-9-four-measured-false-traps` (#1346),
`worktree-agent-a7f9daeaeb399bdbb` (#1359).

The MERGED one is safe to delete - its content is on `main`. The twenty CLOSED ones are **not**:
a closed-unmerged branch is the only surviving copy of that work, and deleting it is irreversible
(DOCTRINE 5.4). Separately, the local remote-tracking cache holds **14 refs the remote no longer
has**, curable with `git fetch --prune`, which touches nothing on the remote.

RULE 1, complete-and-additive FIRST:

- **(A) Prune the local cache now (`git fetch --prune` in both trees), and leave every remote branch
  alone.** Passes both halves: it removes the measured instrument lie permanently (`branch -r`
  overcounting 37 vs 23) and destroys no data anywhere. Does not reduce the remote's branch list -
  but nothing has shown that list to be a cost.
- **(B) (A), plus delete the single MERGED branch `docs/retire-stale-queue`.** Solves completely and
  damages nothing, since #1145's content is on `main`. Fails neither half; it is simply a smaller
  claim than (A) about what the problem is.
- **(C) Bulk-delete all 21 settled branches.** Fails the second half outright: twenty of them are
  unmerged work with no other copy.

**ESCALATED** -> Marco. Question: may Station 00 run (A) and (B) as standing hygiene, and should the
twenty CLOSED branches be kept indefinitely or given a retention rule? Deleting them is irreversible
and therefore not an agent's call. No agent bulk-deletes.

### FINDING 5 - the three abandoned worktree directories themselves

Distinct from FINDING 1, which is about the instrument. The directories are 56.2 MB, hold no locks,
and two are unreachable git worktrees whose admin entries no longer exist, so `git worktree prune`
will not touch them - only a filesystem removal would. They contain no committed-only work by
construction (they were checkouts), but proving a given tree carries no uncommitted edit needs a git
read against a `.git` pointer that does not resolve on this host, so I cannot prove it and will not
assert it. `[CANNOT MEASURE]` on "these contain nothing of value".

**ESCALATED** -> Marco, folded into FINDING 4's question. Removing them is a filesystem deletion of
something an agent cannot verify is empty of work; the station doc's own rule is that no agent bulk-
deletes. FINDING 1's prompt deliberately only makes them VISIBLE.

### FINDING 6 - `processed/` holds 3600 files and 6.6 MB, three months deep

Oldest `pr-16-restore-save-cancel-buttons-ready.md.log` from 2026-05-29, newest `rev-1417-ready.md.log`
from today. Every file is gitignored (`.gitignore:76`), so this costs no CI time, no clone size and
no PR noise - it costs local disk and it slows every recursive scan over `docs/pr-prompts`. It is
also the pipeline's only record of what actually ran, which is an argument against deleting it
rather than for.

**DEFERRED** - not now. It becomes worth acting on when a station reports a timeout or a
multi-second stall on a `docs/pr-prompts` recursive walk, or when the folder crosses ~50 MB. The
complete-and-additive answer at that point is a dated roll-up archive, not a deletion.

### FINDING 7 - small queue-root litter, all of it inert, reported so it is not re-discovered

Four `pr-*-ready.md.log` files loose in the queue root (~3 KB, 26-29 August): gitignored at
`.gitignore:26` and non-matching against the watcher's `*-ready.md` glob, so they arm nothing.
`.queue-sync-ledger.txt.bak-2026-08-18` is a 13-day-old backup. `superseded/` holds one untracked
file (`pr-doctrine-s9-four-false-traps-LOOPING.md`, 9056 bytes, 2026-08-27), and `archive/` holds 64
ignored ones. One tracked HOLD, `pr-rates-column-edit-ui-HOLD.md`, carries an uncommitted `+5/-1`
edit in the shared dev tree that is not mine.

**DEFERRED** - none of it can arm anything or fail a gate. Recorded so the next repo-hygiene rotation
recognises it as known rather than paying to re-measure it. The one item worth a decision is the
uncommitted edit to `pr-rates-column-edit-ui-HOLD.md`: it belongs to whichever actor made it, and
per the shared-index rule I left it alone and did not stage or commit it.

### FINDING 8 - the ground SHA expired mid-run and silently INVERTED a tracked/untracked reading

Worth recording as a method finding, because it very nearly went into this report as six confident
wrong lines, and the shape is one DOCTRINE 7.1 already names.

At 02:1xZ, `check-breadcrumb.mjs` printed `NOTE ... is UNTRACKED` against four breadcrumbs and
printed **no** such note against `00-06-pr-master-...`. Ten minutes earlier my own
`git ls-files --others --exclude-standard` had said the exact opposite: those four were tracked and
`00-06` was the only untracked one. Two instruments, one population, flatly contradictory.

The cause was not either instrument. `origin/main` had **moved** - from c1244317 to 63b80368 - while
the run was in progress, because PR #1418 merged at ~02:1xZ, archiving the four breadcrumbs into
`docs/pr-prompts/archive/` and committing `00-06`'s at depth 1. Both readings were correct at the
moment they were taken, against different trees. `git rev-parse HEAD` still said c1244317, so the
GROUND stamp at the top of this report looked current and was already 1 commit stale.

Three things made it findable rather than publishable:

1. The disagreement was noticed instead of averaged. A `ls-tree HEAD` / `ls-tree origin/main` pair
   over the SAME path returned one line and zero lines respectively - impossible for one tree, which
   is what proved the refs had diverged.
2. The controls were run first. `PROMPT-SCHEMA.md` -> tracked/on-main True/True and a nonexistent
   path -> False/False, so the probe itself was exonerated before the data was believed.
3. `git rev-parse origin/main` was asked directly rather than assumed from the opening stamp.

The standing lesson, and the reason this is written down: **`[LIVE]` means "true when measured"
applies to your own GROUND line too.** A station that stamps `origin/main <SHA>` at minute 0 and
reports at minute 45 has been quoting an expired verdict for 45 minutes. Re-stamp `origin/main` at
the END of the run and say whether it moved; a run on a 4-hour cadence can easily straddle two or
three merges.

**DEFERRED** - a real defect in station practice, not in a script, so there is nothing to arm. It
becomes worth a prompt if a second run reports a tracked/untracked claim that a later reader finds
inverted. The cheap partial cure is available now and costs nothing: every station adds an END STATE
line re-reading `origin/main`, as this report does above.

## WHAT I DID NOT DO

- **Did not delete, prune, move or remove anything** - not the three abandoned worktree directories,
  not a remote branch, not a stash, not a `processed/` file, not the loose `.log` files. The sweep
  brief says report-only and no agent bulk-deletes; FINDINGS 4 and 5 are escalations for exactly
  that reason.
- **Did not arm, disarm, rename or move any prompt.** Armed count was **0** at 02:10:59Z and is
  **1** at 02:21:00Z - but the one file is `rev-1419-ready.md`, written by the watcher at 02:18:05Z.
  Per DOCTRINE 9.5 `rev-<n>-ready.md` are auto-generated REVIEW JOBS, not prompts; they carry no
  front matter by design and must not be counted as a prompt arm. **No prompt is armed.** Arming is
  00's, on Marco's authority, and I did not touch it.
- **Did not commit anything.** The dev-tree index is shared; it was clean when I arrived
  (`git diff --cached --name-status` empty) and I left it clean. The four consumed-prompt ` D`
  deletions and the ` M metadata-catalog.json` are not mine to commit.
- **Did not run `git checkout` / `reset` / `stash pop` / `clean` anywhere**, and did not run `git`
  through the device bridge against the Windows `.git`.
- **Did not mint a throwaway worktree.** Everything was read from `origin/main` with `git show` /
  `git ls-tree` against the dev tree, which is at `origin/main` exactly.
- **Did not touch `/sot/`, `apps/**`, `prisma/**`, the watcher clone, or Azure / Entra / SharePoint.**
- **Did not run Part 0, Part 1 or the live-site visual pass.** The station contract says take ONE
  named sweep and cover it completely; `next-sweep.mjs` named repo-hygiene, and a shallow pass over
  everything is the failure mode that contract exists to stop.
- **Did not stage a second prompt** (budget is 2). FINDINGS 4 and 5 are Marco's call, FINDING 3
  already has a staged prompt owned by 03, and 6 and 7 do not justify burning an agent run.
