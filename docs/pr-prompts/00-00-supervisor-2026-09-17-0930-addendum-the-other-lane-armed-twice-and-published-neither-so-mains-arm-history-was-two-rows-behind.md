# Station 00 - Supervisor | 2026-09-17T09:24Z-2026-09-17T09:4xZ (ADDENDUM to the 09:10Z run)

## GROUND

```
UTC            2026-09-17T09:24Z
origin/main    3d6ac52b            (= PR #2000, this run's own first board PR, merged 09:23:55Z)
dev tree       main @ 3d6ac52b      C:\ProjectOperations2   (fast-forwarded, all three read-backs passed)
doc version    1
bootstrap      1
```

Same run, same station, later measurement. The 09:10Z breadcrumb
(`00-00-supervisor-2026-09-17-0910-...`, tracked on `main` in `#2000`) recorded at F2 that the other
lane armed `pr-queue-layout-s1-the-standard` **122 seconds** after this run's sweep read SAFE TO ACT.
Fast-forwarding the dev tree after `#2000` merged exposed what that arm left behind, and this
addendum records it and closes it.

## WHAT I MEASURED

**`#2000` reached `main`, read back rather than assumed.** [MEASURED]

```
$ gh pr view 2000 -R <owner>/<repo> --json state,mergedAt,mergeCommit
   state=MERGED   mergedAt=2026-09-17T09:23:55Z   mergeCommit=3d6ac52b...
$ git branch -r --contains 3d6ac52b...     ->  origin/main   (and origin/HEAD -> origin/main)
$ git rev-parse --short origin/main        ->  3d6ac52b
```

**The dev-tree fast-forward, with all three read-backs the station doc requires** - the first alone
passes on a dirty tree, which is the trap that section names: [MEASURED]

```
$ git merge --ff-only origin/main
  Updating c084027b..3d6ac52b   Fast-forward   2 files changed, 334 insertions(+)
$ git rev-list --left-right --count HEAD...origin/main   ->  0  0
$ git diff --cached --name-status                        ->  EMPTY
$ git diff --numstat                                     ->  3 rows, ALL pre-existing (below)
```

No cure was needed. `#2000`'s breadcrumb was written **inside its own PR worktree** - cure 1 of the
station doc's fast-forward section - so no untracked copy of it ever existed in the dev tree and the
FF had nothing to refuse.

**What the FF exposed: the dev tree carries three uncommitted rows, and all three are the OTHER
lane's and the watcher's, not this run's.** [MEASURED]

```
2  0   docs/pr-prompts/.arming-log.txt                          <- INSERTIONS, ZERO deletions
0 118  docs/pr-prompts/pr-crmvis-s5-followups-HOLD.md            <- consumed by the watcher
0 132  docs/pr-prompts/pr-queue-layout-s1-the-standard-HOLD.md   <- consumed by the watcher
```

`2 0` is the exact discriminator DOCTRINE section 9.5 names for this file: *"INSERTIONS with ZERO
deletions, which means the working copy is a strict superset of `main` and something in it has not
landed yet. On that shape, restoring to HEAD is a deletion, not a repair."* Nothing in this run
restored it.

## WHAT CHANGED

- **One further board PR opened**, carrying exactly two files: the two unpublished arming-log rows
  (F1) and this addendum. Committed with a **pathspec** so the two consumed-`-HOLD.md` deletions
  sitting in the same shared index could not ride along (DOCTRINE section 9.2).
- **The dev tree was fast-forwarded** to `3d6ac52b`, read back three ways above.
- **The `sup-0910-collect` worktree was torn down**; `git worktree list` now returns the dev tree and
  `po-vg` only.
- **Still nothing armed, no prompt file moved, no `/sot/` edit, no label, no watcher action, no
  worktree pruned, `#1998` untouched.**

## FINDINGS

### F1 - The other lane armed twice and published neither row, so `origin/main`'s arm history was two rows behind the only clock that dates an arm

DOCTRINE section 9.5 records that `.arming-log.txt` is tracked, that **nothing commits it on
purpose**, and that the gap therefore *"closes and re-opens by luck"* - and it is explicit about which
shape is worse: *"When it is open a clone reads a STALE arm history rather than none, which is the
more dangerous shape: it answers, and its answer can be a day and a half old."* The bullet's own
prescription is that **any run that arms something MUST commit the arming log in its board PR.**

It was open, by exactly the two arms the 09:10Z F2 measured. [MEASURED]

```
$ (Get-Content docs\pr-prompts\.arming-log.txt).Count                     ->  130   (local)
$ git show origin/main:docs/pr-prompts/.arming-log.txt  | count            ->  128   (main)
$ Compare-Object, side '=>' (local only):
  2026-09-17T08:48:33Z  ARMED  pr-crmvis-s5-followups          escalates=true
        actor=station-00.interactive-0003  by=Marco@LAPTOP-E6NHU4E4  pid=14800  caller=powershell.exe:30476
  2026-09-17T09:12:13Z  ARMED  pr-queue-layout-s1-the-standard  escalates=false
        actor=station-00.interactive-0003  by=Marco@LAPTOP-E6NHU4E4  pid=12780  caller=powershell.exe:15364
```

Both rows name `station-00.interactive-0003`. The first is `#1998`, the PR this run's F1 measured as a
genuine watcher `marco:true`; the second is the arm that landed 122 seconds after the safe-to-act
reading. **So the lane that armed is the lane that owed the commit, and for roughly forty minutes any
clone, any CI job and any cloud-fired station reading `origin/main` would have answered "the last arm
was 06:44:53Z" - a well-formed answer, two arms and two and a half hours stale.**

**Why publishing them is the complete-and-additive move, and why it is safe rather than a second
lane's data being touched by this one.** The file is APPEND-ONLY, so the only way to damage it is to
*remove* a row - which is precisely the hazard section 9.5 records, where `git show HEAD:<path>` piped
to a write *"silently deletes that line, and every read-back in step 5 still passes."* Publishing is
the opposite operation. It was gated on an assertion that refuses anything but a strict superset,
compared as **Buffers** in node so no decoded-length comparison is involved (section 9.3): [MEASURED]

```
src_bytes=21391  src_rows=130      dst_bytes=21041  dst_rows=128
STRICT_SUPERSET_ASSERT=PASS        (every destination row present, at the same index)
rows_to_publish=2
after_bytes=21391  after_rows=130  BYTE_EQUAL_ASSERT=PASS   (Buffer.compare(src, written) === 0)
```

The script exits non-zero and writes nothing on either failure mode - not a superset, or nothing to
publish - so a row can never be dropped by it and a no-op can never be reported as a publish.

**UPDATE at 09:3xZ, while this PR was green and waiting: a THIRD arm landed, and it is included.
It is published here rather than left for the next run, because leaving it would have closed the gap to one row instead of to zero and this file's whole defect is that it goes stale by increments.** [MEASURED]

```
2026-09-17T09:30:54Z  ARMED  pr-transport-capacity-column-order  escalates=true
      actor=station-00.interactive-0003  by=Marco@LAPTOP-E6NHU4E4  pid=12480  caller=powershell.exe:7440
local rows 130 -> 131   origin/main rows 128 (unchanged; #1999 merged in between and did not touch this file)
STRICT_SUPERSET_ASSERT=PASS   rows_to_publish=1   BYTE_EQUAL_ASSERT=PASS
```

That arm is the third by the same lane in 43 minutes (08:48:33Z, 09:12:13Z, 09:30:54Z), and its subject -
`pr-transport-capacity-column-order` - is one of the three `ADMIT` candidates this run's own triage listed.
**It is therefore also the strongest evidence for the 09:10Z F2 and F3:** the lane is working that
queue continuously, so the decision not to arm and not to move a prompt file this cycle was not caution,
it was the only reading of BOARD DRIVING condition 3 the measurements support.

**DISPOSITION: ACTIONED.** Read-back is this PR's own diff on that path - a **`3 0`** numstat,
insertions only - plus the two counts re-run after the merge, which must agree at 131. The falsifying
probe is section 9.5's own: re-run the local-versus-`origin/main` line-count comparison; if they
disagree again, another arm has happened since and the defect that nothing commits this file on
purpose is unchanged. **The DEFECT is not fixed by this run and is not claimed to be** - it is still
true that nothing commits the log deliberately, and this is one more instance of the gap closing by
hand rather than by design.

### F2 - Two consumed `-HOLD.md` prompts are deleted on disk and still tracked on `main`, and they are left that way on purpose

[MEASURED] `git diff --numstat` shows `0 118` and `0 132` for
`pr-crmvis-s5-followups-HOLD.md` and `pr-queue-layout-s1-the-standard-HOLD.md`. That is the normal
shape after the watcher consumes a prompt: arming is a `git mv` of the tracked `-HOLD.md` to a
`-ready.md`, and `-ready.md` is gitignored, so the deletion shows and the arrival does not.

I published the arming log and deliberately did **not** stage these, which is why the commit used a
pathspec. Two reasons, either sufficient. **They are a queue mutation**, and the 09:10Z F2 and F3 are
the measured case for not making one this cycle while the other lane arms from that directory.
**And retiring a consumed prompt is a decision, not bookkeeping** - `#1993` did exactly this for four
of them in its own board PR, after checking each one, which is the right shape and is more than an
addendum should carry.

**DISPOSITION: DEFERRED.** Both names are recorded above, so the next single-actor run can commit the
two deletions alongside the seven SPENT retirements in the 09:10Z F3 - one `git mv` batch and one
staged deletion set, in one worktree, with no re-measurement. What would make it urgent: the deletions
still outstanding when a run next needs a clean fast-forward and meets them as a blocker, which is the
shape the station doc's fast-forward section already records for `sweep-rotation.json`.

## WHAT I DID NOT DO

- **Did not stage the two `-HOLD.md` deletions**, and did not retire the seven SPENT prompts the
  09:10Z F3 names. Same measured reason, recorded there.
- **Did not restore, rewrite or normalise `.arming-log.txt`.** Its `2 0` shape is exactly the case
  where DOCTRINE section 9.5 says restoring to HEAD is a deletion rather than a repair.
- **Did not arm, merge `#1998`, touch its label, or comment on it.**
- **Did not claim the arming-log defect is fixed.** One gap closed by hand is not a mechanism.
- **Did not touch `/sot/`, source, the watcher, or any worktree but my own.**
