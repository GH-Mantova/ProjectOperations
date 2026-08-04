# Unified API-key vault + geocoding provider-failover chain — binding slice plan

**Status:** SLICE-0 (this document). Every code slice below chains behind it via
`requires_merged`. Slices ship independently, each ≤ ~10 files, each CI-green.
**Owner:** Marco / ProjectOperations platform + geocoding.
**Ask (verbatim, Marco 2026-08-04):** replace the three separate key stores with a
single **Name / Type / Key** vault (extensible Type dropdown, "Manage Types" surface
for CRUD), and use the same vault to drive an ordered **geocoding provider-failover
chain** (Geoapify → Google → Geocodify → MapTiler → Nominatim → custom REST) that
falls through on timeout/error/empty for autocomplete, forward, and reverse geocode.

This document is the plan only. No code, schema, migration, or seed is written
here. SLICE-1..7 are staged as separate prompts once this doc merges and the two
pre-requisite programs (see §9) have landed.

---

## 1. Ground truth (pinned to files/lines on origin/main, 2026-08-04)

### 1a. Where third-party keys live TODAY (three separate stores)

- **Company AI keys — PlatformConfig singleton.** `apps/api/prisma/schema.prisma:2496-2534`
  — one row (`id = "singleton"`) holds `anthropicKeyEncrypted`, `openaiKeyEncrypted`,
  `geminiKeyEncrypted`, `groqKeyEncrypted`, plus per-provider `validatedAt` columns
  and per-provider `<provider>Model` overrides. Ciphertext format:
  `<iv-b64>:<authTag-b64>:<ciphertext-b64>` (AES-256-GCM via `KeyEncryptionService`,
  master key = `BYOK_ENCRYPTION_KEY`).
- **AI keys HTTP surface — `/ai-settings/*`.**
  `apps/api/src/modules/ai-settings/ai-settings.controller.ts`:
  - `GET /ai-settings/company/keys` (`:41-50`) — super-user + `platform.admin`;
    status only (`hasKey`, `validatedAt`), never plaintext.
  - `POST /ai-settings/company/keys/:provider` (`:52-67`) — save + **live-validate**
    against the provider (5 s timeout, categorised error).
  - `DELETE /ai-settings/company/keys/:provider` (`:69-81`).
  - `GET/POST/DELETE /ai-settings/me/keys[/:provider]` (`:84-121`) — per-user BYOK,
    gated on `GlobalAISettings.allowBringYourOwnKey` (`schema.prisma:4804`) and
    permission `ai.persona.tendering`; live-validated on save.
  - Provider whitelist: `anthropic | openai | gemini | groq` (`:24-25`).
- **Integration keys — IntegrationCredential.**
  `apps/api/prisma/schema.prisma:2536-2545` — `{ slug @id, label, valueEncrypted,
  meta Json?, updatedAt, updatedById }`. Two rows today, both from
  `apps/api/src/common/integrations/integration-keys.registry.ts:27-40`:
  - `slug="geoapify"`, `envVar=GEOAPIFY_API_KEY` — used by the sites/addresses form.
  - `slug="fuelpricesqld"`, `envVar=FUELPRICESQLD_API_KEY` — fuel-cost calculations.
- **Integration-key resolver — same AES-256-GCM, with env fallback.**
  `apps/api/src/common/integrations/integration-keys.service.ts:44-61`:
  1. DB row → `KeyEncryptionService.tryDecrypt`,
  2. `process.env[envVar]` (transitional — Azure App Service keys keep working
     until re-entered in the UI),
  3. `null`.
  Never returns plaintext to the browser; only server-side integration clients
  call `resolveIntegrationKey(slug)`.
- **Encryption service.** `apps/api/src/modules/security/key-encryption.service.ts`
  — `AES-256-GCM`, 12-byte IV, 32-byte master key, storage
  `<iv>:<tag>:<ct>` (all base64). `tryDecrypt` swallows the throw and logs a warn
  with `{provider, scope, subjectId}` context (never logs the blob, the plaintext,
  or the master). The vault reuses this service byte-for-byte — the ciphertext
  format ports over unchanged, which is what makes the backfill (§4c) idempotent
  and reversible.

### 1b. Where geocoding lives TODAY

- **One endpoint, one provider, autocomplete only.**
  `apps/api/src/modules/geocoding/geocoding.service.ts:38-71` — `autocomplete(text)`
  hits `https://api.geoapify.com/v1/geocode/autocomplete` with a 3 500 ms timeout,
  `filter=countrycode:au`, `limit=6`. No forward geocode. No reverse geocode. No
  batch API. **No provider chain** — a Geoapify outage removes the feature.
- **Configured / not-configured path.** When the key resolver returns `null`,
  the service replies `{ configured: false, results: [], reason: "…" }` so the
  browser shows "not configured" instead of a 500. When the request errors or
  times out, it replies `{ configured: true, results: [], reason: "…" }`. Both
  paths are silent-fallback — the browser never sees a 5xx. Preserve this shape
  in SLICE-5 (§4e) so the chain is drop-in.
- **What the address form persists — TEXT ONLY (compliance rule).**
  `apps/api/src/modules/geocoding/site-resolver.service.ts:36-108` — `findOrCreate`
  reads `{ formatted, addressLine1, suburb, state, postcode, clientId }` from the
  chosen suggestion and writes those into `Site` (see `Site` columns at
  `:97-105`). It **does not** persist `lat`, `lon`, or `place_id` even though the
  API returns them (`geocoding.service.ts:100-116`). This is a deliberate
  compliance boundary and this program preserves it (§4d).

### 1c. Callers wired through the resolver seam TODAY

- `GeocodingService` → `IntegrationKeysService.resolveIntegrationKey("geoapify")`.
- Fuel-cost pathway → `resolveIntegrationKey("fuelpricesqld")` (same seam).
- AI request pathway → **direct DB reads** from `PlatformConfig` and per-user
  key tables inside `AiSettingsService` / `PlatformConfigService`. **These do
  not go through a common seam today**, which is why SLICE-2 (§4b) introduces
  `ApiKeysService.resolve(adapter, scope, userId?)` and reroutes them.

### 1d. Permission model today — and where it moves

- Company AI keys today: super-user + `platform.admin`
  (`ai-settings.controller.ts:42, 53, 71, 123-127`).
- Personal AI keys today: `ai.persona.tendering` + gate on
  `GlobalAISettings.allowBringYourOwnKey` (`schema.prisma:4804`).
- Integration keys today: `platform.admin` (via Admin → Integrations page).
- **Marco's rule (2026-08-04) — read this before SLICE-2:** the vault's
  **company-scope** rows require super-user + `platform.admin`. That is a
  **TIGHTENING** of integration keys, which are `platform.admin`-only today.
  A super-user gate is added at cutover. Personal-scope rows are self-managed
  by the owning user; `userId` is taken from the JWT (`req.user.sub`); a user
  can only read/write their own personal rows and can never touch a company
  row or another user's row. This is enforced in `ApiKeysService.resolve`
  and in the vault controller — both layers.

---

## 2. Data model (SPEC — implemented in SLICE-1)

Two new models. All names shown here are the binding source of truth for
schema.prisma; SLICE-1 authors migrations + the map-regen companion.

### 2a. `ApiKeyType`

```
model ApiKeyType {
  id           String   @id @default(cuid())
  name         String   @unique                  // shown in the Type dropdown
  description  String?
  systemKind   String?                           // null | "ai" | "geocoding"
                                                 //   null      → generic (custom / fuel / etc.)
                                                 //   "ai"      → resolved by ApiKeysService.resolve for AI adapter
                                                 //   "geocoding" → included in GeocodingChainService (§4e)
  adapterHint  String?                           // built-in adapter binding for
                                                 //   the seeded types (e.g. "geoapify",
                                                 //   "google", "nominatim", "custom-rest").
                                                 //   Null on user-created types.
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  credentials  ApiCredential[]

  @@map("api_key_types")
}
```

- **Rename cascade.** Types are referenced by `id`, so a rename in "Manage
  Types" propagates instantly to every `ApiCredential` row without a data
  migration. This is why we do NOT key credentials by `type.name`.
- **Uniqueness.** `name` is unique for the dropdown / free-text search
  ergonomics.
- **`systemKind` is closed-set at the code layer.** Only the seeded types get
  a non-null `systemKind`; the UI does not let users invent a new
  `systemKind`. This preserves the invariant "geocoding chain = enabled rows
  where `type.systemKind='geocoding'` ordered by `order`".

### 2b. `ApiCredential`

```
model ApiCredential {
  id              String        @id @default(cuid())

  // Human name in the vault list (e.g. "Anthropic — prod", "Geoapify AU").
  name            String

  // Type reference — dropdown-driven, extensible via Manage Types.
  typeId          String
  type            ApiKeyType    @relation(fields: [typeId], references: [id], onDelete: Restrict)

  // Adapter override. Populated for custom REST keys (§4g) so the vault can
  // point at a bespoke endpoint without needing a new ApiKeyType. NULL means
  // "use type.adapterHint".
  adapter         String?

  // Scope: "company" = super-user + platform.admin
  //        "user"    = personal / BYOK, self-managed by userId owner
  scope           String        // "company" | "user"
  userId          String?       // required iff scope="user"; must equal req.user.sub on writes
  user            User?         @relation(fields: [userId], references: [id], onDelete: Cascade)

  // AES-256-GCM ciphertext, same format as PlatformConfig / IntegrationCredential today
  // ("<iv-b64>:<authTag-b64>:<ciphertext-b64>"). Reuses KeyEncryptionService.
  valueEncrypted  String

  // Live-validation stamp (mirrors PlatformConfig.<provider>KeyValidatedAt).
  validatedAt     DateTime?

  enabled         Boolean       @default(true)   // disable without deleting
  order           Int?                            // used for geocoding chain ordering; null otherwise

  // Adapter-specific config (custom-REST base URL + header shape, Google project
  // id, MapTiler region hint, etc.). Never stores a secret.
  config          Json?

  updatedById     String?
  updatedBy       User?         @relation("ApiCredentialUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
  updatedAt       DateTime      @updatedAt
  createdAt       DateTime      @default(now())

  @@index([scope, userId])                        // resolve(scope="user", userId) hot path
  @@index([typeId, enabled, order])               // GeocodingChainService hot path
  @@map("api_credentials")
}
```

- **Ciphertext ports as-is.** SLICE-3 (§4c) copies
  `PlatformConfig.<provider>KeyEncrypted` and `IntegrationCredential.valueEncrypted`
  directly into `ApiCredential.valueEncrypted`. Same master key, same format,
  no re-encrypt required. This is what makes the backfill idempotent AND
  reversible (delete the copied rows, legacy fallback still works — §4c).
- **`onDelete: Restrict` on `typeId`.** Prevents accidental type deletion
  while credentials still reference it. "Manage Types" surfaces a "N keys
  use this type — reassign first" affordance.
- **`onDelete: Cascade` on `userId`.** Removing a user removes their personal
  BYOK rows. Matches the current behaviour of the per-user key store.
- **Never returned in plaintext to a browser.** Same rule as today. The
  vault UI shows `hasKey` / `validatedAt` / `updatedBy` / `updatedAt`; never
  the value.

### 2c. Geocoding-chain rule (data-derived, not a separate model)

```
chain = ApiCredential.findMany({
  where: { enabled: true, type: { systemKind: "geocoding" } },
  orderBy: { order: "asc" }
})
```

- Nulls-last on `order` — a row without an explicit `order` runs after every
  ordered row. This is asserted by a test in SLICE-5.
- No separate `GeocodingChain` model. The chain IS the enabled+ordered slice
  of `ApiCredential` filtered by `type.systemKind = "geocoding"`. This
  eliminates a whole class of "chain has an id but no credential" drift.

---

## 3. Resolver seam (SPEC — implemented in SLICE-2)

`ApiKeysService.resolve(adapter, scope, userId?)` is the ONE seam every
downstream consumer calls once this program lands. It replaces every direct
`PlatformConfig.<provider>KeyEncrypted` read and every
`IntegrationKeysService.resolveIntegrationKey(slug)` call.

### 3a. Signature and semantics

```
resolve(adapter: string, scope: "company" | "user", userId?: string): Promise<string | null>
```

- **Vault-first.** Look up an enabled `ApiCredential` where
  `adapter = coalesce(cred.adapter, cred.type.adapterHint)` AND `scope` matches
  AND (`scope="user"` ⇒ `userId` matches). If one exists AND decrypts, return
  the plaintext.
- **Legacy fallback (transition only).** If no vault row, fall through to
  the existing code path (`IntegrationKeysService.resolveIntegrationKey` for
  integrations; `PlatformConfig` / per-user key table for AI). Same env-var
  fallback still applies at the very bottom.
- **`null` is the "not configured" signal.** Callers must handle `null`
  gracefully — no throw. Matches today's behaviour in `GeocodingService`.
- **User rows never cross-read.** With `scope="user"`, `userId` is mandatory
  and must equal `req.user.sub`. Enforced in both the service (defence in
  depth) and the vault controller (primary check).

### 3b. Wiring in SLICE-2 (no behaviour change)

- `GeocodingService.autocomplete` calls `apiKeys.resolve("geoapify", "company")`
  instead of `integrationKeys.resolveIntegrationKey("geoapify")`. Since no
  vault rows exist yet (backfill is SLICE-3), the legacy path fires — same
  result, same key, same latency.
- `PlatformConfigService` provider-key reads and `AiSettingsService` per-user
  reads route through `apiKeys.resolve(<provider>, "company" | "user", userId?)`.
- Fuel-cost pathway: same treatment.
- **No route/UI/permission changes in SLICE-2.** This is a pure indirection
  slice. That is what makes it CI-green with no fixture updates.

### 3c. Compat contract (why SLICE-2 ships alone)

Because legacy paths still fire until SLICE-3 backfills, the switchover from
"legacy is primary" → "vault is primary" is a **one-line code change** in
`resolve` (swap the try/fallback order) that ships with SLICE-3. Anything
that goes wrong in SLICE-3 rolls back by reverting that single line — the
vault rows can stay in the DB harmlessly.

---

## 4. Migration & runtime strategy (slice-by-slice)

### 4a. SLICE-1 — models + additive migration + map regen + sot/04 companion

- `schema.prisma` gains `ApiKeyType` + `ApiCredential` exactly as §2.
- Prisma migration is **additive-only** (two new tables, two indexes, one FK
  cascade, one FK restrict). No touching of `PlatformConfig`,
  `IntegrationCredential`, or any per-user key table.
- Regenerate + commit `docs/data-model/metadata-catalog.json` (mandatory —
  Smart Wizard reads it). The other three data-model outputs stay gitignored
  per project convention (see MEMORY.md).
- Ships with a companion `docs(sot): reconcile data-model for ApiCredential
  vault` PR under `/sot/04-data-model.md` (CP-24). The two PRs land in the
  same window so `/sot/` is never stale.

### 4b. SLICE-2 — resolve() seam with legacy fallback

- Introduce `ApiKeysService` + `resolve(adapter, scope, userId?)`.
- Reroute every existing consumer through it, but with the **legacy path
  still primary** (vault has no rows yet).
- No route surface changes. No permission changes. No UI. CI green with
  zero fixture updates by design.

### 4c. SLICE-3 — idempotent backfill + flip to vault-first + seed types

- Migration script — idempotent, safe to re-run:
  1. `upsert` seed types (`{ name, systemKind, adapterHint }`):
     - `"Anthropic (Claude)"` — `systemKind="ai"`, `adapterHint="anthropic"`
     - `"OpenAI"` — `systemKind="ai"`, `adapterHint="openai"`
     - `"Google Gemini"` — `systemKind="ai"`, `adapterHint="gemini"`
     - `"Groq"` — `systemKind="ai"`, `adapterHint="groq"`
     - `"Geoapify"` — `systemKind="geocoding"`, `adapterHint="geoapify"`
     - `"Google Maps"` — `systemKind="geocoding"`, `adapterHint="google"` *(pre-seeded, no key)*
     - `"Geocodify"` — `systemKind="geocoding"`, `adapterHint="geocodify"` *(pre-seeded, no key)*
     - `"MapTiler"` — `systemKind="geocoding"`, `adapterHint="maptiler"` *(pre-seeded, no key)*
     - `"Nominatim (OSM)"` — `systemKind="geocoding"`, `adapterHint="nominatim"` *(pre-seeded, no key)*
     - `"Fuel Prices QLD"` — `systemKind=null`, `adapterHint="fuelpricesqld"`
     - `"Custom REST"` — `systemKind=null`, `adapterHint="custom-rest"`
  2. For each populated `PlatformConfig.<provider>KeyEncrypted`, upsert an
     `ApiCredential` `{ scope="company", typeId=<matching AI type>,
     valueEncrypted=<copy>, validatedAt=<copy>, enabled=true, name="Company
     <provider> key" }` keyed on `(typeId, scope, name)` so a re-run is a
     no-op.
  3. For each populated per-user key row, upsert an `ApiCredential` with
     `scope="user", userId=<owner>`. Same keying rule.
  4. For each populated `IntegrationCredential` row, upsert an
     `ApiCredential` `{ scope="company", typeId=<matching type>,
     valueEncrypted=<copy>, name=<slug label> }`. `order=1` on geocoding
     rows so the seeded Geoapify becomes head-of-chain.
- **Flip.** One-line change in `ApiKeysService.resolve` — prefer vault, fall
  back to legacy. Rollback = revert that one line.
- Backfill logs `{typeId, scope, subjectId, action}` per row, never the blob
  or the plaintext (same rule as `KeyEncryptionService.tryDecrypt`). Emits a
  final summary `{copied, skipped, errors}` for the smoke run.

### 4d. SLICE-4 — unified Admin UI + retire old screens

- New page: `Admin → Settings → API Keys` (single Name / Type / Key table,
  filter by scope: Company | Personal; personal rows only visible to owner or
  super-user for auditing status-only). Row actions: enable/disable, reorder
  (drag or numeric `order`), edit name/type, delete, "Test now" (fires
  per-type validation — see §5). "Add key" opens Name + Type + Key entry.
  "Manage Types" opens a modal listing types with rename / describe / seed-
  bind-hints; delete blocked while credentials reference it (see §2b).
- Retires `Admin → AI Settings → Company keys` and `Admin → AI Settings →
  My keys` and `Admin → Settings → Integrations`. Route redirects for six
  months so bookmarks land on the new page.
- **`requires_merged`:** the pr-sec-ai-keys-single-path work + the approved
  AdminSettingsPage restructure (see §9 sequencing). Neither exists on
  main yet, so SLICE-4 does not arm until they land.

### 4e. SLICE-5 — GeocodingChainService (autocomplete)

- New `GeocodingChainService` reads the chain per §2c on every call
  (cheap query, indexed by `[typeId, enabled, order]`; also gated behind a
  small in-process 30s memoiser to prevent per-keystroke DB hits during
  autocomplete bursts, invalidated on any `ApiCredential` write via the
  service).
- Iterates the chain. For each row, resolves the key via
  `ApiKeysService.resolve(adapter, "company")`, calls the adapter's
  `autocomplete()` with the SAME 3 500 ms timeout used today. On success,
  returns the mapped `GeoapifySuggestion[]`. On timeout / network error /
  HTTP 4xx-5xx / empty results, moves to the next row.
- `GeocodingService.autocomplete` becomes a thin caller of the chain and
  keeps the same public `{ configured, results, reason }` shape so the
  browser is unchanged.
- **Compliance rule preserved.** `site-resolver.service.ts` still writes
  text-only fields (`formatted`, `addressLine1`, `suburb`, `state`,
  `postcode`). The chain response is normalised to the existing
  `GeoapifySuggestion` shape, so provider `lat` / `lon` / `place_id` never
  reach the DB writer.
- **`requires_merged`:** SLICE-3 (needs the vault populated).

### 4f. SLICE-6 — Additional adapters + forward/reverse geocode ops

- Adapters: `google`, `geocodify`, `maptiler`, `nominatim`. Each implements
  `autocomplete(text)`, `forward(text)`, `reverse(lat, lon)`. Chain iterates
  the same way for all three ops.
- **Cost tiering** (advisory metadata on the type, not enforced): tag each
  built-in type with a `cost: "free" | "paid-metered" | "paid-fixed"`. Admin
  UI shows a badge so the ordering is a deliberate financial choice
  (Nominatim free → Geoapify paid-metered → Google paid-metered, etc.).
  Enforcement stays a human decision.
- Nominatim requires a valid `User-Agent`; adapter hard-codes ours and
  respects the 1 rps rate limit at the adapter layer (retry-after honoured).
- **`requires_merged`:** SLICE-5.

### 4g. SLICE-7 — Custom REST adapter (SSRF-hardened)

- Adapter `custom-rest` reads `config.baseUrl`, `config.autocompletePath`,
  `config.forwardPath`, `config.reversePath`, `config.headerName` (defaults
  to `Authorization`), `config.headerPrefix` (defaults to `Bearer `),
  `config.responseShape` (JSONPath-ish selector for `results[]` and per-row
  field mapping).
- **SSRF hardening — hard requirements, tests in SLICE-7:**
  - Scheme MUST be `https`. `http`, `file`, `data`, `gopher` etc.: rejected
    at save time AND at every request.
  - Resolve `baseUrl` host to IP at request time (not just save time —
    prevents DNS-rebind); reject if the IP is in a private / link-local /
    loopback / CGNAT / broadcast / reserved range (RFC1918, 127/8, 169.254/16,
    100.64/10, 224/4, 240/4, 0.0.0.0/8, IPv6 equivalents, IPv4-mapped-in-IPv6).
  - No redirect following by default; if enabled via `config.followRedirects`,
    re-run the IP allow-check on the redirect target.
  - Request timeout = same 3 500 ms as today.
- Save requires super-user AND `platform.admin` (defence in depth on top of
  the company-scope rule from §1d).
- **`requires_merged`:** SLICE-6.

---

## 5. Validation preservation

- **AI types (Anthropic / OpenAI / Gemini / Groq).** Preserve the current
  live-validate-on-save behaviour (`ai-settings.service.ts`) exactly — a
  cheap Anthropic `messages` probe / OpenAI `models` probe / etc., 5 s
  timeout, categorised error surfaced to the UI. Writes `validatedAt` on
  success.
- **Geocoding types.** Cheap ping on save: single autocomplete for `"Brisbane"`
  with `limit=1`. Success = HTTP 2xx with at least one result parsed.
  Writes `validatedAt`.
- **Fuel Prices QLD.** Cheap `/subscriber/currentDay` probe.
- **Custom REST.** SSRF check must pass; then a single autocomplete probe
  against the configured `autocompletePath` with `text="Brisbane"`. If the
  probe returns 2xx AND the caller can extract at least one row using the
  configured `responseShape`, mark validated. Otherwise return categorised
  error to the UI.
- **Passive / unclassified custom types.** Skip validation; UI badge shows
  "validation skipped — custom type" so the operator knows the row is
  untested.

Every validation path runs from the API tier (never the browser), uses the
same 5 s / 3 500 ms timeout budgets already in the codebase, and NEVER logs
the key value.

---

## 6. Compliance & security rules (invariants for every slice)

1. **Text-only address persistence.** `Site` never stores provider `lat`,
   `lon`, or `place_id`. `site-resolver.service.ts` is the single writer.
   Any new chain adapter maps into the existing `GeoapifySuggestion` shape
   and the resolver discards non-text fields at write time. Enforced by an
   assertion test in SLICE-5.
2. **No plaintext to the browser, ever.** Vault UI shows `hasKey`,
   `validatedAt`, `updatedBy`, `updatedAt`. Never the value. The vault
   controller has no `GET /:id/value` route — full stop.
3. **User rows are self-managed only.** `scope="user"` reads / writes take
   `userId = req.user.sub` from the JWT. A user cannot read, write, or list
   another user's rows. Super-users see per-user rows only as status
   (`hasKey`, `validatedAt`) for audit purposes; they cannot decrypt or
   overwrite a per-user row.
4. **Company rows require super-user + `platform.admin`.** Enforced on
   controller AND in `ApiKeysService.write` (defence in depth). This
   TIGHTENS integration keys, which are `platform.admin`-only today.
5. **Custom REST is SSRF-hardened.** See §4g. Not optional.
6. **Ciphertext format never changes.** SLICE-3 copies bytes; there is no
   re-encrypt step. Losing `BYOK_ENCRYPTION_KEY` still means every key in
   the DB is unreadable — same posture as today.
7. **Legacy fallback is one revert away.** Until SLICE-4 retires the old
   pages, the legacy `PlatformConfig` / `IntegrationCredential` rows keep
   working as fallback. Rollback strategy for the SLICE-3 flip = revert
   the one-line resolve() reorder.

---

## 7. Out of scope

- Azure App Service / Key Vault / Entra changes. Env-var fallback stays.
- Rotating any existing key value. Nobody's key is read, printed, or
  changed by this program. Operators re-enter keys through the new UI on
  their own schedule.
- Batch geocoding APIs, structured-address forward geocode, or reverse-
  polygon lookups.
- IP / rate-limit tracking per credential. (Adapters honour their own
  vendor limits — see Nominatim rate note in §4f.)
- Cost enforcement. Cost tags are advisory badges only.

---

## 8. Slice sequence (staged as separate prompts once this doc merges)

Each bullet is the one-line executable premise sketch for the follow-up
prompt. `requires_merged` chains are explicit so nothing arms out of order.

- **SLICE-1** — `models + additive migration + map regen + sot/04 companion`.
  Premise: `! grep -q "model ApiCredential" apps/api/prisma/schema.prisma`.
  Adds `ApiKeyType` + `ApiCredential`, regenerates `metadata-catalog.json`,
  and ships the sot/04 doc-reconcile PR in the same window.
  `gate_allow: schema` (single additive migration).
- **SLICE-2** — `ApiKeysService.resolve seam with legacy fallback`.
  Premise: `! grep -q "class ApiKeysService" apps/api/src/modules`. Adds the
  service, reroutes every consumer through it, keeps legacy primary.
  `requires_merged: SLICE-1`. `gate_allow: none`.
- **SLICE-3** — `idempotent backfill + flip to vault + seed types & adapters`.
  Premise: `test -f apps/api/prisma/migrations/*_backfill_api_credential_vault/migration.sql`
  is FALSE. Seeds the 11 built-in types (§4c), backfills all three stores,
  flips `resolve` to vault-first. `requires_merged: SLICE-2`.
  `gate_allow: schema` (backfill migration + seed).
- **SLICE-4** — `unified Admin UI + retire two old key screens`.
  Premise: `! test -f apps/web/src/pages/admin/settings/ApiKeyVaultPage.tsx`.
  New page, "Manage Types" modal, company vs personal scope, six-month
  redirects from the retired routes.
  `requires_merged: SLICE-3, pr-sec-ai-keys-single-path, AdminSettingsPage restructure`.
  `gate_allow: none` (UI-only).
- **SLICE-5** — `GeocodingChainService over geocoding-type rows, Geoapify as adapter`.
  Premise: `! grep -q "class GeocodingChainService" apps/api/src/modules/geocoding`.
  Chain reads §2c query, falls through on timeout/error/empty, calls
  Geoapify adapter. `autocomplete` public shape unchanged.
  `requires_merged: SLICE-3`. `gate_allow: none`.
- **SLICE-6** — `Google / Geocodify / MapTiler / Nominatim adapters + forward/reverse ops + cost tiering`.
  Premise: `! grep -q "class NominatimAdapter" apps/api/src/modules/geocoding`.
  Four adapters, `forward()` + `reverse()`, cost badge metadata on the seed
  types. `requires_merged: SLICE-5`. `gate_allow: none`.
- **SLICE-7** — `Custom REST adapter (SSRF-hardened)`.
  Premise: `! grep -q "class CustomRestAdapter" apps/api/src/modules/geocoding`.
  Ships with the DNS-rebind hardening tests and the private-range block
  list from §4g. `requires_merged: SLICE-6`. `gate_allow: none`.

---

## 9. Sequencing (external dependencies before ANY slice arms)

This program lands AFTER two other in-flight programs. SLICE-1 does NOT arm
until both have merged:

1. **`pr-sec-ai-keys-single-path`** — consolidates AI-key call paths into a
   single service. This program depends on the consolidated path so
   SLICE-2's resolver rerouting has one call site per provider to swap
   instead of many.
2. **AdminSettingsPage restructure** (permission-map SLICE 1 landed as
   `docs/plans/settings-restructure-permission-map.md`; the code
   restructure is not on main yet). SLICE-4's new "API Keys" page slots
   into the restructured Settings IA — it does not fight for the same
   slots with the retired pages.

Every schema slice (SLICE-1, SLICE-3) carries its own `sot/04-data-model.md`
doc-reconcile PR in the same window (per CP-24 — docs-only PRs never touch
`/sot/` in the same PR as code).

## 10. Recommended sot/ doc-reconcile

- `sot/04-data-model.md` — add `ApiCredential` + `ApiKeyType` entries; note
  the ciphertext-copy invariant and the geocoding-chain data derivation.
  Landed as a companion PR in the SLICE-1 window (per §4a).
- `sot/05-decisions-and-lessons.md` — record the tightening of integration
  key scope from `platform.admin` → super-user + `platform.admin`
  (Marco 2026-08-04) and the compliance rule "text-only address
  persistence, provider lat/lon/place_id discarded at write time".
- `sot/03-roadmap.md` — add the SLICE-1..7 chain with `requires_merged`
  edges and the two external prerequisites (§9).
