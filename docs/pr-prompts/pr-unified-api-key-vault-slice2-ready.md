---
premise: '! grep -rq "class ApiKeysService" apps/api/src'
premise_means: The ApiKeysService.resolve() seam does not exist yet.
scope:
  - apps/api/src/**
done_when: pnpm build && grep -rq "class ApiKeysService" apps/api/src
size: 10
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 889
---

# SLICE-2: ApiKeysService.resolve() seam with legacy fallback (zero behaviour change)

## Premise
The vault models exist (SLICE-1, #889 merged) but there is no common key-resolution seam.
This slice adds ApiKeysService.resolve(adapter, scope, userId?) and reroutes every existing
key consumer through it, keeping the LEGACY path primary (vault is still empty until SLICE-3).
No schema, no migration, no seed, no UI, no route/permission changes.

## Binding spec — READ IT
`docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md` on main, sections:
- §3 (resolver seam signature + semantics), §3b (SLICE-2 wiring, no behaviour change),
  §3c (legacy-primary now; the one-line vault-first FLIP is deferred to SLICE-3),
- §1c (callers today), §1d (permission model - NOT changed in this slice), §4b.
Implement to that spec. Where this prompt and the plan doc agree, follow the plan doc.

## What to build

### 1. ApiKeysService (new module apps/api/src/modules/api-keys/)
`resolve(adapter: string, scope: "company" | "user", userId?: string): Promise<string | null>`
- Look up an enabled ApiCredential where `adapter = coalesce(cred.adapter, cred.type.adapterHint)`
  AND `scope` matches AND (scope="user" => userId matches, mandatory). If found AND it decrypts via
  KeyEncryptionService, that is the VAULT hit.
- **This slice ships LEGACY-PRIMARY (plan §3c):** resolve() returns the legacy value if the legacy
  path produces one, and only uses the vault result as a fallback. Because the vault is empty until
  SLICE-3, behaviour is byte-identical to today. Structure the try/fallback so that SLICE-3 can flip
  to vault-first by swapping ONE line (that flip is NOT done here).
- Legacy sources: for integration adapters (geoapify, fuelpricesqld) delegate to
  `IntegrationKeysService.resolveIntegrationKey(slug)`; for AI adapters (anthropic, openai, gemini,
  groq) read the SAME single consolidated path the app uses today post pr-sec-ai-keys-single-path
  (PlatformConfig company keys / per-user key table). Env-var fallback still applies at the bottom.
- `null` = not configured. Never throw. Never return plaintext to any browser-facing handler - only
  server-side callers use resolve(). Never log the key value.
- User rows never cross-read: scope="user" requires userId and it must be the caller's own.

### 2. Reroute existing consumers through resolve() (NO behaviour change)
- `GeocodingService.autocomplete` -> `apiKeys.resolve("geoapify", "company")` instead of
  `integrationKeys.resolveIntegrationKey("geoapify")`.
- Fuel-cost pathway -> `apiKeys.resolve("fuelpricesqld", "company")`.
- AI request pathway (the consolidated single path) -> `apiKeys.resolve(<provider>, "company")` and
  per-user reads -> `apiKeys.resolve(<provider>, "user", userId)`.
- Wire ApiKeysModule into the module graph so every consumer can inject it.

### 3. Tests
Unit tests for resolve(): legacy hit returned; vault-empty path fires legacy; user-scope requires
matching userId (cross-read denied); null when nothing configured. Existing specs must stay green
with NO fixture changes (that is the proof of zero behaviour change).

## Do NOT
- Do NOT touch schema.prisma, migrations, or seeds (backfill + seed types is SLICE-3).
- Do NOT flip resolve() to vault-first (that is SLICE-3's one-line change per plan §3c).
- Do NOT add or change any route, controller surface, permission guard, or UI. This is a pure
  indirection slice - the permission tightening lands with the UI in SLICE-4.
- Do NOT edit anything under /sot/ (sot-keeper's job via doc-reconcile). Do NOT touch
  Azure/Entra/SharePoint. Do NOT read, print, or rotate any key value.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Never exit silently - if ApiKeysService already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- pnpm build must pass. Keep existing specs green with no fixture edits - if a spec needs editing to
  pass, you changed behaviour; back it out.
