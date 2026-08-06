---
premise: ! test -f apps/api/prisma/seeds/handover-default-template.ts
premise_means: B-HW-1 (handover template schema + permission + default-template seed) is not built.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seeds/**
  - apps/api/src/common/permissions/permission-registry.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && test -f apps/api/prisma/seeds/handover-default-template.ts && node scripts/data-model/build-relationship-map.mjs --check
size: 7
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive only — new HandoverTemplate/Section/Field tables + a new grantable permission row. To revert mid-flight, drop the three new tables and the seed, and remove the handovertemplate.manage registry entry; nothing existing depends on them yet.
requires_file_on_main: docs/plans/contract-handover-wizard-plan.md
---

# feat(api): handover template schema + permission + default-template seed (B-HW-1)

Implement **B-HW-1** of `docs/plans/contract-handover-wizard-plan.md` EXACTLY (§4 + §5).
Add Prisma models `HandoverTemplate` (version, isActive, publishedAt, publishedById),
`HandoverTemplateSection` (templateId, key, label, sortOrder), `HandoverTemplateField`
(sectionId, `key` STABLE/immutable, label, type ∈ text|money|date|list|attachment|contact,
sourceType ∈ auto|capture|attach|derived, autoBinding?, listId?, required, sortOrder, retiredAt?).
Add ONE additive migration. Register `handovertemplate.manage` in `permission-registry.ts` as a
grantable, admin-assignable permission (module "tendering"/"settings"), seeded to Marco/Colin/Sean.
Create `apps/api/prisma/seeds/handover-default-template.ts` seeding v1 of the default template with
the six sections and fields from the approved field map (Project details; Pricing & budget; Scope
of works; Key contacts & procurement; Documentation, compliance & approvals; Site/logistics/
programme; Risk & watch-items / handover notes), each field carrying its type + sourceType +
autoBinding per the plan. Run `node scripts/data-model/build-relationship-map.mjs` and commit the
regenerated `docs/data-model/*`. Add the bare line `GATE-ALLOW: migrations` at column 0 of the PR body.

## Do NOT
- Do NOT build the template API, editor UI, handover instance, or wizard (later slices).
- Do NOT touch `/sot/`. Do NOT exceed the B-HW-1 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` + the data-model `--check` pass before opening the PR. Update any affected `*.spec.ts` expectations. Read the CI log before diagnosing. Never ask for approval.
