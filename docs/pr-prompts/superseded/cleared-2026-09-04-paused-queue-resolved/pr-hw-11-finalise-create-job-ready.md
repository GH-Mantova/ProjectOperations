---
premise: ! test -f apps/api/src/modules/handovers/handover-finalise.service.ts
premise_means: B-HW-11 (finalise handover → create Job on ERP + SharePoint + baseline + handover PDF) is not built.
scope:
  - apps/api/src/modules/handovers/**
  - apps/api/src/modules/jobs/jobs.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/handovers/handover-finalise.service.ts
size: 9
gate_allow: none
seed_only: false
escalates: true
requires_file_on_main:
  - apps/web/src/pages/handover/autoFieldSafeguards.ts
  - apps/api/src/modules/handovers/compliance-derivation.ts
  - apps/api/src/modules/handovers/handover-subcontractors.service.ts
---

# feat(api): finalise handover → create job (B-HW-11)

Implement **B-HW-11** of `docs/plans/contract-handover-wizard-plan.md`. Add
`handover-finalise.service.ts`: only when a handover reaches 100% completion, expose a finalise
action that (1) reuses the deployed `convertTenderToJob` path to create the Job + allocate the
`IS-P###` number + provision the SharePoint folder tree, (2) links the resulting Project back to
the contract created in B-HW-4, (3) snapshots the handover + WBS as the job baseline, (4) generates
the handover PDF (Kings Beach layout) into the job's Contracts/Safety folders, and (5) scaffolds one
`Subcontractor/` subfolder per engaged subbie. Freeze the handover on finalise. This is
`escalates: true` — open the PR, do NOT auto-merge (it provisions SharePoint / production data).

## Do NOT
- Do NOT add a migration (Project link uses the nullable columns from B-HW-4). Do NOT rewrite
  `convertTenderToJob` — call it. Do NOT touch `/sot/`. Do NOT exceed the B-HW-11 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.
"Do NOT auto-merge" means open the PR and LEAVE IT UNMERGED — it does not mean stop before opening.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
