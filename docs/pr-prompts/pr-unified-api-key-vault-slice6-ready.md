---
premise: '! grep -rq "class NominatimAdapter" apps/api/src/modules/geocoding'
premise_means: The additional geocoding adapters (Google/Geocodify/MapTiler/Nominatim) and forward/reverse ops do not exist yet.
scope:
  - apps/api/src/modules/geocoding/**
done_when: pnpm build && grep -rq "class NominatimAdapter" apps/api/src/modules/geocoding
size: 9
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 901
---

# SLICE-6: Google / Geocodify / MapTiler / Nominatim adapters + forward/reverse geocode ops + cost tiering

## Premise
SLICE-5 landed the GeocodingChainService with autocomplete-only failover and a single Geoapify
adapter. This slice adds four more adapters (Google, Geocodify, MapTiler, Nominatim), extends every
adapter to also do forward and reverse geocode, and tags each built-in type with an advisory cost
tier. No schema, no migration, no UI, no new models.

## Binding spec — READ IT
`docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md` on main:
- §4f (this slice: four adapters, forward()/reverse(), cost tiering, Nominatim UA + 1 rps),
- §4e + §2c (the chain query + how GeocodingChainService iterates - reuse it, do NOT re-derive),
- §3a (ApiKeysService.resolve(adapter, "company")), §1b (the {configured,results,reason} shape),
- §6 (compliance: text-only persistence; provider lat/lon/place_id never reach the DB writer),
- §4c (the seed adapterHints: geoapify/google/geocodify/maptiler/nominatim already seeded, no key).
Implement to that spec.

## What to build (all under apps/api/src/modules/geocoding/)

### 1. Extend the GeocodingAdapter interface with forward + reverse
Add `forward(text, apiKey, config?): Promise<GeoapifySuggestion[]>` and
`reverse(lat, lon, apiKey, config?): Promise<GeoapifySuggestion[]>` to the GeocodingAdapter interface
introduced in SLICE-5. Implement both on the existing GeoapifyAdapter (Geoapify has a `/v1/geocode/search`
forward endpoint and a `/v1/geocode/reverse` reverse endpoint) using the SAME 3500ms timeout,
`filter=countrycode:au`, `format=json`, and the SAME RawGeoapifyResult -> GeoapifySuggestion mapping.

### 2. Four new adapters (adapters/{google,geocodify,maptiler,nominatim}.adapter.ts)
Each implements the full GeocodingAdapter interface (autocomplete + forward + reverse) and normalises
its provider response into the EXISTING GeoapifySuggestion shape (so the chain and the browser contract
are unchanged, and compliance §6 holds - only text fields survive normalisation):
- **GoogleAdapter** (adapterHint "google") - Google Geocoding / Places Autocomplete; key as `key` query
  param; AU region bias (`components=country:AU` / `region=au`); 3500ms timeout.
- **GeocodifyAdapter** (adapterHint "geocodify") - Geocodify autocomplete/geocode/reverse; `api_key`
  query param; 3500ms timeout.
- **MapTilerAdapter** (adapterHint "maptiler") - MapTiler geocoding; `key` query param; AU bias where
  supported; 3500ms timeout.
- **NominatimAdapter** (adapterHint "nominatim") - OSM Nominatim `/search` + `/reverse`. NO api key
  (public). MUST send a valid hard-coded `User-Agent` identifying this app (Nominatim rejects requests
  without one). MUST respect the 1 request/second usage policy AT THE ADAPTER LAYER (in-adapter rate
  gate) and honour `Retry-After` on 429. `countrycodes=au`, `format=json`, `addressdetails=1`, 3500ms.

Register all four via `GeocodingChainService.register(adapter)` (each adapter exposes a `key` matching
its adapterHint: "google"/"geocodify"/"maptiler"/"nominatim") so the chain can dispatch them. The chain
iteration logic from SLICE-5 is reused verbatim - it selects the registered adapter by the row's
`adapter` string (`adaptersByKey.get(row.adapter)`) and already skips a row whose adapter this build
doesn't ship. Do NOT change the chain's row-loading / ordering / skip semantics; only register the new
adapters and add the forward/reverse iteration (below).

### 3. Chain: forward + reverse ops
Extend GeocodingChainService with `forward(text)` and `reverse(lat, lon)` that iterate the SAME
enabled+ordered geocoding chain (§2c) with the SAME fall-through semantics as autocomplete (timeout /
network error / HTTP 4xx-5xx / ZERO results -> next row; exhausted -> graceful empty; nothing configured
-> the not-configured path). Do NOT wire these to any route/controller in this slice unless a caller
already exists on main - the ops are provided on the service for SLICE-4+ consumers. Autocomplete
behaviour is unchanged.

### 4. Cost tiering (advisory, code-level - NO schema change)
Tag each built-in adapter with an advisory `cost: "free" | "paid-metered" | "paid-fixed"` as a
code-level constant/property on the adapter (or a static adapterHint->cost map exposed by the module) -
NOT a DB column and NOT a schema change (gate_allow is none). Nominatim = "free"; Geoapify / Google /
Geocodify / MapTiler = "paid-metered". This metadata is consumed by the SLICE-4 Admin UI badge later;
here it is just declared and unit-asserted. Enforcement stays a human decision - never block a chain
row on cost.

### 5. Tests
Per-adapter: autocomplete/forward/reverse each map a representative provider payload into
GeoapifySuggestion (text fields only; assert lat/lon/place_id are NOT in the persisted shape path).
Nominatim: assert the User-Agent header is sent and the 1 rps gate serialises two rapid calls (and
Retry-After is honoured on 429). Chain: forward + reverse fall-through table tests (timeout / 5xx / 401
/ empty -> next row; exhausted -> graceful empty), mirroring the SLICE-5 autocomplete tests. Cost map:
assert each built-in adapterHint has a cost tier.

## Do NOT
- Do NOT change schema.prisma, add models, or write a migration (gate_allow: none - the vault models and
  seed types already exist on main).
- Do NOT add the Custom REST adapter or any SSRF logic (that is SLICE-7).
- Do NOT change site-resolver.service.ts, any route/controller surface, permission guard, or UI.
- Do NOT change the autocomplete public {configured,results,reason} contract - existing web specs must
  stay green with no fixture edits. A Geoapify-only setup must still behave exactly as today.
- Do NOT edit /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Never exit silently - if NominatimAdapter already exists on main, say `NO-OP`.
- Never ask a question or "stand by". Read the CI job log before diagnosing a failure.
- pnpm build must pass. Reuse the SLICE-5 chain + adapter interface; do not re-derive the chain query.
  Add the fall-through + per-adapter mapping + Nominatim-rate + cost-map tests.
