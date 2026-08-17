---
premise: '! grep -q "model DropReason" apps/api/prisma/schema.prisma'
premise_means: The DropReason lookup table does not exist yet — S1 (Lead→Opportunity migration) has not run.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seeds/**
  - apps/api/src/modules/crm/crm.service.ts
  - apps/api/src/modules/crm/__tests__/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model DropReason" apps/api/prisma/schema.prisma && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: The migration drops the leads table (destructive). Take a full DB backup before applying. If aborted mid-migration, run prisma migrate resolve --rolled-back to reset migration state, then restore from backup. New columns on opportunities are nullable and safe to leave; the dropped leads table is not recoverable without a restore.
backfill: false
---

# feat(api): CRM S1 — fold Lead into Opportunity; add DropReason lookup table

Implement **SLICE 1** of `docs/plans/crm-leads-collapse-plan.md`.

Read that plan in full before writing any code. The plan's §3 (Ground truth) records the
exact lines of every entity you will touch on origin/main — verify them before editing.

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

### 1. `apps/api/prisma/schema.prisma`

Make the following changes in one coherent edit:

**Add `DropReason` model** (new managed lookup table):
```prisma
model DropReason {
  id        String        @id @default(cuid())
  label     String        @unique
  isActive  Boolean       @default(true) @map("is_active")
  sortOrder Int           @default(0) @map("sort_order")
  createdAt DateTime      @default(now()) @map("created_at")
  updatedAt DateTime      @updatedAt @map("updated_at")

  opportunities Opportunity[]

  @@map("drop_reasons")
}
```

**Extend `OpportunityStage` enum** — add three new values:
```
open         // replaces new/qualified/quoting for the lead surface
not_pursued  // replaces lost/disqualified
archived     // replaces won (deal archived after tender conversion)
```
Keep the existing values (`new`, `qualified`, `quoting`, `won`, `lost`) so the migration
can reference them in a WHERE clause. Remove them only after the migration confirms the data
is moved (you can drop them in the same migration's final step if Prisma allows, or leave
a follow-up note if it does not compile).

**Extend `model Opportunity`** — add these fields:
```prisma
  isLead           Boolean      @default(false) @map("is_lead")
  dropReasonId     String?      @map("drop_reason_id")
  dropReason       DropReason?  @relation(fields: [dropReasonId], references: [id], onDelete: SetNull)
  dropReasonDetail String?      @map("drop_reason_detail")
```

**Remove `model Lead` and `enum LeadStatus`** — delete both from the schema. The `Lead`
back-relation on `Opportunity` (`sourceLead`) becomes unnecessary once Lead rows are merged;
remove it. Preserve `convertedTenderId` / `convertedTender` FK exactly as-is.

### 2. `apps/api/prisma/migrations/**`

Generate ONE migration. The migration SQL must perform IN ORDER:

1. `CREATE TABLE drop_reasons (...)` with the columns above.
2. Add new columns to `opportunities` table:
   `is_lead BOOLEAN NOT NULL DEFAULT false`,
   `drop_reason_id TEXT REFERENCES drop_reasons(id) ON DELETE SET NULL`,
   `drop_reason_detail TEXT`.
3. `ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'open'` (repeat for
   `not_pursued`, `archived`). (Postgres does not support removing enum values in the same
   transaction — keep old values in the enum; they will be unused after migration.)
4. Copy `leads` rows into `opportunities`:
   ```sql
   INSERT INTO opportunities (id, title, stage, source, is_lead,
     client_id, contact_id, owner_id, notes,
     next_action_at, next_action_note, created_at, updated_at)
   SELECT l.id, l.title, 'open'::"OpportunityStage", l.source, true,
     l.client_id, l.contact_id, l.owner_id, l.notes,
     l.next_action_at, l.next_action_note, l.created_at, l.updated_at
   FROM leads l
   ON CONFLICT (id) DO NOTHING;
   ```
5. Remap existing `Opportunity` stages:
   ```sql
   UPDATE opportunities SET stage = 'open'        WHERE stage IN ('new','qualified','quoting');
   UPDATE opportunities SET stage = 'not_pursued'  WHERE stage = 'lost';
   UPDATE opportunities SET stage = 'archived'     WHERE stage = 'won';
   ```
6. Carry `lostReason` text from old Opportunity rows into `drop_reason_detail` (cannot
   map to a `DropReason` row automatically — preserve the text):
   ```sql
   UPDATE opportunities SET drop_reason_detail = lost_reason WHERE lost_reason IS NOT NULL;
   ```
7. Drop the `lost_reason` column from `opportunities`.
8. Drop the `leads` table.

**Do NOT touch `converted_tender_id` in any UPDATE or DROP.**

### 3. `apps/api/prisma/seeds/**`

Create `apps/api/prisma/seeds/crm-drop-reasons.ts` seeding the six default `DropReason`
rows (upsert on label):
- "Price / budget"
- "Didn't know we offer it"
- "Timing / capacity"
- "Out of service area"
- "Went cold"
- "Other"

Ensure the seed is called from the main seed entry point (check `apps/api/prisma/seed.ts`
or equivalent and add the call if missing).

### 4. `apps/api/src/modules/crm/crm.service.ts`

Update any Prisma `prisma.lead.*` calls to use `prisma.opportunity.*` with the new unified
shape. Do NOT change the `generateDraftTender` business logic — only update the Prisma
model references if they broke due to `Lead` removal.

### 5. `apps/api/src/modules/crm/__tests__/crm.service.generate-draft-tender.spec.ts`

Update any `toHaveBeenCalledWith(...)` expectations that reference the old `Lead` model
shape (e.g., add `isLead`, remove Lead-specific fields). The spec must pass `pnpm build`.

### 6. `docs/data-model/**`

After the schema changes, run:
```bash
node scripts/data-model/build-relationship-map.mjs
```
Commit the regenerated `docs/data-model/relationship-map.json`,
`docs/data-model/relationship-map.md`, and `docs/data-model/metadata-catalog.json`.
The CI drift check (`--check`) will hard-fail if these are stale.

### 7. PR body

The PR body MUST include the following bare line at column 0 (not under a heading):

```
GATE-ALLOW: migrations
```

## Do NOT

- Do NOT build any API routes or UI in this slice.
- Do NOT change `generateDraftTender` business logic — only update the Prisma model
  references.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or any file outside the declared scope.
- Do NOT remove `convertedTenderId` / `convertedTender` FK.
- Do NOT exceed 10 files.
