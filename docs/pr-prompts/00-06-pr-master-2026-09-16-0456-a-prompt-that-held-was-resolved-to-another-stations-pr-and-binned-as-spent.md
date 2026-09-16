# Station 00 → Station 06 — PR Master | 2026-09-16T04:56:00Z–2026-09-16T05:52:00Z

## GROUND

```
UTC            2026-09-16T05:52:00Z
origin/main    d1634821
dev tree       main @ d1634821       C:\ProjectOperations2
watcher clone  main @ d506ebf1       C:\po-watcher\ProjectOperations   <- AT THE TIME OF THE RUN
actor          station-00.interactive-0003 (supervised interactive lane)
prompt         docs/pr-prompts/pr-ratescol-s4-import-creates-columns-*.md
```

This was a SIGHTED run. Desktop Commander reached the host on every call. Every line below is quoted
from the prompt's own `.log` or measured with `git` in the named tree.

## WHAT I MEASURED

An armed prompt correctly ended in **HOLD**, and the watcher then binned it as *spent* against a
**different step of the same chain**. The arm was silently lost: no PR, no HOLD, no error, no
operator-visible signal. It surfaced only because I was reconciling the queue by hand.

Timeline, all 2026-09-16:

| time (UTC) | event |
|---|---|
| 04:52:15 | `arm-prompt.ps1 -Name pr-ratescol-s4-import-creates-columns` - lint `PROMOTE` against **`origin/main`** |
| 04:56:20 | writer run starts, reads **the watcher clone's local `main`** |
| 04:58:17 | writer refuses: `requires_on_main: ... :: structureAdding` reads **0** |
| 04:58:1x | watcher resolves the prompt to **PR #1979** (ratescol-**S3**'s PR) and moves it to `processed/` **with no action** |

**The refusal, verbatim from the prompt log:**

> `requires_on_main: apps/web/src/components/rates/FilterableRateGrid.tsx :: structureAdding` ->
> **NOT satisfied** ... **Why:** S3 (PR #1979) is still unmerged ... `main` tip is `d506ebf1`, and
> neither the S3 merge commit (`d1634821`, on a branch) nor `structureAdding` reaches it ...
> **Action:** HOLD. Re-fire after PR #1979 lands on main.

Every sentence of that is wrong, and the log contains its own refutation: `d1634821` is not "on a
branch" - it is `origin/main`, and still is. [MEASURED] `git grep -c structureAdding` in
`apps/web/src/components/rates/FilterableRateGrid.tsx`:

| ref | occurrences |
|---|---|
| watcher clone `main` (`d506ebf1`) | **0** |
| `origin/main` (`d1634821`) | **23** |
| watcher clone `main` after fast-forward | **15 in that one file** |

**The disposal, verbatim:**

> `[merge] pr-ratescol-s4-import-creates-columns-ready.md: PR #1979 spent (PR pre-dates this run
> (created 2026-09-16T00:58:18.000Z, run started 2026-09-16T04:56:20.909Z) - the prompt was already
> consumed by an earlier run) - moving prompt to processed/ with no action`

[MEASURED] #1979 is ratescol-**S3**'s PR. S4 never had a PR of its own.

[MEASURED] the HOLD was still tracked on `origin/main` - only the working tree had lost it
(`git status` showed ` D docs/pr-prompts/pr-ratescol-s4-import-creates-columns-HOLD.md`), so recovery
was lossless.

[MEASURED] before fast-forwarding the watcher clone, its one tracked modification
(`docs/data-model/metadata-catalog.json`) was proven a pure line-ending difference - 693855 bytes on
both sides, byte-identical after newline normalisation - and `git merge-base --is-ancestor main
origin/main` returned 0, so the fast-forward discarded nothing.

## WHAT CHANGED

Recovery performed by this lane. No watcher code was touched.

- Restored `pr-ratescol-s4-import-creates-columns-HOLD.md` with `git checkout -- <single named file>`
  - no `checkout .`, no `reset`.
- **Moved** (never deleted, per Marco's standing rule) the consumed `-ready` copy and its `.log` to
  `C:\PR-Master\scripts\station-00\held-not-built\`.
- Backed up `metadata-catalog.json` to `C:\PR-Master\scripts\station-00\clone-ff-backups\`, restored
  that one named file, and fast-forwarded the watcher clone `d506ebf1 -> d1634821`.
- Re-lint: `PROMOTE` / `GATE_RELEASED` - "`structureAdding` is now on `origin/main`".
- Re-armed 2026-09-16T05:52Z by `station-00.interactive-0003`.
- Added this breadcrumb.

## FINDINGS

**F1 - `requires_on_main` resolves against a stale local `main`. ESCALATED to Station 06.**
The gate resolves a ref named `main`. In a clone whose local `main` only advances on an explicit
pull, `main` is not main - and nothing in the run fetched or compared. A released gate was reported
unreleased, in a refusal that named a real file, a real symbol and a real commit. That is the
dangerous shape: a wrong answer wearing the evidence of a right one.
**Ask:** resolve against `origin/main` after an explicit fetch, and refuse to evaluate the gate at
all when `git merge-base --is-ancestor main origin/main` shows the local branch behind. A stale tree
must abort the run, not answer it.

**F2 - a run that ended in HOLD was binned as spent, against another station's PR. ESCALATED to
Station 06.** Two errors compounded: the resolver matched prompt->PR by slug prefix and landed on the
predecessor step, then the spent heuristic ("the PR pre-dates the run, so an earlier run consumed
this prompt") was applied to that unrelated PR and used to discard a live arm. `processed/` means
*consumed*; the run's own outcome was **HOLD**, which means *re-fire later*.
**Ask:** (a) the HOLD path must be terminal-state-aware - a run ending in HOLD restores the `-HOLD`
name and never touches `processed/`; (b) spent-detection must require an exact prompt-to-PR binding
(the PR's own prompt identifier), not a slug-prefix match; (c) when the two disagree, log and **leave
the prompt alone** rather than choosing a bin.

**F3 - the queue's own invariant was violated silently. ESCALATED with F2.**
*Every armed prompt ends as a PR, a HOLD, or a logged failure.* Here it ended as none of the three,
and nothing anywhere alarmed. Anything downstream of a HOLD is exposed to the same loss; this is the
one failure mode the queue cannot detect about itself.

**F4 - the arm was recovered and is live again. ACTIONED** (see WHAT CHANGED).

## WHAT I DID NOT DO

I did not change any watcher code. Both fixes are Station 06's to make, and F2 changes queue
semantics. I did not re-run or reconstruct the lost run's output - the prompt was returned to the
queue and re-armed so the writer produces it normally.
