# Station 00 - Supervisor | 2026-09-17T08:33Z-2026-09-17T08:4xZ (ADDENDUM to the 08:09Z run)

## GROUND

```
UTC            2026-09-17T08:33Z
origin/main    d1228c27            (= PR #1996, this run's own board PR, merged 08:31:35Z)
dev tree       main @ d1228c27      C:\ProjectOperations2   (fast-forwarded, all three read-backs passed)
doc version    1
bootstrap      1
```

Same run, same station, later measurement. The 08:09Z breadcrumb
(`00-00-supervisor-2026-09-17-0817-...`, tracked on `main` in `#1996`) recorded `#1995` as parked by
design on a `do-not-merge` label and said plainly that it was not touched. **Within two minutes of
that PR merging, the label was gone, a merge-approval receipt had been pushed, and the branch had
been updated - by a different actor.** This addendum records who, and what it changes.

## WHAT I MEASURED

**A second Station 00 is live on this board and was mutating it inside this run's window.**
[MEASURED] 2026-09-17T08:3xZ, `gh pr view 1995 --json commits`, authoring identities read
per DOCTRINE section 10.2.1 (the PR's own commit list, never the squash commit):

```
07:56:11Z  fafd5f63  Marco <marco@initialservices.net> + Claude Sonnet 4.6   the watcher's build
08:09:33Z  7b4e8bc7  GH-Mantova <...@users.noreply.github.com>               Merge main into head
08:26:58Z  43d95f23  GH-Mantova <...@users.noreply.github.com>
             "docs(merge-approvals): receipt for PR #1995 (station-00.interactive-0003)"
08:27:09Z  ee8a288e  GH-Mantova <...@users.noreply.github.com>               Merge main into head
```

Cross-measured in the worktree registry, which names the lane directly: [MEASURED]

```
$ git -C C:\PR-Master\worktrees\sup-0003-stage-queue-layout-standard log -1 --format='%H|%an|%ae|%cI'
3ad00768...|station-00.interactive-0003|marco@initialservices.net|2026-09-17T16:33:49+10:00
                                                                  = 2026-09-17T06:33:49Z
$ git -C <that worktree> status --short     ->  clean
```

**Timeline of the two lanes, one board, one hour.** [MEASURED]

```
08:09:24Z  this run's preflight: origin/main 11169191, 2 open PRs, #1995 labelled do-not-merge
08:12:51Z  sweep: SAFE TO ACT
08:20:29Z  #1994 MERGED                                   <- not by this run
08:24:54Z  sweep re-run: section 3 "no PR touched on GitHub in the last 2 min"
08:26:58Z  #1995 receipt pushed by station-00.interactive-0003    <- 2 min after that reading
08:27:09Z  #1995 branch updated
08:2xZ     #1995's do-not-merge label removed (labels: [] at 08:33Z; present at 08:1xZ)
08:30:10Z  this run enables auto-merge on its own #1996
08:31:35Z  #1996 MERGED
```

**#1995's watcher verdict, read from the prompt logs in the DEV tree, never the clone.** [MEASURED]

```
$ Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #1995\b'
pr-scopecards-s2b-c-destination-money-ready.md.log ::
  [watcher] merge result for PR #1995: {"ok":false,"marco":true,"fixLane":false,
                                        "reason":"escalates:true - held for Marco, labelled do-not-merge"}
POSITIVE control  the same probe on #1995 returns a real verdict line (2 hits)
NEGATIVE control  a freshly minted PR number over the same corpus -> 0
newest prompt log 2026-09-17T07:57:19Z, younger than #1995's createdAt 07:56:42Z
```

A genuine watcher `marco:true`. Section 10.1 step 1 runs first and wins.

## WHAT CHANGED

- **One further board PR opened**, carrying this addendum only. Written inside its own worktree.
- **`#1995` NOT touched** - not merged, not branch-updated, not labelled, not commented.
- Nothing armed, no prompt file moved, no `/sot/` edit, no watcher action, no worktree pruned.

## FINDINGS

### A1 - The safe-to-act gate read clear 124 seconds before the other lane pushed to `#1995`

The open escalation `needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`
says the gate reads SAFE *between* another lane's mutations. This run supplies a timestamped pair:
`status-sweep.ps1` section 3 printed *"no PR touched on GitHub in the last 2 min"* at **08:24:54Z**,
and the other lane's receipt commit landed on `#1995` at **08:26:58Z**. The gate was not wrong when
it printed; it is a two-minute sampling window against an actor that acts in seconds, which is
section 7's `[LIVE]`-expires rule with a second supervisor attached rather than a stale process.

**DISPOSITION: DEFERRED - tracked in needs-marco/.** The escalation exists, it is Marco's, and
re-filing it is how this pipeline manufactures duplicates. What this adds is the pair, which that
file did not have: an exact reading and an exact mutation 124 seconds apart. What would make it
urgent: the two lanes touching the *same* PR or the same file, rather than running past each other.

### A2 - `#1995` is released and being driven by lane 0003; BOARD DRIVING condition 3 says it is not mine

Every gate that would have stopped an ordinary run has moved: the `do-not-merge` label is gone, and a
merge-approval receipt naming `station-00.interactive-0003` is committed on the head branch, which is
the signature section 10.2.1 requires of that lane. Read alone, that is a released PR and the ACTIVE
DRIVE MANDATE says drive it.

**It is still not mine, for two independent reasons, and either one is sufficient.**

1. **The watcher's `marco:true` verdict binds.** `STATION-CAPABILITIES.md` section 5 gate 2:
   *"Not overridden by green, unlabelled, or a verified diff - only by an explicit instruction from
   Marco naming that PR."* A receipt written by another agent lane is not that instruction. Section
   10.1 step 1 runs first and wins, and section 10.2.1 says in as many words that the supervised lane
   may **not** clear a watcher `marco:true` either.
2. **Single actor.** BOARD DRIVING condition 3: *"first confirm nothing else is mid-mutation ... If
   something else is acting, STOP: that is the LL-38 collision."* Lane 0003 pushed two commits to
   this PR's head six minutes before I looked. It is mid-mutation on this exact PR.

**DISPOSITION: DEFERRED.** Left for the lane that is driving it. What would make it urgent: `#1995`
still open and released with no further activity from lane 0003 for a full cadence - at that point it
is an abandoned release rather than a live one, and the next scheduled run should say so rather than
inherit this deferral silently.

### A3 - `status-sweep.ps1` reports a LIVE lane's worktree as an orphan to prune, and two standing dispatches to Station 03 ask for exactly that

[MEASURED] The 08:12:51Z sweep listed three worktrees under
*"orphaned worktree (aborted run leftover -- investigate/prune)"*, one of them
`C:/PR-Master/worktrees/sup-0003-stage-queue-layout-standard  3ad00768  age=99 min  dirty=0`.
Its HEAD commit is authored by **`station-00.interactive-0003`** at 06:33:49Z, and that lane pushed to
`#1995` at 08:26:58Z - **114 minutes after the commit the sweep read as evidence of abandonment.**

The classifier is age-and-dirtiness only; it has no identity input, so a clean worktree belonging to a
lane that is between commits is byte-identical to a leftover from an aborted run. Station 04's 09-16
02:19 F2 and 09-16 18:10 F5 were both DISPATCHED to Station 03 as worktree pruning, and the sweep
still prints all three under one heading. **A `git worktree remove --force` on `sup-0003-*` would tear
the tree out from under a live lane** - the 2026-07-13 shape, where a false "this is broken" reading
licensed a destructive action.

**DISPOSITION: DISPATCHED -> Station 03**, as a narrowing of the two prune dispatches it already
holds: `po-vg` and `pr1823` remain candidates (and the 08:09Z run's F3 supplies the measured content
of `po-vg`'s one file); **`sup-0003-stage-queue-layout-standard` is EXCLUDED and must not be pruned
while lane 0003 is active.** The test that distinguishes them costs one command and is quoted above:
`git -C <worktree> log -1 --format='%an|%cI'`, and an identity that names a station lane is not an
orphan whatever its age.

### A4 - A sixth git-identity pairing exists, and DOCTRINE section 10.2.1's table has five rows

That table maps an authoring identity to the tree or actor it names, and closes with
*"The identity SET is state - re-measure it, never quote it; a sixth pairing is invisible until it
appears."* It has appeared. [MEASURED]

```
station-00.interactive-0003 <marco@initialservices.net>
```

It matches no row: the email is the one the table assigns to the **watcher clone**, while the name is
a lane identifier that neither tree's `git config` produces. A run attributing that commit by email
alone reads it as a watcher build; by name alone, as an actor the table does not list. Both readings
are wrong in the same way the table was written to prevent, and the email half is the dangerous one
because it is the most human-looking identity on the board.

**DISPOSITION: DEFERRED.** `DOCTRINE.md` section 10.2.1 is ordinary prose, not a hash-gated canonical
block, so the row is landable in an ordinary docs PR within this station's lane - but not in the same
run that is already carrying two board PRs while a second supervisor is active on the board. The row
to add, so the next run can land it in one edit:

```
| station-00.interactive-0003 <marco@initialservices.net> | a SUPERVISED INTERACTIVE lane
  committing from a dev-tree worktree with a lane-specific user.name; the email is Marco's, so
  attribution by email alone reads it as a watcher build | the lane's own git config |
```

What would make it urgent: any run attributing a `#1995`-era commit and reaching the watcher-build
conclusion from the email.

## WHAT I DID NOT DO

- **Did not merge, update, label, or comment on `#1995`.** A2 gives the two reasons.
- **Did not prune, clean or touch any worktree**, and specifically not `sup-0003-*`.
- **Did not edit `DOCTRINE.md`.** The row is written out above instead, for a run that is not sharing
  the board with a second supervisor.
- **Did not re-file the two-Station-00s escalation.** It is open and this is evidence attached to it.
- **Did not touch `/sot/`, source, any prompt file, or the arming log.**
