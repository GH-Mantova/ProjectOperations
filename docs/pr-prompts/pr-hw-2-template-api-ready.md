---
premise: ! test -f apps/api/src/modules/handover-templates/handover-templates.service.ts
premise_means: B-HW-2 (handover template CRUD + explicit publish/versioning API) is not built.
scope:
  - apps/api/src/modules/handover-templates/**
  - apps/api/src/app.module.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/handover-templates/handover-templates.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/prisma/seeds/handover-default-template.ts
---

# feat(api): handover template CRUD + explicit publish/versioning (B-HW-2)

Implement **B-HW-2** of `docs/plans/contract-handover-wizard-plan.md`. Create a
`handover-templates` NestJS module (controller + service + module) guarded by
`handovertemplate.manage`. Endpoints: read the active/draft template, add/rename/remove/reorder
sections and fields on a working draft, and **explicit Publish** producing a new
`HandoverTemplate.version` (previous version stays intact — never rewritten). Enforce the
non-destructive rules from the plan: rename changes label only (stable `key` unchanged); remove
sets `retiredAt` (never hard-deletes); add creates a new field. Wire the module into `app.module.ts`.

## Do NOT
- Do NOT build the editor UI (B-HW-3) or any handover-instance code. Do NOT add a migration.
- Do NOT touch `/sot/`. Do NOT exceed the B-HW-2 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
