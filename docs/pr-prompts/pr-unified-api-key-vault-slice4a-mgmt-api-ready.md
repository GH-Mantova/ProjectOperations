---
premise: '! test -f apps/api/src/modules/api-keys/api-keys.controller.ts'
premise_means: The vault management REST API (controller + write/list/test methods) does not exist yet.
scope:
  - apps/api/src/modules/api-keys/**
done_when: pnpm build && test -f apps/api/src/modules/api-keys/api-keys.controller.ts
size: 10
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged: []
---

# SLICE-4a: Vault management API (ApiCredential + ApiKeyType CRUD + per-type validation)

## Premise
The vault backend is live: models (ApiCredential/ApiKeyType), the vault-first ApiKeysService.resolve()
seam, the backfill, and the geocoding failover chain with 6 adapters are all on main. But there is NO
management surface: apps/api/src/modules/api-keys/ has only api-keys.service.ts (resolve) + the module.
This slice adds the REST API the SLICE-4b unified "API Keys" screen will consume. NO schema change, NO
migration, NO UI.

## Binding spec — READ IT
`docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md` on main:
- §2 (ApiCredential/ApiKeyType fields — the source of truth for DTO shapes),
- §1d + §6 (PERMISSION + COMPLIANCE invariants — enforce ALL of them),
- §3a (ApiKeysService.resolve semantics — do not change resolve; add write/list/test alongside it),
- §4d (what the screen needs from this API), §5 (per-type validation behaviour),
- §4c (the 11 seeded ApiKeyType rows + their systemKind/adapterHint).
Mirror the existing code: KeyEncryptionService (apps/api/src/modules/security/key-encryption.service.ts)
for encrypt/decrypt; the AI live-probe logic in ai-settings.service.ts; GeocodingChainService +
adapters for geocoding validation; the super-user + platform.admin guards used in ai-settings.controller.ts.

## What to build (all under apps/api/src/modules/api-keys/)

### 1. ApiKeysController (api-keys.controller.ts) — company + personal credential management
- `GET /api-keys/credentials?scope=company|user` — list. Company rows: super-user + platform.admin.
  Personal rows: the caller's OWN rows only (userId = req.user.sub); a super-user may LIST personal rows
  of others as STATUS ONLY (name, type, hasKey, validatedAt, enabled, order, updatedBy) for audit — NEVER
  the value. Response NEVER includes valueEncrypted or plaintext. Shape: { id, name, typeId, typeName,
  adapter, scope, hasKey:true, validatedAt, enabled, order, config (non-secret), updatedAt, updatedBy }.
- `POST /api-keys/credentials` — create. Body { name, typeId, scope, key(plaintext), adapter?, config? }.
  Company scope requires super-user + platform.admin; user scope forces userId = req.user.sub (ignore any
  client-supplied userId). Encrypt `key` immediately via KeyEncryptionService; store valueEncrypted; NEVER
  echo the key back. Optionally run validation on save (see §4) and stamp validatedAt.
- `PATCH /api-keys/credentials/:id` — update name / typeId / enabled / order / config / (optional new key).
  Re-encrypt only if a new key is supplied. Same permission gate; a user can only touch their own rows.
- `POST /api-keys/credentials/reorder` — body { ids: string[] } sets `order` for geocoding-chain ordering
  (company scope). Invalidate the GeocodingChainService memoiser after any credential write (call its
  invalidate()).
- `DELETE /api-keys/credentials/:id` — same gate; user rows self-only.
- `POST /api-keys/credentials/:id/test` — run per-type validation (§4) and stamp validatedAt; return
  { ok, validatedAt?, reason? }.
- There is NO GET /:id/value route — full stop (§6.2).

### 2. ApiKeyTypesController (or the same controller) — Manage Types CRUD
- `GET /api-keys/types` — list types { id, name, description, systemKind, adapterHint, credentialCount }.
- `POST /api-keys/types` — create { name(unique), description? }. New user types get systemKind=null and
  adapterHint=null (users can NOT invent a systemKind — §2a). Reject duplicate name (409).
- `PATCH /api-keys/types/:id` — rename / edit description. Rename is instant everywhere because credentials
  reference typeId (rename-cascade is automatic — assert in a test). Block editing systemKind/adapterHint
  on seeded types.
- `DELETE /api-keys/types/:id` — blocked with a friendly 409 while any ApiCredential references it
  (onDelete: Restrict already enforces at the DB — surface it as "N keys use this type — reassign first").
- Manage-Types writes require super-user + platform.admin.

### 3. Extend ApiKeysService (do NOT change resolve())
Add: listCredentials, createCredential, updateCredential, reorderCredentials, deleteCredential,
testCredential, and the ApiKeyType CRUD helpers. Enforce the permission rules HERE too (defence in depth,
§6.4) — not only in the controller. Never log or return a key value (match KeyEncryptionService.tryDecrypt
logging discipline: {typeId, scope, subjectId} only).

### 4. Per-type validation (§5) — FULL, reuse existing logic
- AI types (systemKind="ai", adapterHint anthropic/openai/gemini/groq): reuse the existing live-probe from
  ai-settings.service.ts (cheap provider probe, 5s timeout, categorised error). Extract a shared validator
  or call the service — do not reimplement the HTTP calls.
- Geocoding types (systemKind="geocoding"): a single autocomplete for "Brisbane" with limit=1 via the
  matching adapter (reuse the geocoding adapters / chain). Success = >=1 result parsed.
- Custom REST (adapterHint="custom-rest"): assertSafeUrl (SSRF guard) MUST pass, then one probe against
  config.autocompletePath with text="Brisbane"; success = 2xx AND >=1 row extractable via responseShape.
- Fuel Prices QLD (adapterHint="fuelpricesqld"): cheap /subscriber/currentDay probe.
- Passive/unclassified custom types (systemKind=null, no known adapter): skip validation; return
  { ok:true, reason:"validation skipped — custom type" }.
Every probe runs API-side, honours the existing 5s / 3500ms budgets, and NEVER logs the key.

### 5. Wiring + tests
- Register the controller(s) in api-keys.module.ts; the module is @Global so no cross-module import churn.
- Tests: permission matrix (company write blocked for non-super-user; user cannot read/write another
  user's row; no value ever serialised); create encrypts + never echoes plaintext; rename-cascade (rename a
  type → credentials reflect it with no data migration); delete-in-use → 409; reorder sets order + calls
  chain invalidate(); each validation branch (AI / geocoding / custom-rest SSRF-first / fuel / skipped).

## Do NOT
- Do NOT change schema.prisma, add a model, or write a migration (gate_allow: none — models already exist).
- Do NOT add or change any UI (that is SLICE-4b).
- Do NOT change ApiKeysService.resolve() behaviour, the geocoding adapters, or site-resolver.
- Do NOT add a route that returns a decrypted key value to the browser, ever (§6.2).
- Do NOT edit /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key VALUE beyond
  the encrypt-on-write and the server-side validation probe.
- If the full slice would exceed ~10 files, SPLIT: land credential CRUD + validation here, and leave the
  ApiKeyType (Manage Types) CRUD for an immediate follow-up prompt — say so in the PR body. Do not blow the
  size budget or drop tests to fit.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. Finishing the work and then asking for
> permission is indistinguishable from failing.

## Guardrails
- One attempt. Never exit silently — if api-keys.controller.ts already exists on main, say `NO-OP`.
- Never ask a question or "stand by". Read the CI job log before diagnosing a failure.
- pnpm build + pnpm lint must pass. Enforce permissions in BOTH controller and service. No plaintext key
  ever leaves the API. Add the permission-matrix + rename-cascade + delete-in-use + validation tests.
