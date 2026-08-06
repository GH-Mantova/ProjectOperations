---
premise: ! test -f apps/api/src/modules/handovers/compliance-derivation.ts
premise_means: B-HW-9 (compliance obligation derivation from activity types + manual add) is not built.
scope:
  - apps/api/src/modules/handovers/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/handovers/compliance-derivation.ts
size: 7
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/handovers/handovers.service.ts
---

# feat(api): compliance obligation derivation (B-HW-9)

Implement **B-HW-9** of `docs/plans/contract-handover-wizard-plan.md`. Add
`compliance-derivation.ts`: from the awarded quote's scope items' `rowType`/discipline, **suggest**
`HandoverComplianceItem` rows (e.g. asbestos activity → Form 65 asbestos + SWMS; demolition → Form
65 demolition + SWMS; plus permits, disconnection certificates) with `origin: suggested`. Expose an
endpoint to confirm/edit suggestions and add `origin: manual` items, each with a
`responsibleParty` (us | client). Persist against the handover.

## Do NOT
- Do NOT auto-finalise or create the job. Do NOT add a migration (schema landed in B-HW-5).
- Do NOT touch `/sot/`. Do NOT exceed the B-HW-9 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
