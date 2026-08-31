# Station 04 — Scanner | 2026-08-31T18:10:27Z–2026-08-31T18:22Z

## GROUND

```
UTC            2026-08-31T18:10:27Z
origin/main    f4f6ddc6            (fetched, then rev-parse)
dev tree       main @ f4f6ddc6     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions agree — full authority, not read-only.

Binding docs were read from the working copy **after** proving it is byte-identical to `origin/main`:
`git diff origin/main --stat -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **empty** at `f4f6ddc6`. [MEASURED]

Sweep this run: **repo-hygiene** — `node scripts/pipeline/next-sweep.mjs` → `SWEEP: repo-hygiene
(rotation position 3 of 4; previous run: 2026-08-31T14:10:37Z)`. [MEASURED]

`status-sweep.ps1` @18:10:59Z: both instrument positive controls pass, VERDICT **SAFE TO ACT**,
2 open PRs both 13/13 green, watcher pid 32916 alive, trunk green. [MEASURED]

🔴 **A CONCURRENT ACTOR WAS LIVE IN THE DEV TREE DURING THIS RUN** — `.arming-log.txt` records
`2026-08-31T18:13:56Z ARMED pr-lint-not-a-prompt`, four minutes into my run. LL-38 single-actor
rule observed: I mutated nothing but `sweep-rotation.json` and this file, and I never touched the
shared index (`git diff --cached --name-status` → empty, read back at 18:16Z). [MEASURED]

## WHAT I MEASURED

Every git query below avoids the §9.2 traps: `ls-tree` always with `-r`, never with a glob
pathspec, filtered in PowerShell; branch truth always from `ls-remote`, never `branch -r`;
`check-ignore` always on a FILE with a known-not-ignored control.

| Claim | Probe | Result |
|---|---|---|
| worktree registry, dev tree | `git -C C:\ProjectOperations2 worktree list` | one line, `C:/ProjectOperations2 f4f6ddc6 [main]` [MEASURED] |
| worktree registry, clone | `git -C C:\po-watcher\ProjectOperations worktree list` | one line, main only [MEASURED] |
| registry admin dir | `Test-Path C:\ProjectOperations2\.git\worktrees` | **ABSENT** — registry genuinely empty [MEASURED] |
| worktree dirs on disk | `Get-ChildItem C:\po-worktrees` | **4 dirs** + 4 stray json/md [MEASURED] |
| their `.git` files | `Get-Content <dir>\.git` | 2 point at `/sessions/<destroyed-sandbox>/mnt/...` [MEASURED] |
| their locks | `Get-ChildItem -Filter *.lock -Recurse` | **none** in any of the 4 [MEASURED] |
| their size | `Measure-Object Length` | 85.3 MB / 7519 files [MEASURED] |
| board trap | `ls-tree -r origin/main -- docs/pr-prompts/` filtered to depth 1 | **0** tracked `*-ready.md` [MEASURED] |
| — its controls | same query, unfiltered / `*zzzNoSuchZzz*` | 589 tracked · 72 depth-1 · 60 HOLD / neg 0 [MEASURED] |
| consumed HOLDs | `scripts/pipeline/triage-holds.ps1` | **spent=0** sat=32 gated=27 unreadable=0 of 59 [MEASURED] |
| real remote heads | `git ls-remote --heads origin` | 25 (24 non-main) [MEASURED] |
| dev-tree ref cache | `git branch -r` | 26 → **1** phantom [MEASURED] |
| clone ref cache | `git branch -r` in clone | 58 vs 25 → **33** phantom [MEASURED] |
| branch↔PR reconcile | `gh pr list --state all --limit 2000 --json` (1455 PRs) | 2 OPEN · 1 MERGED · 21 CLOSED [MEASURED] |
| clone stash | `git stash list` in clone | **55**, newest 2026-08-31T09:35Z, oldest 2026-07-14 [MEASURED] |
| dev-tree stash | `git stash list` | **11** — not previously reported by any run [MEASURED] |
| data-model drift | `node scripts/data-model/build-relationship-map.mjs --check` | exit 0, 292 models / 68 enums / 482 edges [MEASURED] |

Lead, not a finding: `docs/data-model/metadata-catalog.json` is modified-uncommitted in the shared
dev tree, but the generator's own `--check` passes, so it is not map drift. Owner unknown to me.

## WHAT CHANGED

Two files, both read back:

1. `docs/pipeline/sweep-rotation.json` — `next-sweep.mjs --advance --utc 2026-08-31T18:10:27Z`
   → `advanced: last_index=2 last_run_utc=2026-08-31T18:10:27Z`, exit 0. Read back:
   `git diff --stat` = 1 file, 2 insertions, 2 deletions; a fresh `next-sweep.mjs` now returns
   **`SWEEP: instruction-drift`**. [MEASURED] **This file must be committed with this breadcrumb
   or the next run repeats repo-hygiene.**
2. This breadcrumb.

Nothing else. No prune, no delete, no arm, no disarm, no merge, no index write.

## FINDINGS

### F1 — `status-sweep.ps1` cannot see the orphaned worktrees it exists to warn about. S2.

`status-sweep.ps1:117` is `$wt = @(git worktree list ...)`. That reads the **git registry**, and
the registry is **empty** — `C:\ProjectOperations2\.git\worktrees` is ABSENT. So §2 prints
`[LIVE] orphaned worktrees: none`, which is true of the registry and false of the disk:
`C:\po-worktrees` holds **4 orphan directories, 85.3 MB, 7519 files** —

- `po-scan-1787002207` (17 Aug, 26.0 MB) — `.git` → `/sessions/funny-blissful-archimedes/mnt/...`
- `scan-1787220682` (20 Aug, 27.6 MB) — `.git` → `/sessions/peaceful-gracious-knuth/mnt/...`
- `ph` (31.7 MB) · `fix-followup-notes` (empty shell, no `.git`)

Both `.git` files name **Linux sandboxes that no longer exist**. These are precisely the orphans
the station doc forbids creating ("an orphaned worktree lock has no holding process by
construction, forever") and precisely the ones `git worktree list` can never report, because
being absent from the registry is *what makes them orphans*. **A registry query cannot enumerate
registry escapees** — DOCTRINE §9.6, "an empty result is not an empty world".

Positive control, and it matters: the check is not broken. The same line printed a **positive**
at 14:22:36Z today (naming `C:/po-worktrees/sot-05-20260831`) — that output is what PR #1454 was
written about. [INFERRED from #1454's title and the 14:25Z breadcrumb] The query works; the
**population** is wrong. Cure is one line: cross the registry against `Get-ChildItem C:\po-worktrees`
and report set-difference, not registry contents.

No locks are present in any of the four right now, so this is inert litter today, not a freeze.
It is S2 because the next one to appear *with* a lock will be invisible in exactly the same way.

**DISPATCHED → Station 03 (Machine-minder).** Worktrees, locks and clone drift are its lane and it
is report-only, so nothing irreversible happens by handing it over. #1454 edited lines 116–121 four
hours ago; I deliberately did **not** stage a competing prompt against a just-changed function.

### F2 — 22 dead branches survive on origin, and 21 of them are the same bug. S3.

24 non-main heads exist on the remote. Reconciled against all 1455 PRs:

- **2 OPEN** — `feat/crm-s9-anchor-picker` (#1450), `worktree-agent-a5238d83533bcf1fd` (#1443). Correct.
- **1 MERGED, branch not deleted** — `docs/retire-stale-queue` (#1145).
- **21 CLOSED-unmerged, branch not deleted** — incl. #396, #599, #605, #606, #632, #703, #730,
  #804, #833, #973, #978, #1024, #1051, #1062, #1063, #1116, #1250, #1337, #1346, #1359, #1433.

The shape is the finding: **auto-delete-on-merge is working** — one merged residue out of ~1400
merges. It simply **does not fire on close**, and that accounts for all 21. This is not neglect;
it is a gap in the automation, so it will keep growing at the rate PRs get closed.

Branch deletion is DOCTRINE §5.4 **irreversible**, so this is Marco's, not mine.

**ESCALATED → Marco.** Options, RULE 1 applied:

- **(A) — complete AND additive, recommended.** Before deleting anything, write the 22 tip SHAs to
  a tracked manifest (`docs/audits/closed-branch-tips-2026-08-31.md`), then delete the branches.
  A branch whose tip SHA is recorded is fully restorable with `git branch <name> <sha>`, so nothing
  is destroyed; and add the same export+delete as a periodic job so the 21 cannot silently become
  50. **Passes both halves** — fixes today's litter and stops the future accumulation, and destroys
  no recoverable state.
- **(B) — delete the 22 now, no manifest.** Fails the *no-damage* half (a closed PR's branch is the
  only place its unmerged work lives; without the SHA it is gone) and fails the *future* half
  (nothing stops re-accumulation).
- **(C) — leave them.** Damages nothing, fails the *solves-it* half entirely; the count only grows.

**Question for Marco: (A), (B) or (C)?** I have not deleted anything and will not.

### F3 — an armed prompt's mtime dates its AUTHORSHIP, not its ARMING. Instrument note.

I nearly filed a confident, wrong S2. The sequence, all [MEASURED]:

- 18:10:59Z — `status-sweep.ps1` §4: `[LIVE] armed (*-ready.md): 0`.
- 18:11:1xZ — `git status --porcelain`: **10 lines, no deletion** of any HOLD.
- 18:1xZ — `ls-tree` says 60 tracked depth-1 HOLDs; disk says 59. The missing one is
  `pr-lint-not-a-prompt-HOLD.md`.
- 18:14:xxZ — the same `git status`: **11 lines**, now carrying ` D pr-lint-not-a-prompt-HOLD.md`;
  and `pr-lint-not-a-prompt-ready.md` is on disk with **mtime 2026-08-28T08:12:35Z**, gitignored at
  `.gitignore:75` (proved with the FILE form of `check-ignore`, exit 0, against the control
  `CLAUDE.md` → exit 1).

An mtime 3.4 days old on an armed file, invisible to `git status` and counted as 0 by the sweep,
reads exactly like *"a prompt has been armed and unseen since 28 August."* It was armed **two
minutes earlier**: `.arming-log.txt` records `2026-08-31T18:13:56Z ARMED pr-lint-not-a-prompt`.
**`git mv` preserves mtime**, so the armed file still carries the timestamp of its authorship.

Two rules worth keeping: **never read arm age from a `-ready.md`'s mtime — the arming log is the
only clock that dates the arm**; and this is the cleanest instance yet of §7's *"`[LIVE]` means
true when measured, not true now"* — the sweep's `armed: 0` was correct when printed and false
177 seconds later, which is the same order as the 2026-08-22 `pid 42112` case.

Consequence for the board: the banked arm that project memory carries as **NEXT ACTION — arm
`pr-lint-not-a-prompt-HOLD`** has now been **SPENT** (18:13:56Z). It must not be armed again.
Post-arm state is the documented-correct one: ` D` unstaged, empty index, `-ready.md` gitignored.

**DISPATCHED → Station 00.** Two lines for it to place: the mtime rule (DOCTRINE §9.5 is the right
home) and the retirement of the banked-arm next-action.

### F4 — phantom remote-tracking refs are a CLONE-only problem, and the "44" is now 33. S4.

Project memory carries a dispatch to 03: *"`git branch -r` 69 vs `ls-remote` 25 ⇒ 44 phantom refs,
up from 33 in two days."* Re-measured like-for-like:

- **dev tree** — `ls-remote` 25 vs `branch -r` 26 → **1** phantom. Effectively clean.
- **watcher clone** — `ls-remote` 25 vs `branch -r` 58 → **33** phantom.

So the correction is twofold: it is **clone-only** (the dev tree is being `--prune`d, the clone is
not), and it went 33 → 44 → **33**, i.e. it **fluctuates rather than growing monotonically**, which
weakens the "up from 33 in two days" framing that dispatch was built on. The cure is one
`git fetch --prune` in the clone.

Alongside it: clone stash **55**, unchanged from 04's 14:1xZ reading, newest 2026-08-31T09:35Z,
oldest 2026-07-14 — the closed loop DOCTRINE §9.2 describes is real but quiescent this window
(the watcher has not restarted since 09:35Z). **New: the dev tree carries 11 stashes**, which no
previous run has reported. `stash drop`, never `pop`.

**DISPATCHED → Station 03.** Clone hygiene is its lane; both cures are its calls, not mine.

### F5 — the rest of the hygiene sweep is genuinely clean. Recorded so nobody re-derives it.

- **Board trap: 0.** No tracked depth-1 `*-ready.md` on `origin/main`. Controls: 589 tracked files
  under `docs/pr-prompts`, 72 at depth 1, 60 of them `-HOLD.md`; negative control 0.
- **Consumed-but-tracked HOLDs: `spent=0`** (`triage-holds.ps1`: 32 satisfied / 27 gated / 0
  unreadable, of 59; the script proved SPENT reachable with its own fixture control). Down from
  `spent=2` at 10:1xZ — both were retired in #1449, and nothing has replaced them.
- **Queue root is not littered.** 82 files on disk, 72 tracked = 60 HOLDs + 6 breadcrumbs from
  today's runs + 6 permanent registry/schema files (`BACKLOG.yaml`, `ESCALATIONS.yaml`,
  `PROMPT-SCHEMA.md`, `BACKLOG-DECISIONS.md`, `TEMPLATE-sot-reconcile.md`, `shepherd-state.md`).
  `superseded/` (254) and `archive/` (224) are correctly foldered, not in the root.

**ACTIONED** — measured clean against controls; no action was required and none was taken.

## WHAT I DID NOT DO

- **Deleted nothing.** Not a worktree, branch, stash, HOLD or ready-file. The rotation names this
  sweep REPORT-ONLY, I am read-only on the board, and branch deletion is a §5.4 hard stop.
- **Did not stage a fix prompt for F1**, though I am allowed to stage `-HOLD`. #1454 edited
  `status-sweep.ps1:116-121` four hours ago; a second prompt against a just-changed function
  invites a collision. Handed to 03 with the one-line cure instead.
- **Did not touch the armed prompt, the index, or the shared tree**, beyond `sweep-rotation.json`
  and this file — a concurrent actor armed a prompt at 18:13:56Z, mid-run (LL-38).
- **Did not run Parts 0/1/2** (static cross-layer audit, GitHub reconciliation, live-site patrol).
  The station doc is explicit that the run takes **ONE** rotation-named sweep and covers it
  completely; a shallow pass over everything is why findings rot. Next run: `instruction-drift`.
- **Did not prune the 33 clone phantom refs or the 55 clone stashes** — 03's lane.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
