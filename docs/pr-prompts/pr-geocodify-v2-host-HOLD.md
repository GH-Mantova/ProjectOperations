---
premise: 'grep -q "app.geocodify.com/api" apps/api/src/modules/geocoding/adapters/geocodify.adapter.ts'
premise_means: >-
  The Geocodify adapter still calls https://app.geocodify.com/api/{autocomplete,geocode,reverse}.
  That host is dead - it answers 502 Bad Gateway or drops the connection for every request, key
  or no key - so a correctly entered Geocodify key in the API Keys vault fails Test and the
  geocoding chain skips the provider on every call. Geocodify's live API is
  https://api.geocodify.com/v2/{autocomplete,geocode,reverse} with the same api_key / q / lat /
  lng parameters (verified 2026-09-14: the v2 host answers 401 auth-failed for a dummy key; the
  old host answers 502).
scope:
  - apps/api/src/modules/geocoding/adapters/geocodify.adapter.ts
  - apps/api/src/modules/geocoding/__tests__/geocodify.adapter.spec.ts
done_when: >-
  pnpm --filter @project-ops/api lint && pnpm --filter @project-ops/api test -- geocodify
  geocoding-chain adapter-cost-tiers && ! grep -q "app.geocodify.com" apps/api/src/modules/geocoding/adapters/geocodify.adapter.ts
  && grep -q "api.geocodify.com/v2/autocomplete" apps/api/src/modules/geocoding/adapters/geocodify.adapter.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
module: geocoding
---

# Geocodify adapter - move to the live v2 host and read the meta block

Marco entered a valid Geocodify key in Settings > Administration > Integrations / API keys and
it cannot work: the adapter points at a host Geocodify no longer serves. This slice repoints it
and makes a quota-exhausted answer visible instead of silent.

## Grounded on origin/main - read before coding

- `apps/api/src/modules/geocoding/adapters/geocodify.adapter.ts` lines 18-20 define
  `AUTOCOMPLETE_URL`, `GEOCODE_URL`, `REVERSE_URL` on `https://app.geocodify.com/api/...`; the
  header comment (lines 10-14) repeats them.
- Lines 89 and 98 send `countrycodes=au`. Geocodify's API documentation
  (https://geocodify.com/api-documentation, https://geocodify.com/code-samples) lists only
  `api_key` + `q` for autocomplete/geocode and `api_key` + `lat` + `lng` for reverse. The
  parameter is Geoapify/Nominatim vocabulary that was copied across; Geocodify ignores it.
- `fetchFeatures` (lines 112-124) throws on non-2xx and reads `body.response.features`. Geocodify
  documents that a `200 OK` may be returned even when the usage limit is reached or a parameter
  is missing, with the detail in `meta` (`{ "meta": { "code": 401, "error_type": "auth failed",
  "error_detail": "..." }, "response": [] }`). Today that case returns `[]` and the chain reports
  "configured, zero results"; the vault Test button says nothing useful.
- The spec `__tests__/geocodify.adapter.spec.ts` asserts the old URLs and `countrycodes=au`
  (line 68-72).
- The chain (`geocoding-chain.service.ts`) already treats any thrown error as "skip this
  provider, try the next"; `ApiKeysService.testCredential` surfaces the thrown message as the
  Test-button reason. Nothing in either file changes.

## What to do

1. Point the three constants at `https://api.geocodify.com/v2/autocomplete`,
   `https://api.geocodify.com/v2/geocode`, `https://api.geocodify.com/v2/reverse`; update the
   header comment to match.
2. Remove the two `countrycodes` lines. (Australian bias for Geocodify, if ever wanted, is a
   separate decision - do not substitute another undocumented parameter.)
3. In `fetchFeatures`, after parsing the body: if `body.meta.code` is a number other than 200,
   `logger.warn` it and throw `new Error("geocodify_meta_<code>")` so the chain fails over and
   the Test button shows the real reason (`auth failed`, quota). A body with no `meta` keeps the
   current behaviour.
4. Update the spec: URLs, the `countrycodes` test becomes "does NOT send countrycodes", and add
   one case for a `200` body whose `meta.code` is `401` -> throws `geocodify_meta_401`. Keep the
   existing feature-mapping and timeout cases.

## Verify

- `pnpm --filter @project-ops/api test -- geocodify geocoding-chain adapter-cost-tiers` green.
- `pnpm --filter @project-ops/api lint`.
- `grep app.geocodify.com` finds nothing under `apps/api/src`.

## PR

Title: `fix(geocoding): Geocodify adapter on the live api.geocodify.com/v2 host, meta errors surfaced`.
Body: the premise above in one paragraph, the four changes, and the test list. Nothing in the
commit message may put fix/fixes/close/closes/resolve/resolves immediately before a `#NNNN`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- Two files. No new dependency, no env var, no schema change, no vault UI change.
- Do not touch the other adapters, the chain, or `api-keys.service.ts`.
- Never add or remove a label; never merge the PR.
