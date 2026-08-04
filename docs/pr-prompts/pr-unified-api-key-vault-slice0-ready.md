---
premise: '! test -f docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md'
premise_means: The unified API-key vault + geocoding-failover slice plan has not been authored on main yet.
scope:
  - docs/architecture/plans/**
done_when: test -f docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md && grep -q "SLICE-7" docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# SLICE-0 (PLAN): Unified API-key vault + geocoding provider-failover chain

## Premise
No design/plan doc exists yet for this program. This prompt authors ONLY the plan
document under docs/architecture/plans/ - no code, no schema, no migrations. It is the
SLICE-0 of a staged slice plan; SLICE-1..7 are separate prompts staged later.

## Context (grounded on origin/main, 2026-08)
Third-party keys live in THREE stores today:
- Company AI keys on the PlatformConfig singleton (anthropicApiKey/geminiApiKey/...),
  written via /ai-settings/company/keys (super-user + platform.admin, live-validated).
- Per-user BYOK AI keys via /ai-settings/me/keys (gated on GlobalAISettings.allowBringYourOwnKey,
  permission ai.persona.tendering, live-validated).
- Integration keys in IntegrationCredential (slug @id: geoapify, fuelpricesqld),
  Admin -> Integrations, platform.admin, AES-256-GCM, env-var fallback.
Geocoding today: GeocodingService.autocomplete() ONLY (hardcoded Geoapify, 3.5s timeout,
graceful empty-on-fail); NO forward or reverse geocode. site-resolver persists textual
address only (no lat/lon/place_id).

Marco's goal: ONE Name/Type/Key vault (editable, extensible Type dropdown) replacing both key
screens, PLUS a configurable ordered geocoding provider-failover chain that plugs into it.

## What to build (THIS prompt = the plan doc ONLY)
Author docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md specifying:

1. Data model: ApiCredential { id, name, typeId->ApiKeyType, adapter?, scope(company|user),
   userId?, valueEncrypted, validatedAt, enabled, order?, config Json?, updatedById, updatedAt,
   createdAt } and ApiKeyType { id, name @unique, description?, systemKind? (null|"ai"|"geocoding") }.
   Types referenced by id so a rename cascades. Geocoding chain = enabled rows where
   type.systemKind="geocoding" ordered by `order`. Reuse KeyEncryptionService (AES-256-GCM);
   ciphertext ports as-is.
2. ApiKeysService.resolve(adapter, scope, userId?) seam with LEGACY FALLBACK during transition.
3. Migration strategy: dual-read BEFORE backfill; idempotent backfill of all three stores; flip to
   prefer the vault; legacy = fallback only. Per-user rows never cross-read.
4. Permission preservation: AI keys stay super-user + platform.admin; others platform.admin.
5. Validation preservation: per-type validation-on-save (AI validates live; geocoding cheap ping;
   passive/custom skip).
6. Compliance rule: persist textual address only; discard provider lat/lon + place_id at save.
7. Custom REST adapter: SSRF-hardened (https only, block private/link-local ranges), platform.admin.

8. The slice sequence, each with a one-line EXECUTABLE premise sketch. The doc MUST contain the
   literal markers SLICE-1 through SLICE-7:
   - SLICE-1 models + additive migration + map regen + sot/04 doc-reconcile companion.
   - SLICE-2 resolve() seam with legacy fallback; route existing consumers through it (no behaviour change).
   - SLICE-3 idempotent backfill; flip to vault; seed built-in types + adapters.
   - SLICE-4 unified Admin UI (Name/Type/Key table, Manage Types rename-cascade, company/personal
     scope); retire the two old screens; requires_merged the pr-sec-ai-keys-single-path work + the
     AdminSettingsPage restructure.
   - SLICE-5 GeocodingChainService over geocoding-type rows (fall-through on timeout/error/empty),
     Geoapify-as-adapter, autocomplete through the chain.
   - SLICE-6 Google/Geocodify/MapTiler/Nominatim adapters + forward/reverse geocode ops + cost tiering.
   - SLICE-7 Custom REST adapter (SSRF-hardened).
9. Sequencing: this program lands AFTER pr-sec-ai-keys-single-path and the approved AdminSettingsPage
   restructure; every schema slice carries its own sot/04 doc-reconcile PR (CP-24).

## Do NOT
- Do NOT write any code, schema.prisma, migration, or seed. Docs only.
- Do NOT edit anything under /sot/ (recommend a doc-reconcile PR inside the plan doc instead).
- Do NOT touch Azure/Entra/SharePoint. Do NOT read, print, or rotate any key value.
- Do NOT stage or arm SLICE-1..7 - this prompt produces the PLAN doc only.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Never exit silently - if the doc already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- Docs-only PR (docs/** only); never mix code or sot/ (CP-24). A one-line PR body is fine.
