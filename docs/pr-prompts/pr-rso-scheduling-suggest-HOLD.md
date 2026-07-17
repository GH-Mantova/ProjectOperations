---
premise: '! grep -rqi "suggestAllocation\|schedulingSuggest\|allocationSuggest" apps/api/src/modules/scheduler 2>/dev/null'
premise_means: The scheduler has no resource-optimisation / suggestion engine (allocation is fully manual).
scope:
  - apps/api/src/modules/scheduler/**
  - apps/web/src/pages/scheduler/**
done_when: pnpm build && pnpm lint && grep -rqi "suggestAllocation\|schedulingSuggest\|allocationSuggest" apps/api/src/modules/scheduler
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | D365-parity Tier 3 (Field Service RSO parity) | ASSISTIVE suggest engine, phase 1 -->
# HOLD — Resource scheduling optimisation: suggest engine (phase 1)

STATUS: DRAFTED, STAGED, arm-eligible. Tier 3. D365 Field Service parity (Resource Scheduling
Optimization), built the honest way: **phase 1 = SUGGEST (assistive), not auto-assign.** Ties to the
existing scheduler (`ScheduleAllocation`, `JobRole`/`RoleRequirement`, availability/leave, heatmap)
and the Ops-Map site coordinates.

## What to build
Branch: `feat/rso-scheduling-suggest`. Reviewer: `GH-Mantova`. No migration (read-model over existing).
1. A suggestion service: for an open role requirement / unfilled allocation on a day, RANK eligible
   workers (and assets) by: skills/role fit (JobRole/RoleRequirement), availability (not on leave / not
   already allocated / within capacity), conflict rules (existing scheduling-conflict detection), and —
   where site coords exist — proximity. Return a scored, explainable shortlist ("why this person").
2. Endpoint `GET /scheduler/suggestions?...` guarded by the existing scheduler permission.
3. Web: surface the ranked suggestions in the scheduler (a "Suggest" affordance on an open slot);
   the planner picks — the system never auto-commits in phase 1.

## Do NOT
- Do NOT auto-assign or mutate allocations automatically (phase 2, separate, behind a flag). Do NOT
  add schema. Do NOT touch Azure/prod. Keep it explainable — every suggestion carries its reasons.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
