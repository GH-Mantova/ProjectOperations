---
premise: '! grep -q "model ApiCredential" apps/api/prisma/schema.prisma'
premise_means: The ApiCredential/ApiKeyType vault models do not exist on main yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
done_when: pnpm build && grep -q "model ApiCredential" apps/api/prisma/schema.prisma && grep -q "model ApiKeyType" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
seed_only: false
escalates: false
rollback_strategy: 'Additive migration (two new tables api_credential + api_key_type; all columns nullable or defaulted; no data change; no drops). Forward-only safe. To revert before dependent code lands: drop both tables and delete the migration dir, then re-run prisma migrate.'
requires_merged:
  - 887
---

# SLICE-1: ApiCredential + ApiKeyType vault models + additive migration + map regen

## Premise
The unified API-key vault models do not exist yet. This slice adds ONLY the Prisma models,
the additive migration, and the regenerated data-model map. NO services, controllers, seeds,
or UI - those are later slices. Gated on the plan doc (PR #887) landing first.

## What to build

### 1. Add two models to apps/api/prisma/schema.prisma
Mirror the existing IntegrationCredential encryption convention (AES-256-GCM ciphertext string
"iv:authTag:ciphertext" via KeyEncryptionService). Use EXACTLY this shape:

    model ApiKeyType {
      id          String          @id @default(uuid())
      name        String          @unique
      description String?
      systemKind  String?         // null = user-defined; "ai" | "geocoding" = system-consumed
      createdAt   DateTime        @default(now())
      updatedAt   DateTime        @updatedAt
      credentials ApiCredential[]
      @@map("api_key_type")
    }

    model ApiCredential {
      id             String     @id @default(uuid())
      name           String
      typeId         String
      type           ApiKeyType @relation(fields: [typeId], references: [id])
      adapter        String?    // provider binding: anthropic|openai|gemini|groq|geoapify|google|... | null (passive)
      scope          String     @default("company") // "company" | "user"
      userId         String?    // owner when scope="user" (BYOK); app-enforced, no FK in this slice
      valueEncrypted String?    // AES-256-GCM, same format as IntegrationCredential
      validatedAt    DateTime?
      enabled        Boolean    @default(true)
      order          Int?       // chain position for ordered (geocoding) types
      config         Json?      // custom-REST endpoint + field map; geocoding options
      updatedById    String?    // actor; app-enforced, no FK in this slice
      createdAt      DateTime   @default(now())
      updatedAt      DateTime   @updatedAt
      @@index([typeId])
      @@index([scope, userId])
      @@map("api_credential")
    }

### 2. Create the additive migration
Under apps/api/prisma/migrations/<timestamp>_api_key_vault/migration.sql - CREATE TABLE only for
api_key_type and api_credential (+ their indexes + the FK typeId -> api_key_type.id). No drops, no
alters to existing tables, no data changes.

### 3. Regenerate the data-model map (CI data-model drift check will hard-fail otherwise)
Run: node scripts/data-model/build-relationship-map.mjs
Commit the regenerated docs/data-model/relationship-map.json + relationship-map.md +
metadata-catalog.json.

### 4. PR body
Include a bare line at column 0: GATE-ALLOW: migrations

## Do NOT
- Do NOT add any service, controller, resolver, seam, seed, or UI - SLICE-1 is schema + migration
  + map ONLY. The resolve() seam is SLICE-2; backfill/seed is SLICE-3; the UI is SLICE-4.
- Do NOT modify or migrate the existing IntegrationCredential / PlatformConfig / per-user AI key
  storage. Additive only; those keep working untouched.
- Do NOT add a foreign key from ApiCredential.userId/updatedById to User in this slice (bare String,
  app-enforced) - keeps the migration additive and small.
- Do NOT edit anything under /sot/. The sot/04 data-model reconcile is the sot-keeper station's job
  via a separate doc-reconcile PR (CP-24 fails any PR mixing code and sot/). Note it in the PR body.
- Do NOT touch Azure/Entra/SharePoint. Do NOT read, print, or rotate any key value.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Never exit silently - if the models are already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- Regenerate the data-model map (step 3) or the drift check fails; put GATE-ALLOW: migrations bare
  in the PR body (step 4) or CP-11 fails.
- pnpm build must pass. Docs/data-model map is docs-class so it commits alongside the code (CP-24 safe).
