---
premise: '! grep -qi "permit_to_work\|pre_task_plan\|toolbox_talk" apps/api/prisma/seed-form-templates.ts'
premise_means: The forms engine has no seeded WHS template packs (permit-to-work, pre-task/JHA, induction, toolbox, bulletin).
scope:
  - apps/api/prisma/seed-form-templates.ts
  - apps/api/prisma/seed*.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -qi "permit_to_work\|pre_task_plan\|toolbox_talk" apps/api/prisma/seed-form-templates.ts
size: 6
gate_allow: none
seed_only: true
escalates: false
---
<!-- watcher: arm-eligible | ERP gap D/WHS | seeded WHS template packs (forms engine) -->
# ERP gap — WHS forms template packs (seed only)

STATUS: DRAFTED, STAGED, arm-eligible. KEY INSIGHT from the competitor analysis: HammerTech's WHS surface
is mostly TEMPLATES, not new modules — the forms engine (PR #97) already supports them. Ship them as seeded
`isSystemTemplate` form templates so users have starting points.

## What to build
Branch: `feat/erp-whs-template-packs`. Reviewer: `GH-Mantova`. SEED ONLY — no schema/migration.
1. In `seed-form-templates.ts`, add `isSystemTemplate` templates using the EXISTING forms-engine model
   (template/section/field), for: Permit-to-Work (with permit zones/type), Pre-Task Plan / JHA, Site
   Induction, Toolbox Talk sign-on, Take-5, Plant Pre-Start, Hazard/Incident report, and a Site Bulletin
   acknowledgement. Use the existing field types + rules; categories already include permits/induction/
   safety/plant/daily.
2. Idempotent seeding (upsert by template `code`).

## Do NOT
- Do NOT change the forms-engine schema or add models (this is SEED data on the existing engine). Do NOT
  invent field types the engine does not support. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already seeded on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Seed changes may auto-merge per shepherd policy. Do NOT auto-merge
  by hand — leave for the sanctioned path / Marco.
