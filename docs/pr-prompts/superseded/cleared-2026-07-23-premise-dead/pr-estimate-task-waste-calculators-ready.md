---
premise: '! grep -rqiE "taskTimeCalculator|wasteWeightCalculator" apps/api/src'
premise_means: Neither the task-time nor the waste-weight calculator exists in the API yet.
scope:
  - apps/api/src/modules/estimates/**
  - apps/web/src/pages/tendering/**
done_when: pnpm build && pnpm lint && grep -rqiE "taskTimeCalculator|wasteWeightCalculator" apps/api/src
size: 7
gate_allow: none
seed_only: false
escalates: true
---

# Task-time + waste-weight calculators (own reviewable PR — CHANGES QUOTED PRICES)

Marco's decision (BACKLOG-DECISIONS.md #7): build these as their OWN PR, line-by-line reviewable,
because they change quoted prices. They must NOT ride along with a refactor.

## What to build

1. A dedicated calculator seam in the estimates module (e.g. `estimate-calculators.service.ts` or
   clearly-named exported functions `taskTimeCalculator` / `wasteWeightCalculator`) implementing the
   SoT business logic (sot/01 SECTION 10):
   - **Task time** = quantity ÷ production rate (units/hour) — hours per scope task.
   - **Waste weight** = volume (m³) × material density (kg/m³) ÷ 1000 = tonnes. Density comes from the
     existing density lookup (`EstimateMaterialDensity`); do not hardcode densities.
2. Wire the results into the estimate line calc where task hours and waste tonnes are surfaced, and
   display them in the tendering scope UI (`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`,
   `ScopeWasteTab.tsx`) without changing any other pricing behaviour.
3. Update the estimates unit specs to assert the new calculator outputs.

## PR body MUST include
- A **worked before/after example**: one real scope line showing the prior number and the new
  calculated number, so Marco can eyeball the price impact.

## Do NOT
- Do NOT change any pricing/markup/rate logic beyond introducing these two calculators.
- Do NOT touch schema.prisma or add a migration — this is service + display logic only.
- Do NOT bundle any other backlog item into this PR.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

This PR is `escalates: true` (it changes quoted prices): build it, open the PR with the before/after
worked example, and LEAVE IT UNMERGED for Marco's line-by-line review.

## Guardrails
- One attempt. Never exit silently -- if the calculators already exist, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
