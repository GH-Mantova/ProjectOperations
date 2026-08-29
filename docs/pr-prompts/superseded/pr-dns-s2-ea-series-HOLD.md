---
premise: '! grep -q "EA-D3" apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts'
premise_means: The estimating-analytics decision series still uses bare D<n> tokens with NO source attribution in its code comment, so "// Decision D3:" reads as a citation of Marco's register when it is not.
scope:
  - docs/plans/estimating-analytics-plan.md
  - apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts
  - apps/api/src/modules/reporting/estimating-analytics-report.definitions.spec.ts
  - apps/api/src/modules/reporting/reporting.service.ts
  - docs/plans/bid-prioritisation-plan.md
  - docs/plans/estimator-allocation-workload-plan.md
  - docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md
done_when: pnpm build && pnpm lint && grep -q "EA-D3" apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts && grep -q "EA-D5" docs/plans/estimating-analytics-plan.md
size: 4
gate_allow: none
seed_only: false
escalates: false
cluster: d-namespace
cluster_order: 2
requires_on_main: apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts :: TFM-D3
---

# D-namespace S2 - prefix the EA series

**Slice 2 of 5.** Full spec:
`docs/pr-prompts/00-supervisor-2026-08-20-D-NAMESPACE-CHAIN-for-05-and-06.md`.

**Gate:** slice 1 must be on main - `TFM-D3` present in
`apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts`. The gate points at a file
**slice 1 actually edits**; a gate on a file the chain never writes is `FILE_GATE_DEAD`.

## Why this series is the one that actually misleads - MEASURED

TFM's comments at least carry a source line. **EA's code comment gives none at all - just
`// Decision D3:`.** A reader has no way to tell it is plan-local rather than a citation of Marco's
register. So this slice does **two** things, not one:

1. prefix the tokens to `EA-D<n>`, and
2. **ADD the attribution line** (the same shape as TFM's
   *"Decision references (from docs/plans/...)"*) so the series names its own source.

Prefixing without attribution solves half the problem.

## What to build

Rename **only the EA series** to `EA-D<n>` across the files in `scope`, and add the attribution line
to `estimating-analytics-report.definitions.ts` (the decision comments sit at roughly lines 7-10 -
**grep, do not trust the numbers**).

At minimum `EA-D3`, `EA-D4` and `EA-D5` must exist afterwards; rename every member of the series you
find in the scoped files.

### The one prompt file in scope

`docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md` cites the EA series. Update its citations, then:

- **re-lint it** with `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md`
  and **paste the verdict verbatim into the PR body**;
- 🔴 **do NOT change its `premise`, its `done_when`, or its gate.** You are editing prose citations
  inside a staged prompt, nothing else. Altering a premise silently re-scopes work nobody reviewed.

⚠️ **Correction to the chain spec, measured 2026-08-23:** the spec also lists
`docs/pr-prompts/pr-ea-s1-report-defs-HOLD.md`. **That prompt no longer exists at depth 1** - its
work shipped as **#1272** and it was retired to `docs/pr-prompts/superseded/` on 2026-08-23. The
spec's own rule is *"do not touch `superseded/**`"*, so it is deliberately **out of scope** here and
has been removed from `scope`. Do not go looking for it, and do not restore it.

## Do NOT

- Do NOT touch the TFM series (slice 1) or `sot/` (slice 3). CP-24 hard-fails any PR mixing code and
  `sot/` - `pr-gates.mjs:327`.
- Do NOT touch `docs/pr-prompts/superseded/**`.
- **Do NOT renumber or rename Marco's register.** This chain renames only foreign series.
- Do NOT change schema, seed, migrations, permissions or any runtime path. Comments, plan prose and
  table labels only - if a change would alter behaviour, you have gone wrong.
- Do NOT change the behaviour asserted by
  `estimating-analytics-report.definitions.spec.ts`; if a rename breaks an assertion, the rename is
  wrong, not the test.
- Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the seven paths in `scope`. That is a scope
limit, **not** a reason to stop before pushing.

## Guardrails

- One attempt. If `EA-D3` is already on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
- ⚠️ Check `git diff --numstat` before pushing - CRLF churn shows a small change as a huge one.
