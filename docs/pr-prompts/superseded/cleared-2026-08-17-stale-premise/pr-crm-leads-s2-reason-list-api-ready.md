---
premise: '! grep -rq "listDropReasons" apps/api/src/modules/crm/crm.service.ts'
premise_means: The DropReason CRUD API has not been built yet (S2 not done).
requires_file_on_main: apps/api/prisma/seeds/crm-drop-reasons.ts
scope:
  - apps/api/src/modules/crm/crm.controller.ts
  - apps/api/src/modules/crm/crm.service.ts
  - apps/api/src/modules/crm/dto/**
  - apps/api/src/modules/crm/__tests__/**
done_when: pnpm build && pnpm lint && grep -rq "listDropReasons" apps/api/src/modules/crm/crm.service.ts
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# feat(api): CRM S2 — DropReason CRUD API + seed defaults

Implement **SLICE 2** of `docs/plans/crm-leads-collapse-plan.md`.

Read that plan in full before writing any code. This slice adds the managed drop-reason
list API that backs the "Don't pursue" flow. S1 (`requires_file_on_main` gate) must be on
`main` first — the `DropReason` model in `schema.prisma` and the seed file it creates are
the foundation for this slice.

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

Create `apps/api/src/modules/crm/dto/create-drop-reason.dto.ts`:
```typescript
import { IsString, MinLength, MaxLength, IsOptional, IsInt, Min } from 'class-validator';
export class CreateDropReasonDto {
  @IsString() @MinLength(1) @MaxLength(200) label: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
```

Create `apps/api/src/modules/crm/dto/update-drop-reason.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean } from 'class-validator';
import { CreateDropReasonDto } from './create-drop-reason.dto';
export class UpdateDropReasonDto extends PartialType(CreateDropReasonDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
```

### 2. `apps/api/src/modules/crm/crm.service.ts`

Add four methods:

- `listDropReasons()` — return all `DropReason` rows ordered by `sortOrder`, `label`.
- `createDropReason(dto: CreateDropReasonDto)` — create; throw `ConflictException` if
  `label` already exists.
- `updateDropReason(id: string, dto: UpdateDropReasonDto)` — patch; throw
  `NotFoundException` if not found.
- `deleteDropReason(id: string)` — throw `ConflictException` if any `Opportunity` row
  references this reason (i.e. `_count.opportunities > 0`). Otherwise hard-delete.

### 3. `apps/api/src/modules/crm/crm.controller.ts`

Add four routes (all require `crm.view` or a suitable admin gate — check the existing
controller's `@UseGuards` pattern and match it):

```
GET    /crm/drop-reasons        → listDropReasons()
POST   /crm/drop-reasons        → createDropReason(dto)
PATCH  /crm/drop-reasons/:id    → updateDropReason(id, dto)
DELETE /crm/drop-reasons/:id    → deleteDropReason(id)
```

### 4. `apps/api/src/modules/crm/__tests__/crm.service.drop-reason.spec.ts` (new)

Unit tests covering:
- `listDropReasons` returns sorted list.
- `createDropReason` throws `ConflictException` on duplicate label.
- `updateDropReason` throws `NotFoundException` on missing id.
- `deleteDropReason` throws `ConflictException` when opportunities reference the reason.
- `deleteDropReason` succeeds when no references exist.

Match the test structure of the existing
`apps/api/src/modules/crm/__tests__/crm.service.generate-draft-tender.spec.ts`.

## Do NOT

- Do NOT build any UI in this slice.
- Do NOT touch `schema.prisma`, migrations, or `/sot/`.
- Do NOT add a new permission code without verifying it exists in the permission registry.
- Do NOT exceed 7 files.
