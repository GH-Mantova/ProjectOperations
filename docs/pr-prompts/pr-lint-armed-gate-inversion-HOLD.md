---
premise: '! grep -q "ARMED_GATE_STILL_CHECKED" scripts/pipeline/lint-prompt.mjs'
premise_means: >-
  lint-prompt.mjs still runs checkGateNotReleased under an `if (isHold)` guard, so a prompt whose
  requires_on_main / requires_file_on_main gate is UNMET rejects while it is parked and admits the
  moment it is armed. The gate protects the prompt only while nothing can run it.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/**
  - scripts/pipeline/test-lint-prompt.mjs
done_when: >-
  grep -q "ARMED_GATE_STILL_CHECKED" scripts/pipeline/lint-prompt.mjs && node
  scripts/pipeline/test-lint-prompt.mjs
size: 3
gate_allow: none
seed_only: false
escalates: true
backfill: false
---

# The unmet-gate check stops applying at the exact moment it starts to matter

## The defect, measured 2026-08-28

`scripts/pipeline/lint-prompt.mjs`, in `lint()`:

```js
// GATE_NOT_RELEASED / FILE_GATE_NOT_RELEASED - for HOLDs with a gate key whose
// condition is ABSENT from origin/main.
if (isHold) {
  const gnrRes = checkGateNotReleased(fm, repoRoot, name, isHold);
  if (!gnrRes.ok) return fail(gnrRes.code, gnrRes.msg);
}
```

`isHold` is derived from the FILENAME. Arming renames `-HOLD.md` to `-ready.md`. So the check that
says "your gate is not satisfied, you may not run" is skipped for exactly the prompts that are about
to run.

**Isolated to one variable** — same bytes, three placements, so neither content nor directory can
explain it:

```
pr-rates-s11c-drop-legacy-tables        (scope reaches apps/api/prisma)
  1. in place, -HOLD name      exit=1  REJECT [FILE_GATE_NOT_RELEASED]
  2. scratch dir, -HOLD name   exit=1  REJECT [FILE_GATE_NOT_RELEASED]
  3. scratch dir, -ready name  exit=0  ADMIT
  -> CAUSE = FILENAME, not location
```

Identical result for `pr-tenant-mt4-s2-ownership-migration`.

**Blast radius, measured across all 56 board HOLDs** (each copied to a scratch dir and linted under
both names; nothing in `docs/pr-prompts` was modified): 37 carry a `requires_*` gate, and **24 of
those 37 reject while held on an unmet gate and admit once armed.** They include the whole
`crm-build` chain `s4` through `s12` — the ordering gates that keep that chain in sequence — plus the
two prompts whose gate is a human approval file that does not exist on main.

## Why this has not already caused an incident

`scripts/pipeline/arm-prompt.ps1` lints the **pre-rename HOLD** name before renaming, and refuses on
any non-zero exit. That is the only thing closing the hole, and it closes it in a different file, in
a different language, on a different code path.

It is not hypothetical that arming happens elsewhere: `00-06-pr-master-2026-08-26-1133-...` records
an arm performed as a filesystem rename via `fs.renameSync`, never `git mv`, never `arm-prompt.ps1`.
Any such path loses the gate silently. Nothing re-lints after arming — the two `lint-prompt` mentions
in `scripts/pr-watcher/index.mjs` are comments, not invocations.

## Do

1. **Run `checkGateNotReleased` for every prompt, not only HOLDs.** Delete the `if (isHold)` wrapper
   so the call is unconditional. `checkGateNotReleased` already takes `isHold` and can word its
   message for either state; the decision to *run the probe* must not depend on the filename.

2. Introduce the literal `ARMED_GATE_STILL_CHECKED` as a named constant or comment marker at that
   call site — this is what the premise and `done_when` grep for. Give it a one-line comment saying
   why the check is filename-independent, so the guard is not reintroduced as a "simplification".

3. **Keep every existing fail-safe.** A probe that errors must still warn-and-skip, not reject. One
   broken `git` call must never bin the queue.

4. Leave `checkFileGateDead` and `checkDeadGate` exactly as they are. Their HOLD/non-HOLD split is
   deliberate and correct: a gate satisfied at author time is a promotion signal for a HOLD and a
   dead gate for an armed prompt. **Only the unmet-gate path is wrong.**

## Do NOT

- Do **not** fix this by adding a second `00-*`-style check to `arm-prompt.ps1`. That is what already
  exists, and it is the coupling that makes the bug survivable rather than absent. The linter must
  give the same answer about the same bytes whatever the file is called.
- Do **not** change the verdict codes or their exit codes. `FILE_GATE_NOT_RELEASED` and
  `GATE_NOT_RELEASED` keep their names and keep exiting 1.
- Do **not** "fix" the 24 exposed prompts by editing their gates. They are correct; the linter is
  wrong.

## Verification

Add cases to `scripts/pipeline/test-lint-prompt.mjs` (or a new file under `__tests__/`) covering:

- **must REJECT** — an armed (`-ready.md`) prompt whose `requires_file_on_main` path is absent from
  origin/main → exit 1, `FILE_GATE_NOT_RELEASED`. *This is the case that passes today.*
- **must REJECT** — an armed prompt whose `requires_on_main: <path> :: <needle>` needle is absent →
  exit 1, `GATE_NOT_RELEASED`.
- **must still REJECT** — the same two bodies under `-HOLD.md` names, unchanged behaviour.
- **must still ADMIT** — an armed prompt whose gate IS satisfied and which is not clustered.
- **must still REJECT `CLUSTER_DEAD_GATE`** — an armed clustered prompt whose needle is present, so
  step 4's carve-out is proven intact.
- **must still PROMOTE** — a HOLD whose gate has just released, emitting `GATE_RELEASED`.

Then re-run the board sweep: every one of the 24 must reject under its armed name, and the 13 gated
HOLDs that are not in the exposed set must be unchanged.

## Note on today's blast radius

Zero currently-armed prompts are affected — the board carries no armed slice with an unmet gate right
now, and all 24 already reject while held. This closes a hole going forward rather than changing any
verdict in flight.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
