# Station 04 — Scanner | 2026-09-04T02:10:41Z–2026-09-04T02:22Z

Sweep this run: **repo-hygiene** (rotation position 3 of 4, chosen by `next-sweep.mjs`, not by me).

## GROUND

```
UTC            2026-09-04T02:10:41Z  (start)   2026-09-04T02:22Z (end)
origin/main    57b956c7 at start -> cd06e4d1 at end   (main moved twice during the run)
dev tree       main @ 57b956c7 at start -> cd06e4d1 at end   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

Versions AGREE, so this run was not restricted to read-only by the version rule. It was read-only
anyway: 04 is read-only on the board by the authority matrix.

Read in the DEV TREE, per the station-contract v2 freshness clause: `04-scanner.md`, `DOCTRINE.md`,
`STATION-CAPABILITIES.md`. Freshness proved by blob identity, NOT by the piped-hash form —
see MEASURED-1.

`status-sweep.ps1` verdict at 02:12:06Z: **CAUTION** — one LIVE STATION WORKTREE, `C:/po-queue`
(`lane/station-authority-10-1`, age 11 min, dirty=0). I mutated nothing, so CAUTION did not bind me.
Instrument positive controls in sweep section 0 both PASSED (`gh` reached GitHub, `node` ran).

## WHAT I MEASURED

**MEASURED-1. The contract's own freshness cure returns a FALSE MISMATCH on this box.**
[MEASURED] `git show origin/main:docs/pipeline/stations/04-scanner.md | git hash-object --stdin`
-> `c13ff2fa`, while `git hash-object <the file on disk>` -> `cdbafc12`. Two different hashes for a
file `git diff origin/main` reports as identical. The authoritative reading:
`git rev-parse origin/main:docs/pipeline/stations/04-scanner.md` -> `cdbafc12` and
`git ls-files -s` -> `cdbafc12`. The blob on main and the file on disk are the SAME; the PowerShell
pipe between the two git calls re-encodes the byte stream. **Station 00 already found this at
2026-09-04T00:09Z** (`00-00-supervisor-2026-09-04-0009-an-approval-file-is-marcos-and-the-hash-cure-lies-on-crlf.md`).
Recorded here only as an independent reproduction; NOT re-filed as a finding.
Use `git rev-parse <ref>:<path>` versus `git ls-files -s <path>`, or `git diff <ref> -- <path>`.

**MEASURED-2. A lead that died: the "0KB escapee" reading is CORRECT, not an instrument lie.**
`status-sweep.ps1` reports `REGISTRY-ESCAPEE: C:\po-worktrees\fix-1523 size=0KB`. Because
`fs.readdirSync` showed children `[apps, node_modules, packages]`, I suspected a repeat of the
`Measure-Object -Property Length` bug the sweep documents at its own lines 206-213. [MEASURED] by
recursive `fs.statSync` byte sum: `fix-1523` = **0 MB / 7 files**, `vs-s2-durable-smoke` =
**0 MB / 7 files**. They are empty pnpm workspace husks. **The sweep is right and I was wrong.**
Recorded so the next run does not re-derive it.

**MEASURED-3. The watcher clone's `origin/main` is CURRENT right now — which does NOT refute
Station 03's 2026-09-03 finding.** [MEASURED] at 02:18Z: clone `origin/main` = `cd06e4d1`, dev tree
`origin/main` = `cd06e4d1`. Identical. Station 03 measured a 10-commit gap on 2026-09-03T23:0xZ and
that is now binding law in `station-contract v2`. **Both readings are true.** The clone's
remote-tracking ref is refreshed whenever the watcher fetches, so the gap is a function of *when you
look*, not a permanent property. A single "they match" reading is not evidence the trap is gone.
The cure (fetch explicitly, and say which tree you read in) is unaffected.

**MEASURED-4. The clone's dirty working tree is a BUILD IN FLIGHT, not drift.** [MEASURED] at
02:20Z the clone held ` M docs/pipeline/DOCTRINE.md` and ` M docs/pipeline/stations/_canonical-blocks.json`.
Reading the diff shows it re-anchoring the section 9.5 `checkFixesPrTargetOpen` citation from a line
number onto a comment string — i.e. the watcher executing `pr-doctrine-s95-cite-symbol-not-line`,
armed 02:18:14Z. **Do not report a dirty clone as drift without reading the diff.**

**MEASURED-5. The board moved under me three times in twelve minutes.** `armed: 0` at 02:12:06Z
(sweep) and `*-ready.md = 0` at 02:15Z (my own `readdirSync`) were both correct when taken and both
false by 02:18Z. `origin/main` went `57b956c7` -> `cd06e4d1`; the clone went 20 commits behind ->
level; remote heads went 5 -> 4 as `board/00-2026-09-04-0109` was deleted on the merge of #1561.
This is DOCTRINE section 7's `[LIVE]` rule reproducing four times in one run.

**MEASURED-6. The board trap is CLEAN.** `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
(trailing slash, `-r`, no glob, per section 9.2): **723** tracked paths, **96** at depth 1, of which
**0** are `*-ready.md` and **80** are `*-HOLD.md`. Negative control: the glob pathspec form
`-- docs/pr-prompts/*.md` returned **0**, confirming section 9.2's "ls-tree has no glob and does not
tell you" is still live.

**MEASURED-7. No HOLD on main has already shipped.** `triage-holds.ps1` over all 80 depth-1 HOLDs:
**SPENT = 0**, gates-satisfied = 38, still-gated = 42, unreadable = 0. Its own two controls passed
(`GIT control: PASS` read 54306 chars from `origin/main:DOCTRINE.md`; `SPENT control: PASS`, the
fixture produced exit 3), so the zero is a measured zero and not a broken query.

**MEASURED-8. `git branch -r` versus the remote, re-measured.** `git ls-remote --heads origin` = 4
real heads at 02:20Z (`main`, `fix/agent-defs-double-encoded`, `fix1483`, `lane/station-authority-10-1`).
`git branch -r` = 11. The extras are `refs/remotes/pr/1477`, `pr/1478`, `pr/1483`, `pr/1487`,
**`pr/1544` (new since Station 00's 2026-09-03 measurement of five)** and `pr1273`. No refspec owns
them, so `--prune` can never reach them; the set is still GROWING. Confirms section 9.2 unchanged.

**MEASURED-9. The 66 clone stashes, by content.** Classified each with `git stash show --name-only`:
**6** touch `apps/ scripts/ packages/ prisma/`, **51** touch only docs and review files, **9**
resolve to no files. ⚠️ **This 6 is a LOWER BOUND**: `git stash show` does not list untracked files
by default, so a stash holding only untracked work reads as empty. `stash@{0}` returned empty both
plainly and with `--include-untracked`, so the "9" bucket is real, but I cannot certify it is
entirely benign.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or staged. No PR opened, merged
or labelled. No branch, worktree, lock or stash created or deleted. No file under `/sot/` read for
edit or written. Station 04 is read-only on the board and this run stayed inside that.

Two writes, both permitted:

1. This breadcrumb, at the tracked path `docs/pr-prompts/`, in the **dev tree** (not in a worktree —
   a worktree is torn down and the report dies with it).
2. `docs/pipeline/sweep-rotation.json`, advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-04T02:10:41Z`. **LEFT DIRTY AND
   UNCOMMITTED ON PURPOSE — Station 00 must commit it, because 04 may not.** If it is not committed
   the next run repeats repo-hygiene and the rotation silently stops.

Scratch probes were written to `C:\po-sup-fix-scripts\scan-hygiene{,2..8}-2026-09-04.mjs`
(sanctioned scratch, outside the repo, untracked, mutate nothing).

## FINDINGS

### F1 — `origin/fix1483` is a remote branch that has never had a PR, and it outlived the squash that landed its work. — S3

[MEASURED] `git ls-remote --heads origin` lists `refs/heads/fix1483` @ `9de07267`. `gh pr list
--state all --head fix1483` -> `[]`. **Positive control**: the same query for
`fix/agent-defs-double-encoded` -> `[{"number":1544,"state":"OPEN"}]`, so the query works.
(Negative control `zzz-no-such-branch-ever` -> `[]` — identical to `fix1483`'s answer, which is
section 9.6 exactly: I rely on `ls-remote` for the branch's existence, not on this query.)

**Why it survived**: GitHub's delete-on-merge only fires for a PR head. `fix1483` was never a PR
head — PR #1483 merged at 2026-09-02T02:46:46Z from `feat/scope-s2-wbs-table-shell` (deleted
correctly). `fix1483` was pushed 19 minutes earlier and nothing has ever collected it.

**Is its work the only copy? NO — measured, not assumed.** The naive instruments both over-report:
`git log origin/main..origin/fix1483` shows 28 commits and `git cherry` shows 5 unique by patch-id,
but this repo squash-merges, so neither survives contact (section 9.2). The content test, over the 8
files the branch authored since `merge-base 1239c33a`:

| result | count |
|---|---|
| blob IDENTICAL to `origin/main` | **7** |
| DIFFERS | 1 |
| ABSENT from main | 0 |

The single differing file is `apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`, and it differs
because **main is ahead**: `fix1483->main` numstat is `911 added / 94 removed`, main last touched it
in #1523 on 2026-09-03, the branch on 2026-09-02. The branch is 54 commits behind and holds nothing
main lacks. **Positive control**: the same test on `fix/agent-defs-double-encoded` (#1544, live
work) gives identical=0, differs=9 — that is what genuinely unlanded work looks like.

**DISPOSITION: DISPATCHED -> Station 00.** Deleting a remote branch is irreversible (DOCTRINE
section 5.4) and branch pruning is not 04's. `pr-hygiene-s1-guarded-branch-prune-HOLD.md` is already
on the board and `triage-holds.ps1` reports it **ADMIT** this run — `fix1483` is its worked example
and its regression case. Whoever acts should still apply the standing cure from the merged-but-
undeleted thread: tag `abandoned/fix1483@9de07267`, push the tag, and only then delete. The local
worktree `C:/po-1483-fix` (age 2872 min, dirty=0) is pinned to this branch and should go with it.

### F2 — the registry-escapee scan cannot see `C:\po-work`, and there is a 22-day-old escapee sitting there. — S3

[MEASURED] `status-sweep.ps1:192` reads
`$worktreeRoots = @("C:\po-worktrees", "C:\po-wt", "C:\po-watcher-worktrees")`.
`C:\po-work` is **not** in that list, and `C:\po-work` currently holds two entries:
`s2-e2e` (registered in the dev tree's worktree list — correctly not an escapee) and
**`wt-cfx3-20260813-091739`**, age **31844 min (22.1 days)**, `has_dotgit=false`,
`in_dev_registry=false`, and absent from the clone's worktree list too. It is in no registry and no
sweep has ever named it.

The sweep's wording is honest — it says "none found under **known roots**" — but the count line
reads `worktree-registry-escapees: 2 found`, which any reader takes as the total. This is section
9.6 in a config file: an empty result from an incomplete query.

**Blast radius is small**: the tree measures 0 MB / 7 files, so nothing is being consumed. The defect
is the scanner's coverage, not this directory.

**RULE 1 options** (complete-and-additive first):
- **(a) Add `C:\po-work` to `$worktreeRoots`, AND derive the roots from the union of every parent
  directory named in `git worktree list` across both trees, so a new root cannot silently escape
  again.** Solves it immediately and for the future; purely additive; touches one script; no data
  written. **Both halves pass.**
- (b) Add the literal string `C:\po-work` only. Fixes today, fails the *future* half — the next new
  root is invisible again, which is the same bug with a different path.
- (c) Do nothing. Fails the *immediately* half.

**DISPOSITION: DISPATCHED -> Station 06 (PR Master), to stage as a `-HOLD`.** Option (a), one edit
to `status-sweep.ps1:192`. Not staged by me this run — see WHAT I DID NOT DO.

### F3 — DOCTRINE section 9.2 tells you to `git stash drop` in the clone, and that is not safe for 6 of the 66. — S3

Section 9.2 reads: *"`git stash` in the watcher clone is a CLOSED LOOP — the launcher's preflight
stashes on every start, and nothing ever pops. Report the count and its growth. `git stash drop`,
**never `pop`**."* The advice is correct about the mechanism and correct for the common case. It is
written as though **every** entry in that stack is a disposable preflight autostash. Measured, they
are not.

[MEASURED] 66 stashes spanning 2026-07-14 to 2026-09-03 (52 days, monotonic — 9 on 09-01, 2 on
09-03). Of these, **6 carry code**, and one is large:

```
stash@{64}  2026-07-14T12:28:36+10:00  "On main: wip-staged-work-not-for-this-pr"
            149 files changed, 14617 insertions(+), 1186 deletions(-)
            includes apps/api/prisma/schema.prisma and 4 migration folders
```

Its label is not `watcher-preflight-autostash` — it is a deliberate stash by a person or an agent.
`git stash drop` is effectively irreversible (the entry leaves the reflog; recovery needs
`fsck --unreachable` and only until gc runs).

**Severity is S3, not S2, because I checked before alarming.** All four migration folders it carries
ARE on `origin/main` — `20260710120000_quote_estimate_traceability`,
`20260713120000_editable_permissions_matrix`, `20260713120000_feat_company_profile`,
`20260714120000_sharepoint_folder_mappings` (negative control `zzz_no_such_migration` -> 0 hits;
positive control: 237 migration files on main). So the stash is very likely a landed July WIP
snapshot. **"Very likely" is the point**: the standing instruction asks an agent to destroy it
without ever forming that opinion.

**RULE 1 options** (complete-and-additive first):
- **(a) Amend section 9.2 to say: drop ONLY entries whose message is `watcher-preflight-autostash`,
  and only after `git stash show --name-only` shows no path under `apps/ scripts/ packages/
  prisma/`; anything else is reported, never dropped.** Complete (covers today's 66 and every future
  entry), additive (it only ever narrows what may be destroyed), and it cannot damage data entry.
  **Both halves pass.**
- (b) Drop the 51 docs-only entries now and leave the rest. Fixes the count, fails the *future*
  half — the next hand-made stash lands in the same undifferentiated stack.
- (c) Leave the advice as written. Fails both halves; the stack grows and the hazard stays armed.

⚠️ Whoever implements (a) must account for MEASURED-9: `git stash show` hides untracked files, so
the classifier needs `--include-untracked` or it will call an untracked-only stash empty.

**DISPOSITION: ESCALATED -> Marco.** Two reasons this is not merely dispatched. Section 9.2 lives
inside the **hash-gated `instruments v2` canonical block**, so changing it re-records a canonical
hash and ships all seven station docs together — a governance change, not a fix. And the underlying
act is irreversible destruction of possibly-unique work, which is hard stop 5.4. The question for
Marco is narrow: **adopt (a)?** Nothing needs doing to the 66 stashes today; they are inert.

### F4 — a HOLD that was armed is still tracked on `main`, so it will be armable again the moment its PR lands. — S3

Caught live, by accident, because the board moved mid-run. [MEASURED]:

- `.arming-log.txt` last line: `2026-09-04T02:18:14Z  ARMED  pr-doctrine-s95-cite-symbol-not-line
  escalates=false  by=Marco@  pid=32688  caller=powershell.exe:12492`. **pid 32688 is not one of my
  processes** (mine this run: 32668, 35392, 35132, 21780, 32380, 30864, 27756, 28668, 23464, 28608,
  33872, 2084, 16772, 24180, 28120, 18328, 16096, 11496, 25108, 24500) — I checked, because a
  CAUTION worktree can be your own.
- `pr-doctrine-s95-cite-symbol-not-line-ready.md` exists on disk at depth 1.
- Its `-HOLD` twin is **gone from disk** but **still tracked on `origin/main`**
  (`git cat-file -e origin/main:docs/pr-prompts/pr-doctrine-s95-cite-symbol-not-line-HOLD.md` -> exit 0).
- The `-ready.md` is **not** tracked on main (`fatal: ... exists on disk, but not in 'origin/main'`).

So the arm exists only in the working tree. Any `git checkout` / `reset --hard` in the dev tree
restores the HOLD, its premise still passes, and it is armable a second time — the "stays armable
forever" defect, reproduced on a named file at a named minute. This is a **known** defect
(recorded as unstaged, owned by 06); this run supplies a fresh dated instance rather than a new
escalation.

Two instrument facts fell out of it, both confirming DOCTRINE rather than contradicting it:
- The `-ready.md`'s mtime is **2026-09-01T00:38:06Z**, three days before the arm. Section 9.5's
  *"mtime dates authorship, not arming"* — a reader trusting mtime would report a prompt armed and
  unseen for three days. The arming log is the only clock.
- `git status` on the `-ready.md` returns **empty** (it is ignored at `.gitignore:75`), while
  `git check-ignore -v` returns exit 0 with the rule, and the negative control `check-ignore
  CLAUDE.md` returns exit 1 empty. Section 9.2's blindness rule, reproduced with both controls.

**DISPOSITION: DISPATCHED -> Station 06**, folded into the existing "an armed prompt whose PR does
not delete its HOLD stays armable forever" item, with this instance as its reproduction case.

### F5 — the board trap and the SPENT bucket are both clean. — no severity

Reported because a clean result measured with controls is worth as much as a defect, and because
"nobody checked" and "checked, clean" are indistinguishable in a later reader's hands.
0 tracked `*-ready.md` at depth 1 of `origin/main` (positive control: 723 tracked paths, 96 at depth
1, 80 HOLDs). 0 SPENT HOLDs of 80 (positive control: the SPENT fixture produced exit 3).
The clone carries 2 `*-ready.md` on disk (`pr-sot-ll36-sot-purity-ready.md`, `rev-1162-ready.md`)
but **0 tracked at its HEAD** (positive control: 695 tracked paths), so no checkout there re-arms
anything either.

**DISPOSITION: ACTIONED** — verified clean this run at `origin/main` `cd06e4d1`; nothing to do.

## WHAT I DID NOT DO

- **Staged no prompt, for F2 or anything else.** 04 may stage a lint-clean `-HOLD`, so this was a
  judgement call and I am naming it rather than leaving it implicit. Three reasons: the sweep
  verdict was **CAUTION** with a live station worktree at `C:/po-queue`; Station 00 armed a prompt
  **46 seconds** before my probe, so the queue was actively being mutated by another actor; and the
  board already holds **38 ADMIT candidates** among 80 HOLDs, so a 39th adds little and risks an
  index collision in a tree DOCTRINE 9.2 says is shared between chats. F2's fix is specified to the
  exact line so 06 can stage it without re-deriving anything.
- **Deleted nothing** — not `fix1483`, not the four orphaned worktrees (`C:/po-1483-fix`,
  `C:/po-guard`, `C:/po-sa-fix`, `C:/po-work/s2-e2e`, all dirty=0, none locked, `git worktree prune
  --dry-run` says it would remove nothing because every path still exists), not the escapees, not
  one of the 66 stashes. All irreversible; none mine.
- **Did not clear any lock.** There were none to clear: `index.lock`, `MERGE_HEAD`, `REBASE_HEAD`,
  `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` and `sequencer` were all absent from the dev
  tree, the clone and all five registered worktrees. `git processes running: 0`.
- **Did not run `git` against the Windows `.git` through the device bridge.** Everything went
  through Desktop Commander on the host.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
- **Did not run the other three sweeps** (gate-liveness, instrument-honesty, instruction-drift).
  One sweep per run, covered completely, is the contract. Next run: instruction-drift.
- **Did not chase the 156 untracked files under `docs/pr-prompts/` + `docs/pr-reviews/`**
  (149 of them the `archive/review-escalations-516-1346/` directory, plus `queue-watch-state.md`
  which `status-sweep.ps1` section 4C quotes as "freshest station summary" while it exists on this
  box only). Real, and out of this sweep's named scope. **DEFERRED** — it becomes urgent the moment
  anyone reasons from `queue-watch-state.md` in a clone or in CI, where it does not exist.
