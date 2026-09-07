---
premise: '! grep -q READY_PATTERN scripts/pipeline/arm-prompt.ps1'
premise_means: >-
  arm-prompt.ps1 does not know the one pattern that decides whether the watcher can ever dequeue
  what it arms, so it will happily arm a prompt no node will run. MEASURED 2026-09-07T01:2xZ at
  origin/main 14c6810c - scripts/pr-watcher/index.mjs declares
  `const READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i` and gates its queue scan on it, while
  arm-prompt.ps1 (506 lines) contains the token READY_PATTERN zero times (POSITIVE controls in the
  same file - $PROMPT_DIR 3, ARMED 1; NEGATIVE control, a freshly minted needle, 0). Live instance -
  fix-1740-jest-cannot-parse-puppeteer-25-esm-ready.md was staged by #1744, armed at 00:20:55Z and
  sat unrunnable for 62 minutes. lint-prompt.mjs said ADMIT, status-sweep.ps1 said `armed: 1`,
  restart-watcher-if-wedged.ps1 said HEALTHY; only the watchdog saw it, as
  `WATCHDOG armed=1 runnable=0 -- nothing this node can dequeue`, in a line that then calls the idle
  legitimate. Renaming the file to pr-fix-1740-...-ready.md made the watcher dequeue and start it
  within ONE SECOND, which is the proof that the prefix was the whole fault.
scope:
  - scripts/pipeline/arm-prompt.ps1
  - scripts/pipeline/__tests__/arm-prompt.test.mjs
done_when: >-
  grep -q READY_PATTERN scripts/pipeline/arm-prompt.ps1 && node --test scripts/pipeline/__tests__/arm-prompt.test.mjs && pnpm build && pnpm lint
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# ARMGUARD-S2: refuse to arm a name the watcher can never dequeue

**Second slice on the script `#1742` hardened.** ARMGUARD-S1 made `arm-prompt.ps1` refuse a prompt
that is *already* armed. This slice makes it refuse a prompt whose armed name is *unreachable*.
Same script, same failure family: the arm succeeds and the work never runs.

## The defect, stated exactly

`scripts/pr-watcher/index.mjs` decides what may enter the queue with a single constant:

```js
const READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i;
```

`arm-prompt.ps1` builds `"$PROMPT_DIR/$Name-ready.md"` and never checks that the result can match.
So arming `fix-1740-jest-cannot-parse-puppeteer-25-esm` produces a file the watcher's queue scan
skips forever. The prompt is armed, tracked as armed by every census, and dead.

**It fails in the dangerous direction.** The board reports work in flight; nothing is in flight.
No `fix-*` prompt has ever been dequeued in this repo — the only two `fix-*` entries in
`docs/pr-prompts/processed/` are `*-already-done.md` marker files, against 1777 `pr-*` entries —
so this trap has simply never been sprung before, not been guarded against.

## What to build

1. **A refusal in `arm-prompt.ps1`, before the `git mv`.** Compute the name the arm would produce
   and test it against the same regex the watcher uses. On no match, **exit non-zero** with a
   message that names both the offending name and a conforming suggestion, e.g.

   ```
   REFUSED: 'fix-1740-...-ready.md' can never be dequeued - the watcher's READY_PATTERN is
   /^(pr|rev)-.*-ready.md$/i. Rename the HOLD to 'pr-fix-1740-...-HOLD.md' and arm that.
   ```

   Nothing is renamed, moved or logged on the refusal path — a refused arm must leave the queue
   byte-identical to how it found it.

2. **Do not re-derive the regex from prose.** Read it from `scripts/pr-watcher/index.mjs` if you
   can do so cheaply and deterministically; otherwise hard-code it *and* add a test that fails the
   moment the two drift apart. A copy nobody checks is how this class of bug returns.

3. **Tests in `scripts/pipeline/__tests__/arm-prompt.test.mjs`**, following the file's existing
   style. At minimum:
   - a POSITIVE case: `pr-foo` and `rev-1234` arm normally (the guard does not change today's
     behaviour);
   - a NEGATIVE case: `fix-1740-jest-cannot-parse-puppeteer-25-esm` is REFUSED, exit non-zero,
     and the `-HOLD.md` is still on disk afterwards;
   - a DRIFT case: the pattern the guard enforces equals the pattern `index.mjs` declares.

## What NOT to do

- **Do NOT widen `READY_PATTERN` in `scripts/pr-watcher/index.mjs`.** `pr-` / `rev-` is the naming
  convention; the defect is that arming does not enforce it. Widening it also silently changes a
  live daemon's dequeue set, and a running watcher keeps executing the OLD code until it is
  restarted — so the fix would appear to land and not take effect.
- **Do NOT rename anything in `docs/pr-prompts/` as part of this slice.** The one live instance was
  already corrected by Station 00 on 2026-09-07 and its PR is `#1740`'s branch.
- **Do NOT make the guard a warning.** A warning in a headless arm is read by nobody. The whole
  value here is a non-zero exit.

## Acceptance

`grep -q READY_PATTERN scripts/pipeline/arm-prompt.ps1` succeeds, the new tests pass under
`node --test`, and `pnpm build` + `pnpm lint` are clean. Say in the PR body which of the two
approaches in step 2 you took, and why.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
