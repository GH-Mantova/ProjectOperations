---
premise: '! grep -rEq "FPDAPI|GetSitesPrices|fuelpricesqld" apps/api/src'
premise_means: There is no fuelpricesqld live price feed client yet.
scope:
  - apps/api/src/modules/estimates/**
  - apps/api/src/modules/admin-settings/**
  - packages/config/src/**
  - apps/web/src/pages/AdminSettingsPage.tsx
done_when: pnpm build && pnpm lint && grep -rEq "FPDAPI|GetSitesPrices|fuelpricesqld" apps/api/src
size: 7
gate_allow: env-vars
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-r3-t0-transport-capacity-fuel AND pr-integration-keys-settings MERGED, and Marco has entered the fuel token in the ERP Integrations settings -->
# HOLD — R3 T-2: fuelpricesqld.com.au live fuel-price feed

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**.
**ARM ONLY WHEN** (a) `pr-r3-t0-transport-capacity-fuel` has merged (it creates
`OperationsSettings.fuelPricePerLitre` + `fuelPriceSource`/`fuelPriceFetchedAt`) AND
(b) `pr-integration-keys-settings` has merged and Marco has entered the fuelpricesqld token in the
ERP **Integrations / API keys** settings (no Azure step needed; env fallback still works).

Context (Marco, 2026-07-15): the company's preferred fuel supplier is **Ampol** (contracted).
For estimating, use the **HIGHEST (max) Diesel price among Ampol sites** available at the time
the price is refreshed → written to `OperationsSettings.fuelPricePerLitre` so the waste
transport cost (T-1) uses it, with the manual value as fallback. The value is captured into the
tender's cost snapshot at rate-lock (T-1 already snapshots `fuelCost` per line), so "highest at
the moment rates are locked" is satisfied by locking the then-current value. API spec confirmed
from the v1.5 PDF.

## API contract (verified — do not re-derive)
- Host (config `FUELPRICE_QLD_BASE_URL`): `https://fppdirectapi-prod.fuelpricesqld.com.au`
- Auth header: `Authorization: FPDAPI SubscriberToken=<token>` — resolve the token via
  `resolveIntegrationKey('fuelpricesqld')` (DB-first, env `FUELPRICE_QLD_TOKEN` fallback), never
  `process.env` directly; `Content-Type: application/json`.
- Prices: `GET /Price/GetSitesPrices?countryId=21&geoRegionLevel=3&geoRegionId=1` (QLD).
  Response rows `{ SiteId, FuelId, CollectionMethod, TransactionDateUtc, Price }`. **Price is
  in tenths of a cent** → `$/L = Price / 1000`. **Skip `Price == 9999`** (unavailable).
- Fuel-type id via `GET /Subscriber/GetCountryFuelTypes?countryId=21` (resolve "Diesel" by
  name; cache daily). Regions via `GET /Subscriber/GetCountryGeographicRegions?countryId=21`.
- **Brand filter (Ampol):** `GET /Subscriber/GetCountryBrands?countryId=21` → resolve the
  Ampol `BrandId`. `GetSitesPrices` rows carry no brand, so resolve the Ampol **SiteIds** via
  `GET /Subscriber/GetFullSiteDetails?countryId=21&geoRegionLevel=3&geoRegionId=1` (each site's
  `B` = BrandId), cache daily, then keep only prices for those SiteIds. (Ampol may still appear
  under legacy "Caltex" branding — resolve by the brand NAME containing "Ampol"/"Caltex" and
  log which BrandIds matched.)
- **Rate limit: call GetSitesPrices at most once per minute.** Lookups once/day.
- Region/fuel/brand overridable via `FUELPRICE_QLD_REGION_LEVEL` (default 3),
  `FUELPRICE_QLD_REGION_ID` (default 1 = QLD), `FUELPRICE_QLD_FUEL` (default "Diesel"),
  `FUELPRICE_QLD_BRAND` (default "Ampol").

## What to build

Branch: `feat/r3-t2-fuel-price-feed`. Reviewer: `GH-Mantova`. No migration (columns exist from
T-0). Reads config via `packages/config` — bare `GATE-ALLOW: env-vars` at column 0 of the PR body.

1. A server-side fuel-price service (estimates module) with a **daily `@Cron`** (precedent:
   compliance-expiry-alerts) that: resolves the Diesel FuelId and the Ampol BrandId + Ampol
   SiteIds (all cached daily), calls GetSitesPrices for the configured region, filters to Diesel
   AND Ampol SiteIds, drops `9999`, takes the **MAXIMUM** (highest) remaining price, converts
   ÷1000 → $/L, and writes `OperationsSettings.fuelPricePerLitre` +
   `fuelPriceSource = "fuelpricesqld:Ampol-Diesel-max"` + `fuelPriceFetchedAt = now`.
   (Highest Ampol diesel is the estimating rule per Marco. If zero Ampol diesel prices are
   available, keep the previous stored value and log it — do not fall to $0.)
2. **Server-side only** — never call the feed from the browser. Base URL + token from config,
   never hardcoded. On any non-200 or network failure: log a structured warning and KEEP the
   last stored price (graceful fallback; never throw into a quote).
3. Admin Settings: show "fuel price: $X.XXX/L · source · fetched <time>" read-only next to the
   manual override field (from T-0), so staleness is visible.

## Do NOT

- Do NOT put the token in the repo or the browser. Read it via `resolveIntegrationKey` only. Do
  NOT touch Azure. Do NOT call more than once/minute.
- Do NOT change the T-1 cost formula; only supply the price it reads.
- Do NOT build the map/distance feature here (that is M-1/M-2).

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Already on `main` → `NO-OP: <reason>`. Never stand by for approval.
- If `OperationsSettings` (T-0) is not on `main`, STOP with `NO-OP: predecessor pr-r3-t0 not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
