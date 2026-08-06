---
premise: ! test -f apps/api/src/modules/handovers/handover-subcontractors.service.ts
premise_means: B-HW-10 (handover subcontractors/procurement capture + quote/PO link + folder-slot) is not built.
scope:
  - apps/api/src/modules/handovers/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/handovers/handover-subcontractors.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/handovers/handovers.service.ts
---

# feat(api): handover subcontractors & procurement (B-HW-10)

Implement **B-HW-10** of `docs/plans/contract-handover-wizard-plan.md`. Add
`handover-subcontractors.service.ts`: CRUD `HandoverSubcontractor` rows on a handover (name,
required trade), each optionally linking an existing quote (`quoteRef`) and/or purchase order
(`poRef`), and carrying the `folderSlot` name used to scaffold one subfolder per engaged subbie
under the job's `Subcontractor/` SharePoint folder at finalise. Flag rows with no quote/PO as gaps
for the PM.

## Do NOT
- Do NOT create the job or SharePoint folders here (B-HW-11). Do NOT add a migration.
- Do NOT touch `/sot/`. Do NOT exceed the B-HW-10 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
