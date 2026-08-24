---
premise: '! test -f scripts/pipeline/check-d-register.mjs'
premise_means: Nothing checks that a D<n> cited in the repo actually exists in Marco's register, so a foreign or invented decision number can be cited as authority and nobody notices.
scope:
  - scripts/pipeline/check-d-register.mjs
  - scripts/pipeline/__tests__/check-d-register.spec.mjs
  - .github/workflows/ci.yml
done_when: pnpm lint && test -f scripts/pipeline/check-d-register.mjs && grep -q "D_REGISTER_MODE" scripts/pipeline/check-d-register.mjs && node --test scripts/pipeline/__tests__/check-d-register.spec.mjs && node scripts/pipeline/check-d-register.mjs
size: 4
gate_allow: none
seed_only: false
escalates: false
cluster: d-namespace
cluster_order: 4
requires_on_main: sot/05-decisions-and-lessons.md :: D_NAMESPACE_EXCLUSIVE
---

# D-namespace S4 - the register checker, WARN-ONLY

**Slice 4 of 5.** Full spec:
`docs/pr-prompts/00-supervisor-2026-08-20-D-NAMESPACE-CHAIN-for-05-and-06.md`.

**Gate:** slice 3 must be on main - `D_NAMESPACE_EXCLUSIVE` present in
`sot/05-decisions-and-lessons.md`. That marker is the statement this checker enforces; without it
the checker would be asserting a rule the repo has not adopted.

## 🔴 SHIP IT WARN-ONLY. This is the whole point of the slice.

**A hard-failing checker red-lights every PR on day one** - `scheduler-resourcing-spec.md` alone
carries **40** references. Warn-only lets the true positives surface and be cleaned up while the
pipeline keeps moving. **Slice 5 flips it to fail, and only after a clean warn run has been read.**

Expose the mode through a module-level constant named **`D_REGISTER_MODE`** (set it to `"WARN_ONLY"`).
`done_when` asserts that symbol, and slice 5 gates on it - so name it exactly that.

## What to build

### 1. `scripts/pipeline/check-d-register.mjs`

Scan the repo for `D<n>` citations and report any that are **not** rows in the register in
`sot/05-decisions-and-lessons.md`. In `WARN_ONLY` mode it prints findings and **exits 0**.

🔴 **REQUIRED EXCLUSIONS - each one measured, each one a false positive if you skip it:**

| Exclusion | Why |
|---|---|
| `docs/pr-prompts/superseded/**` | archived history, deliberately not renamed by slice 1 |
| the `sot/05` register rows themselves | it *defines* them; it must not flag itself |
| `TFM-D*`, `EA-D*`, `W*` | namespaced by slices 1-3 - already resolved |
| `PR D<n>` | the `sot/06` work-breakdown chain, disambiguated by slice 3 |
| `mergeCells("A1:D1")` in `apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts:62` | a spreadsheet cell range, not a decision |
| fixtures `ZZTEST-BP0A3-D1` and `ZZTEST-BP0A3-D2` in `apps/api/src/modules/projects/__tests__/bp0a3-source-tender-unique.spec.ts` | test data |

⚠️ **Correction to the chain spec, measured 2026-08-23:** the spec gives the Excel builder's path as
`apps/api/src/modules/estimates/estimate-excel.builder.ts`. **That path does not exist.** The real
path is `apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts` (line 62 is correct).
The spec also names only the `-D1` fixture; **there is a `-D2` as well.** Use the corrected values
above, and **verify both yourself before relying on them** - my correction is an instrument too.

**A bare identifier grep is not a search.** Classify by reading the surrounding text, not by counting
hits. The exclusions above exist precisely because a naive `\bD\d+\b` sweep is wrong.

### 2. `scripts/pipeline/__tests__/check-d-register.spec.mjs`

🔴 **Tests with a POSITIVE CONTROL, both directions:**

- an unregistered `D99` **must** warn - proves the checker can fire;
- a registered `D48` **must not** warn - proves it is not simply warning on everything;
- each exclusion above has a case proving it is excluded, **and** a near-miss case proving the
  exclusion is not so broad it swallows a real citation (e.g. `TFM-D3` excluded, bare `D3` still
  flagged).

**Ask of every check: what result would have made this fail?** If nothing would, it is not a check.

### 3. CI wiring

🔴 **Do NOT create a fifth standalone workflow.** Wire it into the **existing** job that already runs
the pipeline checkers - measured on `origin/main`, the job named
**`Pipeline — watcher + linter tests`** already runs:

```
- run: node --test "scripts/pr-watcher/__tests__/*.mjs"
- run: node --test "scripts/pipeline/__tests__/*.mjs"
- run: node scripts/pipeline/test-lint-prompt.mjs
```

Your spec file is picked up automatically by that second glob. Add **one** `- run:` step for the
checker itself in that same job.

## Do NOT

- **Do NOT ship it hard-failing.** That is slice 5, and only after a clean warn run.
- **Do NOT touch `sot/`** - CP-24 hard-fails a PR mixing `scripts/` and `sot/` with no escape hatch.
  This slice reads `sot/05`; it must not write to it.
- Do NOT rename any `D<n>` anywhere - slices 1-3 did the renaming and are already on main.
- Do NOT add exclusions beyond the table above without saying, in the PR body, what you measured to
  justify each one. An over-broad exclusion silently disables the checker.
- Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`. That is a scope
limit, **not** a reason to stop before pushing.

## Guardrails

- One attempt. If `check-d-register.mjs` already exists on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm lint`, the new spec, and a clean `node scripts/pipeline/check-d-register.mjs` run must all
  pass before you open the PR. **Paste the checker's warn output into the PR body** - slice 5 needs
  a human to read exactly that.
