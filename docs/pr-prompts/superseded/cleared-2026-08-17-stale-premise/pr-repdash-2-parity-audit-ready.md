---
premise: ! test -f docs/audits/reporting-definitions-parity.md
premise_means: SLICE 2 of the reporting-dashboard plan (audit of every ReportDefinition vs widget rendering primitives) is not written yet.
scope:
  - docs/audits/**
done_when: pnpm lint && test -f docs/audits/reporting-definitions-parity.md
size: 1
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: docs/plans/reporting-dashboard-layout-conventions.md
---

# docs: reporting definitions parity audit (SLICE 2)

Implement **SLICE 2** of `docs/plans/reporting-dashboard-layout-plan.md`: create
`docs/audits/reporting-definitions-parity.md` enumerating every `ReportDefinition` in `REPORT_DEFS`
(`apps/api/src/modules/reporting/reporting.service.ts`) — for each: parameters, columns, whether a
`chart` is defined, and any column `format` not representable by widget primitives. Audit-only, no code.
Follow the plan's SLICE 2 exactly.

## Do NOT
- Do NOT write code or touch `/sot/`. Single docs/audits file.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm lint` passes before opening the PR. Never ask for approval.
