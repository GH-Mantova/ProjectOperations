# 2026-08-20 — Measurement discipline near-misses

Four sub-incidents, same day. References are shared at the end.

---

## Sub-incident 1 — Measured the wrong tree

### What happened

Two orphan prompts were reported as "gone from the tree" after reading the shared dev-tree working
copy, which the watcher mutates and which was 13 commits behind origin/main. Both prompts are on
main, and there is a third. `queue-sync.ps1` prints a DRIFT warning stating "local greps and lint
runs from it will lie" — it had been read the same hour.

### Why it matters

Acting on that report would have left three prompts permanently orphaned, silently discarded
rather than queued. Work would have been lost without any error surfacing.

### Lesson

Measure in a clean `origin/main` worktree. Read arming state, and only arming state, from the dev
tree. When `queue-sync.ps1` emits a DRIFT warning, treat all subsequent readings from that tree as
invalid until re-synced.

---

## Sub-incident 2 — Reported the input, not the outcome

### What happened

The Playwright browser cache was called "confirmed working" after a 4-second cache restore. The
install step still took 667 seconds, because the real cost is `--with-deps` installing 181 apt
packages every run; only 23 of the 181 are webkit-family. The prompt that introduced the cache had
already said "a cache that has only ever been observed missing has not been shown to work" — that
clause was ignored.

### Why it matters

The optimisation was reported as effective and the CI cost continued unchanged. A misleading result
presented as confirmed feeds future decisions built on a false baseline.

### Lesson

Confirm the outcome, not the input. A cache restore completing in 4 seconds proves the cache
exists; it does not prove the slow step was eliminated. Measure the step you intended to speed up,
not the step before it.

---

## Sub-incident 3 — One data point presented as a baseline

### What happened

A single 40-second pre-cache run was about to be reported as a 16x regression against a
post-cache result. The actual distribution is bimodal both before and after:
pre-cache `39 47 50 51 | 551 748`; post-cache `40 123 | 344 579 665 667 1099`.

### Why it matters

A 16x regression headline triggers investigation and rollback pressure. The actual distribution
shows no meaningful difference — both have a fast cohort and a slow cohort. Acting on N=1 wastes
engineering time and can cause correct changes to be reverted.

### Lesson

N=1 is not a baseline. Before reporting a performance change, collect enough runs to see the
distribution. A single fast or slow result is a prompt to gather more data, not a finding.

---

## Sub-incident 4 — Armed a wave before diffing scopes

### What happened

Five of fifteen prompts in a wave collided: four `fv2` prompts all edit `forms.module.ts`; `tr-s1`
shares `schema.prisma` with `ew-s1`. The collisions were only found because a hash check on four
files described as duplicates came back not identical.

### Why it matters

Concurrent edits to the same file produce merge conflicts or silent overwrites depending on order.
A wave armed with scope collisions either stalls the merge queue or corrupts one prompt's changes
with another's.

### Lesson

Diff scopes pairwise before arming a wave. For every pair of prompts in the wave, confirm no file
appears in both scope lists. A hash check on files flagged as identical is not optional — "looks
the same" is not the same as "is the same."

---

## Closing countermeasure

Every sub-incident above was a reading taken from an instrument that had not been calibrated.
The countermeasure that caught each one: run a known-true and a known-false probe through the same
instrument before trusting any reading, and discard the pass if either misbehaves. A check that
cannot be shown to fail on a known-bad input has not been shown to work.

---

## References

- `sot/05-decisions-and-lessons.md` (incident ledger)
- `queue-sync.ps1` DRIFT warning: "local greps and lint runs from it will lie"
- No PR references — all four incidents were near-misses caught before commit.
