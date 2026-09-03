# Station 00 — Supervisor | 2026-09-03T03:00Z–03:30Z (ADDENDUM to the 02:46Z run)

Same station, same run, later measurement. The 02:46Z breadcrumb
(`00-00-supervisor-2026-09-03-0246-...`, merged in `#1524`) left **F4 open** with its
discriminator in flight. This closes it, and records one new defect found while waiting.

## GROUND

```
UTC            2026-09-03T03:25:00Z
origin/main    f5c80e43
dev tree       main @ f5c80e43   C:\ProjectOperations2
doc version    1
bootstrap      1
```

## WHAT I MEASURED

**[MEASURED] A1 — `#1523`'s e2e failure is a REAL REGRESSION, not a flake. F4 is answered.**
Two runs, two different head SHAs, byte-identical outcome:

| run | head | result | the one failure |
|---|---|---|---|
| `33697001238` | `c39558e4` | 163 passed / 1 skipped / **1 failed** | `batch3-scope-items.spec.ts:256` |
| `33709849227` | `bd08b0f8` | 163 passed / 1 skipped / **1 failed** | `batch3-scope-items.spec.ts:256` |

Both: `Test timeout of 60000ms exceeded`, then
`Error: apiRequestContext.fetch: Target page, context or browser has been closed` at
`pr-acceptance/api-helpers.ts:65`. **That second line is teardown, not the cause** — the context is
torn down at the 60 s deadline while a cleanup `fetch` is in flight, so it is a symptom of the
timeout and reading it as "a network/browser flake" is the trap here. A flake does not reproduce
identically on two heads.

**[MEASURED] A2 — the cause, from the diff and not from the review.** The failing test is
`"plant pills: add a plant cluster, set qty/days, remove it (PRs #241, #72)"`. It drives the plant
controls **inside the scope-item body**. `gh pr diff 1523` removes exactly that:

```
-                      <ItemPlantCell
-// Per-row plant + measurement cell. Slice 3 moved the Manpower columns out;
-// this cell retains plant clusters and the full measurement section until
-// slice 4 (plant columns) and slice 5 (measurement) move them.
-  // Row 0: delegate to ItemBodyInputs which retains the full plant +
```

Slice 4 **is** the removal of that delegation — it replaces `ItemPlantCell` (which rendered the old
plant pills via `ItemBodyInputs`) with five discrete WBS columns. So the acceptance test times out
because **the UI it drives no longer exists in that place**. The slice moved the controls and did not
move the test that proves them.

Note the reviewer (`docs/pr-reviews/pr-1523-review.md`) recorded *"Plant section cleanly removed from
ItemBodyInputs"* as an in-scope observation and separately called e2e *"unrelated infrastructure
checks"*. Both halves of the answer were in one review, unconnected, and the verdict was MERGE.
**A review verdict is not evidence a PR is green** — this is the second time that line has earned
its place in the standing methods.

**[MEASURED] A3 — merging my own board PR moved `#1523`'s head and CANCELLED the diagnostic rerun
I had deliberately started.** Timeline, all from `gh`:

```
02:59:28Z  #1524 merged to main
03:01:50Z  bd08b0f8  "Merge branch 'main' into feat/scope-wbs-plant-columns"   <- I did not do this
           run 33697001238 (my rerun) -> conclusion: CANCELLED
03:02:xxZ  run 33709849227 starts from scratch on the new head
```

Nothing in that merge commit is mine. It is `pollForBehindPrs()` — `PR_WATCHER_AUTO_UPDATE` is
`"true"` at `start-watcher.ps1:159` while `index.mjs:155` and `README.md:90` both document the
default as OFF. The drift itself is already on the record and still unstaged. **What is new is the
consequence:** every board PR Station 00 merges rebases every open PR within ~2 minutes, which
**cancels any in-flight CI, including a rerun a station started on purpose to answer a question.**
So the doctrine's own first move on a suspected flake — `gh run rerun --failed` — is silently
destroyed by the next merge. Here it cost 14 minutes and was only survivable because the fresh run
asked the same question by accident.

## WHAT CHANGED

- Nothing on `#1523`. No push to its branch, no label touched, no merge.
- This breadcrumb, in its own board PR off `origin/main` in a disposable worktree.

## FINDINGS

**A-F1 — `#1523` carries a real regression: its own acceptance test was not moved with the code.**
A1 + A2. The fix is small and precisely located: `tests/e2e/pr-acceptance/batch3-scope-items.spec.ts`
at the test starting **line 256**, whose steps must be repointed from the item-body plant pills to
the five WBS plant columns slice 4 introduced in `ScopeQuantitiesTable.tsx`. It is a `tests/`-only
change, so it is **not** Marco's lane and does not need him — but it must land **on
`feat/scope-wbs-plant-columns`**, because that is where the test must pass.
**The trap for whoever does it:** the obvious "fix" — relaxing or deleting the assertions until it
passes — produces a green check that verifies nothing, which is the failure mode this pipeline
already has a name for. The test must exercise the plant columns in their **new** location.
**DISPOSITION: ACTIONED (diagnosed) + DISPATCHED — to Station 01, as a `tests/`-only prompt.**
I stopped at the diagnosis deliberately: rewriting a Playwright acceptance test's selectors is
code-writing in a disposable worktree, which is 01's contract, not mine, and the failure mode of
getting it wrong is a test that lies. **Everything 01 needs is in A2 — the file, the line, the cause
and the constraint. Do not re-derive it.**

**A-F2 — `PR_WATCHER_AUTO_UPDATE=true` makes Station 00's own merges cancel Station 00's own
diagnostics.** A3.
**DISPOSITION: DISPATCHED — to Station 03**, which owns the watcher's lifecycle and configuration.
Two things, and they are separable: (i) the documented default (`OFF` in `index.mjs:155` and
`README.md:90`) disagrees with the shipped value (`"true"` at `start-watcher.ps1:159`) — one of the
two is wrong and the drift should be resolved rather than papered over; (ii) `pollForBehindPrs()`
has no guard against updating a PR whose required checks are currently RED or RUNNING, which is
what turns a harmless rebase into a cancelled diagnostic. Both remain unstaged.

**A-F3 — the tracked `.arming-log.txt` now differs from `main` by line endings alone.**
Committing it from a worktree normalised it to CRLF (`git` warned "LF will be replaced by CRLF");
the dev-tree copy is LF. Content is identical — verified line-by-line, 36 lines each, same tail —
but `git hash-object` differs (`b2d1fcb4` local vs `55aedcd2` on `main`), so the file reads as
permanently modified in the dev tree and every future board PR will offer to "change" it. Given this
file already has two writers and has already lost an arm once, a third way for it to look modified
when it is not is worth removing.
**DISPOSITION: DEFERRED** — the cure is a one-line `.gitattributes` entry, but it belongs with
whoever next touches the arming-log's two-writer problem rather than as a drive-by.

## WHAT I DID NOT DO

- **Did not push a test fix to `feat/scope-wbs-plant-columns`.** Two reasons, and the second is the
  real one: the head is being moved by the watcher on a timer (A3), and rewriting acceptance-test
  selectors is 01's lane, where a wrong answer is a test that passes while proving nothing.
- **Did not merge, label, or re-run anything on `#1523`.** It is `escalates:true`, labelled
  `do-not-merge`, and its watcher verdict is `marco:true`. RULE 2.
- **Did not change `PR_WATCHER_AUTO_UPDATE` or restart the watcher.** The watcher's lifecycle is
  03's; the sweep reports it RUNNING and healthy and there is nothing wedged.
- **Did not arm `pr-vmguard-s1`**, now tracked on `main` via `#1524`. It is armable next run; the
  02:46Z breadcrumb says why this run staged rather than armed.
