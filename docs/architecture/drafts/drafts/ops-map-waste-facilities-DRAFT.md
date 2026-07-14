# Ops Map & Waste Tip Finder — Design (DRAFT)

> **Status:** Design / analysis only. This document changes no schema, service,
> migration, or route. It is the proposed plan of record for the new
> "Ops Map & Waste Tip Finder" feature.
>
> **Decision date (locked items):** 2026-07-03 (Marco). **Scope owner:** WHS &
> Commercial Compliance.
>
> **UX contract:** the approved interactive mockup
> `docs/design/mockups/site-map-tipfinder-mockup.html`. This document does not
> re-design the UX — it explains how the platform delivers it.
>
> **Verified against:** this checkout of `apps/api/prisma/schema.prisma`
> (3916 lines), the modules under `apps/api/src/modules/`, `apps/web/src/App.tsx`,
> `docs/architecture/module-ownership-ia-map.md` (decisions locked 2026-07-03),
> and `docs/architecture/job-project-consolidation.md` (B-P0a). Line numbers
> are from the current local tree and may drift by a few lines.

---

## 0. Locked decisions (Marco, 2026-07-03 — recorded, not reopened)

1. **Prices are maintained manually** by the system admin (Marco). The system
   raises a **half-yearly price-review reminder** through the existing
   notification-trigger machinery (section 2.6).
2. **Every accepted tip-finder recommendation is logged** — facility, waste
   type, load, estimated cost, and the job/site it came from. The log becomes
   tipping-spend-per-job cost tracking, surfaced on the job detail page and,
   later, a dashboard widget (section 2.3).
3. **Worker home addresses** become new fields on `WorkerProfile`, visible to
   **Admin & Planner roles only**, gated by the existing permissions machinery
   (section 2.4).
4. **Trip planning resolves the worker's actual location in priority order:**
   (a) today's `ScheduleAllocation` site, (b) home base, (c) — phase 4 only —
   live GPS from the worker's mobile browser/PWA (decision 10, section 0.2),
   **on-shift only, with a consent record**. GPS is flagged as a WHS/privacy
   design constraint for that phase (sections 2.5, 5, 6).

## 0.1 Locked decisions (Marco, 2026-07-09 — open questions closed)

5. **Travel rate seed value:** `$2.75/km` (round-trip, matches the mockup's
   worked example). **Schema note:** `OperationsSettings.travelRatePerKm`
   ships as one flat rate for v1/v2, but the field is understood as an
   interim value — **future work will move this to a per-vehicle-type rate**
   once the load selector is Asset-backed (see decision 8 below) and v3 fuel
   costing lands. Not re-modelled now; flagged so R-slice work later doesn't
   have to rediscover this intent.
6. **Subcontractor tipper drivers: no access in v1.** The tip finder stays
   internal-only; subbie drivers get the recommendation from their
   supervisor. No new portal/field-app permission work in scope. Revisit if
   a subcontractor-facing need materialises.
7. **Waste-type taxonomy: reuse existing rate data, do not invent a new
   list.** Waste types (concrete/rubble, green waste, mixed C&D, clean
   fill/soil, etc.) already exist as `wasteType` keys inside the **legacy**
   `EstimateWasteRate` table (`wasteType`+`facility`, unique constraint —
   schema.prisma:1559-1574) and are read via the canonical, non-legacy path,
   `RateResolverService`/the `RateTable`/`RateColumn`/`RateRow` projection
   (R0, PR #485; see section 2.7 below and `sot/01-charter-and-architecture.md`
   "Rates & Lists R0" entry). **`WasteFacilityPrice.wasteTypeCode` must reuse
   this same value space — call `resolveRate`/read the projected `RateTable`
   for the waste category, never hardcode a fresh enum and never read
   `EstimateWasteRate` directly from new code** (the legacy table is the
   resolver's internal fallback only, per the R0/R1/R2…Rn migration plan in
   `sot/06-active-specs.md`). This also means **no new `LookupValue`
   `WASTE_TYPE` category** — section 2.2 below is updated accordingly. Exact
   current waste-type values must be read from the live table at
   implementation time, not guessed or fabricated (GLOBAL_RATE_FABRICATION_PROHIBITION
   applies to anything rate-adjacent).
8. **Load-size selector: Asset-backed, not hardcoded presets.** The finder's
   load selector queries the existing **Asset register** (`Asset` +
   `AssetCategory`, schema.prisma:542-655), filtered to the truck/tipper
   category, instead of three hardcoded strings ("~2t ute/trailer" etc.).
   This pulls the "map to an actual asset" step (originally section 3's v3
   milestone) forward into v1/M-2 for the *selection* UI; the *fuel-based
   costing* itself still lands in v3 once `Asset.fuelConsumptionLPer100km`
   exists (section 3 unchanged there). **Schema gap found:** `Asset` has no
   capacity/tonnage field today (schema.prisma:626-655 — name, assetCode,
   category, resourceType, homeBase, notes only). M-2 needs one new nullable
   field, e.g. `Asset.nominalLoadTonnes Decimal(6,2)?`, populated for
   truck/tipper-category assets, so the finder has a tonnage to costed
   against. Section 2 and slice M-2 (section 5) updated accordingly.
9. **Half-yearly price-review reminder recipients:** the **Admin role**
   (not just Marco), so it survives Marco being on leave. `NotificationTriggerConfig`
   recipient-role assignment already supports this (section 2.8, schema.prisma:2860-2861).

## 0.2 Locked decisions (Marco, 2026-07-10)

10. **Phase 4 "mobile app" = responsive web / PWA, not a native app.**
    Explicitly ruled out: packaging and distributing through Apple's or
    Google/Samsung's app stores (developer account, review process, code
    signing, MDM/enterprise enrollment for worker-issued phones). The phase-4
    worker-facing surface — live vehicles layer, on-shift GPS, "Send
    directions to driver" — ships as a mobile-responsive page in the
    worker's own browser (optionally installable as a PWA via
    add-to-homescreen + a service worker for basic offline/tile caching),
    reusing the existing web session/auth rather than standing up separate
    mobile login. **What this rules out:** the native Google Maps/Apple Maps
    SDKs, app-store-restricted API keys, and native background-location
    entitlements. **What it does not change:** turn-by-turn navigation still
    hands off to the driver's own installed Google Maps/Waze app via a plain
    URL scheme (section on driver directions, unchanged) — that was never
    going to need a native shell either way. GPS consent/`WorkerLocationLog`
    plumbing (already built from GPS clock-on, decision context in 2.5) is
    reused as-is; only the delivery surface for viewing the map itself was
    the open question, and it's now closed.

11. **"Live vehicles" = the phone of whoever is using the tip finder, not
    vehicle telematics.** There is no GPS hardware fitted to the truck/tipper
    fleet, so vehicle-asset location tracking is off the table entirely —
    not deferred, not a later phase, just not a real data source. The layer
    is renamed in intent (not necessarily in mockup copy) to reflect what it
    actually is: the on-shift phone location of the **site supervisor
    currently on site** or the **driver currently in the vehicle**, i.e. the
    same person who is using the tip finder to make the call. This resolves
    the open question from the previous session about driver-vs-asset
    tracking: **it's neither a new `Asset`-linked location log nor a new
    concept** — it's the existing `WorkerLocationLog` + `locationConsent`
    plumbing (decision 10, section 2.5), rendered as a "vehicle" pin only
    because the person carrying the phone happens to be in/at a vehicle at
    that moment. No new schema, no telematics integration, no per-vehicle
    hardware procurement. The distinction that matters going forward is
    **whose phone**, not **which truck** — a driver swapping vehicles mid-day
    doesn't create or need a vehicle-tracking record, the location point is
    still just that worker's consented on-shift position.

12. **Map provider order SUPERSEDES the 2026-07-03 addendum: Geoapify
    (primary) → MapTiler (fallback) → Google Maps (final, manual-escalation
    tier).** Reason: hassle-free — Geoapify and MapTiler both offer
    no-credit-card, email-signup-only free tiers comfortably above this
    platform's actual usage (a few hundred map loads and well under 50
    geocodes a month, per the addendum's own estimate), whereas Google
    requires a billing account regardless of whether the free tier ever gets
    touched. **Capability split, because the three providers aren't at
    parity:**
    - **Tiles + geocoding:** Geoapify primary, MapTiler fallback. Both are
      mature, GA products with settled free tiers.
    - **Routing (v2 driving distance/duration):** Geoapify primary, **Google
      Maps as the fallback for routing specifically** — MapTiler's routing
      product is still in beta as of this decision and does not yet have a
      settled free tier, so it is *not* part of the routing fallback chain.
      If Geoapify routing is unavailable, the system falls back further to
      the v1 straight-line/haversine estimate (already the documented
      ground-floor fallback regardless of provider) rather than silently
      guessing.
    - **Google Maps is now the final, manual-escalation tier**, not the
      primary — provisioned only if Geoapify/MapTiler ever prove insufficient
      in practice. The full API-key/Azure setup walkthrough already drafted
      stays valid for whenever that tier is actually needed.
    - **v1 ships with automatic fallback deferred, not built.** Given the
      usage estimate above, hitting Geoapify's or MapTiler's free-tier
      ceiling is very unlikely soon. Rather than building full runtime
      quota-detection + automatic cascading now (real complexity: reliably
      distinguishing a quota-exceeded response from other error types per
      provider, caching that decision instead of re-probing every request,
      and — for tiles specifically — likely needing a server-side tile proxy
      to centrally control which provider's tiles the frontend requests,
      versus the currently-planned browser-direct-to-CDN approach), **v1
      ships with Geoapify only + a usage-alert** (server-side counter against
      the known free-tier ceiling, notifying Admin when usage approaches it —
      same `NotificationTriggerConfig` machinery as the price-review
      reminder, section 2.8). The automatic multi-provider cascade is an
      explicit, deferred **future enhancement**, built only if real usage
      ever approaches the point where it matters — not spec'd further here.
    - The provider-agnostic adapter interface (section 2.7) already
      anticipated a provider swap; this decision only changes *which*
      provider is default and confirms the adapter must support an ordered
      list, not just a single primary + single fallback.
    - **Navigation handoff is unaffected either way** — "Send directions to
      driver" always deep-links to the driver's own installed GPS app
      (ADDENDUM 2, unchanged), independent of which provider renders the
      in-app map, geocodes addresses, or computes routing.

13. **Map-vs-radar question (raised against the M-1 HOLD gate) resolved:
    layer both, don't pick one.** M-1's canvas stays the **literal, real
    map** (mockup v5, now on real Geoapify/MapTiler tiles with real geocoded
    coordinates — this is what actually fixes the original complaint, since a
    real tile provider can't get Brisbane's geography wrong the way the
    hand-illustrated SVG did). The cost-radar concept's actual value wasn't
    "replace the map" — it was the ranked-result treatment: distance rings
    and labeled spokes that make cost/distance comparison honest and legible
    at a glance. **M-2's finder panel overlays that radar-style treatment ON
    TOP of the real M-1 map**: distance rings centered on the selected
    origin, and spokes to each facility labeled with cost, drawn over real
    tiles at real coordinates — replacing the original mockup's plain
    dashed-route-line-to-the-best-pin styling. This keeps M-1 unchanged in
    scope (real map, no finder panel, per section 5) and gives M-2 a concrete
    visual upgrade over the original mockup's route-line treatment. A
    follow-up mockup pass (v7) combining the geography-corrected map style
    with the radar's ring/spoke treatment is worth doing before M-2 starts,
    but does not block M-1.

---

## 1. Overview + UX contract

### 1.1 What it is, in one sentence

One live map of everything Initial Services — job sites, the office, waste
facilities, and (privacy-gated) worker home bases — with a side panel that
answers the crew's daily question: *"where do I tip this load?"*, ranked by
**true cost** (tipping fee + travel there and back), not just distance.

### 1.2 The mockup is the contract

> **Note (2026-07-09):** the mockup went through three visual passes — v2 → v3
> (icons, spacing, cost-bar breakdown on result cards) → v4 (restyled to an
> actual **Google Maps look**: Google's basemap palette, a street grid instead
> of the abstract land illustration, classic teardrop pin markers, Google-style
> chrome — search bar, zoom stack, map/satellite toggle, blue directions line
> — matching the locked Google Maps Platform provider decision in the
> addendum below) → v5 (geography correction: suburb labels, job-site/facility
> pins, motorway/arterial roads, and suburb boundary lines were repositioned to
> match Brisbane's real relative geography — Sandgate ~16 km N, Rochedale
> ~19 km SE, Wacol ~14 km SW and Ipswich ~40 km SW on the same Ipswich Motorway
> corridor further out than Wacol, Beenleigh ~40 km S and Coomera ~54 km S
> further out than Beenleigh on the same Pacific Mwy corridor — after v4 had
> Ipswich mislabelled on the wrong side of the map and Coomera placed closer
> than Beenleigh). **The mockup's per-facility km/fee/travel figures remain
> illustrative placeholders**, not real routing distances — the real system's
> nearest/cheapest ranking will call the Google Maps Platform Distance
> Matrix/Directions API against each facility's actual coordinates (locked
> decision, section 3 costing model v2), so ranking accuracy comes from that
> API call, not from the mockup's geometry. **Functional contract unchanged**:
> same fields, same layers, same ranking/route behaviour described below —
> only the look changed, so the line numbers below may drift a few lines
> against the current file; the section names/order did not change.

The approved mockup (`docs/design/mockups/site-map-tipfinder-mockup.html`)
fixes the layout and behaviour:

- **Layers rail** (mockup L52-60): toggleable layers for Job sites, Office,
  Waste facilities, **Workers** (off by default, planner-gated), and
  **Live vehicles** (off, future). The legend note (L59) states both
  constraints in-product: *"Worker home locations are visible to Admin &
  Planners only"* and *"Live vehicles arrives with the mobile app (phase 4)"*.
- **Map canvas** (L62-80): pins for sites (brand teal), office (dark),
  facilities (accent orange); the recommended facility gets a highlight ring
  (`.pin.best`, L27) and a dashed route line with a distance/time badge
  (L69-71).
- **Tip finder panel** (L82-99): three inputs — waste type (L86-91: concrete/
  rubble, green waste, mixed C&D, clean fill/soil), "coming from" (L93: a job
  site or the office), and load size (L95: ~8 t tandem, ~14 t truck & dog,
  ~2 t ute/trailer). Results are ranked cards showing **the working**, e.g.
  *"Est. total: $887 — fee $760 + travel est. $127"* (L104), including the
  honest "closest, but dearest fee" case (L106) and the **"not accepted"**
  case for facilities that don't take that waste type (L111-112).
- **Accuracy roadmap shown to the user** (L97): *"today distance is estimated
  as the crow flies; phase 2 uses real driving routes; and once the Assets
  module holds each vehicle's fuel use, the travel figure becomes an actual
  dollar cost for the truck you picked."* This is the costing model of
  section 3, in the user's own words.
- **"Send directions to driver"** button (L98) is explicitly labelled
  *mobile app — future*: rendered disabled until phase 4.

Frontend conventions carry over unchanged: design tokens (the mockup already
uses `--brand-primary` etc., L7), 44px touch targets (L14, L35, L44 —
`min-height:44px` throughout), skeleton loaders and empty states per CLAUDE.md
frontend rules.

### 1.3 What exists today that this builds on (evidence)

- **Sites already have a page and a model, but no coordinates.** `Site`
  (schema.prisma:519-540) carries `addressLine1` / `suburb` / `state` /
  `postcode` (L524-527) and is surfaced at `/sites` + `/sites/:id`
  (apps/web/src/App.tsx:233-234). There is **no latitude/longitude anywhere on
  Site** — geocoding is net-new (section 2.7).
- **Projects (the delivery spine post-B-P0a) inline their own site address**:
  `siteAddressLine1..Postcode` (schema.prisma:1974-1978, on `Project`, L1961).
  The map's "job sites" layer therefore plots **active Projects' site
  addresses** plus the standalone `Site` register; both need the same
  geocode-on-save treatment.
- **Day-grain worker→project allocations exist**: `ScheduleAllocation`
  (schema.prisma:2151-2177) has `date @db.Date` (L2153) and
  `workerProfileId → WorkerProfile` (L2157-2158). "Where is this worker
  today?" is a single indexed query (`@@index([workerProfileId, date])`,
  L2174) — this is location-resolution priority (a).
- **GPS consent plumbing already exists** (built for GPS clock-on, PR #84):
  `WorkerProfile.locationConsent` / `locationConsentAt` /
  `locationConsentRevokedAt` (schema.prisma:2089-2091) and
  `WorkerLocationLog` with `latitude`/`longitude Decimal(9,6)`
  (schema.prisma:3545-3560). Phase 4 reuses this, it does not reinvent it.
- **WorkerProfile has NO home address today** (schema.prisma:2072-2107 —
  phone/email/emergency contact only). Home-base fields are net-new
  (section 2.4).
- **Assets have no fuel data**: `Asset` (schema.prisma:672-702) carries
  free-text `homeBase` / `currentLocation` strings (L680-681) and nothing
  about consumption. The v3 costing tie-in (section 3) requires a new field.

---

## 2. Data model

All additions are **additive** (new tables + nullable columns) — no existing
column changes, which keeps every slice reversible. Migrations follow Prisma
discipline: full `YYYYMMDDHHMMSS_` timestamps, committed with the schema change
(CLAUDE.md; docs/architecture/job-project-consolidation.md section 6 R3).

### 2.1 `WasteFacility` (new)

The register of tips/transfer stations. Owned and written by the new
`waste-facilities` module only (section 4).

| Field | Type | Notes |
|---|---|---|
| `id` | String cuid | |
| `name` | String | e.g. "Beenleigh Recycling" |
| `addressLine1`, `suburb`, `state`, `postcode` | String? | same shape as `Site` (schema.prisma:524-527) |
| `latitude`, `longitude` | Decimal(9,6)? | same precision as `WorkerLocationLog` (schema.prisma:3551-3552); populated by geocode-on-save (2.7) |
| `openHours` | String? | plain text v1 ("Mon–Sat 6:30–16:30"); the mockup only needs "open to 4:30pm" (L104) |
| `notes` | String? | |
| `isActive` | Boolean @default(true) | soft retirement — history in the log survives |
| `pricesReviewedAt` | DateTime? | stamped when Marco confirms a review; drives the half-yearly reminder (2.6) |
| `createdAt` / `updatedAt` | DateTime | standard |

### 2.2 `WasteFacilityPrice` (new, child)

One row per facility per accepted waste type. **A missing row means "not
accepted"** — which is exactly how the mockup renders Wacol for mixed C&D
(mockup L111). No `accepted: false` flag needed.

| Field | Type | Notes |
|---|---|---|
| `facilityId` | FK → WasteFacility, Cascade | |
| `wasteTypeCode` | String | **Resolved (decision 7):** reuses the existing waste-type value space already resolved via `RateResolverService`/the `RateTable` projection (R0, PR #485) — the same values sourced from `EstimateWasteRate.wasteType` (schema.prisma:1561) but read through the canonical resolver, never the legacy table directly. No new `LookupValue`/`WASTE_TYPE` category is created. |
| `pricePerTonne` | Decimal(10,2) | AUD; maintained manually (locked decision 1) |
| `unit` | String @default("t") | future-proofing for per-m³ facilities |
| `notes` | String? | e.g. "sorted loads only" (mockup L112) |
| unique | `(facilityId, wasteTypeCode)` | |

### 2.3 `TipRecommendationLog` (new, append-only)

Written when a user **accepts** a recommendation (taps the recommended card /
"use this facility"). Append-only, like `AuditLog`
(module-ownership-ia-map.md section 1, schema.prisma:209 row: "create-only,
never update/delete").

| Field | Type | Notes |
|---|---|---|
| `id` | String cuid | |
| `facilityId` | FK → WasteFacility, Restrict | facility can't be hard-deleted from under history (hence `isActive`) |
| `wasteTypeCode` | String | snapshot, not FK — survives taxonomy edits |
| `loadTonnes` | Decimal(8,2) | from the load selector |
| `projectId` | FK → Project, SetNull, nullable | the job/site it came from; null when "coming from: Office" |
| `originType` | enum SITE / OFFICE | |
| `distanceKm` | Decimal(7,1) | as computed at the time (v1 haversine, later route) |
| `tipFeeEst`, `travelCostEst`, `totalCostEst` | Decimal(10,2) | the working, snapshotted — prices change, history must not |
| `acceptedById` | FK → User, Restrict | same pattern as `ScheduleAllocation.createdById` (schema.prisma:2165-2166) |
| `createdAt` | DateTime | |
| indexes | `(projectId, createdAt)`, `(facilityId)` | tipping-spend-per-job query is the primary read |

**Where it surfaces:**

1. **Job detail tab** — "Tipping" tab on the project/job detail page, following
   the exact precedent of the Contracts fold-in: contract data becomes a tab on
   job detail rather than a standalone page
   (module-ownership-ia-map.md section 4.2, decision Q1). Shows the log rows
   for that project plus a running total — tipping spend per job.
2. **Future dashboard widget** — "Tipping spend by job / by facility" joins the
   widget-candidates pipeline (docs/design/widget-candidates-catalogue.md); it
   reads this table and needs nothing else. Not in scope for the slices below.

### 2.4 `WorkerProfile` home-base additions (locked decision 3)

New nullable columns on `WorkerProfile` (schema.prisma:2072):
`homeAddressLine1`, `homeSuburb`, `homeState`, `homePostcode`,
`homeLatitude` / `homeLongitude Decimal(9,6)` (geocoded on save, 2.7).

**Visibility gate — Admin & Planner only.** The enforcement machinery exists
end-to-end today:

- Endpoints declare required permission codes via `@RequirePermissions(...)`
  (`apps/api/src/common/auth/permissions.decorator.ts:3-5`).
- `PermissionsGuard` rejects callers missing the code, with a super-user bypass
  (`apps/api/src/common/auth/permissions.guard.ts:15-44`).
- Codes live in the registry
  (`apps/api/src/common/permissions/permission-registry.ts:1-66`) and are
  assigned to roles through the roles/permissions modules.

**New permission code: `workers.location.view`** ("View worker home-base and
location data"), granted to the Admin and Planner roles at seed. The worker
API returns the home-base fields **only** when the caller holds the code
(field-level stripping in the service, not just endpoint gating — the same
worker record is legitimately readable by others for scheduling). The map's
Workers layer calls a dedicated endpoint gated by this code, so non-planners
never receive coordinates at all. Note the registry currently has **no
`workers.*` codes** (permission-registry.ts — verified by inspection), so this
is a clean addition, not a collision.

### 2.5 Trip-origin resolution (locked decision 4)

Resolution order, implemented as one service method in `waste-facilities`:

1. **Today's allocation** — `ScheduleAllocation` row for
   (`workerProfileId`, today) → that project's `siteAddress*` coordinates
   (schema.prisma:2151-2177; index at L2174 makes this cheap).
2. **Home base** — the new `homeLatitude`/`homeLongitude` (2.4), permission-gated.
3. **Live GPS (phase 4 only)** — latest on-shift `WorkerLocationLog` point
   (schema.prisma:3545-3560), **only if** `locationConsent` is true and not
   revoked (schema.prisma:2089-2091) **and** the worker is clocked on. On-shift
   only + consent record is a hard WHS/privacy design constraint carried into
   phase 4 acceptance criteria — not a nice-to-have.

### 2.6 Office location + rates: singleton settings row (not env)

Office location is business data Marco should be able to edit, not deploy-time
config. The platform already has the exact pattern: `EmailProviderConfig` is a
singleton row `id = "singleton"` (schema.prisma:2872-2883) managed by
`AdminSettingsService` (`apps/api/src/modules/admin-settings/admin-settings.service.ts:5,46-52`),
while true secrets stay in env (`packages/config/src/index.ts:1-9` shows the
env-side pattern; `.env.example` per CLAUDE.md).

**New `OperationsSettings` singleton row:** office address fields, office
`latitude`/`longitude` (geocoded on save), `travelRatePerKm Decimal(6,2)`
(the v1 flat rate, section 3), and later `fuelPricePerLitre` (v3). Edited on
the existing Admin Settings page (gated by `platform.admin`,
permission-registry.ts:5). Never hardcoded — CLAUDE.md API conventions
("Inject config — never hardcode values").

### 2.7 Geocoding + map tiles — external dependencies #2 and #3

The platform's **first** external data dependency is Open-Meteo, defined in the
weather-widget prompt with its rules: *thin API-side proxy, never call third
parties from the browser, cache server-side, graceful failure state, base URL
in config* (docs/pr-prompts/pr-widgets-batch3-weather-defaults-HOLD.md:8-14).
This feature adds #2 and #3 under the same discipline:

- **#2 — Nominatim (OSM) geocoding, at data-entry time only.** When an admin
  saves a facility, site, office, or worker home address, the API (not the
  browser) calls Nominatim once, stores lat/lng, done. **Never geocode
  per-request** — the tip finder reads stored coordinates only. Server-side
  proxy honours the Nominatim usage policy (identify with a proper User-Agent,
  ≤1 request/second — trivially satisfied at data-entry cadence), caches
  results, and on failure saves the record without coordinates plus a visible
  "needs geocoding" flag with a manual lat/lng override field (the rural-site
  mitigation, section 6 R4).
- **#3 — map tiles for the map itself.** **Superseded by decision 12
  (2026-07-10):** primary provider is **Geoapify**, fallback **MapTiler**,
  both no-credit-card free-tier signups, tile base URL/key in config behind
  the provider-agnostic adapter so the active provider is a config change,
  not a code change. Plain OSM raster tiles (no key, no billing at all)
  remain available as a documented zero-signup option if Marco ever wants to
  skip even the free-tier-account step. Whichever provider is active,
  required attribution renders in the map corner. Graceful state if tiles
  fail: pins over a plain background, finder still works (the ranking never
  depends on tiles).

Leaflet is one new frontend dependency in `@project-ops/web` (single
`pnpm add`, lockfile committed same commit — CLAUDE.md pnpm discipline).

### 2.8 Half-yearly price-review reminder (locked decision 1)

Uses the existing notification machinery end-to-end, nothing new invented:

- **Trigger catalogue:** `NotificationTriggerConfig` (schema.prisma:2853-2867)
  — per-trigger enable/disable, delivery method, recipient roles/users, all
  editable by admins via `AdminSettingsService.listTriggers/updateTrigger`
  (`admin-settings.service.ts:15-45`). New trigger **`waste.price_review_due`**
  seeded into the catalogue exactly like the nine existing triggers
  (`apps/api/prisma/seed-reference.ts:270-334`, idempotent upsert per seed
  rules).
- **Firing:** a daily `@Cron` pass in the `waste-facilities` module, precedent
  `@Cron("0 21 * * *", { name: "compliance-expiry-alerts" })`
  (`apps/api/src/modules/compliance/compliance.service.ts:261`) and
  `claim-cutoff-reminders` (`apps/api/src/modules/contracts/contracts.service.ts:572`).
  It flags any active facility whose `pricesReviewedAt` is older than ~182
  days (or null), with per-facility dedup so Marco is nagged once per cycle,
  not daily — the same dedup idea as compliance's `ComplianceAlert` tier
  records (compliance.service.ts:274-296 doc comment).
- **Delivery:** in-app `Notification` rows (schema.prisma:342-357) +
  optional email via `EmailService.sendNotificationEmail`, which already
  respects the trigger config's enabled/delivery/recipients settings
  (`apps/api/src/modules/email/email.service.ts:43-60`).
- **Recipients (decision 9):** the **Admin role**, not just Marco — set as
  the trigger's recipient role at seed so the reminder survives Marco being
  on leave.
- Confirming a review (one button on the facility register) stamps
  `pricesReviewedAt`, which resets the clock.

---

## 3. Costing model — the formula, in plain terms

The ranking is always: **estimated total = tip fee + travel cost**, for every
facility that accepts the selected waste type; facilities that don't accept it
are shown greyed as "not accepted" (mockup L111-112). Only the travel-cost
term gets smarter over time — the shape of the answer never changes, so the
UI and the log schema are stable across all three versions.

| Version | Travel cost = | What it needs | Honest label in UI |
|---|---|---|---|
| **v1 (ship first)** | *straight-line km × 2 (round trip) × flat rate per km* | stored lat/lng (2.7) + `travelRatePerKm` from OperationsSettings (2.6). Haversine is ~10 lines of arithmetic, no external calls at query time. | "travel est. (as the crow flies)" — the mockup already sets this expectation (L97) |
| **v2** | *actual driving km (and minutes) × 2 × flat rate* | an OSRM route lookup — public demo server or self-hosted; same server-side-proxy + cache pattern as Open-Meteo (external dependency #4 when it comes). Cache per (origin, facility) pair — site/facility pairs barely change. | "23 km · ~28 min" route badge becomes real (mockup L71) |
| **v3** | *driving km × 2 × (vehicle's litres-per-km × fuel price) + optional hourly driver cost* | a new `fuelConsumptionLPer100km` field on `Asset` (none exists today — schema.prisma:672-702) and `fuelPricePerLitre` in OperationsSettings; the load selector is **already** Asset-backed as of M-2 (decision 8) — v3 only adds the fuel-consumption field to the same Asset records, no selector rework needed | "actual dollar cost for the truck you picked" (mockup L97) |

Worked example from the mockup (L104): 8 t of concrete from Ipswich Stage 4 →
Beenleigh: fee $95/t × 8 t = $760; travel 23 km × 2 × rate ≈ $127; total $887.
Note the mockup's numbers imply a round-trip rate of roughly **$2.75/km** —
recorded as open question Q1, not a decision.

The `TipRecommendationLog` snapshots `distanceKm` + the three cost components
(2.3), so per-job spend reporting is version-proof: v1-era rows stay honest
v1 estimates.

---

## 4. Module placement + ownership

### 4.1 API: new `waste-facilities` module (single writer)

One new folder under `apps/api/src/modules/` (joining the 47 existing —
module-ownership-ia-map.md:18), following the single-writer doctrine that the
ownership map enforces everywhere (module-ownership-ia-map.md section 1):

- **Sole writer** of `WasteFacility`, `WasteFacilityPrice`,
  `TipRecommendationLog`, and the `OperationsSettings` singleton. No other
  module touches these tables — recorded here so the next ownership-map
  revision can add the rows as **OK** verdicts.
- Read endpoints: map layers (sites/office/facilities; workers layer gated per
  2.4), facility register CRUD, `POST /waste/recommendations` (compute
  ranking), `POST /waste/recommendations/accept` (write the log row).
- All endpoints carry Swagger decorators + class-validator DTOs, Prisma via
  the service layer only (CLAUDE.md API conventions).
- **New permission codes:** `waste.view` (see map + use finder — most staff),
  `waste.manage` (facility register + prices — admin), plus
  `workers.location.view` (2.4). Registered in
  `permission-registry.ts` alongside the existing 65 codes.

### 4.2 Web: a page in the Operations group

The map is a **page** (`/ops-map` route in `apps/web/src/App.tsx`), not a
widget. Per the locked IA (module-ownership-ia-map.md section 3.2 + decision 7
"**Sites: stays in Operations**", :457), it slots into the **Operations**
group, which sits at 6 items (:199-205) under the 7-item cap (:182-186) — the
map makes 7, exactly at the cap. Natural adjacency: directly beside **Sites →
/sites**. Adding the nav item touches `NAV_GROUPS`
(`apps/web/src/components/ShellLayout.tsx:152-262`) — the same lines slice
IA-1 reorders (module-ownership-ia-map.md section 6), so sequence the nav-item
commit after IA-1 lands, or rebase over it (it is a one-entry insert either
way).

Sites register stays where it is; the map **reads** Sites, it does not become
their home. If Operations later needs headroom, the map page can also host the
Sites list as a tab — noted as an option only, not proposed here.

### 4.3 Scheduler-proximity synergy — follow-on, NOT in scope

Once worker home bases have coordinates, "closest eligible worker to this
job" becomes computable by joining home-base distance with the scheduler's
fit-the-bill eligibility (eligibility is computed on read over
`ScheduleAllocation` — schema.prisma:2136-2144 design comment). That is a
scheduler feature, owned by the scheduler module, and it depends on the
Worker → WorkerProfile consolidation (**B-P0b**) that the ownership map defers
to (module-ownership-ia-map.md section 4 intro; job-project-consolidation.md
section 4). **Explicitly out of scope here; revisit after B-P0b.** This
feature's only contribution is the coordinates.

---

## 5. Phased slices

Small, individually shippable, reversible — same doctrine as B-P0a section 6.
Each slice is one PR, one branch (`feat/` prefix per CLAUDE.md), migrations
with full timestamps, PR body per CLAUDE.md.

| Slice | Scope | Rollback |
|---|---|---|
| **M-1 — map page + registers** | Leaflet + OSM tiles; layers: job sites (Project `siteAddress*` + Site register), office, waste facilities. New tables `WasteFacility`/`WasteFacilityPrice`, `OperationsSettings` singleton, facility register CRUD (`waste.manage`), Nominatim geocode-on-save + manual lat/lng override, nav item in Operations. Seed 3-5 real SEQ facilities with current gate prices (idempotent, stable IDs — CLAUDE.md seed rules). **Mockup-faithful minus the finder panel.** | Remove nav item + route; tables are additive and empty of dependents — drop migration reverses cleanly. |
| **M-2 — tip finder + logging** | Finder panel (waste type sourced via `resolveRate`/RateTable projection — decision 7; load selector sourced from `Asset`/`AssetCategory` truck-tipper records — decision 8, incl. new nullable `Asset.nominalLoadTonnes` field; coming-from), v1 haversine costing (section 3), ranked cards with the working shown, route line to the recommended pin, accept → `TipRecommendationLog`, "Tipping" tab on job detail, `waste.price_review_due` trigger + cron seeded to the Admin role (2.8, decision 9). | Feature-flag the panel off; log table additive; new Asset column nullable/droppable; trigger row disabled via the existing admin toggle (admin-settings.service.ts:21). |
| **M-3 — worker layer + privacy gate** | `WorkerProfile` home-base columns, `workers.location.view` permission + field-level stripping (2.4), geocode-on-save for homes, Workers layer (off by default, hidden entirely without the permission), legend note as in mockup L59. | Layer removal; columns nullable and droppable; permission code removable (guard just stops matching). |
| **M-4 — mobile/GPS + fuel accuracy (phase 4)** | Live-vehicles/workers layer from on-shift `WorkerLocationLog` points gated on `locationConsent` (2.5) — **WHS/privacy constraint: on-shift only, consent recorded, revocation honoured immediately**; v2 OSRM routing behind the proxy+cache pattern; v3 fuel costing (`Asset.fuelConsumptionLPer100km` + fuel price setting); enable "Send directions to driver". | Each sub-feature independently flag-gated; costing falls back v3→v2→v1 automatically when data is missing. |

**Sequencing around the in-flight dashboard widget batches.** The map is a
page, not a dashboard widget, so collision risk with the widget batches is
low: they touch the widget registry and dashboard seeds, M-1/M-2 touch new
routes and new tables. The one shared concern is the **external-API
server-side-proxy + caching pattern**: the batch-3 site-weather widget
(currently HOLD, gated on batch 2 merging —
docs/pr-prompts/pr-widgets-batch3-weather-defaults-HOLD.md:3-4) introduces it
for Open-Meteo (:8-14). **Whichever lands first establishes the shared proxy
module/pattern (config-driven base URL, server-side cache, graceful-failure
state) and the other reuses it** — if weather lands first, the Nominatim
client follows its structure; if M-1 lands first, the weather prompt should be
updated to point at M-1's proxy helper. Either way it is written once.

---

## 6. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | **Privacy — home addresses.** Home coordinates on a shared ops map is qualitatively new personal data. | Med | High | Locked gate: Admin & Planner only via `workers.location.view`, enforced server-side with field stripping (2.4) — not UI hiding. Layer off by default (mockup L57). Home-base fields excluded from any export/report surface by default. Access is auditable via the existing `AuditLog` (append-only SBD — module-ownership-ia-map.md section 1). |
| R2 | **Privacy/WHS — live GPS (phase 4).** Tracking workers is a consultation-grade WHS matter, not just a feature. | Med | High | Phase-4-only; on-shift only; consent recorded and revocable (`locationConsent*`, schema.prisma:2089-2091 — machinery already exists from GPS clock-on PR #84); points come from `WorkerLocationLog` which was designed for auditable sampling (schema.prisma:3540-3543 comment). Marco (WHS owner) signs off the consent wording before M-4 starts. |
| R3 | **Stale prices → wrong recommendations.** Manual prices (locked decision 1) will drift; gate fees change ~yearly. | High | Med | The half-yearly `waste.price_review_due` reminder (2.8); `pricesReviewedAt` shown on the register and a "prices last reviewed" line on the finder panel so field users can see staleness; log rows snapshot costs so history stays honest either way (2.3). |
| R4 | **Geocoding accuracy for rural sites.** Nominatim can miss or badly place rural/new-estate addresses common in civil works. | Med | Med | Geocode-on-save shows the resolved pin for a human to confirm; manual lat/lng override field (2.7); "needs geocoding" flag keeps un-geocoded records visible instead of silently missing from the map; the finder excludes origins without coordinates rather than guessing. |
| R5 | **External API availability** (Nominatim, OSM tiles, later OSRM). | Med | Low | Nothing user-facing calls a third party at request time: geocoding is data-entry-only with stored results; tiles fail to a plain background with the finder unaffected; OSRM (v2) falls back to v1 haversine. Same graceful-degradation bar the weather widget is held to (pr-widgets-batch3…:11). |
| R6 | **IA cap pressure.** The map takes Operations to exactly 7 items. | Low | Low | At-cap, not over; noted option to tab Sites under the map later (4.2). Coordinate the `NAV_GROUPS` edit with slice IA-1 (4.2). |
| R7 | **B-P0a drift.** The "job sites" layer reads Project `siteAddress*` and the tipping tab lives on the project/job detail page while B-P0a is mid-flight. | Low | Med | Both bind to `Project` — the **surviving** spine (job-project-consolidation.md section 1) — never to `Job`. `TipRecommendationLog.projectId` FKs Project, so B-P0a slices cannot orphan it. |

---

## 7. Open questions for Marco — ALL RESOLVED (2026-07-09)

*(The four locked decisions of section 0 are settled and not reopened.)*

1. ~~Per-km flat rate starting value (v1).~~ **RESOLVED — see decision 5:**
   `$2.75/km`, flagged as an interim value ahead of per-vehicle-type rates.
2. ~~Subcontractor tippers.~~ **RESOLVED — see decision 6:** no access in v1,
   internal-only.
3. ~~Waste-type taxonomy.~~ **RESOLVED — see decision 7:** reuse the existing
   rate data via `RateResolverService`, no new list invented.
4. ~~Load sizes.~~ **RESOLVED — see decision 8:** Asset-backed selector, not
   hardcoded presets; needs one new `Asset.nominalLoadTonnes` field.
5. ~~Half-yearly reminder recipients.~~ **RESOLVED — see decision 9:** Admin
   role.

**No open questions remain. M-1 is ready to be written up as a PR prompt.**

---

## ADDENDUM (2026-07-03, Marco): map provider decision — SUPERSEDED 2026-07-10

> **This addendum is superseded by locked decision 12 (section 0.2, 2026-07-10).**
> Kept below for history only — do not implement against this version.
> Google Maps Platform is no longer the primary provider because it requires
> a billing account even though usage sits inside the free tier; Geoapify
> (primary) and MapTiler (fallback) were chosen instead specifically because
> their free tiers require no credit card. Google is retained as a final,
> manual-escalation tier only, provisioned if Geoapify/MapTiler ever prove
> insufficient — the setup steps below remain accurate for *if/when* that
> tier is actually needed, they're just no longer the v1 starting point.

Marco will provision a **Google Maps Platform** key (billing account + budget alert; two
restricted keys: browser-referrer key for Maps JavaScript API, server-IP key for
Geocoding + Routes). Verified pricing 2026: per-SKU free tiers (10k map loads/mo, 10k
geocodes/mo, Routes own tier) — internal usage sits comfortably inside free.
Design consequence: sections 2-3 SWITCH to Google-first (Maps JS for tiles, Geocoding
API at data entry, Routes API for v2 drive-times WITH live traffic) but the server-side
proxy layer stays PROVIDER-AGNOSTIC (one adapter interface; Nominatim/OSM/OSRM remain the
documented fallback adapter, mirroring the SharePoint mock/live adapter pattern). New env
vars: GOOGLE_MAPS_BROWSER_KEY, GOOGLE_MAPS_SERVER_KEY (+ MAPS_PROVIDER=google|osm).
Slice M-1 must not start until the keys exist in the API environment.

## ADDENDUM 2 (2026-07-03, Marco): navigation handoff + cost ceiling

DECIDED: the system NEVER does turn-by-turn navigation. "Send directions" deep-links to
the driver's own app (Google Maps universal URL `https://www.google.com/maps/dir/?api=1&destination=lat,lng`,
Waze `https://waze.com/ul?ll=lat,lng&navigate=yes`) — zero API cost, works on any phone,
and is the mobile-app "Send to my GPS" button. The platform only calls Routes API for
ranking math (traffic-aware duration + distance -> travel cost + fuel estimate).
Estimated consumption at full internal usage: ~1-2k route elements + a few hundred map
loads + <50 geocodes per month = 10-30% of the per-SKU free tiers, $0, enforced by
console quota caps set just under each free allowance. Cache origin->facility results
(per day, since traffic varies) to cut further. Traffic-aware duration feeds the fuel
estimate; per-vehicle accuracy still lands in phase 4 via Assets fuel-consumption data.
