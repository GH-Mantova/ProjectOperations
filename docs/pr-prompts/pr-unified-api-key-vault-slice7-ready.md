---
premise: '! grep -rq "class CustomRestAdapter" apps/api/src/modules/geocoding'
premise_means: The SSRF-hardened custom REST geocoding adapter does not exist yet.
scope:
  - apps/api/src/modules/geocoding/**
done_when: pnpm build && grep -rq "class CustomRestAdapter" apps/api/src/modules/geocoding
size: 9
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 909
---

# SLICE-7: Custom REST geocoding adapter (SSRF-hardened) — FINAL slice

## Premise
SLICE-5/6 landed the GeocodingChainService with Geoapify/Google/Geocodify/MapTiler/Nominatim adapters
(autocomplete + forward + reverse). This FINAL slice adds a single configurable `custom-rest` adapter so
an operator can point the chain at a bespoke geocoding endpoint via the vault's `ApiCredential.config`
JSON, WITHOUT a code change. It MUST be SSRF-hardened. No schema, no migration, no UI, no new models.

## Binding spec — READ IT
`docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md` on main:
- §4g (this slice: custom-rest config shape + the SSRF HARD REQUIREMENTS — implement ALL of them),
- §4e + §2c (the chain + how adapters are registered/iterated — reuse it, do NOT re-derive),
- §3a (ApiKeysService.resolve(adapter, "company")), §1b ({configured,results,reason} shape),
- §6 (compliance: text-only persistence; provider lat/lon/place_id never reach the DB writer).
Also mirror the SLICE-6 adapter style already on main (adapters/*.adapter.ts, GeocodingAdapter interface
with autocomplete/forward/reverse, ADAPTER_COST_TIERS map, registration via GeocodingChainService.register).
Implement to that spec.

## What to build (all under apps/api/src/modules/geocoding/)

### 1. CustomRestAdapter (adapters/custom-rest.adapter.ts)
Implements the full GeocodingAdapter interface (autocomplete + forward + reverse), key = "custom-rest",
matching the seeded `adapterHint="custom-rest"` type. Reads its endpoint + shape from the credential's
`config` JSON (passed through the chain to the adapter, same as other adapters receive `row.config`):
- `config.baseUrl` (required), `config.autocompletePath`, `config.forwardPath`, `config.reversePath`,
- `config.headerName` (default `"Authorization"`), `config.headerPrefix` (default `"Bearer "`) — the
  resolved API key is sent as `{headerName}: {headerPrefix}{key}`,
- `config.responseShape` — a JSONPath-ish selector describing where `results[]` is and how to map each
  row's fields into the EXISTING GeoapifySuggestion shape (TEXT fields only — formatted/addressLine1/
  suburb/state/postcode). Provider lat/lon/place_id are discarded at normalisation (compliance §6).
- Request timeout = 3500ms (same as every other adapter).

### 2. SSRF hardening — HARD REQUIREMENTS (tests are mandatory, §4g)
Put the guard in a small reusable helper (e.g. assertSafeUrl) called at BOTH save-time validation AND on
EVERY request:
- **Scheme allow-list:** MUST be `https`. Reject `http`, `file`, `data`, `gopher`, `ftp`, etc.
- **DNS-rebind defence:** resolve the `baseUrl` host to its IP(s) AT REQUEST TIME (not only at save time)
  and reject if ANY resolved IP is in a private / link-local / loopback / CGNAT / broadcast / reserved
  range: RFC1918 (10/8, 172.16/12, 192.168/16), 127.0.0.0/8, 169.254.0.0/16, 100.64.0.0/10, 224.0.0.0/4,
  240.0.0.0/4, 0.0.0.0/8, and the IPv6 equivalents (::1, fc00::/7, fe80::/10, ::/128) plus
  IPv4-mapped-in-IPv6 (::ffff:0:0/96 — unwrap and re-check the embedded v4).
- **Redirects:** do NOT follow redirects by default. Only if `config.followRedirects === true`, follow —
  and RE-RUN the full IP allow-check against the redirect target's host before issuing the next request.
- Reject at save-time (validation, §5) AND fail-closed at request-time; on rejection skip the row / return
  a categorised error, never leak internal network info.

### 3. Permission (defence in depth)
Saving/validating a custom-rest credential requires super-user AND `platform.admin` (on top of the
company-scope rule). Enforce wherever this adapter's save/validate path lives; if that path is a SLICE-4
concern not yet on main, at minimum assert the guard in the adapter/validation layer and document it — do
NOT add a new route/controller in this slice.

### 4. Wire into the chain
Register CustomRestAdapter via GeocodingChainService.register (key "custom-rest"); add its cost tier to
ADAPTER_COST_TIERS (custom-rest = "paid-metered" advisory). The chain iterates it identically to the
other adapters (autocomplete/forward/reverse, same fall-through). Do NOT change the chain's row-loading /
ordering / skip semantics.

### 5. Tests
- SSRF: assert http/file/data/gopher rejected; assert a host resolving to 127.0.0.1 / 10.x / 169.254.x /
  100.64.x / ::1 / fe80:: / ::ffff:127.0.0.1 is rejected AT REQUEST TIME (stub the resolver); assert a
  public IP passes; assert redirects are not followed by default and, when followRedirects=true, a
  redirect to a private IP is rejected.
- Mapping: a representative custom payload maps into GeoapifySuggestion (text-only; assert lat/lon/place_id
  are NOT present in the persisted shape path) for autocomplete/forward/reverse via `responseShape`.
- Chain: custom-rest participates in the fall-through table (timeout / 5xx / 401 / empty -> next row).
- Cost map: custom-rest has a tier.

## Do NOT
- Do NOT change schema.prisma, add models, or write a migration (gate_allow: none - vault models + seed
  types incl. the custom-rest type already exist on main).
- Do NOT change site-resolver.service.ts, any route/controller surface, permission guard, or UI.
- Do NOT change the autocomplete public {configured,results,reason} contract - existing web specs must
  stay green with no fixture edits.
- Do NOT weaken or skip any SSRF check "to make a test pass". Fail closed on anything ambiguous.
- Do NOT edit /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Never exit silently - if CustomRestAdapter already exists on main, say `NO-OP`.
- Never ask a question or "stand by". Read the CI job log before diagnosing a failure.
- pnpm build must pass. Reuse the SLICE-5/6 chain + adapter interface; do not re-derive the chain query.
  The SSRF + DNS-rebind + redirect + mapping + cost-tier tests are all mandatory.
