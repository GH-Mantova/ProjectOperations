---
premise: '! grep -rq "class GeocodingChainService" apps/api/src/modules/geocoding'
premise_means: The GeocodingChainService (provider-failover chain) does not exist yet.
scope:
  - apps/api/src/modules/geocoding/**
done_when: pnpm build && grep -rq "class GeocodingChainService" apps/api/src/modules/geocoding
size: 9
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 895
---

# SLICE-5: GeocodingChainService (autocomplete via the ordered provider-failover chain)

## Premise
The vault (SLICE-1..3) is live and resolve() is vault-first. Autocomplete still calls Geoapify
directly. This slice introduces the ordered provider-failover chain for AUTOCOMPLETE ONLY, with
Geoapify as the first adapter. Forward/reverse geocode and the other adapters (Google/Geocodify/
MapTiler/Nominatim) are SLICE-6. No schema, no UI, no new models.

## Binding spec — READ IT
`docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md` on main:
- §4e (GeocodingChainService behaviour), §2c (the chain query - enabled rows where
  type.systemKind="geocoding" ordered by `order` asc, NULLS LAST), §1b (current geocoding.service +
  the {configured,results,reason} shape to preserve), §3a (ApiKeysService.resolve), §6 (compliance:
  text-only persistence). Implement to that spec.

## What to build (all under apps/api/src/modules/geocoding/)

### 1. Geocoding adapter interface + GeoapifyAdapter
Define a GeocodingAdapter interface with `autocomplete(text: string, apiKey: string, config?): Promise<GeoapifySuggestion[]>`.
Extract the EXISTING Geoapify autocomplete logic out of geocoding.service.ts into a GeoapifyAdapter
that implements it - keep the 3500ms timeout, `filter=countrycode:au`, `format=json`, `limit=6`, and
the exact RawGeoapifyResult -> GeoapifySuggestion mapping (trimSuggestion) already in the file.

### 2. GeocodingChainService
- Loads the chain via Prisma: enabled ApiCredential where `type.systemKind="geocoding"`, ordered by
  `order` ASC with NULLS LAST (a row with null order runs after every ordered row - assert this in a test).
- 30s in-process memoiser of the chain list to avoid a DB hit per keystroke; INVALIDATE it on any
  ApiCredential write (expose an invalidate() the write path calls, or a short TTL + version bump).
- Iterate the chain. For each row: resolve the key via `ApiKeysService.resolve(adapter, "company")`
  where `adapter = coalesce(cred.adapter, cred.type.adapterHint)`; if no key, skip the row. Call the
  matching adapter's autocomplete() with the 3500ms timeout. On success WITH >=1 result, return the
  mapped GeoapifySuggestion[]. On timeout / network error / HTTP 4xx-5xx / ZERO results -> move to the
  next row. If the chain is exhausted -> return empty. If NO geocoding provider is configured at all ->
  the "not configured" path.

### 3. Route autocomplete through the chain (preserve the public shape)
GeocodingService.autocomplete becomes a thin caller of GeocodingChainService and MUST keep returning
the same `{ configured, results, reason }` shape (§1b) so the browser is unchanged: configured=false
+ reason when nothing is configured; configured=true + empty results + reason on all-exhausted/failed.
Wire GeocodingChainService + GeoapifyAdapter into the geocoding module graph.

### 4. Compliance preserved
site-resolver.service.ts is UNCHANGED. The chain normalises every adapter's output to the existing
GeoapifySuggestion shape; provider lat/lon/place_id are never persisted (§6). Only autocomplete is
wired here.

### 5. Tests
Fall-through table tests with stub adapters (timeout / 5xx / 401 / empty -> next row; all-exhausted ->
graceful empty); NULLS-LAST ordering; single-provider (Geoapify only) still works identically to today.

## Do NOT
- Do NOT add forward geocode, reverse geocode, or any adapter other than Geoapify (Google/Geocodify/
  MapTiler/Nominatim + forward/reverse are SLICE-6). Autocomplete + Geoapify adapter ONLY.
- Do NOT change schema.prisma, add models, or write a migration (the vault models already exist).
- Do NOT change site-resolver, any route/controller surface, permission guard, or UI.
- Do NOT edit /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.
- Keep the browser-facing {configured,results,reason} contract byte-identical - existing web specs
  must stay green with no fixture edits.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Never exit silently - if GeocodingChainService already exists on main, say `NO-OP`.
- Never ask a question or "stand by". Read the CI job log before diagnosing a failure.
- pnpm build must pass. Preserve the autocomplete public shape; a single Geoapify provider must behave
  exactly as today (chain of one). Add the fall-through tests.
