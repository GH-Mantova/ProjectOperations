# Rate hub (3 tabs) + SoR integration — plan

> **Scope**: extend the existing rates program with a three-tab **Rate Hub**
> (Internal / Subcontractors / Suppliers) and re-wire **Schedule of Rates** so
> every SoR line is a pull from that hub with markup + guarded push-back.
> **This plan REPLACES nothing** — the flexible `RateTable`, `resolveRate` seam,
> `/settings/reference-data` grid, subbie rate cards (RC-1/RC-2), and the SoR
> S1–S3/S5 models are all already on `main`; the slices EXTEND them.

Companion plans (do not fork — align):
`docs/plans/rates-migration-plan.md`, `docs/plans/subcontractor-rate-cards-slice-plan.md`,
`docs/plans/sor-program-plan.md`.

---

## Ground (cite before changing)

| Seam                                          | Location                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GlobalList` / `GlobalListItem`               | `apps/api/prisma/schema.prisma:3568`, `:3585` (managed lists — feed the new "subcontractor/supplier type")      |
| `SubcontractorSupplier`                       | `apps/api/prisma/schema.prisma:4278` (one vendor store; `entityType` + `categories` today)                      |
| `SubcontractorRate` (RC-1/RC-2, append-only)  | `apps/api/prisma/schema.prisma:4353` — the ONLY home for a vendor's priced schedule; never routed via resolver  |
| `RateTable` / `RateColumn` / `RateRow`        | `apps/api/prisma/schema.prisma:5421`, `:5444`, `:5464` — the flexible internal store                            |
| `TenderRateSet` (frozen snapshot precedent)   | `apps/api/prisma/schema.prisma:5486` — pattern to reuse for SoR freeze-in-time                                  |
| `SorPeriod` / `SorRate`                       | `apps/api/prisma/schema.prisma:6978`, `:6996` — SoR master (today: standalone values, no source-link, no markup)|
| `SorClientRateCard` / `SorClientRateEntry`    | `apps/api/prisma/schema.prisma:7042`, `:7059` — per-client rate card, S3 pattern                                |
| Rate resolver seam                            | `apps/api/src/modules/rates/rate-resolver.service.ts:54` (`resolveRate(slug, keys)`) — INTERNAL only            |
| Reference-data hub page (extend, do not fork) | `apps/web/src/pages/admin/RatesListsAdminPage.tsx:77` — top tabs today: `rates` \| `lists` (line 75)            |
| Super-user guard (reuse for hard delete)      | `apps/api/src/common/auth/super-user.guard.ts:4`                                                                |
| Archive-first pattern (reuse)                 | `apps/api/src/modules/tender-clients/tender-packages.service.ts:22`, `:186` (`isArchived` gate)                 |
| Existing API modules to extend                | `apps/api/src/modules/rates/**`, `apps/api/src/modules/subcontractor-rates/**`, `apps/api/src/modules/schedule-of-rates/**`, `apps/api/src/modules/global-lists/**` |

---

## Marco's locked decisions (2026-08-12) — bake in, do NOT re-litigate

1. **Rate hub = three tabs** on `/settings/reference-data`: **Internal rates**
   (existing `RateTable` grid — reuse), **Subcontractors**, **Suppliers**
   (both new tabs — read-through views over the ONE vendor store).
2. **Grouped by TYPE** (concrete cutters / trucks & waste / asbestos /
   hygienists …). Type is a **managed `GlobalList` item** — user add/edit/
   archive with NO migration per new type. Ship with only the single real
   group today (Cutrite → concrete cutters); do NOT pre-create the rest.
3. **`providesRates` capability, not a separate entity.** One vendor store
   (`SubcontractorSupplier`) + new boolean `providesRates`:
   - `providesRates = true` → shown on the **Subcontractors** tab; carries
     `SubcontractorRate` cards; eligible for SoR pull.
   - `providesRates = false` → shown on the **Suppliers** tab (service /
     product / hire / labour-hire) — no priced schedule.
   The flag can flip later on the same record with NO migration.
4. **One home per rate** (anti-drift): internal rates in `RateTable`; a
   vendor's rates stay on their `SubcontractorSupplier` card and appear in
   the hub tab as a **grouped, write-through view** — NEVER duplicated. A
   Schedule of Rates is a curated period-stamped **snapshot**, not a fourth
   copy.
5. **Delete safeguard** (reuse contracts/clients pattern): archive-first
   (soft, recoverable) → **hard delete BLOCKED while any live tender /
   variation / SoR references the rate** → super-user only → confirm +
   change-log.
6. **"Create Schedule of Rates"** action = build a period-stamped SoR by
   pulling chosen lines from all three tabs with **markup** (category
   default + per-line override). The SoR attaches to a client / job and
   **freezes at lock** (mirror `TenderRateSet` pattern).
7. **SoR line source** = enum on `SorRate`:
   - `INTERNAL` — resolved via `resolveRate` (internal rate table).
   - `SUBBIE` / `SUPPLIER` — explicit vendor pick from the card (opt-in;
     NOT a resolver default — subbie/supplier rates NEVER route through
     `resolveRate`).
   - `MANUAL` — typed; opt-in "promote to hub".
8. **Excel (.xlsm) import/export** lives on the HUB (`RateTable` /
   reference-data), with the locked validation gate (staged → validated →
   all-or-nothing commit; dry-run + impact preview). SoR + estimating both
   consume from the hub — import once.
9. **Guarded push/pull.** Pull (hub → SoR / tender / variation) is
   read+snapshot. **Push-back** (local edit → master) is permission-gated,
   change-logged, and shows an **impact preview of UNLOCKED tenders** that
   would move before confirm. Locked snapshots never move. Optional role
   split (who may push to master).

---

## Non-negotiable invariants (every slice re-tests)

- **Freeze-in-time** holds across tender rate set, SoR client card, and any
  new snapshot. Locking freezes; unlocking un-freezes; upstream edits never
  reach a locked snapshot. Precedent: `TenderRateSet` (schema:5486).
- **Subbie/supplier rates NEVER go through `resolveRate`.** Explicit
  opt-in only, from the vendor card. The resolver stays internal-only.
- **One canonical home per rate.** No duplicate copies for display — the
  hub tabs are *views*.
- **Migrations are additive.** New columns are nullable-with-default or
  bring `backfill: false`; column drops are a separate later slice.
- **Data-model map** regenerated + committed on every schema-touching
  slice (`node scripts/data-model/build-relationship-map.mjs`; CI drift
  check hard-fails otherwise — sank #593).

---

## Ordered slices

Each slice is ≤ 10 files, ships an armed `docs/pr-prompts/pr-ratehub-s<N>-*-ready.md`,
and chains to the next via `requires_file_on_main` (never guessed PR numbers).

### S1 — hub tabs + type grouping + `providesRates` capability
**Prompt:** `docs/pr-prompts/pr-ratehub-s1-hub-tabs-ready.md`
**Gate:** `migrations` (additive) · **backfill:** `false` · **escalates:** `false`

- Schema: add `SubcontractorSupplier.providesRates Boolean @default(false)`
  and `SubcontractorSupplier.typeId String?` (FK-by-value to a new managed
  `GlobalList` slug e.g. `subcontractor-supplier-type`). Additive; no data
  transform. Regen + commit data-model map.
- Seed / bootstrap: create the managed list `subcontractor-supplier-type`
  with the single real item today (`concrete-cutters` — Cutrite). Do NOT
  pre-create other groups.
- API: read endpoint `GET /rates-hub/vendors?providesRates=true|false`
  returning vendors grouped by `typeId`, each vendor's active
  `SubcontractorRate` lines nested (write-through — no copy). New service
  file at `apps/api/src/modules/rates/rate-hub-vendors.service.ts` (this
  is the file S2 chains on).
- Web: extend `RatesListsAdminPage.tsx` to add **Subcontractors** and
  **Suppliers** top tabs alongside `rates` / `lists`. Each new tab renders
  a grouped-by-type collapsible list; each row links out to the existing
  vendor card (RC-1/RC-2) — no in-line rate editing in this slice.
- Tests: unit spec for the grouped read (grouping, ordering, active-only
  rate filter, `providesRates` filter).

**Rollback:** additive; safe to leave on main. Re-run drops nothing.

---

### S2 — archive-first + in-use guard + super-user hard-delete + change-log
**Prompt:** `docs/pr-prompts/pr-ratehub-s2-delete-safeguard-ready.md`
**Gate:** `none` (behavioural + change-log table can piggyback on an
existing log — no new migration in this slice) · **escalates:** `false`

- API: new `RateArchiveService` (`apps/api/src/modules/rates/rate-archive.service.ts`
  — this is the file S3 chains on) with:
  - `archive(entity)` — soft (sets `isActive: false` or `isArchived: true`;
    recoverable).
  - `assertNotInUse(entity)` — blocks hard delete when referenced by a live
    tender, variation, `SorClientRateEntry`, or `TenderRateSet`.
  - `hardDelete(entity)` — guarded by the existing `SuperUserGuard`
    (`apps/api/src/common/auth/super-user.guard.ts:4`); writes a
    change-log entry.
- Applies to: `RateTable` row/table archive, `SubcontractorSupplier`
  archive, `SubcontractorRate` row archive, `GlobalListItem` type archive.
- Web: confirm dialogs (reuse `useConfirm`), disabled hard-delete button
  with "in-use by N tenders" hover reason, super-user-only visibility.

**Rollback:** N/A — behavioural.

---

### S3 — SoR line source + category-default markup + per-line override
**Prompt:** `docs/pr-prompts/pr-ratehub-s3-sor-source-markup-ready.md`
**Gate:** `migrations` (additive columns + a new enum) · **backfill:**
`false` (existing `SorRate` rows default to `sourceKind = MANUAL`) ·
**escalates:** `true` (touches pricing shape used by the SoR that lands on
client jobs; Marco must sign the merge).

- Schema (`apps/api/prisma/schema.prisma`):
  - New enum `SorRateSource { INTERNAL SUBBIE SUPPLIER MANUAL }`.
  - `SorRate.sourceKind SorRateSource @default(MANUAL)`.
  - `SorRate.sourceRef Json?` (INTERNAL: `{ tableSlug, keys }` for
    `resolveRate`; SUBBIE/SUPPLIER: `{ vendorId, subcontractorRateId }`).
  - `SorRate.markupPct Decimal? @db.Decimal(6, 3)` (per-line override).
  - `SorPeriod.categoryMarkup Json?` (category → default markup pct).
  - Types file `apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts`
    (this is the file S4 chains on).
- Regen + commit data-model map. Update the `schedule-of-rates` service
  specs (Prisma `create`/`update` payload changed — CP-ish spec drift, see
  PROMPT-SCHEMA rule).
- Constraint (service-level, not schema): if `sourceKind` is
  `SUBBIE`/`SUPPLIER`, do NOT read via `resolveRate`; explicit vendor
  lookup only. Unit test asserts.

**Rollback:** additive; if run dies mid-flight, safe to leave columns —
default is `MANUAL`, existing behaviour unchanged. Re-run drops nothing.
Forward-only.

---

### S4 — "Create Schedule of Rates" (hub → SoR builder)
**Prompt:** `docs/pr-prompts/pr-ratehub-s4-create-sor-ready.md`
**Gate:** `none` · **escalates:** `false`

- API: `SorHubBuilderService` (`apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts`
  — this is the file S5 chains on) with:
  - `buildFromHub({ periodLabel, categoryMarkup, lines: [{ source, ref, markupPctOverride? }] })`
    → creates a `SorPeriod` + `SorRate[]` snapshotting each chosen line
    (INTERNAL via `resolveRate`; SUBBIE/SUPPLIER via explicit vendor
    lookup; MANUAL typed). Applies category default markup with per-line
    override (S3 fields).
- Web: **Create Schedule of Rates** button on the hub; three-tab picker
  (Internal / Subcontractors / Suppliers) with markup input; preview →
  commit.

**Rollback:** N/A.

---

### S5 — hub .xlsm import / export
**Prompt:** `docs/pr-prompts/pr-ratehub-s5-xlsm-import-export-ready.md`
**Gate:** `none` (staged import writes to an in-memory buffer + `RateTable`
via existing repo — no schema change) · **escalates:** `false`

- API: `RateXlsmImportService` (`apps/api/src/modules/rates/rate-xlsm-import.service.ts`
  — this is the file S6 chains on) — the locked import gate: staged →
  validated → all-or-nothing commit; dry-run + impact preview; export
  round-trip.
- Web: import/export buttons on the Internal-rates tab; validation-error
  panel; dry-run preview.

**Rollback:** N/A.

---

### S6 — guarded push-back (SoR local edit → master)
**Prompt:** `docs/pr-prompts/pr-ratehub-s6-guarded-push-back-ready.md`
**Gate:** `none` · **escalates:** `true` (edits master rates used
everywhere; Marco holds the merge).

- API: `SorPushBackService` (`apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts`)
  — permission-gated (`rates.push`), change-logged (reuse the S2
  change-log), returns an **impact preview** listing UNLOCKED tenders that
  would move before the caller confirms. Locked snapshots frozen.
- Web: "Push to master" action on a SoR line (visible only to the
  permitted role); preview modal; confirm.

**Rollback:** N/A.

---

## Slice chain summary

| # | Prompt file                                        | Requires file on main                                                                   | Migration? | Escalates |
| - | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------- | --------- |
| 1 | `pr-ratehub-s1-hub-tabs-ready.md`                  | —                                                                                       | yes (add)  | no        |
| 2 | `pr-ratehub-s2-delete-safeguard-ready.md`          | `apps/api/src/modules/rates/rate-hub-vendors.service.ts`                                | no         | no        |
| 3 | `pr-ratehub-s3-sor-source-markup-ready.md`         | `apps/api/src/modules/rates/rate-archive.service.ts`                                    | yes (add)  | yes       |
| 4 | `pr-ratehub-s4-create-sor-ready.md`                | `apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts`                       | no         | no        |
| 5 | `pr-ratehub-s5-xlsm-import-export-ready.md`        | `apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts`                     | no         | no        |
| 6 | `pr-ratehub-s6-guarded-push-back-ready.md`         | `apps/api/src/modules/rates/rate-xlsm-import.service.ts`                                | no         | yes       |

---

## Out of scope (explicitly)

- Rebuilding `RateTable`, `RateColumn`, `RateRow`, `resolveRate`, or the
  reference-data grid — they exist; extend them.
- Duplicating a vendor's rates into the hub. The hub tab is a VIEW; edits
  flow through the vendor card.
- Routing subbie/supplier rates through `RateResolverService`. Explicit
  opt-in only (SoR `sourceKind = SUBBIE/SUPPLIER`).
- Editing `/sot/`. This is a plan under `docs/plans/**`.
- Any `requires_merged: <guessed number>`. Use `requires_file_on_main`.

---

## Verify

- `pnpm build && pnpm lint`
- `test -f docs/plans/rate-hub-sor-integration-plan.md`
- `ls docs/pr-prompts | grep -q "pr-ratehub-s1"`
- Each `docs/pr-prompts/pr-ratehub-s*-ready.md` passes
  `node scripts/pipeline/lint-prompt.mjs <file>` with exit 0.
