---
premise: '! ls apps/api/prisma/migrations | grep -q backfill_api_credential_vault'
premise_means: The API-key vault backfill migration does not exist on main yet.
scope:
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/api-keys/**
done_when: pnpm build && ls apps/api/prisma/migrations | grep -q backfill_api_credential_vault
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Idempotent + additive: only INSERT/upsert of new ApiKeyType + ApiCredential rows (ciphertext bytes copied, NO re-encrypt); legacy PlatformConfig / IntegrationCredential / per-user rows untouched. To revert before the vault-first flip is trusted: delete the copied ApiCredential rows (legacy fallback still resolves every key) and revert the one-line resolve() reorder. Forward-safe; re-running the migration is a no-op.'
requires_merged:
  - 892
---

# SLICE-3: idempotent backfill + seed 11 types + flip resolve() to vault-first (escalates)

## Premise
The vault models (SLICE-1 #889) and the resolve() seam (SLICE-2 #892) are on main, seam is
LEGACY-PRIMARY. This slice seeds the built-in types, backfills the three legacy key stores into
ApiCredential (copying ciphertext bytes, no re-encrypt), and flips resolve() to VAULT-FIRST.
escalates:true - this copies key material, so the pipeline opens the PR but must NOT auto-merge;
Marco reviews before it lands.

## Binding spec — READ IT
`docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md` on main:
- §4c (backfill + seed, exact 11 seed types + keying rules), §3c (the one-line vault-first flip +
  rollback contract), §1a (source columns: PlatformConfig.<provider>KeyEncrypted, IntegrationCredential,
  per-user key table), §6 (ciphertext format never changes; no plaintext).
Implement to that spec.

## What to build

### 1. Idempotent backfill migration
Create apps/api/prisma/migrations/<timestamp>_backfill_api_credential_vault/migration.sql that is
SAFE TO RE-RUN (upserts / ON CONFLICT DO NOTHING), per plan §4c:
a. Seed the 11 built-in ApiKeyType rows (name, systemKind, adapterHint) EXACTLY as listed in §4c:
   Anthropic (Claude)/ai/anthropic, OpenAI/ai/openai, Google Gemini/ai/gemini, Groq/ai/groq,
   Geoapify/geocoding/geoapify, Google Maps/geocoding/google, Geocodify/geocoding/geocodify,
   MapTiler/geocoding/maptiler, Nominatim (OSM)/geocoding/nominatim, Fuel Prices QLD/null/fuelpricesqld,
   Custom REST/null/custom-rest. INSERT ... ON CONFLICT (name) DO NOTHING.
b. For each populated PlatformConfig.<provider>KeyEncrypted → upsert an ApiCredential
   {scope="company", typeId=<AI type by adapterHint>, valueEncrypted=<COPY bytes>, validatedAt=<copy>,
   enabled=true, name="Company <provider> key"} keyed on (typeId, scope, name) so re-run is a no-op.
c. For each populated per-user key row → upsert ApiCredential {scope="user", userId=<owner>}, same keying.
d. For each populated IntegrationCredential row → upsert ApiCredential {scope="company",
   typeId=<matching type>, valueEncrypted=<copy>, name=<slug label>}; set order=1 on the geoapify row
   so seeded Geoapify is head-of-chain.
COPY ciphertext bytes as-is (no decrypt, no re-encrypt). No drops, no ALTERs to legacy tables.

### 2. Flip resolve() to VAULT-FIRST (plan §3c)
In ApiKeysService.resolve, reorder so the vault lookup is preferred and legacy is the fallback (the
one-line change SLICE-2 was built to enable). Update api-keys.service.spec.ts: a vault hit now wins;
legacy still fires when the vault has no matching row.

### 3. PR body
Include a bare line at column 0: GATE-ALLOW: migrations
Note the migration is idempotent + reversible (rollback in frontmatter).

## Do NOT
- Do NOT modify apps/api/prisma/schema.prisma (models already exist from SLICE-1) - so NO data-model
  map regen is needed; the drift check passes with schema unchanged.
- Do NOT add UI, routes, controllers, or permission guards (that is SLICE-4).
- Do NOT drop, alter, or delete any legacy row (PlatformConfig / IntegrationCredential / per-user).
  Backfill is additive; legacy stays as the fallback until SLICE-4 retires the old screens.
- Do NOT decrypt, read, print, log, or rotate any key VALUE. Copy the encrypted bytes only.
- Do NOT edit /sot/. Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way. (escalates:true only blocks
> the MERGE, never the run - build it and OPEN the PR.)

## Guardrails
- One attempt. Never exit silently - if the backfill migration already exists on main, say `NO-OP`.
- Never ask a question or "stand by". Read the CI job log before diagnosing a failure.
- pnpm build must pass. Migration must be idempotent (re-run = no-op) and additive only.
- Put GATE-ALLOW: migrations bare at column 0 of the PR body or CP-11 fails.
