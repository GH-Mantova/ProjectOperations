---
premise: '! test -f scripts/rates/fallback-audit.mjs'
premise_means: There is no way to measure RateTable projection gaps, so pr-524 precondition 2 cannot be evidenced.
scope:
  - scripts/rates/**
  - apps/api/src/modules/rates/**
  - package.json
done_when: pnpm build && pnpm lint && test -f scripts/rates/fallback-audit.mjs
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# Rates: fallback audit - make "zero ratetable misses" measurable

STATUS: ARMED - RUN NOW. No predecessor. `RATES_CANONICAL_SOURCE` shipped in #579 and is on
main (`apps/api/src/config/app.config.ts`). Build the audit now; do not stand down.

## Why this exists

`pr-524-rates-b-slice2-canonical` PHASE D drops the legacy rate tables **irreversibly**. Its
precondition 2 is "a full live pricing cycle ran with `RATES_CANONICAL_SOURCE=ratetable` and the
structured warn log shows zero `ratetable-miss-fell-back-to-legacy` events". Today nothing counts
those events, so that precondition can only be met by opinion. This PR makes it evidence.

**This is a READ-ONLY audit. It must not write to the database and must not drop anything.**

## What to build

Branch: `feat/rates-fallback-audit`. Reviewer: `GH-Mantova`. No migration.

1. `scripts/rates/fallback-audit.mjs` - resolves **every** rate the estimator can ask for through
   the existing `RateResolverService` seam with `RATES_CANONICAL_SOURCE=ratetable`, and records for
   each lookup whether it was served from RateTable or fell back to a legacy table.
2. Enumerate the lookup set from the legacy tables themselves (every distinct key in each legacy
   rate table is a lookup that MUST be resolvable from RateTable) - do not hand-list them, or the
   audit will pass by omission.
3. Output a report: total lookups, RateTable hits, **fallback count**, and a per-surface breakdown
   listing the exact missing keys. Write it to `docs/rates/fallback-audit-<stamp>.md` and print the
   headline counts to stdout.
4. **Exit code is the verdict**: exit 0 only when the fallback count is 0; exit 1 otherwise. That
   makes it usable directly as pr-524's precondition-2 gate.
5. Ensure the resolver emits a structured warn on fallback if it does not already, so the same
   signal is observable in a real running cycle, not only under the script.

## Do NOT
- Do NOT write, update or delete any rate data. Do NOT drop any table. Do NOT change the resolver's
  resolution ORDER - only observe it.
- Do NOT hardcode the expected lookup list. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". Finishing the work then asking permission is indistinguishable from
> failing - the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge - open the PR and leave it for Marco.
