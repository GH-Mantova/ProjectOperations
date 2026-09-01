---
premise: grep -q ':1518' docs/pipeline/DOCTRINE.md
premise_means: DOCTRINE section 9.5 still pins its "single gh call" citation to lint-prompt.mjs line 1518. PR 1457 moves that line to 1535, so the citation goes stale the moment 1457 lands.
scope:
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/stations/_canonical-blocks.json
done_when: pnpm lint && node scripts/pipeline/lint-station.mjs && ! grep -q ':1518' docs/pipeline/DOCTRINE.md
size: 2
gate_allow: none
seed_only: false
escalates: false
requires_on_main: scripts/pipeline/lint-prompt.mjs :: NOT_A_PROMPT
---

# DOCTRINE 9.5: cite the symbol, not the line number

## Why this exists

Station 04 measured this on 2026-08-31T22:2xZ at `origin/main` 6d19e841.

DOCTRINE section 9.5 pins fifteen `scripts/pipeline/lint-prompt.mjs:<line>` citations. Fourteen of
them (`:439 :492 :563 :728 :730 :732 :743 :755 :767 :826 :865 :903 :1164 :1165`) were verified to
land on the claimed content on BOTH `origin/main` and `origin/feat/lint-not-a-prompt` (PR #1457).
They are stable.

The fifteenth is not. Section 9.5 says the exported `checkFixesPrTargetOpen` is
"reached from ... (`:1518` calls it *a single gh call*)". Measured:

- `origin/main`: `single gh call` is at line **1518**. The citation is CORRECT today.
- `origin/feat/lint-not-a-prompt` (PR #1457, CLEAN, 13/13 green, +46/-7 in that same file):
  `single gh call` is at line **1535**. `checkFixesPrTargetOpen` stays at `:1132` on both.

So the instant #1457 merges, the one document every station is told it can trust carries a wrong
line number - inside `<!-- CANONICAL-BLOCK: instruments v2 -->`, which is hash-gated. The hash
protects that block from being EDITED. It does not protect it from going STALE. Section 9.5 already
records this exact failure once (the block-scalar bullet asserted a pending fix for thirteen hours
after it had landed, read in full by four station runs, caught by none).

A line number is a stale-by-construction instrument: it is invalidated by any edit ABOVE it, in a
file nobody is obliged to tell DOCTRINE about.

## What to build

Edit `docs/pipeline/DOCTRINE.md`, section 9.5 only, in the bullet beginning
"**`lint-prompt.mjs` does NOT reject when `git` is missing or broken**".

1. Replace the line-number citation `(`:1518` calls it *"a single gh call"*)` with a SYMBOL-anchored
   one that no edit above it can invalidate - cite the call site by its function and its comment
   text rather than by line, e.g. `(the comment "single gh call, no shell subprocess" above the
   `checkFixesPrTargetOpen({ fixesPr, fetchState: fetch })` call site)`.
2. Leave the other fourteen citations ALONE. They were measured stable across #1457 and re-pinning
   them is churn with a fresh chance to introduce an error.
3. Add one short sentence to the same bullet recording the general rule this instance proves:
   a line-number citation into a file outside this document is invalidated by any edit above it,
   so prefer a symbol or a fixed string as the anchor.
4. Re-record the canonical-block hash: `node scripts/pipeline/lint-station.mjs --write-canonical`,
   and commit the regenerated `docs/pipeline/stations/_canonical-blocks.json` in the SAME PR.
   `lint-station.mjs` hard-fails a section-9 edit whose hash was not re-recorded.
5. Verify: `node scripts/pipeline/lint-station.mjs` exits 0 and prints ADMIT for all 7 docs.

## Do NOT

- Do NOT touch any file outside `docs/pipeline/`. This is a docs-only PR; mixing code or `sot/`
  fails CP-24.
- Do NOT edit `scripts/pipeline/lint-prompt.mjs`. The code is correct; the citation is what drifted.
- Do NOT re-pin the citation to `:1535`. That is the same instrument, aimed one edit further along;
  it would be wrong again on the next change above it. The point of the fix is the anchor type.
- Do NOT restate DOCTRINE section 9.1 or any other canonical block, and do NOT edit
  `STATION-CAPABILITIES.md` (it is forbidden from paraphrasing section 9).
- Do NOT alter section 9.5's other bullets.

## Guardrails

- ONE attempt. If you cannot land it, say `NO-OP: <reason>` plainly - never exit silently.
- Never ask a question and never "stand by" for approval. There is no human in this run.
- Read the CI job log before diagnosing any red check. Never reason a failure out of the diff.
- Re-verify the premise on the current head before acting: `grep -n 'single gh call'
  scripts/pipeline/lint-prompt.mjs` and `grep -n ':1518' docs/pipeline/DOCTRINE.md`. If #1457 landed
  differently from the measurement above, chase the current file, not this write-up.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.
