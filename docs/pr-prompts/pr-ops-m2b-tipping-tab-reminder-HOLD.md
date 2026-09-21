---
premise: '! grep -q "waste.price_review_due" apps/api/prisma/seed-reference.ts'
premise_means: The job page has no Tipping tab and nothing reminds anyone to re-check tip prices, so planned tipping cost is invisible on the job and facility prices go stale silently.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seed-reference.ts
  - apps/api/src/modules/map-locations/**
  - apps/web/src/pages/projects/ProjectDetailPage.tsx
  - apps/web/src/pages/projects/ProjectTippingTab.tsx
  - apps/web/src/pages/admin/MapLocationsTab.tsx
done_when: pnpm build && pnpm lint && grep -q "waste.price_review_due" apps/api/prisma/seed-reference.ts && grep -q "OPS_M2B_TIPPING_V1" apps/api/src/modules/map-locations/tip-recommendations.service.ts
size: 6
gate_allow: migrations
backfill: false
rollback_strategy: Additive only (three nullable columns, one FK, one index, one insert-if-absent trigger row); safe to leave if the run dies, fix forward - nothing existing is rewritten.
seed_only: false
escalates: true
module: map-locations
requires_on_main: apps/api/prisma/schema.prisma :: model TipRecommendationLog
design_ref: Claude Design/proposed/ops-m2b-tipping/m2b-tipping-mockup.html
---

# Ops-Map M-2b: Tipping tab on the job + half-yearly tip-price review reminder

**Rewritten 2026-09-21 against what is actually on main** (Marco: *"do as you suggested"*). The
earlier HOLD named a `waste-facilities` module and a `WasteFacility` model that were never built -
facilities shipped as `MapLocation` (kind `TIP`) in the `map-locations` module. Its "no migration"
line was also wrong: the reminder needs a date to count from, and nothing stores one today.

**The mock-up is the spec:** `Claude Design/proposed/ops-m2b-tipping/m2b-tipping-mockup.html`.
Match its labels, columns, tiles and dialog copy exactly.

## Grounded on origin/main a9751066 - re-verify before you edit

- `MapLocation` at `schema.prisma:7162` - `kind` (`TIP` | `POI`), `isActive`, **no price and no
  review field**. Prices stay in the rate tables; this PR adds none.
- `TipRecommendationLog` at `schema.prisma:7191` - snapshot of an accepted tip: facility,
  `loadTonnes`, `disposalFee`, `travelCost`, `totalCost`, `originType`, `projectId?`, `createdAt`.
  **No `tenderId` column.**
- `tip-recommendations.service.ts` - DTOs accept `tenderId` (required when `originType = "tender"`,
  :46, :57, :275) and use it to resolve the origin (:278), but `log.create` (~:318-330) writes
  `projectId` only - **a tender-stage tip is logged with no link to its tender.** Fix that here.
- Controller `tip-recommendations.controller.ts`: `@Controller("waste/recommendations")`, POST `/`
  (`estimates.view`), POST `accept` (`estimates.manage`).
- `map-locations.controller.ts:32` - `MAP_LOCATION_PERMISSION = "masterdata.manage"`.
- Admin screen: `apps/web/src/pages/admin/MapLocationsTab.tsx` (route
  `settings/administration/map-locations`).
- Job page: `apps/web/src/pages/projects/ProjectDetailPage.tsx`, tabs array
  `["overview","scope","schedule","diary","documents","team","activity"]` (~:247) + `TAB_LABEL`.
  `project.sourceTender` is available.
- Notification precedent: `compliance.service.ts` - `@Cron("0 21 * * *", { name:
  "compliance-expiry-alerts", timeZone: "UTC" })` (~:324), recipients resolved from the
  trigger's `recipientRoles` (~:701-731), delivered via `NotificationsService.create` (~:789).
- `NotificationTriggerConfig` (`schema.prisma` ~:4326) has `recipientRoles String[]`. Seed list
  `seedNotificationTriggerConfigs` in `seed-reference.ts` (entry shape at ~:389).

## What to build

### 1. One migration (`<UTC ts>_ops_m2b_tipping_review`)
- `map_locations`: add `prices_reviewed_at TIMESTAMP(3) NULL` and
  `prices_review_notified_at TIMESTAMP(3) NULL`.
- `tip_recommendation_logs`: add `tender_id TEXT NULL`, FK to `tenders(id)` `ON DELETE SET NULL`,
  index on `tender_id`.
- Insert the `waste.price_review_due` row into the notification trigger table **if absent**
  (`ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS`), `recipient_roles = ARRAY['Admin']`, enabled,
  delivery `both`. Never overwrite an existing row - an admin may have edited it.
- No backfill. Existing log rows keep `tender_id` null (it was never recorded). Say so in the PR.

### 2. API (`map-locations` module)
- `export const OPS_M2B_TIPPING_V1 = "ops-m2b";` in `tip-recommendations.service.ts`.
- `accept` stores `tenderId` when `originType = "tender"` (and keeps storing `projectId`).
- **`GET /waste/recommendations?projectId=<id>`**, guarded `projects.view`: returns the project's
  rows **plus** rows whose `tenderId` = the project's `sourceTender` id, newest first. Each row
  carries `source: "tender" | "job"`. Totals are summed **server-side in Decimal**: `loads`,
  `tonnes` (3 dp), `disposal`, `travel`, `total` (2 dp). The web never adds money.
- **`PATCH /map-locations/:id/prices-reviewed`**, guarded `MAP_LOCATION_PERMISSION`: `kind` must be
  `TIP` (else 400), sets `pricesReviewedAt = now()`, returns it with `nextReviewAt`.
- `nextReviewAt = pricesReviewedAt + 182 days`; `null` reviewed -> due now. Expose both on the
  map-locations list response for `TIP` rows.
- **Daily cron** in the module, `@Cron("0 21 * * *", { name: "waste-price-review", timeZone:
  "UTC" })`: collect every active `TIP` that is due **and not yet notified this cycle**
  (`pricesReviewNotifiedAt` is null or earlier than `pricesReviewedAt`). If none, do nothing. If
  any, send **one digest** per run listing them (mock-up section 3: "2 tips are due a price
  review", each with "overdue N days" or "never reviewed"), then stamp `pricesReviewNotifiedAt` on
  each listed tip - so each tip appears once per six-month cycle, never daily. Read the trigger
  row; if disabled or no recipients, do nothing. Deliver via `NotificationsService` exactly like
  compliance; email follows the trigger's `deliveryMethod`.

### 3. Seed
- `seed-reference.ts`: add `waste.price_review_due` to `seedNotificationTriggerConfigs` with
  label `Tip price review due`, `recipientRoles: ["Admin"]` (the migration row and the seed row must
  agree), idempotent like the rest.

### 4. Web (match the mock-up)
- **Job page -> new `Tipping` tab** (`ProjectTippingTab.tsx`, added to the tabs array and
  `TAB_LABEL`). Three tiles: **Planned loads**, **Planned tonnes**, **Planned tipping cost** (with
  disposal / travel split underneath). Table columns, as in the mock-up: Accepted, Facility, Waste
  type, Tonnes, Distance, Disposal fee, Travel, Total, Planned at (`Tender` / `Job` chip), By -
  plus a **Planned tipping cost** total row. Empty state, verbatim from the mock-up: "No tipping
  planned for this job yet. Use Tip Finder to pick a facility - accepted picks appear here." The
  word is **planned** - these are accepted recommendations, not invoices. Never label them spend
  or actual.
- **Admin -> Map locations**, `TIP` rows only: columns **Prices reviewed** and **Next review**,
  with the mock-up's chips - red "Overdue - N days", red "Never reviewed" (reviewed cell shows a
  dash), green "Due <date>" - and a **Mark prices reviewed** action opening the mock-up's confirm
  dialog, which names the tip, states the next reminder date and says no price is changed.

## Do NOT
- Do NOT store prices, change the finder, change costing, or recompute any logged figure.
- Do NOT backfill `tender_id` or touch existing log rows.
- Do NOT overwrite an existing trigger row. Do NOT touch Azure / Entra / SharePoint.

## Verify
- `pnpm build`, `pnpm lint`, api jest for `map-locations` pass. New tests: accept stores
  `tenderId`; list endpoint merges tender + job rows with Decimal totals; cron sends one digest
  listing only un-notified due tips (second run sends nothing; after mark-reviewed and 182 days
  the tip is listed again); PATCH on a
  `POI` returns 400.
- `prisma migrate dev` applies cleanly on the local Docker DB; the migration re-run inserts no
  second trigger row.

## PR body must carry (column 0, bare)
```
GATE-ALLOW: migrations
```

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- If `TipRecommendationLog` is not on `main`, STOP with `NO-OP: predecessor pr-ops-m2 not merged`.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge - open the PR and leave it for Marco.
