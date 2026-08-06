---
premise: ! test -f apps/api/src/modules/contracts/contract-at-issue.service.ts
premise_means: B-HW-4 (Contract created at tender→contract issue; Contract.projectId nullable + tender link) is not built.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/contracts/**
  - apps/api/src/modules/jobs/jobs.service.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/contracts/contract-at-issue.service.ts && node scripts/data-model/build-relationship-map.mjs --check
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive/relaxing — makes Contract.projectId nullable and adds nullable tenderId/tenderClientId. Existing contracts keep their projectId. To revert mid-flight, drop the two new nullable columns; re-tightening projectId to NOT NULL is only safe once no contract-at-issue rows exist.
requires_file_on_main: docs/plans/contract-handover-wizard-plan.md
---

# feat(api): create Contract at tender→contract issue (B-HW-4)

Implement **B-HW-4** of `docs/plans/contract-handover-wizard-plan.md`. Make `Contract.projectId`
nullable and add nullable `Contract.tenderId` + `Contract.tenderClientId` (additive migration).
Add `contract-at-issue.service.ts`: when `jobs.service.ts#issueContract` moves a tender to
`CONTRACT_ISSUED`, also create a `Contract` row prefilled from the **awarded** TenderClient's
highest `ClientQuote` revision (value from quote total; retention/terms from defaults) and link it
via tenderId/tenderClientId. `listContracts` must surface these project-less contracts on
`/contracts`. Run `node scripts/data-model/build-relationship-map.mjs` and commit
`docs/data-model/*`. Update `contracts.service.spec.ts` / `jobs.service.spec.ts` expectations. Add
the bare line `GATE-ALLOW: migrations` at column 0 of the PR body.

## Do NOT
- Do NOT create the Project or Job here (that stays at finalise, B-HW-11). Do NOT build the handover
  instance/wizard. Do NOT touch `/sot/`. Do NOT exceed the B-HW-4 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` + data-model `--check` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
