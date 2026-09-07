---
premise: '! grep -q "VERDICT_HEADING_TOLERANT_V1" scripts/pr-watcher/index.mjs'
premise_means: >-
  The watcher decides whether its own reviewer approved a PR with one regex at
  scripts/pr-watcher/index.mjs:1418 - /^VERDICT:\s*MERGE\b/m - which is anchored hard at
  start-of-line and tolerates no markdown heading prefix. The reviewer agent's output format is
  not constrained, and when it writes the verdict as a heading ("## VERDICT: MERGE") instead of
  bare at column 0, the regex returns false and the watcher reads its own reviewer's MERGE as
  "no approval". It then falls out of the auto-merge branch at :1826 and records
  {"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"} at :1848
  - byte-identical to a genuine policy routing, which RULE 2 then correctly refuses to clear.
  This is the same defect shape as the GATE-ALLOW marker trap ("must be BARE at column 0"), on a
  second regex, and verdictApproves is neither exported nor covered by any test.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/verdict-anchor.test.mjs
done_when: pnpm lint && node --test scripts/pr-watcher/__tests__/verdict-anchor.test.mjs && grep -q "VERDICT_HEADING_TOLERANT_V1" scripts/pr-watcher/index.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
rollback_strategy: >-
  One regex widened from /^VERDICT:\s*MERGE\b/m to /^#{0,6}[ \t]*VERDICT:\s*MERGE\b/m, plus one
  new test file. Strictly additive: #{0,6} admits zero hashes and [ \t]* admits zero spaces, so
  every string that matched before still matches; MERGE\b is untouched, so no FIX or BLOCK verdict
  can newly approve. No schema, no migration, no data. Revert the commit and the old regex is back.
---

# The verdict reader is anchored, and a markdown heading defeats it

## What is wrong

`scripts/pr-watcher/index.mjs:1414-1419`:

```js
async function verdictApproves(prNumber, prFiles) {
  const verdictPath = path.join(REPO_ROOT, "docs", "pr-reviews", `pr-${prNumber}-review.md`);
  ...
  if (!/^VERDICT:\s*MERGE\b/m.test(content)) return false;
```

The comment two lines above (`:1410-1411`) states the contract: *"The reviewer writes
docs/pr-reviews/pr-{N}-review.md with the verdict on the first line: 'VERDICT: MERGE'"*.
**Nothing enforces that contract on the reviewer**, and the reviewer does not always honour it.

## The measurement (2026-09-03T13:2xZ, origin/main `12df7bfc`)

Reproducing the live regex verbatim in node, over every `pr-*-review.md` reachable on this box
(602 files across the watcher clone, `verdicts-archive/` and the dev tree):

```
MERGE verdicts (loose):              478
  matched by the LIVE strict regex : 474
  SILENTLY MISSED (heading form)   :   4   -> pr-1543 (live, open) and pr-762 (historic, x3 copies)
```

Controls, same run:

```
POS  'VERDICT: MERGE'      -> true      (the regex CAN pass)
NEG  'VERDICT: BLOCK'      -> false
BUG  '## VERDICT: MERGE'   -> false     <-- the defect
```

Live instance: `pr-1543-review.md` line 3 is `## VERDICT: MERGE`, and its Recommendation section
reads "Merge." `verdictApproves(1543)` returns **false**.

## Honest scoping - what this does NOT claim

**#1543's own `marco:true` was NOT caused by this.** Its recorded reason is
`"outside tests/ or docs/: scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs"` - it fell
out on the policy classifier at `:1774/:1776`, before the verdict was ever consulted. So this
defect is **latent** on today's board, not operative.

It becomes operative on the first PR that is otherwise policy-eligible (diff confined to
`tests/**` + `docs/**`) whose reviewer happens to write the heading form. `pr-762` shows that has
already happened once. It is a **third, independent** cause on the `tests-docs` deadlock thread,
alongside the CI-creation-latency timeout and the `verdict-guard.mjs` backticked-path extractor -
and unlike those two it is a one-line fix.

## What to build

1. **Widen the regex at `:1418`** to tolerate an optional markdown heading prefix, and mark it:

   ```js
   // VERDICT_HEADING_TOLERANT_V1 - the reviewer sometimes writes "## VERDICT: MERGE".
   // #{0,6} and [ \t]* both admit zero, so every previously-matching string still matches.
   if (!/^#{0,6}[ \t]*VERDICT:\s*MERGE\b/m.test(content)) return false;
   ```

2. **Export the predicate so it can be tested.** Lift the regex test into a small pure exported
   function (e.g. `export function verdictTextApproves(content)`) and have `verdictApproves` call
   it. Do not change `verdictApproves`'s signature or its `validateVerdict` guard call at `:1420` -
   **the guard stays exactly as it is.**

3. **Add `scripts/pr-watcher/__tests__/verdict-anchor.test.mjs`** with, at minimum:
   - bare `VERDICT: MERGE` -> true (positive control; this is the regression test that the widening
     did not break the normal path)
   - `## VERDICT: MERGE` -> true (the fix)
   - `VERDICT: BLOCK` -> false and `## VERDICT: FIX` -> false (negative controls; **these are the
     regression tests that matter** - they prove the widening did not make the reader permissive)
   - a fixture with the verdict on line 3 rather than line 1 -> true

## What NOT to do

- **Do not touch `verdict-guard.mjs`.** Its backticked-path extractor is a separate, already-
  dispatched defect. Fixing two things in one PR makes both harder to revert.
- **Do not fold any assertion into `scripts/pr-gates/pr-gates.mjs`** - CP-26 failing there takes
  `PR gates - diff checks` down with it, one cause producing two reds.
- **Do not relax `MERGE\b`.** The word boundary is what stops `MERGED`/`MERGE-WITH-NITS` slipping
  through, and a permissive verdict reader is far worse than a strict one.
- Do not change the reviewer's output format as the fix. Constraining the producer is a fine
  follow-up, but the reader must be robust either way - it is the thing standing between a green
  docs PR and a permanent human gate.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build this in a disposable worktree off `origin/main`, run `pnpm build` and `pnpm lint`, open the
PR, and stop there. Do **not** merge it - it touches `scripts/`, so the policy classifier routes it
to Marco and RULE 2 applies.
