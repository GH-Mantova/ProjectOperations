# Station 00 — Supervisor | 2026-09-17T07:45Z–2026-09-17T07:55Z (ADDENDUM to the 07:08Z run)

## GROUND

```
UTC            2026-09-17T07:45Z
origin/main    11169191            (= PR #1993, this run's own board PR, merged 07:23:27Z)
dev tree       main @ 11169191      C:\ProjectOperations2   (fast-forwarded and clean this run)
doc version    1
bootstrap      1
```

Same run, same station, later measurement. The 07:08Z breadcrumb
(`00-00-supervisor-2026-09-17-0708-forty-nine-hours-with-no-collect-…`, tracked on `main` in #1993)
dispositioned its **F2 as DEFERRED** on the ground that the cure is a `scripts/` change and therefore
not Station 00's to merge. That reasoning still stands for *merging*. It does not stand for *opening*,
and the ACTIVE DRIVE MANDATE says so: get it green and mergeable, then hand it over. **F2's cure is
now open as `#1994` with its control.** This addendum records that so the earlier DEFERRED is not
read as "nobody did anything."

## WHAT I MEASURED

**The fix, and its control.** Both versions of `check-breadcrumb.mjs` run over the same 26-file corpus
in the same worktree, the unpatched one restored from `origin/main` so the two differ only in the
change under test. [MEASURED]

```
UNPATCHED  exit 1   structure: 26 checked, 1 malformed
PATCHED    exit 0   structure: 26 checked, 0 malformed   CLEAN

Compare-Object over every ADMIT/REJECT line — EXACTLY ONE verdict changed:
  <=  REJECT  00-04-scanner-2026-09-17-0611-…md    (unpatched)
  =>  ADMIT   00-04-scanner-2026-09-17-0611-…md    (patched)

--freshness, patched: exit 0, CLEAN, all five station rows unchanged
  00  last 2026-09-17T07:08:00Z  0.3h ago  ok      <- the 07:08Z breadcrumb, now on main
```

25 of 26 verdicts are byte-identical across the change. That is the whole claim: the patch is not
"more permissive", it accepts exactly one report that was always well-formed.

**The dev-tree fast-forward after #1993 merged, read back in full.** [MEASURED] The 07:08Z run wrote
its own breadcrumb inside the PR worktree (cure 1), but fourteen *other* stations' breadcrumbs sat
untracked in the dev tree at paths the fast-forward had to create — the same blocker, fourteen times
over. Each disk copy was proved byte-identical to the new blob (`git hash-object <path>` against
`git rev-parse origin/main:<path>`, never a piped hash) before being deleted.

```
byte-identical untracked copies deleted : 14
NOT ON MAIN, kept                        : 00-04-scanner-2026-09-17-0611-…md   (held back on purpose)
rev-list --left-right --count HEAD...origin/main : 0   0
git diff --numstat                               : EMPTY
git diff --cached --name-status                  : EMPTY
arming-log bytes on disk                         : 21041   (unchanged; 0 rows re-appended, 0 lost)
armed *-ready.md at depth 1                      : pr-scopecards-s2b-c-destination-money-ready.md
```

All three read-backs pass. The first alone would pass on a dirty tree — that is the trap the station
doc records, which is why all three are quoted.

🔴 **A THIRD CAUSE of the refused fast-forward, and neither documented cure reaches it.** [MEASURED]
The FF refused twice on `docs/pipeline/sweep-rotation.json` **while `git diff --numstat` read EMPTY
for that exact path**, before and after `git update-index --refresh`. The documented sequence —
restore to HEAD, then `git add --renormalize`, then undo the renormalize with `git restore --staged`
— cannot fire, because it is gated on a non-empty `--cached` that never appears: the file restored
byte-exact from `git show HEAD:` is LF, the checkout wants CRLF, `git diff` applies the clean filter
and sees equality, and `git merge` compares the worktree bytes and does not.

🔧 **What cleared it: `git checkout-index -f -- <single path>`**, which writes the index version
**through the smudge filter**, so the bytes on disk become the ones git expects. It is path-scoped and
explicit — it is not `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or
`git clean`, none of which were used, and it has no directory-form sibling a typo could reach. After
that one command the fast-forward succeeded first try and all three read-backs passed.

## WHAT CHANGED

- **`#1994` opened** — `fix/breadcrumb-heading-anchor`, commit `95ae8592`, one file
  (`scripts/pipeline/check-breadcrumb.mjs`), **no auto-merge armed**. It waits for Marco.
- Nothing else. No arm, no merge, no label, no `/sot/`, no prompt file moved.

## FINDINGS

### F1 — F2 of the 07:08Z run is open as `#1994`, driven and controlled, and it is Marco's to merge

The 07:08Z breadcrumb named the cure (anchor the section lookup to a line start) and stopped. This
addendum closes the gap between *naming* a cure and *shipping* one: the change is written, the control
is the 26-file A/B above, and the PR is open and unarmed.

**DISPOSITION: ESCALATED** — `scripts/pipeline/` is outside `tests|docs`, so `classifyPolicyFiles`
routes it to Marco and Station 00's authority row does not cover it. There is no question attached and
nothing for him to decide beyond merging: the option set is one, because the alternative — a convention
telling stations not to quote their own headings — has no gate behind it and fails the "future" half
of RULE 1.

### F2 — The refused fast-forward has a third cause, and the cure for it is one command that is not on the forbidden list

Measured above. Worth recording because the two documented causes are *an untracked file at a path the
FF must create* and *a tracked file another station left dirty*; this is neither. It is a pure
LF/CRLF boundary condition in which the prescribed diagnostic (`--numstat`) reads EMPTY and the
prescribed cure is unreachable, so a run following the station doc literally is left with a refusal it
has no next move for — and the tempting next moves are all on the §9.2 forbidden list.

**DISPOSITION: DEFERRED.** The durable home for this is the station doc's fast-forward section, which
is ordinary prose rather than a canonical block, so it is landable in a docs PR — but not in the same
run that is already carrying a 48-hour collect and an instrument fix. What would make it urgent: a
second run meeting a refused FF with `--numstat` EMPTY and reaching for `git checkout .` because
nothing told it about `checkout-index`.

## WHAT I DID NOT DO

- **Did not arm auto-merge on `#1994`**, and did not merge it. Out of lane.
- **Did not fold this breadcrumb into `#1994`.** That PR's value is a tight one-file diff with a
  clean A/B control; adding docs to it would blur the thing a reviewer has to check.
- **Did not land the F2 fast-forward note into `00-supervisor.md`.** Named with its cure instead.
- ⚠️ **This breadcrumb is UNTRACKED in the dev tree** at
  `C:\ProjectOperations2\docs\pr-prompts\`. It reaches nobody until a board PR commits it — the next
  Station 00 run sweeps it up, and it is named here so that run knows to look. A breadcrumb filename
  matches no watcher glob, so leaving it in the queue root arms nothing.
