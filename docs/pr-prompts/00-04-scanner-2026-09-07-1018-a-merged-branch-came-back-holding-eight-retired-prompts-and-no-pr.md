# Station 04 — Scanner | 2026-09-07T10:12Z–2026-09-07T11:05Z

Sweep this run: **repo-hygiene** (rotation position 3 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me). Advanced with
`--advance --utc 2026-09-07T10:17:56Z`; `docs/pipeline/sweep-rotation.json` is **LEFT DIRTY**
in the dev tree — **Station 00 commits it**, I may not.

## GROUND

```
UTC            2026-09-07T10:12Z (start)  ·  2026-09-07T11:05Z (end)
origin/main    bc41cd78 at 10:12Z  ->  01db2bb2 at 10:59Z   (#1780 landed mid-run)
dev tree       main @ 01db2bb2   C:\ProjectOperations2   (rev-list --left-right origin/main...HEAD = 0/0, index clean: 0 staged)
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)  -> MATCH, full authority
```

Read from the dev tree, and proved current rather than assumed:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
returned **EMPTY** for all three, so the working copies I read ARE `origin/main`'s
(§9.3's sound form — no piped hash, no length comparison).

Device-bridge git guard, run first, last line quoted verbatim [MEASURED]:

```
vm-git-guard installed at /sessions/beautiful-fervent-cannon/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

`status-sweep.ps1` verdict at 10:20:34Z: **CAUTION — 1 LIVE STATION WORKTREE**
(`C:/po-worktrees/board-1008`, age 3 min). That was Station 00's 1008 collect; by 10:31Z the
worktree was gone from `.git/worktrees` and `#1780` had merged. I mutated nothing either way.

**Fresh needles this run** (both now spent — §9.6): `zzQq04Hyg20260907T1030`,
`zzQq04Branch20260907`, `zzQq04Scratch20260907`, `docs/zzQq04NoSuchFile20260907.md`.

## WHAT I MEASURED

### 1. The board trap — tracked `*-ready.md` at depth 1 [MEASURED] — **CLEAN, and the zero is controlled**

```
git ls-tree -r --name-only origin/main -- "docs/pr-prompts/"   -> 885 paths (trailing slash + -r, §9.2)
  depth-1 subset                                               -> 55
  depth-1 *-ready.md                                           -> 0        <- the board trap
  depth-1 *-HOLD.md                                            -> 46
  depth-1 *-LOOPING.md                                         -> 0
POSITIVE CONTROL  *-ready.md anywhere under docs/pr-prompts/   -> 175  (processed/, superseded/…)
POSITIVE CONTROL  depth-1 set contains docs/pr-prompts/BACKLOG.yaml -> True
NEGATIVE CONTROL  fresh needle in the same 885-path set        -> 0
```

175 proves the `*-ready.md` filter can match; 0 at depth 1 is therefore a real absence and not a
blind grep. On disk, `ONDISK_ARMED_ready = 0` as well — armed count is genuinely zero.

### 2. HOLD files tracked on main whose work has already shipped [MEASURED] — **ZERO**

`scripts/pipeline/triage-holds.ps1`, run with `$env:OS='Windows_NT'` set **inside the script**
(without it the SPENT probe silently does not run — `#1769`, merged 10:04Z this morning):

```
spent=0 of 46 evaluated · gates-satisfied=18 · still-gated=28 · unreadable=0
SPENT BEHIND A REJECT: (none)
"SPENT was additionally proved reachable by the fixture control above."
```

`unreadable=0` and the script's own fixture control are what make `spent=0` mean *none*, rather
than *this instrument could not say*. The seven SPENT holds retired by `#1776` at 09:21Z are the
reason the count is zero; this axis of the sweep is genuinely clean.

### 3. Worktrees, locks, stashes [MEASURED]

```
git worktree list (dev tree)  -> C:/ProjectOperations2 [main] · C:/po-vg [fix/no-rebase-while-checks-run]
                                 (C:/po-worktrees/board-1008 present at 10:20Z, gone by 10:31Z)
.git/worktrees registry       -> dev tree: 1 entry (po-vg), locked=False, gitdir target exists
                                 watcher clone: no .git/worktrees directory at all
index.lock                    -> ABSENT in both trees
clone stash list              -> 69   (newest 2026-09-06T09:35Z — no growth today)
dev tree stash list           -> 0
```

`C:\po-vg`: branch `fix/no-rebase-while-checks-run` @ `23c91ba9`, **not on the remote**
(`ls-remote` membership False), **1 commit not on `origin/main`**, plus one untracked file
`scripts/pipeline/check-pipeline-heartbeat.mjs`. Age from the sweep: 4467 min (~74 h).

### 4. Remote heads vs open PRs [MEASURED]

```
git ls-remote --heads origin                     -> 14 heads   (the authority, §9.2 — NOT git branch -r)
gh pr list --state open --limit 200               -> 5 PRs
heads with no open PR (excluding main)            -> 8
```

Per-branch, via `gh pr list --head <b> --state all` (the sound form; the `--state closed --limit 60`
window does **not** reach these — see the instrument note below):

| head still on remote | PR | state |
|---|---|---|
| `chore/sweep-breadcrumbs-20260907-0934` | #1778 | **MERGED** 09:41:35Z |
| `feat/crm-account360-v2-s1` | #1612 | CLOSED, unmerged |
| `feat/verdict-home-resolver` | #1703 | CLOSED, unmerged |
| `feat/verdict-home-resolver-v1` | #1707 | CLOSED, unmerged |
| `fix/verdict-home-resolver-v1` | #1708 | CLOSED, unmerged |
| `fix/verdict-home-resolver-v1-impl` | #1705 | CLOSED, unmerged |
| `fix/classify-policy-nested-tests` | #1571 | CLOSED, unmerged |
| `fix1483` | — | **no PR ever** |

`delete_branch_on_merge = true` on the repo (`gh api repos/... --jq .delete_branch_on_merge`), and
the POSITIVE CONTROL confirms it fires: `#1780`, `#1779` and `#1776` — all merged today — have no
head ref left. NEGATIVE CONTROL: `heads -contains zzQq04Branch20260907` = False. So the survivor at
the top of that table is an exception to a working mechanism, not evidence the mechanism is off.

### 5. Local remote-tracking cache vs the remote [MEASURED]

```
git for-each-ref refs/remotes   -> 26 refs      git ls-remote --heads origin -> 14 heads
```
The 12 extras are `refs/remotes/pr/{1477,1478,1483,1487,1544,1571,1692,1699,1709,1713}`, `pr1273`
and `origin/HEAD` — hand-made by `git fetch origin pull/N/head:refs/remotes/pr/N`. No refspec owns
them, so `--prune` can never remove them. This is DOCTRINE §9.2's documented trap, re-measured; it
is why every branch question in this breadcrumb was asked of `ls-remote`.

### 6. Queue root and clone litter [MEASURED]

```
docs/pr-prompts depth-1 files on disk  -> 58 (54 .md, 2 .yaml, 2 .txt)
non-prompt files                       -> 9, of which TWO are neither tracked on main nor ignored:
    .queue-sync-ledger.txt    889 B    mtime 2026-08-19T23:19Z
    queue-watch-state.md    38757 B    mtime 2026-08-31T20:26Z
docs/pr-reviews (dev tree)             -> 47 untracked  vs  59 tracked on origin/main
watcher clone `git status`             -> 6 untracked entries, one of which is:
    "C\357\200\272po-watcherProjectOperations.._scratch_1740_log.txt"  1,033,778 B  2026-09-07T01:24Z
```

That last filename's second character is **U+F03A** (codepoint 61498, Private Use Area) — a path
whose `:` and `\` were flattened into the *name*. Controlled search for its author over
1,091 `.ps1` files in `C:\ProjectOperations2\scripts`, `C:\po-watcher` and the clone's `scripts`:
`_scratch_` → **0** everywhere, with POSITIVE controls `ErrorActionPreference` → 76 and
`Start-Transcript` → 18 proving the search works. `C:\po-watcher\_scratch_1740_log.txt` (the path
it was presumably meant to be) does **not** exist. No committed script writes that name, so it was
an ad-hoc redirect from an agent session at 01:24Z. Scan for other Private-Use-Area filenames in
the three tree roots: **1** — this one.

### 7. Two readings I took and then had to correct — recorded because they nearly became findings

**(a) "A Station 00 breadcrumb is stranded on the resurrected branch."** `git diff --name-status
origin/main...<branch>` (THREE dots — the merge base) showed
`A docs/pr-prompts/00-00-supervisor-2026-09-07-0908-….md`, which reads as *a finding that never
reached main*. It is on main: `git cat-file -e origin/main:<that path>` → **exit 0**, and the path
is in `ls-tree` on main. The three-dot form was answering a question about the merge base, not about
main. **Use `cat-file -e` or a two-dot/two-arg diff when the question is "is this on main".**

**(b) `git cat-file -e` returns 128 for a missing path, not 1.** My legend said "1 = ABSENT". The
NEGATIVE CONTROL (`origin/main:docs/zzQq04NoSuchFile20260907.md`) returned **128**, POSITIVE control
(`origin/main:docs/pipeline/DOCTRINE.md`) returned 0. The discriminator is zero vs non-zero. Had the
control not been run, a 128 would have been read as "neither present nor absent" — or worse, matched
against the wrong expected value.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced to `last_index=2`,
  `last_run_utc=2026-09-07T10:17:56Z`. `git diff --numstat` = `2 2`. **LEFT DIRTY on purpose.**
  Station 00 commits it; 04 may not commit to the shared dev tree (authority matrix: *Mutate the
  board: NO*, and `#1773`'s NO-DRIFT law).
- `refs/remotes/probe/sw0934` — I created this ref to inspect the resurrected branch, then
  **deleted it** (`git update-ref -d`). Read back: `for-each-ref refs/remotes/probe` → **0 refs**.
  Leaving it would have added a thirteenth un-prunable ref to the very cache §5 above reports.
- Scratch outputs under `C:\po-sup-fix-scripts\` (7 files). Not in either repo.
- **Nothing else.** No prompt armed, renamed, moved, staged or deleted. No PR opened, merged,
  labelled or branch deleted. No commit anywhere.

## FINDINGS

### F1 — S2 — A merged branch came back from the dead holding eight retired prompts, two reverted fixes, and no PR

`refs/heads/chore/sweep-breadcrumbs-20260907-0934` is live on the remote and belongs to `#1778`,
**merged 09:41:35Z**. Its remote SHA is `261d7856`; the PR's `headRefOid` was `af372448`. They are
not equal, and `git merge-base --is-ancestor 261d7856 origin/main` exits **1** — the branch tip is
not on main.

**The mechanism.** `delete_branch_on_merge` is on and works (three controls above). GitHub declines
to delete a head that has moved past the merged commit. The branch's own last commit is stamped
`2026-09-07T19:41:26+10:00` = **09:41:26Z — nine seconds before the merge**. Five commits sit
between main and the tip, and their subjects say what happened:

```
261d7856 docs(pr-prompts): add the pr-title scope finding
233fe591 docs(pr-prompts): correct the record - a pathspec commit swept a deletion in
54a4014c docs(pr-prompts): put back the HOLD a pathspec commit swept into this branch
1029f4be docs(pr-prompts): record the second sweep defect and the end-to-end control
e71bbd07 docs(pipeline): sweep 1 breadcrumb(s) 20260907-0934
```

That is `sweep-breadcrumbs.ps1` being debugged in place, mid-merge — the same script whose two
defects `#1777` (open, red, Marco's) exists to fix.

**Why it is S2 and not litter.** The question is not *what does the branch add* — it is *what does
its tree say*. Two-dot `git diff --name-status origin/main origin/chore/sweep-breadcrumbs-20260907-0934`
[MEASURED, POSITIVE control: the same diff against `origin/fix/watcher-gate-path-space` returns 3
files, so the comparison is live]:

```
D    docs/decisions/merge-approvals/1769.md                                (-26)  merge receipt REMOVED
D    docs/pr-prompts/00-00-supervisor-2026-09-07-1008-….md                (-209)  00's newest breadcrumb REMOVED
M    docs/pr-prompts/00-00-supervisor-2026-09-07-0908-….md              (+5/-18)
M    scripts/pipeline/triage-holds.ps1                                   (+1/-16)  the #1769 $env:OS fix REVERTED
R100 archive/…-0708-….md                    -> depth 1                            breadcrumb UN-archived
R100 archive/…-0808-….md                    -> depth 1                            breadcrumb UN-archived
R100 superseded/pr-armguard-s2-…-HOLD.md             -> docs/pr-prompts/          RETIRED PROMPT RESURRECTED
R100 superseded/pr-module-provenance-s2-HOLD.md      -> docs/pr-prompts/          RETIRED PROMPT RESURRECTED
R100 superseded/pr-pipeline-nodrift-…-HOLD.md        -> docs/pr-prompts/          RETIRED PROMPT RESURRECTED
R100 superseded/pr-rates-plant-fuel-column-HOLD.md   -> docs/pr-prompts/          RETIRED PROMPT RESURRECTED
R100 superseded/pr-statussweep-local-time-timestamps-HOLD.md -> docs/pr-prompts/  RETIRED PROMPT RESURRECTED
R100 superseded/pr-sweep-dead-queue-dir-reads-HOLD.md-> docs/pr-prompts/          RETIRED PROMPT RESURRECTED
R100 superseded/pr-triageholds-s2-…-HOLD.md          -> docs/pr-prompts/          RETIRED PROMPT RESURRECTED
R100 superseded/pr-watcher-app-auth-switch-on-HOLD.md-> docs/pr-prompts/          RETIRED PROMPT RESURRECTED
```

**This is THE BOARD TRAP, on the remote instead of in a working tree.** The station doc and
DOCTRINE §9.2 both warn that a checkout can re-arm consumed prompts; every warning is written about
a *local* `checkout .` / `reset --hard`. Here the resurrecting tree is a **published ref**, reachable
by anyone who branches from it, opens a PR from it, or fetches and checks it out. Anything built on
it silently proposes: put eight retired `-HOLD.md` back at depth 1 — including
`pr-rates-plant-fuel-column-HOLD.md` and `pr-watcher-app-auth-switch-on-HOLD.md`, both on the
standing do-not-arm list, and `pr-watcher-app-auth-switch-on` is *production auth* — delete a merge
receipt, delete 00's newest breadcrumb, and revert the `$env:OS` fix that shipped six hours ago.

It cannot merge by itself: there is no PR and nothing polls it. **It is a loaded vector, not an
active incident** — which is exactly why it should be closed while it is cheap.

**Five-angle check.** (1) Reproduced twice, 28 min apart, `ls-remote` both times. (2) Source: the
branch's own commit subjects name the pathspec-sweep defect; `#1777` is the open fix. (3) Ground
truth: violates the board-trap rule in `docs/pipeline/stations/04-scanner.md` (AUTHORITY) and
DOCTRINE §9.2. (4) History: **the class is already escalated** —
`docs/pr-prompts/needs-marco/remote-branches-outlive-their-prs-2026-09-05.md` (raised 09-05, still
open) asks for exactly the missing check, and its companion
`pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md` warns that some such branches
must **not** be deleted. Neither names this branch or this mechanism. (5) Blast radius: the same
push-during-merge race is available to every job that pushes to its own PR branch — the breadcrumb
sweeper does this on every 00 cycle.

**DISPOSITION: ESCALATED.** Deleting a remote ref is DOCTRINE §5.4 irreversible, so it is Marco's,
and it belongs folded into the 09-05 escalation rather than filed as a tenth separate one. The ask,
RULE 1, complete-and-additive first:

- **(a) COMPLETE + ADDITIVE — add the queue check the 09-05 escalation already proposes (report
  every remote head with no open PR, never auto-delete), extend it to compare each such head's TREE
  against `origin/main` and flag any that would resurrect `superseded/` or `archive/` files, and
  delete this one branch by hand.** Passes both halves: it clears today's vector and it catches the
  next one, including the `#1612` case where the correct answer is *preserve*. Damages nothing —
  the tree carries no work that is not already on main (every `R100` is a rename of a file main
  still has, and the two `D`s delete files main has).
- **(b) Delete this branch only.** Fails the future half; the sweeper races its own merge again on
  the next cycle and nobody is looking.
- **(c) Leave it.** Fails the immediate half: a published tree that re-arms two do-not-arm prompts
  stays reachable, and the count of heads-with-no-PR is now **8**, up from the 5 measured on 09-05.

### F2 — S3 — Five dead `verdict-home-resolver` heads are the kill loop's residue, and nothing reports them

`feat/verdict-home-resolver` (#1703), `feat/verdict-home-resolver-v1` (#1707),
`fix/verdict-home-resolver-v1` (#1708) and `fix/verdict-home-resolver-v1-impl` (#1705) are all
CLOSED-unmerged with their heads still on the remote, plus `fix/classify-policy-nested-tests`
(#1571). Closed-unmerged heads are **never** auto-deleted — `delete_branch_on_merge` only fires on
merge — so this class only grows.

These four are the duplicate builds DOCTRINE §9.5 records: one prompt, five builds, `#1704` merged
and the other four closed. The fix is on main (`git grep -c VERDICT_HOME_RESOLVER` = 6, recorded
09-06), so **[INFERRED]** they hold nothing unique — but I did **not** diff their trees, so treat
that as a lead. The measured half is that the heads-with-no-open-PR count went **5 → 8 in two days**
and no instrument on the board reports it.

**DISPOSITION: ESCALATED**, as the same fold into
`needs-marco/remote-branches-outlive-their-prs-2026-09-05.md`. Same option (a) as F1 covers it: the
check must **report** and never auto-delete, because `feat/crm-account360-v2-s1` (#1612) is in this
same list and its companion escalation says that one holds the only copy of its work.

### F3 — S3 — A megabyte of junk sits in the build clone's root under a filename that is a flattened path

`"C\357\200\272po-watcherProjectOperations.._scratch_1740_log.txt"`, 1,033,778 B, written
2026-09-07T01:24:17Z, second character **U+F03A**. It is one of the six untracked entries that make
`status-sweep.ps1` report `watcher clone: branch=main dirty=6 <-- NOT clean-on-main; the watcher may
refuse to start`. No committed script writes that name (controlled search, §6 above), so it came
from an ad-hoc redirect in an agent session — and the log its author believes exists at
`C:\po-watcher\_scratch_1740_log.txt` **does not exist**, so whatever it was capturing was never
read back. Only one such filename exists across the three tree roots.

**DISPOSITION: DISPATCHED → Station 03 (machine-minder).** Clone hygiene is 03's lane and only 03
may act in the clone; 04 is read-only and must not touch it. The ask is one deletion of a junk file
plus, if 03 can find the caller in a session transcript, a note on why the path flattened — a
redirect target built by string concatenation where `:` and `\` were lost is a shell-quoting defect
worth a DOCTRINE §9.1 line if it recurs. Fold into the existing open 03 dispatch; do **not** raise a
new one.

### F4 — S3 — `C:\po-vg` still holds one commit that exists nowhere else, four days on

Branch `fix/no-rebase-while-checks-run` @ `23c91ba9`, **absent from `git ls-remote --heads origin`**,
**1 commit not reachable from `origin/main`**, plus untracked
`scripts/pipeline/check-pipeline-heartbeat.mjs`. Age ~74 h. `status-sweep.ps1` classifies it
`orphaned worktree … HOLDS UNCOMMITTED WORK … 'git worktree remove' will refuse, and --force would
discard it`. Its registry entry is **not locked** and its gitdir target exists, so it is a live
worktree, not a stale registry stub.

**DISPOSITION: DISPATCHED → Station 03**, and it is a re-statement, not a new finding: 03 already
escalated `C:\po-vg` (recorded as 63 h old at the time, commit on no remote branch). Re-measured
here at 74 h with the numbers above so the dispatch does not go stale. Nothing in it should be
`--force`d away; the commit and the untracked `.mjs` are the only copies.

### F5 — S4 — Two stale state files in the queue root are neither tracked nor ignored

`docs/pr-prompts/.queue-sync-ledger.txt` (889 B, last written 2026-08-19) and
`docs/pr-prompts/queue-watch-state.md` (38,757 B, 2026-08-31) are tracked-on-main **False** and
`git check-ignore` **empty** for both. So they appear as `??` on every `git status` in the shared dev
tree, forever, and any station that reaches for `git add -A` or `git commit -a` sweeps them into its
board PR — which is how `queue-watch-state.md`, a 19-day-old snapshot, keeps surfacing as
`status-sweep.ps1`'s "freshest station summary". The other seven queue-root non-prompt files are
properly tracked.

**DISPOSITION: DEFERRED.** Real but not urgent, and deleting or `.gitignore`-ing either one is a
board mutation I may not make. It becomes urgent the moment a station commits with `-A` rather than
a pathspec — which `#1773`'s NO-DRIFT law and DOCTRINE §9.2's shared-index rule both already guard
against. If 00 wants it closed now, the additive form is a `.gitignore` entry for both, in the same
PR that names them, so nothing is deleted and nothing can be swept.

### F6 — S4 — `gh pr list --state closed --limit 60` cannot see a closed-unmerged PR on this board

Asked *"how many closed-unmerged heads survive?"* the obvious query answered **0**:

```
gh pr list --state closed --limit 60 --json number,headRefName,closedAt,mergedAt
   -> 60 rows, of which mergedAt is null on 0
```

All 60 most-recent "closed" PRs are merged ones, so the five genuinely closed-unmerged PRs (#1571,
#1703, #1705, #1707, #1708) are simply outside the window. The number is a well-formed zero that was
never measuring the question — §9.6, reached through `--limit` truncation, which §9.2 already records
for a different query (`--limit 600` vs `--limit 2000`). The **sound** form, and the one the table in
§4 above is built from, is per-branch: `gh pr list --head <branch> --state all`.

**DISPOSITION: DEFERRED** — this is a note for the next run rather than a defect in the repo, and it
is one instance of a trap DOCTRINE §9.2 already names. It becomes worth a §9 line only if a second
station is measured tripping on the `--state closed` form specifically; a bullet per query variant
would bloat §9 faster than it helps. The falsifying probe if anyone wants it retired: re-run the
query with `--limit 400` and check whether `#1708` appears.

## WHAT I DID NOT DO

- **Deleted nothing on the remote**, in either tree, or in the clone. F1–F4 all end in a deletion
  somebody else must authorise: remote refs are DOCTRINE §5.4 irreversible (Marco), and the clone
  and `C:\po-vg` are Station 03's lane.
- **Staged no prompt.** The sweep's own brief says *"stage a prompt for anything worth deleting"* and
  I judged that wrong here: F1's correct home is an **existing open escalation** that already asks
  for this exact check, and adding a tenth near-duplicate file to `needs-marco/` is the failure mode
  §10.6 and the 09-05 escalation both warn about. My budget was 2 prompts; I used 0, deliberately.
- **Did not commit `docs/pipeline/sweep-rotation.json`** — named under WHAT CHANGED, left dirty for
  00, per the AUTHORITY block and `#1773`.
- **Did not touch the dev tree's `main`** — no fetch-and-ff, no checkout, no stash. Another chat had
  already fast-forwarded it to `01db2bb2` during the run; I recorded that rather than racing it.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site patrol).** The station doc gives
  me one named sweep per run and rotation chose `repo-hygiene`; a shallow pass over everything is
  what the rotation exists to prevent.
- **Did not diff the four `verdict-home-resolver` branch trees** (F2). The claim that they hold
  nothing unique is tagged `[INFERRED]` for exactly that reason.
- **Did not clear, prune, or investigate the 69 clone stashes beyond counting them.** `git stash
  drop` in the clone is 03's, and the count did not grow today.
- **Did not go near Azure / Entra / SharePoint, production data, `/sot/`, any label, or any merge.**

---

**This breadcrumb is UNTRACKED in the dev tree** at
`docs/pr-prompts/00-04-scanner-2026-09-07-1018-a-merged-branch-came-back-holding-eight-retired-prompts-and-no-pr.md`.
Station 00 sweeps it up; `scripts/pipeline/sweep-breadcrumbs.ps1` is the job that lands it — and F1
is a finding about that job's last run, so if the sweeper is still broken pending `#1777`, this file
needs landing by hand.

**Validator [MEASURED]:** `node scripts/pipeline/check-breadcrumb.mjs` → `structure: 3 checked,
0 malformed, 0 skipped` · `CLEAN` · **exit 0**, with this file listed `ADMIT` and correctly flagged
`is UNTRACKED — it reaches nobody until a board PR commits it`. (Re-run after this footer was
appended.) No `lint-prompt.mjs` verdict is quoted anywhere above: it gates prompts, not breadcrumbs,
and its result on one is not evidence in either direction.
