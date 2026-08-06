---
premise: ! test -f apps/api/src/modules/handovers/handover.types.ts
premise_means: B-HW-5 (handover instance schema — Handover + Value + Compliance/Subcontractor/Attachment, pinned to template version) is not built.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/handovers/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/handovers/handover.types.ts && node scripts/data-model/build-relationship-map.mjs --check
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive only — new Handover/HandoverValue/HandoverComplianceItem/HandoverSubcontractor/HandoverAttachment tables. To revert mid-flight, drop the new tables; nothing existing depends on them yet.
requires_file_on_main:
  - apps/api/prisma/seeds/handover-default-template.ts
  - apps/api/src/modules/contracts/contract-at-issue.service.ts
---

# feat(api): handover instance schema (B-HW-5)

Implement **B-HW-5** of `docs/plans/contract-handover-wizard-plan.md` §4. Add Prisma models:
`Handover` (contractId, tenderId, `templateVersionId` PINNED, status ∈ draft|finalised,
completionPct, createdById, finalisedAt?), `HandoverValue` (handoverId, fieldKey, value Json,
sourceValue Json?, isOverridden, sectionDone), `HandoverComplianceItem` (handoverId, type,
origin ∈ suggested|manual, responsibleParty ∈ us|client, status, docRef?), `HandoverSubcontractor`
(handoverId, name, quoteRef?, poRef?, folderSlot), `HandoverAttachment` (handoverId,
fieldKey/category, docRef). Add ONE additive migration. Create `handover.types.ts` with the shared
TS types. Run `node scripts/data-model/build-relationship-map.mjs` and commit `docs/data-model/*`.
Add the bare line `GATE-ALLOW: migrations` at column 0 of the PR body.

## Do NOT
- Do NOT build the handover API (B-HW-6) or wizard. Do NOT touch `/sot/`. Do NOT exceed the B-HW-5 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` + data-model `--check` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
