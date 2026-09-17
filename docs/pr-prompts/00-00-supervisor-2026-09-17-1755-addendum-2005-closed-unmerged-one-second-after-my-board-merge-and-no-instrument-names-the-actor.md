# Station 00 — Supervisor | SECOND ADDENDUM to the 2026-09-17T17:07:55Z run

## GROUND

```
UTC            2026-09-17T17:55Z
origin/main    5fb8410c               (#2011 merged 17:25:23Z, #2012 merged 17:32:10Z)
dev tree       main @ 5fb8410c        C:\ProjectOperations2   (0 0, EMPTY, EMPTY)
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

**The final board re-measurement of this run found something the two reports above do not contain**,
because it happened after both were written. The board went from three open PRs to two. This addendum
exists because *"never stay quiet about"* is the shorter list, and a labelled PR leaving the board
unexplained belongs on it.

## WHAT I MEASURED

**[MEASURED] #2005 is CLOSED and UNMERGED, and it left the board one second after my own board PR
merged.** Re-measuring the board at close (the `[LIVE]`-expires rule) returned **2** open PRs, not the
three every earlier section of this run's reporting names:

| | [MEASURED] |
|---|---|
| `#2005` | **CLOSED**, `mergedAt` **empty**, `mergeCommit` **empty**, `closedAt` **2026-09-17T17:25:24Z** |
| timeline `closed` event actor | `GH-Mantova` |
| `#2011` (mine) merged at | **17:25:23Z** — one second earlier |
| label at close | **`do-not-merge`**, still attached |
| head branch on the remote | **PRESENT**, `d92fb4d269eeb106ba342ebf2e2f2c9907ef279f` |
| remaining open | `#2002` **BEHIND**, `#1998` **BEHIND**, both `do-not-merge` |

**[MEASURED] The watcher did not close it — it READ the closure.** Live daily clone log found by name
shape then mtime and copied before reading (never constructed — §9.5): the file with content is
`2026-09-16.log`, mtime `17:25:45Z`, POSITIVE control `[merge]` → **41**, NEGATIVE control a needle
minted this run → **0**.

```
[2026-09-17T16:47:36.648Z] [update] PR #2005 branch updated (was BEHIND)
[2026-09-17T17:25:27.730Z] [review] verdict-archive: moved pr-2005-review.md (state=CLOSED)
```

Its last *action* on #2005 was a branch update 38 minutes before the close; at `17:25:27Z` it merely
archived the review verdict **having observed** `state=CLOSED`, three seconds after the fact. No close
verb for #2005 appears anywhere in the log.

**[MEASURED] It was not me, and that is a negative with support rather than an assertion.** This run
issued exactly two board mutations, both on its own PRs — `Merge-Pr -Pr 2011` and `Merge-Pr -Pr 2012`.
No `gh pr close`, no `gh pr edit`, no label touched. Its entire change set is five `git mv` archive
renames plus two breadcrumbs, all under `docs/pr-prompts/`.

**[MEASURED] The watcher crashed and was auto-restarted during this run, which is what the PID change
was.** The same log's final line: `[2026-09-18T03:25:45+10:00] Watcher exited with code 1 (raw node
exit: -1)` — i.e. `17:25:45Z`. That accounts for `pid 30248` at the 17:09Z sweep against `pid 24032`
at 17:41Z. `supervise-watcher.ps1` handles an *exit* by design (§3a: it auto-restarts on exit; what is
mine is a watcher **alive but wedged**), and the sanctioned check returned **HEALTHY** with
`restart churn: 0 cycle(s) in 20 min`. **Nothing was restarted or killed by me.**

## WHAT CHANGED

1. **Filed `needs-marco/pr-2005-closed-unmerged-one-second-after-a-board-merge-2026-09-17.md`.**
   ⚠️ That folder is gitignored at `.gitignore:82`, so it reaches Marco through `status-sweep.ps1`
   section 5 and **not** through git — which is why F-5 below states the whole question here, at a
   tracked path.
2. **This file.**

No arm, no label, no close, no reopen, no merge on the product board, no `/sot/` edit, no commit on
`main`, no `git` in the watcher clone, no worktree pruned, nothing Azure / Entra / SharePoint.

## FINDINGS

### F-5 — A PR carrying Marco's own `do-not-merge` gate was closed UNMERGED by an actor no instrument on this board can identify

The one-second gap to my own merge is the reason this is written up rather than shrugged at, and it is
also the reason it must not be *asserted* either way: coincidence and causation look identical at this
resolution, and I have no instrument that separates them.

**The actor field cannot answer.** `STATION-CAPABILITIES.md` §5 records that `GH-Mantova` is the
identity for *"every merge on this board, agent and human alike"* — it is the `gh` CLI's authenticated
login, the web UI's, and the API's. DOCTRINE §10.2.1 reaches the same conclusion from the other side:
identity survives **per-commit**, on trailers and authoring identity — and **a close event has no
commit.** So this is `[CANNOT MEASURE]` on the actor, stated as such rather than filled in with an
inference, which is §7.1's whole point.

🔴 **The general shape is already on file three times, and this is the fourth face of it.** A *merge*
with no durable signature is `nothing-verifies-a-merge-approval-receipt-2026-09-07`; a *label removal*
with none is `label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05`; CP-26 passing
vacuously is `cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05`. **A close is
the fourth board-changing act with no signature**, and unlike the others it can remove work from the
board rather than add it.

✅ **No work is stranded, and this is the load-bearing reassurance.** The head branch is still on the
remote at `d92fb4d2`, so the failure mode of
`needs-marco/pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md` **does not apply**: the
PR is reopenable, the commits are intact, the label and review history survive. ⚠️ That is true *today*
— `stale-remote-heads-and-auto-delete-2026-09-08` and
`stale-remote-heads-need-auto-delete-on-merge-2026-09-10` both ask for auto-delete-on-merge, and a
closed-unmerged branch is precisely what such a reaper must not touch.

**DISPOSITION: ESCALATED** — to Marco, as
`needs-marco/pr-2005-closed-unmerged-one-second-after-a-board-merge-2026-09-17.md`. The question is
one line: *did you close it?* **RULE 1 applied, complete-and-additive first:**

- **(a) Reopen `#2005` if the close was not deliberate, and give a close the same provenance a merge
  gets.** Solves it now — the slice returns to the board with its gate, CI history and review intact —
  **and** in future, because the next unexplained close becomes attributable. Additive: reopening
  deletes nothing. **Both halves pass. This is the option I would take.**
- **(b) Leave it closed, re-stage the work as a fresh prompt.** Fails the *complete* half: verdict, CI
  history and the label decision are discarded and no record says why. Damages no data, so it passes
  the second half only.
- **(c) Leave it closed, do nothing.** Fails **both** halves if the close was accidental — the slice is
  silently gone from the board while its prompt is already consumed, so nothing resurfaces it.

**I did not reopen it myself.** Reopening a PR Marco's own label was gating is a board decision about
his gate, and guessing his intent is §5.5. It is also the one action that is trivially reversible *by
him* and not cleanly reversible by me.

## WHAT I DID NOT DO

- **Did not reopen, re-close, re-label or comment on `#2005`.** See above.
- **Did not restart, kill or touch the watcher.** It exited on its own and `supervise-watcher.ps1`
  restarted it, which is that wrapper's job; the sanctioned verdict is HEALTHY.
- **Did not rebase `#2002` or `#1998`**, now both `BEHIND` after this run's two board merges. `BEHIND`
  is a rebase, not a failure, and the churn is the subject of
  `needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`.
- **Did not assert that my merge caused the close, or that it did not.** One second is suggestive and
  is not evidence; the log shows the watcher observing rather than acting, and nothing else is
  measurable from here.
