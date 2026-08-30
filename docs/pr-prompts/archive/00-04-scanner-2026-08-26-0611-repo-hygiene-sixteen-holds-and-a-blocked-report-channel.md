# Station 04 — Scanner | 2026-08-26T06:10:42Z–2026-08-26T06:32Z

## GROUND

```
UTC            2026-08-26T06:10:42Z
origin/main    8f0377e5            (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 8f0377e5     C:\ProjectOperations2   (0 behind, index clean, no index.lock)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — this run was not forced read-only by a version mismatch. It is read-only because
Station 04 always is.

**Sweep this run: `repo-hygiene`** — chosen by `node scripts/pipeline/next-sweep.mjs`
(rotation position 3 of 4; previous run 2026-08-26T02:10:18Z). Not chosen by me.

**Desktop Commander was PRESENT.** This was a sighted run. Every line below is from the Windows host.

## WHAT I MEASURED

### Preflight sweep
`scripts/pipeline/status-sweep.ps1` at 06:11:19Z — **[MEASURED]** verdict `SAFE TO ACT`, both
instrument positive controls passed (`gh` reached GitHub, `node` runs). 4 open PRs
(#1325, #1323, #1320, #1316). Armed = 0. In-progress prompts = 0. Git processes = 0. No `index.lock`
in interactive tree or clone, no `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD`/rebase-merge/
rebase-apply/sequencer anywhere.

🔴 **I did NOT adopt the sweep's `main branch CI ... (trunk green)` line.** That line is a known
coin-flip (`gh run list --branch main` serves an arbitrarily old page and is tagged `[LIVE]`). Trunk
colour is **[CANNOT MEASURE]** this run — I did not need it, so I did not spend a probe on it.

### H1 — the board trap, both halves
- **[MEASURED]** POSITIVE CONTROL first: `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
  returned **407** entries and found `pr-524-rates-b-slice2-canonical-HOLD.md`, a file known tracked.
  The instrument can produce a positive. (Without `-r` this returns ONE line — DOCTRINE §9.2.)
- **[MEASURED]** tracked `*-ready.md` anywhere under `docs/pr-prompts/`: **171**, every one at depth
  ≥2 under `superseded/` or `processed/`. Filtered to depth 1 (`-notmatch '^docs/pr-prompts/[^/]+/'`):
  **0**. **The `-ready` board trap is CLEAR.**
- **[MEASURED]** on-disk depth-1 `*-ready.md` in the dev tree: **0**. Armed = 0, both ends agree.
- 🔴 **[MEASURED] the HOLD half is NOT clear.** `git status --porcelain -- docs/pr-prompts/` shows
  **16 files in state ` D`** — tracked on `origin/main`, deleted from the working tree, deletion
  never staged or committed. CONTROL: all 16 confirmed present in
  `git ls-tree -r origin/main` (0 of 16 not tracked).

### H2 — the breadcrumb channel
- **[MEASURED]** breadcrumbs (`00-*.md`) on disk at queue root: **66**.
  Tracked on `origin/main`: **23**. **43 are not on main.**
- **[MEASURED] control pair, because "absent" has two very different causes:**
  - NEGATIVE CONTROL — `git check-ignore --no-index -v docs/pr-prompts/pr-zzz-ready.md`
    → exit **0**, `.gitignore:75`. The instrument detects ignoring.
  - SUBJECT — `git check-ignore --no-index -v docs/pr-prompts/00-04-scanner-2026-08-26-0210-…md`
    → exit **1**. **Breadcrumbs are NOT gitignored.**
- **[MEASURED]** they appear as `??` in `git status`. Full dev tree: 73 porcelain lines =
  56 `??` + 16 ` D` + 1 ` M`.
- **[MEASURED]** oldest uncommitted breadcrumb dates from the 2026-08-21 scanner run.
- **[MEASURED]** last breadcrumb to reach main: `019c7579`, 2026-08-25T16:13Z, carried incidentally
  by **#1324** (a sot PR) — not by a board PR that set out to sweep them.

### H3/H4/H5 — branches
- **[MEASURED] TRUTH** `git ls-remote --heads origin` → **23** heads (22 excluding `main`).
- **[MEASURED] THE LIE** `git branch -r` before a prune-fetch → **53**. After
  `git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune` → **24**, with **29 `[deleted]`**
  lines. The remote-tracking cache overstated the world by **30 branches**.
- **[MEASURED] my first merged-branch instrument was blind.** `git merge-base --is-ancestor <tip>
  origin/main` reported **0 of 22** merged. That is an artifact of **squash-merge**: the branch tip is
  never an ancestor of main, so this check can only ever return 0. It is a check that has never been
  seen to succeed — DOCTRINE §7 guard 1 — so I discarded it.
- **[MEASURED] honest instrument** — index all PRs by `headRefName` (`gh pr list --state all
  --limit 1000 --json …`, parsed in **node**, not `ConvertFrom-Json`, which collapses arrays).
  POSITIVE CONTROL: `feat/crm-backfill-accounts-script` → `#1319 MERGED`. Instrument works.
  Result over the 22 non-main heads: **OPEN 4** (#1325, #1323, #1316, #1320) ·
  **MERGED-not-deleted 1** (`docs/retire-stale-queue`, #1145, merged 2026-08-17) ·
  **CLOSED-not-deleted 17** (oldest `feat/sso-silent-autologin`, #396, closed **2026-06-15**) ·
  **NO_PR 0**.
- **[MEASURED]** local branches in the dev tree: **328**, of which **298** have `[gone]` upstreams
  and **22** have no upstream at all.
- **[MEASURED]** one stray remote-tracking ref outside `origin`: `refs/remotes/pr1273`, while
  `git remote -v` lists **only `origin`**. It is why `pr1273` appeared as a bare entry in
  `git branch -r` output.

### H6 — the watcher clone
- **[MEASURED]** `git -C C:\po-watcher\ProjectOperations stash list` → **39 stashes**.
  Top 4 are `watcher-preflight-autostash`, all dated **2026-08-24** (local AEST+10);
  the oldest reach back to `feat/sharepoint-folder-mappings`. Nothing has popped.
- **[MEASURED]** clone HEAD `b18caa34`, **4 commits behind** `origin/main`; dirty = **38**;
  **zero `.lock` files**; no merge/rebase state.

### H7 — orphaned worktrees (re-verifying a prior run's claim, per the re-read rule)
**[MEASURED]** all four still exist, all four are **CLEAN**, each holds **exactly 1 commit** ahead of
`origin/main`, and **none of their branches exists on `origin`** (`git ls-remote --heads origin <br>`
returned empty for all four). **Zero `.lock` files** in any of the four worktree gitdirs.

| worktree | branch | sha | files in the unpushed commit |
|---|---|---|---|
| `C:\po-worktrees\sot-d-register` | `docs/sot-05-d-register` | `407b93d2` | `sot/05-decisions-and-lessons.md` |
| `C:\po-worktrees\sot-readme-fetch` | `docs/sot-readme-fetch-plain1` | `904fa4e8` | `sot/README.md` |
| `C:\po-worktrees\sotk-03-ledger` | `docs/sot-03-merged-pr-ledger-2026-08-24` | `5db5a7c2` | `sot/03-progress-log.md` + one 05 breadcrumb |
| `C:\po-wt-h` | `hygiene` | `edef9f59` | 1 HOLD disarm + 3 retirements into `superseded/cleared-2026-08-20-verified-shipped/` |

`C:\po-wt-h` additionally carries one untracked scratch file, `.cm.txt`.

### H9 — queue-root litter
**[MEASURED]** 136 files at `docs/pr-prompts/` depth 1: 66 breadcrumbs · 57 HOLD · 9 other-md ·
4 non-md · 0 ready. The non-md four are `BACKLOG.yaml`, `ESCALATIONS.yaml`,
`.queue-sync-ledger.txt` and **`.queue-sync-ledger.txt.bak-2026-08-18`** (a stray backup).
The two suffix-less prompts **`pr-permission-role-reconciler.md`** and
**`pr-smoke-share-worker-tokens.md`** are still present, unchanged since 2026-08-17.

## WHAT CHANGED

**On the board: NOTHING.** Nothing armed, disarmed, renamed, moved, deleted, merged or labelled.
Station 04 is read-only on the board and this run stayed read-only.

Two mutations, both outside the board, both verified:

1. **`git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune`** in the dev tree. This writes
   only remote-tracking refs — no working tree, no index, no branch. Read back: `git branch -r`
   went **53 → 24** and `git ls-remote` still reports 23 heads, so the cache now matches the truth.
   The dev tree remained `main @ 8f0377e5`, 0 behind, index clean.
2. **Four scratch `.ps1`/`.mjs` probes** written to `C:\po-sup-fix-scripts\` (the sanctioned scratch
   folder). Nothing in the repo.

I did **not** run `next-sweep.mjs --advance` — see WHAT I DID NOT DO.

## FINDINGS

### F1 — 16 executed HOLD prompts are still tracked on `origin/main`; one `git checkout` re-arms them — **S2**

The `-ready.md` board trap is clear at depth 1 (0 tracked, 0 on disk). **The HOLD side is not.**
16 HOLD files are tracked on `origin/main` and deleted from the dev worktree with the deletion never
committed. 15 of the 16 are confirmed consumed — their `-ready.md` twin sits in
`docs/pr-prompts/processed/` (gitignored), i.e. the prompt has RUN:

`pr-apierr-s12-ci-gate` · `pr-arm-lock-s1-serialize-arming` · `pr-crm-account-backfill` ·
`pr-crm-direction-richer-surface-reconcile` · `pr-crm-leads-page-title` ·
`pr-crm-route-permission-guard` · `pr-crm-triage-archive-entry` · `pr-crm-wincount-s1-flag-and-guard` ·
`pr-crm-winrate-display` · `pr-ew-s2a-capacity-service` · `pr-lessons-folder-s1-restore` ·
`pr-nopr-s1-dismissed-means-proceed` · `pr-nopr-s2-hard-failure-bounded-restage` ·
`pr-pipeline-fold-s1-any-permission` · `pr-sot-04-bp0a-job-canonical-reconcile`

This is the arming lifecycle's missing final step. Arming is a `git mv` of a tracked `-HOLD.md`; the
watcher then retires the `-ready.md` into a gitignored folder — so the **deletion of the tracked HOLD
never reaches main**. The exposure is exactly the board trap in DOCTRINE §9.2: `git checkout .`,
`reset --hard`, `stash pop`, `git clean`, **or a fresh clone**, and 16 already-executed prompts
re-materialise as armable HOLDs. Several of them have already merged (win-rate display #1322,
account backfill #1319, win-count #1321); re-firing them would redo shipped work.

Note the 16 are not all equal: `pr-ew-s2a-capacity-service`, `pr-arm-lock-s1-serialize-arming` and
`pr-sot-04-bp0a-job-canonical-reconcile` map to PRs still OPEN (#1316, #1323, #1325). Committing
their deletion is still correct — the prompt has run and the PR is now the artifact — but 00 should
say so in the commit message rather than let a reader think open work was binned.

**16th file, different shape:** `pr-watchdog-heartbeat-during-merge-wait-HOLD.md` is tracked on main,
deleted from the dev tree, and has **no consumed copy in any gitignored folder** — but it is still
present at depth 1 in the CLONE (`C:\po-watcher\ProjectOperations\docs\pr-prompts\`, mtime
2026-08-24 05:24 local). That is a HOLD deleted from the dev tree with no execution record. It needs
a premise read before anyone commits its deletion; it may be live work someone removed by hand.

**DISPATCHED** — to Station 00. This is one pathspec commit (`git commit -- docs/pr-prompts/`) of 15
deletions, from a tree whose index it must check first (§9.2: the dev index is shared). The 16th is
held back pending a premise read. I am read-only on the board and correctly did not do it.

### F2 — the only reporting channel that closes is 43 reports deep and 5 days behind — **S2**

STATION-CAPABILITIES §7 names project memory as primary and breadcrumbs as the tracked channel
"✅ tracked on main as of #1300". **43 of 66 breadcrumbs on disk are not on main**, the oldest from
2026-08-21. The backlog includes **every Station 00 supervisor breadcrumb from 2026-08-25 and
2026-08-26** (16 of them), both machine-minder runs, seven scanner runs and the 06 handover.

The controls matter here, because "absent from main" has two causes with opposite fixes. It is **not**
gitignore: the negative control fired correctly on `*-ready.md` (exit 0, `.gitignore:75`) while a real
breadcrumb returned exit 1. They sit as plain `??`. So the report contract's path is right and the
**writing** step works; the **committing** step is what never happens. The last breadcrumb to reach
main did so as a passenger on #1324, a sot PR — incidental, not swept.

The consequence is precisely the failure the REPORT CONTRACT was written to prevent: "a report nobody
can find is a report that does not exist." Stations are dutifully writing findings to a tracked path
and 43 of them have never left the machine. A fresh Station 00 collecting "every breadcrumb since its
last run" from `origin/main` sees 23 files, the newest of which predates 16 supervisor runs.

**ESCALATED** — to Marco, because the fix is a policy call only he can make, and the two options fail
different halves of RULE 1.

> **Complete-and-additive (RULE 1: passes both halves).** Give the breadcrumb commit an owner in the
> contract — 00 commits the breadcrumb backlog as a docs-only pathspec commit at the end of every
> run, the same move it already makes for `sweep-rotation.json`. Additive: nothing is deleted, no
> existing prompt or data path changes, and it closes the channel permanently rather than draining it
> once. Costs 00 one commit per run.
>
> **Alternative A — drain it once now, by hand.** Fails the *future* half: the backlog rebuilds from
> zero the moment the next run writes a breadcrumb, and we are back here in five days.
>
> **Alternative B — stop treating breadcrumbs as the channel and rely on project memory alone.**
> Fails the *complete* half: memory is explicitly absent in device tasks
> (STATION-CAPABILITIES §2), so Station 03 would have no durable channel at all.

The question for Marco is narrow: **may Station 00 commit other stations' breadcrumbs on their
behalf as part of its collect step?** A prior 00 run declined precisely this and recorded "why 00
must not PR them" — so the two stations currently disagree about whose job it is, and that
disagreement is why 43 files are stuck.

### F3 — 18 settled remote branches were never deleted, the oldest 72 days old — **S3**

Of 22 non-main remote heads: 1 merged (`docs/retire-stale-queue`, #1145) and 17 closed, oldest
`feat/sso-silent-autologin` (#396, closed 2026-06-15). All 18 are safe delete candidates; the 4
attached to open PRs are not.

**DEFERRED** — real, not urgent. It becomes urgent when someone re-runs an ancestor-based merged-check
and is told "0 merged, all live" (see F5), or when a stale branch name is reused. Deleting remote
branches is a mutation on someone else's lane; a prompt should carry it, not a scanner.

### F4 — 328 local branches in the dev tree, 298 with deleted upstreams — **S3**

Plus one stray `refs/remotes/pr1273` under a remote that does not exist (`git remote -v` lists only
`origin`), which is why `pr1273` appears as a bare entry in `git branch -r` and got treated as a
branch by my own first-pass loop.

**DEFERRED** — cosmetic today. Worth noting that `git branch --merged` over 328 branches is exactly
the kind of query that produces a confident wrong answer under squash-merge, so the litter is not
purely cosmetic: it is a standing trap for the next agent who tries to reason about branch state.

### F5 — an ancestor-based "is this branch merged" check is structurally blind here — **S3, instrument**

`git merge-base --is-ancestor <tip> origin/main` reported **0 of 22** branches merged. The truth is 18
settled. The repo squash-merges, so a branch tip is **never** an ancestor of main and this check can
only ever return 0 — a check never seen to succeed, which DOCTRINE §7 guard 1 says to distrust before
believing its negative. The honest instrument is to index PRs by `headRefName` and read `state`, with
a positive control (`feat/crm-backfill-accounts-script → #1319 MERGED`) proving it can find one.

**ACTIONED** — caught in-run by running the guard, discarded before it reached a finding, and written
down here so the next run does not re-derive it. Candidate for DOCTRINE §9.2 if it recurs.

### F6 — the watcher clone's stash loop is at 39 and still closed — **S3**

39 stashes, top four `watcher-preflight-autostash` dated 2026-08-24. The launcher stashes on every
start and nothing ever pops (`stash drop`, never `pop`). No new autostash since 08-24, so the loop is
**not currently growing** — consistent with the clone not having been restarted since. Clone is 4
behind `origin/main`, dirty = 38, and — worth stating plainly — carries **zero locks** and no
merge/rebase state.

**DEFERRED** — no lock, no wedge, not blocking anything today. It becomes urgent if the count starts
moving again, which is the thing to watch rather than the absolute number.

### F7 — the four orphaned worktrees: prior "DO NOT PRUNE" verdict RE-VERIFIED and still standing — **S2**

Each of the four holds exactly one commit that exists **nowhere else** — not on `origin`, not on
`main`. Three of them are `/sot/` edits: the D1–D55 decision register, the `sot/README` fetch-URL
correction, and the sot/03 merged-PR ledger. The fourth is queue hygiene (a HOLD disarm plus three
retirements). All four trees are clean; none holds a lock. Pruning any of them **destroys unpushed
source-of-truth work.**

**ESCALATED** — and note this is now the second consecutive run to carry it forward unresolved, which
is itself the finding. Three of the four are `/sot/` commits and **only Station 05 may edit `/sot/`**,
so they cannot simply be adopted by 00. The decision is Marco's: push these three as a 05
doc-reconcile PR, or discard them as superseded. Until then the standing instruction stands —
**status-sweep will keep listing them as "investigate/prune" and the correct action is NOT prune.**

### F8 — queue-root litter — **S4**

`.queue-sync-ledger.txt.bak-2026-08-18` is a stray backup at the queue root. Two `-DISARMED-`/
`-RETIRED-` marker files sit at depth 1. And the two suffix-less prompts
`pr-permission-role-reconciler.md` and `pr-smoke-share-worker-tokens.md` are **still present and
unchanged since 2026-08-17** — they match neither the watcher's `*-ready.md` glob nor HOLD triage nor
the backlog, so they are armable work that is invisible to every instrument that looks for work.

**DEFERRED** — the two invisible prompts are the part that matters and they are already on record from
an earlier run; this run confirms they survived another 9 days. They become urgent the moment someone
believes the queue inventory is complete.

## WHAT I DID NOT DO

- **Armed, disarmed, renamed, moved or deleted nothing.** Read-only on the board is the whole lane.
- **Did not prune the four worktrees**, did not `git worktree prune`, and did not clear the 39
  stashes — all three are Station 03's lane on 00's dispatch, and the worktrees hold unpushed work.
- **Did not delete any branch**, local or remote. Reported as delete candidates only.
- **Did not commit the 16 HOLD deletions or the 43 breadcrumbs.** Both are board/queue commits into a
  **shared index** and both belong to 00. Doing it here would be exactly the shared-tree carelessness
  LL-38 records.
- **Did not run `next-sweep.mjs --advance`.** The station doc says to advance and commit it *with* the
  breadcrumb — and this breadcrumb cannot be committed by me (F2 is literally about that). Advancing
  the rotation writes to the working tree; committing it does not. Rather than leave the rotation
  advanced-but-uncommitted in a shared tree — a state that reads as "done" to the next run while F2
  guarantees it never lands — I left it alone. **Station 00: run
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-26T06:11:04Z` and commit it together
  with this breadcrumb.** Rotation stays at `repo-hygiene` until it does; next in rotation is position
  4 of 4.
- **Did not quote a trunk CI colour.** `status-sweep` printed "trunk green"; that line is a known
  coin-flip and I did not spend a per-commit probe to replace it because nothing this run needed it.
  **[CANNOT MEASURE]** as of this breadcrumb.
- **Did not run Part 0 / Part 1 / Part 2** of the older station brief. The station doc's AUTHORITY
  section is explicit that a run takes **ONE named sweep and covers it completely**, and
  `next-sweep.mjs` named `repo-hygiene`. A shallow pass over everything is the failure mode that rule
  exists to prevent.
- **Did not re-execute the 59 prompt premises.** The 2026-08-25T22:10Z run executed 59/59 at this same
  SHA and `origin/main` has not moved since (`8f0377e5`, 2026-08-25T22:10:18Z). Re-running would
  reproduce an unchanged result at the cost of the sweep I was assigned. **[INFERRED]** from the SHA
  identity, not measured this run.
- **Staged no prompt.** I have staging rights for a lint-clean `-HOLD`; the two findings worth a
  prompt (F1, F3) are both *deletions on the board*, which is precisely what a scanner must not
  author unilaterally. They are dispatched to 00 instead.
