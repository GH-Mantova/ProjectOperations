---
premise: '! grep -q "clientStats" apps/api/src/modules/jobs/jobs.service.ts'
premise_means: Five paths in jobs.service.ts and one in projects.service.ts move a tender into a won status without ever calling ClientStatsService, so those clients are silently under-counted.
scope:
  - apps/api/src/modules/jobs/jobs.service.ts
  - apps/api/src/modules/projects/projects.service.ts
  - apps/api/src/modules/jobs/__tests__/jobs.service.spec.ts
  - apps/api/src/modules/projects/__tests__/projects.service.spec.ts
done_when: pnpm lint && pnpm --filter api test -- jobs.service && pnpm --filter api test -- projects.service && grep -q "clientStats.recordTenderOutcome" apps/api/src/modules/jobs/jobs.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: true
cluster: crm-wincount
cluster_order: 2
requires_on_main: apps/api/prisma/schema.prisma :: tenderWinCounted
---

# Six paths win a tender without telling the scorer

## The defect, measured

`updateStatus` in `tendering.service.ts` is the only place that calls `ClientStatsService`. Six other
sites write a won status **directly** to the `Tender` row, bypassing it entirely — so no `wonAt`, no
`tenderScoreCounted`, no `tenderWinCounted`, and no increment at all:

| Site | Writes |
|---|---|
| `jobs.service.ts:1072` `awardTenderClient` | `status: "AWARDED"` |
| `jobs.service.ts:1127` `issueContract` | `status: "CONTRACT_ISSUED"` |
| `jobs.service.ts:1332` convert-to-job | `status: "CONVERTED"` |
| `jobs.service.ts:1538` convert-to-job | `status: "CONVERTED"` |
| `jobs.service.ts:1663` `rollbackLifecycle` | `status: dto.targetStage` |
| `projects.service.ts:907` | `status: "CONTRACT_ISSUED"` |

Clients reached only through these paths are **under**-counted — the opposite error to the win-flip
that slice 1 fixed, in the same numbers.

## What to build

Route all six through the same scoring path the tendering service uses, so there is one rule about
what counts and it lives in one place.

- Inject `ClientStatsService` into `JobsService` and `ProjectsService` (it is exported from
  `master-data.module.ts:16-17`; wire the module import as the tendering module already does).
- At each of the five forward sites, after the status write succeeds, apply the **same** condition
  `updateStatus` applies — `isScorable && !tenderScoreCounted` takes `first-count`;
  `isWon && tenderScoreCounted && !tenderWinCounted` takes `win-flip` — and set the corresponding
  flag. Do not re-derive the rule by hand at each call site: **extract the decision into one helper**
  and call it from all of them, including from `tendering.service.ts`, so a future seventh path
  cannot drift.
- `rollbackLifecycle` at `jobs.service.ts:1663` moves a tender **backwards**. It must not increment
  anything. Leave the counters and both flags untouched there, and add a comment saying that is
  deliberate — a reader who does not know will "fix" it.
- Follow the existing pattern of updating client scoring **outside** the main transaction, as
  `tendering.service.ts:326` and `:1032` both do and both comment on.

### Tests

For each of the five forward sites: a tender not yet scored gets `first-count` and both flags set as
appropriate; a tender already scored and already won gets **no** further increment. For
`rollbackLifecycle`: no counter call is made at all. **Update the existing
`toHaveBeenCalledWith` assertions** in both spec files that the new service dependency disturbs.

## Do NOT

- Do NOT change, recompute or correct any existing stored counter value. Slice 3 owns that.
- Do NOT change `client-stats.service.ts` or its SQL.
- Do NOT change the schema or add a migration — slice 1 added the column this slice reads.
- Do NOT change what `isWon` / `isScorable` mean. Move the rule, do not redefine it.
- Do NOT touch the web app.

## Guardrails

- One attempt. If `jobs.service.ts` already calls `clientStats`, say `NO-OP: <reason>`.
- `pnpm lint` and both service test suites must pass.
- **`escalates: true`** — this changes what gets written to production counters. Open the PR and
  leave it unmerged.
- Never exit silently. Never ask a question or stand by for approval — there is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

