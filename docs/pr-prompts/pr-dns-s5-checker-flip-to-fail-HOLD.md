---
premise: '! test -f scripts/pipeline/check-d-register.mjs || grep -q "WARN_ONLY" scripts/pipeline/check-d-register.mjs'
premise_means: The D-register checker is still warn-only (or does not exist yet, because slice 4 has not landed), so an unregistered or invented D<n> citation can still land on main unchallenged. Dies only when the checker exists AND is no longer warn-only. The absent-file arm is deliberate - a bare grep on a file slice 4 creates exits 2 and lints as PREMISE_INVALID while this slice is correctly waiting on its gate.
scope:
  - scripts/pipeline/check-d-register.mjs
  - scripts/pipeline/__tests__/check-d-register.spec.mjs
done_when: pnpm lint && ! grep -q "WARN_ONLY" scripts/pipeline/check-d-register.mjs && grep -q "ENFORCE" scripts/pipeline/check-d-register.mjs && node --test scripts/pipeline/__tests__/check-d-register.spec.mjs
size: 2
gate_allow: none
seed_only: false
escalates: true
cluster: d-namespace
cluster_order: 5
requires_on_main: scripts/pipeline/check-d-register.mjs :: D_REGISTER_MODE
---

# D-namespace S5 - flip the checker from warn to fail

**Slice 5 of 5, the last.** Full spec:
`docs/pr-prompts/00-supervisor-2026-08-20-D-NAMESPACE-CHAIN-for-05-and-06.md`.

**Machine gate:** slice 4 must be on main - `D_REGISTER_MODE` present in
`scripts/pipeline/check-d-register.mjs`.

## 🔴 THE HUMAN PRECONDITION - and why the machine gate is not enough

The spec requires, on top of the gate above:

> **ONE clean warn-only run on main must be read first.**

**No gate can assert that a human read something.** Station 00 enforces it by not arming this slice
until it has happened, and this prompt carries `escalates: true` so the PR stops for Marco even once
it is green.

**Before you change a single line, verify the precondition yourself:**

1. Run `node scripts/pipeline/check-d-register.mjs` against the current tree.
2. If it reports **any** finding, **STOP.** Say `NO-OP: checker still reports N findings - flipping
   to fail would red-light every PR` and list them. **Do not flip it.** A checker that fails on
   day one on pre-existing debt is exactly the outcome the warn-only stage exists to prevent, and
   `scheduler-resourcing-spec.md` alone carried 40 references when the chain was designed.
3. Only a genuinely clean run justifies the flip.

This is the one slice in the chain where **the right answer may be to do nothing**, and reporting
that plainly is a success, not a failure.

## What to build

If and only if the run is clean:

- Change `D_REGISTER_MODE` from `"WARN_ONLY"` to `"ENFORCE"` (or an equivalently named constant -
  `done_when` asserts the literal `ENFORCE` is present and `WARN_ONLY` is gone).
- In enforce mode the checker **exits non-zero** when it finds an unregistered citation. Warn mode's
  reporting stays exactly as it is - the only change is the exit code and the mode constant.
- **Keep every exclusion from slice 4 byte-identical.** Narrowing an exclusion while flipping to
  fail turns a false positive into a merge block, and the two changes would be impossible to tell
  apart in the diff.

### Tests

Extend the existing spec rather than replacing it:

- in `ENFORCE` mode, an unregistered `D99` produces a **non-zero exit**;
- in `ENFORCE` mode, a tree with only registered citations exits **zero**;
- every slice-4 exclusion still holds under enforce mode - **re-run the same cases, do not assume
  they carry over**;
- the near-miss cases still discriminate (`TFM-D3` excluded, bare `D3` flagged).

**Ask of every check: what result would have made this fail?** A flip-to-fail slice whose tests only
prove the happy path has verified nothing.

## Do NOT

- **Do NOT flip if the checker reports anything.** Report and stop.
- **Do NOT "fix" findings by widening an exclusion.** If a real citation is flagged, the citation is
  wrong or the register is incomplete - both are decisions for a human, not for this slice.
- **Do NOT touch `sot/`** - CP-24 hard-fails a PR mixing `scripts/` and `sot/`. If the register is
  missing a row, say so; Station 05 adds it.
- Do NOT rename any `D<n>` - slices 1-3 own that and are on main.
- Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Note the interaction with the precondition above: **`NO-OP: <reason>` is not "asking permission".**
It is a finished run reporting a measured result. Stopping because the checker is not clean is the
correct outcome; stopping because you wanted someone to confirm it is not.

Scope discipline still applies: do not widen beyond the two files in `scope`.

## Guardrails

- One attempt. If `WARN_ONLY` is already gone from main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- Paste the pre-flip checker output into the PR body - it is the evidence that the flip was safe.
