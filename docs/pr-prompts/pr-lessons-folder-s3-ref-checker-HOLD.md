---
premise: '! test -f scripts/pipeline/check-sot-refs.mjs'
premise_means: >-
  Nothing checks that the paths cited inside sot/ actually exist, which is why 16
  of 36 references in sot/05 dangled with no signal. Worse, the four checkers that
  DO exist - check-backlog, check-escalations, check-lessons, check-sot-bytes -
  have no caller in .github/workflows or package.json, so none of them runs
  automatically and check-sot-bytes has no caller anywhere at all.
scope:
  - scripts/pipeline/check-sot-refs.mjs
  - scripts/pipeline/__tests__/check-sot-refs.test.mjs
  - .github/workflows/ci.yml
  - package.json
done_when: >-
  test -f scripts/pipeline/check-sot-refs.mjs && node --test
  "scripts/pipeline/__tests__/*.mjs" && grep -q "check-sot-refs"
  .github/workflows/ci.yml && grep -q "check-lessons" .github/workflows/ci.yml &&
  grep -q "check-backlog" .github/workflows/ci.yml && grep -q "check-escalations"
  .github/workflows/ci.yml && grep -q "check-sot-bytes" .github/workflows/ci.yml
size: 4
gate_allow: none
escalates: false
backfill: false
cluster: sot-reference-hygiene
cluster_order: 3
requires_file_on_main: docs/legacy-ai-providers-investigation.md
rollback_strategy: >-
  One new script, one new test, and additive CI steps. Revert is a git revert of
  one commit. The failure mode of a bad checker is a red required-adjacent job,
  which is loud and immediate, not silent. No existing check is modified or
  weakened - the four existing checkers are only given a caller.
---

# SLICE 3 of 3 — check the references, and give the existing checkers a caller

**Gated on SLICE 2.** `requires_file_on_main` points at a file only SLICE 2
creates, so this cannot open early and ship red against the 16 dangling
references SLICE 2 removes.

## Two findings, and the second is the bigger one

**1. Nothing validates the paths cited inside `sot/`.** 16 of 36 path-shaped
references in `sot/05` did not resolve — 44% — and no instrument said so.

**2. The four checkers that already exist have no caller.**

```
grep -n "check-lessons|check-backlog|check-escalations|check-sot-bytes" .github/workflows/*.yml
  -> no matches
grep "check-" package.json
  -> no matches
check-sot-bytes.mjs : 0 callers anywhere in the repo
```

`check-lessons.mjs` reports `holding=5 regressed=0 broken=0` and **nobody runs
it.** That is the artifact-exists-is-not-artifact-runs pattern this project has
now hit repeatedly. Adding a fifth unrun script would be decoration, so this slice
wires all five.

## What to build

### `scripts/pipeline/check-sot-refs.mjs`

Walk every `sot/**/*.md`, extract path-shaped references, and assert each resolves
against the repo root.

- **Extraction:** backticked strings that look like repo paths — contain a `/` and
  end in a known extension (`.md .mjs .ts .tsx .js .ps1 .yaml .yml .sql .json`).
  Report the count extracted alongside the failures, so a regex that silently
  matches nothing is visible instead of reading as a pass.
- **Polarity — match the other checkers, do not invert it.** `check-lessons.mjs`
  has an inverted polarity and says so loudly in its header because getting it
  backwards makes an alarm that fires constantly and is muted within a week. This
  one is the ordinary direction: **exit non-zero when a reference does not
  resolve.** State the polarity in the file header the way `check-lessons` does.
- **Never read a broken instrument as clean.** If the walk finds zero `sot/` files
  or zero references, exit non-zero with `BROKEN`, not zero with "clean".
- **Allowlist, deliberately narrow:** a reference may be exempted only with an
  inline marker on the same line (e.g. `<!-- sot-ref-allow: reason -->`), and the
  script must **print every exemption it honoured**. A silent allowlist is how
  this rots again.

### `scripts/pipeline/__tests__/check-sot-refs.test.mjs`

**Prove the guard fires, in both directions.** Construct a fixture with a dangling
reference, assert non-zero exit **and** that the offending path is named in the
output; remove it, assert clean. A gate only ever observed passing has not been
tested.

`ci.yml:174` already runs `node --test "scripts/pipeline/__tests__/*.mjs"`, so a
test placed there **will** execute. **Confirm that line still exists before
relying on it** — the equivalent gap is exactly what #1232 had to fix, and
`ci.yml:169-172` records that a bare directory argument exits 1, so do not
"simplify" the quoted glob.

### CI wiring — all five

Add steps that run `check-sot-refs`, `check-lessons`, `check-backlog`,
`check-escalations` and `check-sot-bytes`.

**Mind the polarities, they are not the same.** `check-lessons` exits 0 when
lessons are holding and 2 when one has regressed. `check-backlog` and
`check-escalations` report readiness and use their exit codes differently again.
**Read each script's header before wiring it** and make the CI step fail on the
condition that script means by failure — not on non-zero as a blanket rule. Getting
this wrong turns a healthy repo red and the job gets disabled within a week.

If a checker cannot be wired without changing its semantics, **wire the others and
report that one** rather than editing it here. Changing a checker's contract is
not in this slice's scope.

Also add `package.json` scripts so they are runnable by name locally.

## What NOT to do

- Do **not** touch `sot/`. CP-24 hard-fails `sot/` mixed with `scripts/` or
  `.github/` and there is no escape hatch. That is why this is a separate slice
  from SLICE 2.
- Do **not** weaken, edit or "fix" the four existing checkers. Give them a caller.
- Do **not** make the new job non-blocking or add `continue-on-error`. A reference
  checker nobody can fail is the problem restated.

## Verification

In the PR body: the extracted-reference count on current main; the both-direction
test output; the exit code each wired checker returns on main today, per checker,
showing the CI step interprets it correctly; and confirmation that
`git diff --name-only` contains no `sot/` path.
