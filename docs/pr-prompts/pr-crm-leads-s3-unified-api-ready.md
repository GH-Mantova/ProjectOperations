---
premise: '! grep -rq "dontPursue" apps/api/src/modules/crm/crm.service.ts'
premise_means: The unified CRM entry API with "Don't pursue" action has not been built yet (S3 not done).
requires_file_on_main: apps/api/src/modules/crm/dto/create-drop-reason.dto.ts
scope:
  - apps/api/src/modules/crm/crm.controller.ts
  - apps/api/src/modules/crm/crm.service.ts
  - apps/api/src/modules/crm/dto/**
  - apps/api/src/modules/crm/__tests__/**
done_when: pnpm build && pnpm lint && grep -rq "dontPursue" apps/api/src/modules/crm/crm.service.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# feat(api): CRM S3 — unified entry CRUD; "Price it" + "Don't pursue" actions

Implement **SLICE 3** of `docs/plans/crm-leads-collapse-plan.md`.

Read that plan in full before writing any code. S2 (`requires_file_on_main` gate) must be
on `main` first. This slice collapses the separate Lead and Opportunity CRUD endpoints into
one unified set and wires the two primary actions on the triage surface.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.

---

## What to build

### 1. DTOs

Create `apps/api/src/modules/crm/dto/create-entry.dto.ts` — fields for creating a unified
CRM entry (formerly Lead or Opportunity): `title`, `source?`, `isLead`, `estimatedValue?`,
`clientId?`, `contactId?`, `ownerId?`, `notes?`, `nextActionAt?`, `nextActionNote?`,
`companyName?`, `contactName?`, `contactEmail?`, `contactPhone?`. Use `class-validator`
decorators matching existing DTO patterns in the crm module.

Create `apps/api/src/modules/crm/dto/update-entry.dto.ts` — `PartialType(CreateEntryDto)`
plus `stage?` (string — validate against the new `OpportunityStage` values including `open`,
`not_pursued`, `archived`).

Create `apps/api/src/modules/crm/dto/dont-pursue.dto.ts`:
```typescript
import { IsString, IsOptional, MaxLength } from 'class-validator';
export class DontPursueDto {
  @IsString() dropReasonId: string;
  @IsOptional() @IsString() @MaxLength(2000) detail?: string;
}
```

### 2. `apps/api/src/modules/crm/crm.service.ts`

Add methods:

- `createEntry(dto: CreateEntryDto, actorId: string)` — creates an `Opportunity` row. If
  `dto.isLead` is true, sets `isLead: true` and `stage: 'open'`. If false (full
  opportunity), sets `stage: 'open'` as default. Never set `stage` to the old values
  `new|qualified|quoting|lost|won` from this method.

- `updateEntry(id: string, dto: UpdateEntryDto, actorId: string)` — patches the
  `Opportunity` row. If `dto.stage` is provided, validate it is one of the new stage
  values before writing.

- `dontPursue(id: string, dto: DontPursueDto, actorId: string)` — sets
  `stage: 'not_pursued'`, `dropReasonId: dto.dropReasonId`, `dropReasonDetail: dto.detail`.
  Throws `NotFoundException` if entry not found. Throws `BadRequestException` if entry is
  already `archived` (cannot un-win a deal via this path).

Also grep the file for any exhaustive `switch` on `OpportunityStage` and add cases for
`open`, `not_pursued`, `archived` before editing anything else.

Keep `generateDraftTender` unchanged in signature and logic. It may reference `prisma.lead`
— update those references to `prisma.opportunity` if S1 has not already done so (check first).

### 3. `apps/api/src/modules/crm/crm.controller.ts`

Add / update routes:

```
POST   /crm/entries             → createEntry(dto, actor)
PATCH  /crm/entries/:id         → updateEntry(id, dto, actor)
POST   /crm/entries/:id/dont-pursue → dontPursue(id, dto, actor)
```

The existing `/crm/opportunities` and `/crm/leads` routes may remain as-is for now (the
web slices will migrate callers to the new paths). Do not delete old routes in this slice.

The existing `POST /crm/leads/:id/generate-draft-tender` and
`POST /crm/opportunities/:id/convert-to-tender` routes remain unchanged.

### 4. `apps/api/src/modules/crm/__tests__/crm.service.unified.spec.ts` (new)

Unit tests covering:
- `createEntry` with `isLead: true` sets `stage: 'open'`.
- `updateEntry` rejects stage value `'new'` (old value) with `BadRequestException`.
- `dontPursue` sets the correct fields.
- `dontPursue` throws `BadRequestException` when entry is `archived`.

### 5. `apps/api/src/modules/crm/__tests__/crm.service.generate-draft-tender.spec.ts`

Verify the existing spec still compiles and passes after the service changes. Update any
`toHaveBeenCalledWith` expectations that reference fields removed or renamed in S1
(e.g., if `Lead` references were not already cleaned up). Do not change test intent.

## Do NOT

- Do NOT delete the old `/crm/leads` or `/crm/opportunities` routes in this slice.
- Do NOT build any web UI in this slice.
- Do NOT touch `schema.prisma`, migrations, `/sot/`, or Azure/Entra/SharePoint.
- Do NOT exceed 8 files.
