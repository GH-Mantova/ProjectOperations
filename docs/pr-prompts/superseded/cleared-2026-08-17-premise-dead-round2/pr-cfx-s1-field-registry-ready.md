---
premise: '! grep -q "model FieldDefinition" apps/api/prisma/schema.prisma'
premise_means: The FieldDefinition registry model does not exist yet — CFX-1 (field-registry + customFields + missing parity columns) has not run.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seeds/**
  - apps/api/src/modules/field-definitions/**
  - apps/api/src/modules/field-definitions/__tests__/field-definitions.service.spec.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model FieldDefinition" apps/api/prisma/schema.prisma && grep -q "customFields" apps/api/prisma/schema.prisma && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: false
rollback_strategy: Purely additive — new table field_definitions, nullable custom_fields JSONB and nullable sales_account_code / purchase_account_code / discount columns on clients and subcontractor_suppliers, plus two new enums. Safe to leave on main without the consuming UI; safe to drop (no data migration to unwind).
backfill: false
---

# feat(api): CFX-1 — FieldDefinition registry, customFields JSON, missing Xero parity columns

Implement **SLICE 1** of `docs/plans/configurable-fields-xero-exchange-plan.md`.

Read that plan in full before writing any code. §2 records the locked decisions (hybrid
registry NOT EAV; built-ins hidden not deleted; custom fields never round-trip to Xero;
add `salesAccountCode`, `purchaseAccountCode`, `discount` as typed BUILTIN columns). §3
pins every entity/field you touch to a file:line on origin/main — verify before editing.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
`pnpm build` and `pnpm lint` must pass.

---

## What to build

### 1. `apps/api/prisma/schema.prisma`

**Add two enums:**
```prisma
enum FieldAppliesTo {
  CLIENT
  VENDOR
  BOTH
}

enum FieldSource {
  BUILTIN
  CUSTOM
}
```

**Add `FieldDefinition` model:**
```prisma
model FieldDefinition {
  id         String         @id @default(cuid())
  key        String
  label      String
  group      String         @default("General")
  sortOrder  Int            @default(0) @map("sort_order")
  visible    Boolean        @default(true)
  required   Boolean        @default(false)
  appliesTo  FieldAppliesTo @map("applies_to")
  source     FieldSource    @default(CUSTOM)
  createdAt  DateTime       @default(now()) @map("created_at")
  updatedAt  DateTime       @updatedAt @map("updated_at")

  @@unique([appliesTo, key])
  @@index([appliesTo, visible])
  @@map("field_definitions")
}
```

**Extend `model Client`** (schema.prisma L672–752) — add these fields alongside the existing ones:
```prisma
  salesAccountCode    String?  @map("sales_account_code")
  purchaseAccountCode String?  @map("purchase_account_code")
  discount            Decimal? @db.Decimal(5, 2)
  customFields        Json?    @map("custom_fields")
```

**Extend `model SubcontractorSupplier`** (schema.prisma L4278–4347) — add the same four fields:
```prisma
  salesAccountCode    String?  @map("sales_account_code")
  purchaseAccountCode String?  @map("purchase_account_code")
  discount            Decimal? @db.Decimal(5, 2)
  customFields        Json?    @map("custom_fields")
```

Do NOT touch any other column on either model. Do NOT drop `sourceLead`, `xeroContactId`,
`myobCardId`, or any FK relation.

### 2. `apps/api/prisma/migrations/**`

Generate ONE new migration. The SQL, in order:

1. `CREATE TYPE "FieldAppliesTo" AS ENUM ('CLIENT', 'VENDOR', 'BOTH');`
2. `CREATE TYPE "FieldSource" AS ENUM ('BUILTIN', 'CUSTOM');`
3. `CREATE TABLE field_definitions (...)` matching the model above (id text PK, unique
   composite index on (applies_to, key), index on (applies_to, visible)).
4. `ALTER TABLE clients ADD COLUMN sales_account_code TEXT, ADD COLUMN purchase_account_code TEXT, ADD COLUMN discount NUMERIC(5, 2), ADD COLUMN custom_fields JSONB;`
5. `ALTER TABLE subcontractor_suppliers ADD COLUMN sales_account_code TEXT, ADD COLUMN purchase_account_code TEXT, ADD COLUMN discount NUMERIC(5, 2), ADD COLUMN custom_fields JSONB;`

**No `UPDATE … SET` in this migration.** All ADDs are nullable — this is the reason
`backfill: false` is declared in the front-matter (Gate A).

### 3. `apps/api/prisma/seeds/field-definitions-builtin.ts` (new)

Upsert one `FieldDefinition` row per typed BUILTIN column on `Client` and on
`SubcontractorSupplier`. Use `source: BUILTIN`, `visible: true`, stable `sortOrder`, and
these groups:

- **Identity** — name, code, tradingName, businessType, abn, acn, gstRegistered, legalName, country
- **Contact** — email, phone, website
- **Address** — physicalAddress/Suburb/State/Postcode, postalAddress/Suburb/State/Postcode, postalSameAs
- **Payment** — paymentTermsDay, paymentTermsType, paymentTermsDays, creditLimit, creditApproved, preferredPayment, **salesAccountCode, purchaseAccountCode, discount**
- **Banking** — bankName, bankAccountName, bankBsb, bankAccountNumber
- **Integration** — xeroContactId, myobCardId
- **Status** — isActive, onHold, onHoldReason, internalNotes
- **Compliance (vendor only)** — entityType, categories, prequalStatus, prequalNotes, swmsOnFile, complianceBlocked, complianceBlockReason, performanceRating

Only include a group on a model if that model has the column (Compliance is VENDOR-only).
Use `appliesTo: BOTH` for fields present on both models; `CLIENT` or `VENDOR` otherwise.
Upsert on `[appliesTo, key]` so re-running the seed is safe.

Wire the new seed into the main seed entry (check `apps/api/prisma/seed.ts` or equivalent
and add the call if missing).

### 4. `apps/api/src/modules/field-definitions/field-definitions.service.ts` (new)

```typescript
@Injectable()
export class FieldDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(appliesTo?: FieldAppliesTo) { /* filter or return all */ }
  get(id: string) { /* findUniqueOrThrow */ }

  createCustom(dto: CreateFieldDefinitionDto) {
    // Force source=CUSTOM; reject if caller tries to pass BUILTIN.
  }

  update(id: string, dto: UpdateFieldDefinitionDto) {
    // Allow: label, group, sortOrder, visible, required.
    // Reject: key, source, appliesTo (throw BadRequest).
  }

  remove(id: string) {
    // If source === BUILTIN → throw BadRequest("Built-in fields can only be hidden, not deleted.")
    // Otherwise delete.
  }
}
```

### 5. `apps/api/src/modules/field-definitions/field-definitions.module.ts` (new)

Standard Nest module wiring the service (no controller in this slice — the controller
ships in CFX-2).

Register the module in the app module (`apps/api/src/app.module.ts` — check the imports
list and add `FieldDefinitionsModule`).

### 6. `apps/api/src/modules/field-definitions/__tests__/field-definitions.service.spec.ts` (new)

Unit tests covering:
- `createCustom` forces `source=CUSTOM` even if the caller passes `BUILTIN`.
- `update` rejects a payload that includes `key`, `source`, or `appliesTo`.
- `remove` throws when the target row is `source=BUILTIN`.
- `remove` succeeds when the target row is `source=CUSTOM`.
- `list()` filters by `appliesTo` (a BOTH row is returned for both CLIENT and VENDOR filters).

Use the standard Prisma mock pattern used by other spec files in this repo — do NOT
introduce a new testing library.

### 7. `docs/data-model/**`

After the schema edit, run:
```bash
node scripts/data-model/build-relationship-map.mjs
```
Commit the regenerated `docs/data-model/relationship-map.json`,
`docs/data-model/relationship-map.md`, and `docs/data-model/metadata-catalog.json`.
The CI drift check (`--check`) will hard-fail if these are stale.

### 8. PR body

Include this bare line at column 0 (not under a heading):

```
GATE-ALLOW: migrations
```

## Do NOT

- Do NOT drop any existing column on `Client` or `SubcontractorSupplier`.
- Do NOT convert typed columns to EAV or to `customFields`.
- Do NOT write the admin controller — that is CFX-2.
- Do NOT touch `apps/api/src/modules/xero/xero.service.ts` (the dormant API push).
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or any file outside declared `scope`.
- Do NOT include any `UPDATE … SET` in the migration — this must stay purely additive
  (matches `backfill: false`).
- Do NOT exceed 10 files.
