---
premise: '! grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1'
premise_means: status-sweep.ps1 has no way to skip or shorten section 5, so its closing SAFE / CAUTION / DO-NOT-ACT verdict is unreachable inside a station run.
scope:
  - scripts/pipeline/status-sweep.ps1
  - scripts/pipeline/__tests__/status-sweep-section5.test.mjs
  - docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md
done_when: pnpm lint && node --test scripts/pipeline/__tests__/status-sweep-section5.test.mjs && grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1
size: 3
gate_allow: none
seed_only: false
escalates: false
module: pipeline
---

# status-sweep section 5 - dedupe the PR crawl and add a fast-exit switch (RETIRED)

## Retirement note

This prompt is retired by the PR that satisfies its `done_when`. `scope` names this very file,
so the retirement is the PR's own paper trail: without it, PROMPT-SCHEMA's self-retirement rule
would re-arm this prompt forever. Do not re-arm from this copy; read the merged PR for the
built form of the three changes (cache, switch, timing) and the test file that asserts them.

## The defect this removed

`scripts/pipeline/status-sweep.ps1` is the pipeline's safe-to-act gate. Its closing line is a
**SAFE / CAUTION / DO-NOT-ACT** verdict, and every station is told to obey it. That verdict sits
after section 5, and **section 5 did not finish inside a station run.**

Measured by Station 00 on four consecutive hourly occurrences (2026-10-09 at 14:27Z, 15:27Z, 16:14Z
and 17:14Z, breadcrumbs landed as #2286, #2287, #2289 and the 1714 report): each run was still
enumerating when its reading budget ran out, so **each one had to write "I quote no sweep verdict."**
A gate whose verdict no caller ever reaches is a gate that is not in force.

The cause was in section 5's shape, not its purpose. It re-checked every `#N` reference inside
`docs/pr-prompts/needs-marco/` against GitHub by calling `gh pr view <n> --json state,isDraft,mergedAt`
**once per occurrence of the number**, not once per number. Measured 2026-10-09T16:29Z by Station 00:
**383 occurrences, 153 distinct numbers, across 52 files** - so roughly 230 of those round trips asked
GitHub a question it had already answered in the same run.

## What this PR built

Three changes, all inside `scripts/pipeline/status-sweep.ps1`, plus one test file.

1. **Per-PR cache.** Ask each DISTINCT PR number at most once per run (`$prViewCache`). Readings
   stay byte-identical to what section 5 reports today - this is a de-duplication, not a change of
   meaning.
2. **`-SkipSection5` switch parameter.** When passed, skip the needs-marco crawl entirely and
   print one `[SKIP]` line naming the section and why. DOCTRINE 9.6: an empty result is not an
   empty world, and a skipped section must not read as a clean one. The default run is
   unchanged - section 5 still runs when the switch is absent.
3. **Per-section elapsed line.** One `[TIMING] section <name> elapsed=<N>s` line per section, so
   the next station can see where the time actually goes.

The test file (`scripts/pipeline/__tests__/status-sweep-section5.test.mjs`) is source-level - the
sweep is PowerShell and the Ubuntu CI runner has no pwsh. It asserts the invariants the prompt
named: the cache is declared before the needs-marco foreach; the only `gh pr view` call site is
gated by a cache miss; the `[switch]$SkipSection5` parameter exists and emits a `[SKIP]` line
inside the skip branch; the needs-marco crawl is suppressed in skip mode; section 7 and the
SWEEP COMPLETE line sit after the skip branch so the closing verdict is reachable in both modes.
