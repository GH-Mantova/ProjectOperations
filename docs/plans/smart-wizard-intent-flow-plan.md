# Smart Wizard — intent-first flow (module → intent → widget), SLICE-0 binding plan

**Status:** authored 2026-08-05 (Marco session). Every audit finding below was re-verified
against origin/main HEAD on 2026-08-05 before this plan was written.
**Owner:** Marco / ProjectOperations desktop-shell (`apps/web/src/dashboards`) + api
(`apps/api/src/modules/metadata`) + data-model (`scripts/data-model/`).
**Rule:** every code slice chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green. This plan is docs-only
(`scope: docs/plans/**`); the code slices are in §4.

Companion plans this one deliberately does not duplicate:
- `docs/plans/smart-wizard-catalog-deploy-plan.md` — resolver + bundle strategy for
  `/meta/catalog` (SLICE 1–3 shipped as PRs #896 / #904 / #910; see `sot/05` LL-58).
  The wizard's runtime read of `/meta/catalog` is a fixed contract from that plan.
- `docs/plans/settings-restructure-permission-map.md` — the permission code IA the
  module picker in SLICE 2 gates on.

---

## 1. Motivation — what is broken, on origin/main today

Opening Dashboard → **Smart Wizard** on origin/main HEAD 2026-08-05 opens a single
modal that:

1. **Speaks schema, not user.** `apps/web/src/dashboards/SmartWizardModal.tsx:166-189`
   renders `<select id="smart-wizard-model">` seeded from `visibleModels(catalog)` and
   labelled `{m.domain} › {m.label}` — a flat list of every Prisma model that has
   `wizardVisible: true` on the metadata catalog, sorted by
   `smartWizardCatalog.ts:224-233` first by `domain.localeCompare` then by `name`.
2. **Enumerates ~24 raw schema domains, not the 5 business modules.**
   `docs/data-model/metadata-catalog.json:4-28` currently lists 24 `domains`:
   `Assets, Authorization, Communications, Compliance, Contracts, Dashboards,
   Directory, Documents, Estimating, Estimating (Legacy), Forms, Integrations,
   Inventory, Jobs, Platform, Procurement, Projects, Safety, Scheduler, Sites,
   Tendering, Unclassified, Workers`. These are auto-derived schema clusters, not
   the 5 sidebar modules defined in `sot/01-charter-and-architecture.md`
   §9 (Estimating, Projects, Operations, HR, Safety & Compliance).
3. **Exposes ~240 Prisma models with no filter for user permission.**
   `SmartWizardModal.tsx:73-79` renders the wizard body once the catalog fetch
   resolves — there is no cross-check between the catalog's `wizardVisible` set
   and the user's permission grants. `visibleModels()`
   (`smartWizardCatalog.ts:224-233`) filters ONLY on `m.wizardVisible`; it never
   sees the caller's identity. A user without `assets.view`, `payroll.view`,
   `authorization.*`, etc. is still offered Assets, PayrollBatch, RolePermission
   in the dropdown. (Rendering the resulting widget would 403 at query time, but
   the picker itself is already an information leak — the user learns the model
   exists and is Wizard-visible.)
4. **After picking a model, the entire flow is a schema form.** Same file,
   lines 191-253: the only next choices are Measure field (roles `measure` /
   `measure-candidate` in the catalog), Group-by field (role `dimension`), chart
   type (`SMART_WIZARD_CHART_TYPES = ["kpi", "bar", "donut", "line"]` at
   `smartWizardCatalog.ts:235`). There is no template shortcut ("pipeline value
   by stage") and no natural-language on-ramp. Every widget is built from raw
   schema atoms, even when the user's intent is a well-known report.
5. **Template capability already exists elsewhere and is not reused.**
   `sot/01-charter-and-architecture.md:616-635` §12 already inventories per-module
   widget categories (Operations / Tendering / Jobs / Maintenance / Forms /
   Safety live PR #96 / Compliance live PR #96) with named widgets like
   `Tender pipeline value`, `Win rate YTD`, `Due this week`. These are the
   templates the wizard should be reaching for on module pick — they exist as
   pre-built widgets in `widgetRegistry.ts` (§12: "All widgets: register in
   widgetRegistry.ts") but are unreachable from the wizard's schema-first flow.

**Root cause (one sentence):** the Smart Wizard is a thin UI over the raw
metadata catalog's domain axis (~24 schema clusters × ~240 models), with no
business-module grouping, no permission filter, no report-template shortcut,
and no natural-language on-ramp — so users see schema, not intent.

**Why this is a plan, not a direct fix:** (a) the module → intent → widget flow
touches backend overlay generation, catalog shape, wizard UI, permission gates,
widget registry, and an AI provider seam — one PR would be un-reviewable and
would fail the per-PR scope; (b) the module→model map is a **curated overlay**
(the schema does not know "Estimating") that must survive the CI drift gate
(`build-relationship-map.mjs --check`) and the bundled-asset resolver (LL-58);
(c) the permission filter is a **binding** acceptance criterion — no slice may
ship an unfiltered picker, and that constraint has to be visible at plan level,
not tucked into a code diff; (d) the AI on-ramp routes through the existing
`AiProvidersService.resolveChosenProvider` BYOK seam (§5A) and inherits the
GLOBAL_RATE_FABRICATION_PROHIBITION guardrail — that is a plan-level design
constraint, not an implementation detail.

---

## 2. Design constraints (non-negotiable)

1. **Business-module axis is CURATED, not derived.** The schema has no
   "Estimating" concept — Tender, Job, Site, Contract each live in their own
   `domain`. The module→model map is authored as reviewed overlay entries in
   `docs/data-model/metadata-catalog.json`, generated + drift-checked by
   `scripts/data-model/build-relationship-map.mjs`, and served via
   `/meta/catalog` alongside the existing shape (LL-58). One source of truth
   the wizard renders. No parallel JSON, no client-side taxonomy.
2. **Permission-filtered from day one.** SLICE 2 (module picker) MUST filter
   the offered modules AND (later) models AND fields by the caller's grants,
   using the existing per-module permission codes from
   `apps/api/src/common/permissions/permission-registry.ts` (e.g.
   `tenders.view`, `assets.view`, `dashboards.view`, `forms.view`). A module
   card is shown iff the user holds **any** of the module's `view`-family
   permissions (the curated overlay names them). Every later slice — templates,
   build-your-own, AI — inherits the same filter and MUST NOT bypass it.
   **Rationale:** the current picker is a passive information leak — a user
   without `assets.view` learning that model `Asset` exists and is
   Wizard-visible. Ship no slice that regresses this.
3. **Runtime `/meta/catalog` contract preserved.** The wizard continues to fetch
   the catalog at open time (`SmartWizardModal.tsx:38-50`), staleTime 30s, no
   bundling on the web side. New overlay fields ride the existing endpoint;
   `parseCatalog()` (`smartWizardCatalog.ts:45-82`) gains permissive parsing
   for new fields, tolerating older API responses.
4. **Retire the flat dropdown at SLICE 2, not before.** SLICE 1 (backend
   overlay + generator) lands the module data on the catalog without touching
   the UI; SLICE 2 replaces the `— Select a model —` `<select>` with the module
   picker + permission filter. Slices 3–5 layer richer on-ramps behind the same
   picker; the schema-first path stays reachable ONLY under the "build your
   own" on-ramp (SLICE 4) — never as the default landing.
5. **AI slice is the last, most-isolatable slice.** SLICE 5 routes through
   `AiProvidersService.resolveChosenProvider` (BYOK company keys — see
   `ai-providers.service.ts:57,89,135`), respects
   GLOBAL_RATE_FABRICATION_PROHIBITION (never invents fields, dates, or
   $-values not present in the catalog / the returning query), and degrades
   gracefully to the guided path when no provider or key is configured
   (`assist.controller.ts:50` returns 503 in that case; the wizard must render
   the guided on-ramps unchanged, not error). AI produces a **prefilled build
   the user confirms**, never a widget that is added silently.
6. **No `/sot/` edits outside the reconcile slice.** SLICE 6 lands a
   sot-purity doc-reconcile PR through 05-sot-keeper updating
   `sot/01-charter-and-architecture.md` §12 to describe the intent-first flow +
   module axis. No mixed code+sot PRs (CP-24 sot-purity gate).
7. **No behaviour change to `/meta/catalog` resolver.** LL-58's resolver order
   (env → bundle → walker) and deploy-bundling contract (#896) are load-bearing
   and out of scope. This plan only adds fields to the JSON payload.
8. **No Azure / App Service / Entra / SharePoint change.** Hard stop.
9. **No raw-model dump behind a module card.** SLICE 3 shows templates first;
   SLICE 4's build-your-own path caps the picker to models the user's
   permissions reach AND that the curated overlay maps to this module.
10. **No cross-module widget-registry rename.** Existing widget entries in
    `widgetRegistry.ts` and the §12 categories (Operations / Tendering / Jobs /
    Maintenance / Forms / Safety / Compliance) are the template inventory
    SLICE 3 reuses. Adding a `module: "estimating" | "projects" | "operations"
    | "hr" | "safety-compliance"` axis to registry entries is additive; no
    existing category disappears.

---

## 3. Target UX

Progressive, three-step flow that replaces the current flat-dropdown modal.
All three steps live inside the existing `CenteredModal`
(`SmartWizardModal.tsx:54-79`) — no new route.

### Step 1 — Pick a module
- Renders **at most five module cards**, sourced from the curated overlay
  (§4 SLICE 1) — **filtered by the caller's `module.view` permission family**
  (§2 constraint 2). The five candidate modules are the `sot/01` §9 sidebar
  business modules:
  1. **Estimating** — Tenders, Contracts, Directory, Rates & Lists, Tender
     reports. Perm family (union): `tenders.view`, `tenderdocuments.view`,
     `finance.view`, `masterdata.view`, `dashboards.view` (curated in overlay).
  2. **Projects** — Jobs, Sites. Perm family: `jobs.view`, `sites.view`,
     `dashboards.view` (curated).
  3. **Operations** — Scheduler, Assets, Inventory, Maintenance, Procurement.
     Perm family: `assets.view`, `maintenance.view`, `inventory.view`,
     `scheduler.view`, `procurement.view`, `dashboards.view` (curated —
     exact codes reconciled against `permission-registry.ts` in SLICE 1).
  4. **HR** — Workers, Payroll Export, Timesheet Approval. Perm family:
     `resources.view`, `payroll.view`, `timesheets.view` (curated — exact
     codes reconciled against `permission-registry.ts` in SLICE 1).
  5. **Safety & Compliance** — Safety, Compliance, Forms, Documents. Perm
     family: `forms.view`, `documents.view`, `safety.view`, `compliance.view`
     (curated — exact codes reconciled against `permission-registry.ts` in
     SLICE 1).
- A module card is shown iff the user holds **at least one** permission from
  its family (`OR`, not `AND`). Zero-card state renders a copy-only "you don't
  have access to any wizard-enabled modules — ask an admin" panel, not the
  legacy dropdown.
- Card copy is human ("Estimating — tenders, contracts, win-rate"), not
  schema. No model counts on the card (leaks nothing).

### Step 2 — Pick an intent (one screen, three on-ramps)
After Step 1, the modal renders three parallel on-ramps side-by-side (or
stacked on narrow viewports). All three inherit the Step-1 module context
and the same permission filter.

- **(a) AI free-text ("describe what you want to see")** — a single-line
  input + submit that POSTs to a new `/meta/wizard/suggest?module=<slug>`
  endpoint (SLICE 5). Backend calls `AiProvidersService.resolveChosenProvider`
  and asks the provider, given the module's permission-filtered catalog slice,
  to return a `WizardChoice`-shaped JSON prefill. UI surfaces the parsed
  prefill in the "build-your-own" panel below with a "review and add"
  affordance; **never** an auto-add. If no provider is configured (503),
  the AI box shows a small "AI suggestions unavailable — try a template or
  build your own" hint and disables submit; the guided on-ramps stay live.
- **(b) Ready-made report templates** — a shortlist of ≤ ~8 pre-built widgets
  for the module, drawn from `widgetRegistry.ts` filtered by a new
  `module: "estimating" | "projects" | "operations" | "hr" |
  "safety-compliance"` field (SLICE 3). Renders as clickable rows with the
  widget's existing icon + label + one-line description. Clicking a template
  goes straight to Step 3 with the widget pre-configured. Examples for
  Estimating: `Tender pipeline value`, `Win rate YTD`, `Due this week`,
  `Follow-up queue` (all already listed in `sot/01` §12).
- **(c) Build your own** — the shape → subject → fields flow (SLICE 4).
  Shape = KPI / Trend (line) / Breakdown (bar or donut) / List (table).
  Subject = a model from the module's permission-filtered curated list.
  Fields = the existing measure/dimension pickers from
  `smartWizardCatalog.ts:210-222`, unchanged. This is where the current
  schema-first flow lives on — reachable, no longer the default.

### Step 3 — Configure + preview → Add
Existing chart-type / measure / grouping controls (`SmartWizardModal.tsx:191-252`)
handle final tuning; existing `buildWizardWidgetFilters()` +
`onAdd(entry)` emit the widget config; the canvas continues to handle
placement (contract from `WidgetGalleryModal` — see the JSDoc on `onAdd`
at `SmartWizardModal.tsx:20-25`). Zero change to the widget shape.

**Retire criterion for the flat dropdown:** SLICE 2 is complete when
`<select id="smart-wizard-model">` does not render on any first-open code
path. The `<select>` code may survive inside the "build your own" panel
in SLICE 4, restricted to the module's permission-filtered model list.

---

## 4. Slice list (ordered, independently shippable)

Each code slice ≤ ~10 files. Dependency edges expressed as `requires_merged`.
Docs-only sot-reconcile is separated at the end.

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/smart-wizard-intent-flow-plan.md`.
- **Gate/CI:** `pnpm build && pnpm lint`.
- **Requires:** nothing.
- **Notes:** binds every slice below. Safe to merge as pure prose.

### SLICE 1 — backend module layer + generator + catalog overlay `size:6`
- **Files:**
  - `docs/data-model/metadata-catalog.json` — add a top-level `modules: [{
    slug: "estimating" | "projects" | "operations" | "hr" |
    "safety-compliance", label: string, description: string,
    permissionAnyOf: string[], models: string[] }]` array. Author the five
    entries by hand from §3 above; set `reviewed: true` on each so the
    generator does not clobber the map. The existing per-model `domain` axis
    stays untouched (backward-compat: older UIs keep working).
  - `scripts/data-model/build-relationship-map.mjs` — emit the `modules`
    array on regen; on `--check` (drift gate), diff the shipped `modules` vs
    the reviewed overlay and fail red on any unreviewed drift (mirrors the
    existing per-model overlay diff behaviour). Reviewed entries survive
    regeneration verbatim.
  - `apps/api/src/modules/metadata/metadata.service.ts` — no code change to
    resolver order (LL-58 preserved); the JSON grows a `modules` key that
    the service passes through opaquely.
  - `apps/api/src/modules/metadata/metadata.controller.ts` — extend the
    Swagger response schema to describe the new `modules` field (docs-only
    change to the OpenAPI surface, no wire change).
  - `apps/api/test/modules/metadata/metadata.service.spec.ts` — extend the
    "production-shape" spec (LL-58, SLICE-2 of the catalog plan) with a case
    asserting `getCatalog().modules` is an array of five entries with the
    expected slugs. Failing red on `main` today (field does not exist) is
    the CI proof-point.
  - `apps/web/src/dashboards/smartWizardCatalog.ts` — extend `MetadataCatalog`
    with `modules?: CatalogModule[]` and add permissive `parseCatalog()`
    handling (missing field → empty array, so older API responses do not
    break the wizard). Add `CatalogModule` type; add
    `visibleModulesForUser(catalog, userPermCodes)` pure fn (unit-testable,
    no React).
- **Verify:**
  - `pnpm --filter @project-ops/api build`,
  - `pnpm lint`,
  - `pnpm --filter @project-ops/api test -- metadata.service.spec.ts` includes
    the new module-shape case (all-green after this slice, red on `main`).
  - `node scripts/data-model/build-relationship-map.mjs --check` passes; a
    deliberate edit to a reviewed module entry is caught by the drift gate
    (spot-checked locally, not gated in CI beyond the existing `--check`).
- **Non-goal:** no UI change in this slice. The Smart Wizard modal still
  renders the flat dropdown on `main` — this slice only lands data.
- **Requires:** SLICE 0.
- **CI-testable assertion (nailed):** the metadata.service.spec.ts case
  above. Fails red on `main` (no `modules` field), passes green after this
  slice.

### SLICE 2 — module-first picker WITH permission filtering `size:5`
- **Files:**
  - `apps/web/src/dashboards/SmartWizardModal.tsx` — replace the initial
    modal body (currently `SmartWizardBody` at lines 107-271) with a
    two-view state machine: `view: "module" | "intent"`. `"module"` renders
    the ≤5-card grid from `visibleModulesForUser(catalog, userPerms)`.
    `"intent"` is the schema-form path (existing controls), reachable ONLY
    via a "Build your own" affordance on the intent screen (added in SLICE 4;
    in SLICE 2 the "intent" view is a placeholder that renders the existing
    schema-form flow restricted to the module's `models` set from the
    overlay). Retire the un-filtered `visibleModels(catalog)` call at
    line 117 for the initial view.
  - `apps/web/src/dashboards/smartWizardCatalog.ts` — add
    `modelsForModule(catalog, moduleSlug, userPermCodes)` pure fn that
    intersects the overlay's `models: string[]` with the user's grants
    (per-model perm hint carried on the catalog model — most model perms are
    inferable from the model's `domain` today; the overlay may add an
    explicit `permissionAnyOf` per model in this slice if inference is
    ambiguous — decide at implementation time, not now).
  - `apps/web/src/auth/AuthContext.tsx` — expose the caller's flat set of
    permission codes to `SmartWizardModal` (already available on the session
    payload; this slice just surfaces a `permissions: Set<string>` on the
    hook return). No wire change.
  - `apps/web/src/dashboards/__tests__/SmartWizardModal.test.tsx` — new
    RTL spec (or extension). Cases:
    1. **Baseline:** user with all module perms sees 5 cards; no flat
       `<select id="smart-wizard-model">` in the initial view.
    2. **Filtered:** user with only `tenders.view` sees exactly the
       Estimating card; the "you don't have access" panel does NOT render.
    3. **Zero-access:** user with no wizard-family perms sees the
       zero-state panel; no cards, no dropdown, no crash.
    4. **Regression guard:** the string
       `data-testid="smart-wizard-model"` does not appear anywhere in the
       initial-view render tree (the flat dropdown is retired).
  - `apps/web/src/dashboards/__tests__/smartWizardCatalog.spec.ts` — unit
    coverage for `visibleModulesForUser` and `modelsForModule` (any-of
    membership, empty-set behaviour, unknown-slug behaviour).
- **Verify:**
  - `pnpm build && pnpm lint`,
  - `pnpm --filter @project-ops/web test -- SmartWizardModal` all-green,
  - Manual: log in as `admin@projectops.local` → open Dashboard → Smart Wizard
    → assert five cards; log in as a seeded low-perm role → assert the
    filtered set; log in as a role with none of the wizard families → assert
    the zero-state panel.
- **Non-goal:** no template shortlist, no AI box. Step 2 renders the
  schema-form path as the sole intent on-ramp in this slice (SLICE 3 adds
  templates; SLICE 4 formalises "build your own"; SLICE 5 adds AI).
- **Requires:** SLICE 1.
- **CI-testable assertion (nailed):** RTL case 4 above — the
  `smart-wizard-model` testid is absent from the initial view. Fails red
  today (the testid is present in `SmartWizardModal.tsx:181`), passes
  green after this slice. This is the "flat dropdown retired" proof.

### SLICE 3 — ready-made report templates per module `size:4`
- **Files:**
  - `apps/web/src/dashboards/widgetRegistry.ts` (or the equivalent — verify
    exact path at implementation; §12 says "All widgets: register in
    `widgetRegistry.ts`") — extend each entry with an optional
    `module?: "estimating" | "projects" | "operations" | "hr" |
    "safety-compliance"` field. Populate for every entry called out in
    `sot/01` §12 category lists (Tendering entries → `estimating`; Jobs +
    Maintenance → mixed operations/projects; Safety + Compliance →
    `safety-compliance`; etc.). Missing = not offered as a template.
  - `apps/web/src/dashboards/SmartWizardModal.tsx` — render the template
    shortlist on the "intent" view for the chosen module. Clicking a
    template calls `onAdd(entry)` with the pre-built widget's config
    (existing entry shape), skipping Step 3 tuning.
  - `apps/web/src/dashboards/__tests__/SmartWizardModal.test.tsx` — add a
    case: Estimating module → template list contains at least
    `Tender pipeline value`, `Win rate YTD`, `Due this week`; clicking one
    fires `onAdd` with the expected widget entry.
  - `apps/web/src/dashboards/__tests__/widgetRegistry.spec.ts` — unit
    assertion that every entry with a `module` field has one of the five
    known slugs (typo guard).
- **Verify:** `pnpm build && pnpm lint`; new specs green.
- **Non-goal:** no new widget content in this slice — templates are the
  widgets that already ship on `main`. Adding new widgets is a separate
  ticket.
- **Requires:** SLICE 2.
- **CI-testable assertion:** RTL case above — the Estimating intent view
  renders the three named template rows. Fails red today (no template
  shortlist path exists), passes green after this slice.

### SLICE 4 — build-your-own (shape → subject → fields) `size:4`
- **Files:**
  - `apps/web/src/dashboards/SmartWizardModal.tsx` — formalise the
    "Build your own" affordance on the intent view. Shape selector
    (KPI / Trend / Breakdown / List) drives the initial `chartType`.
    Subject selector = a `<select>` scoped to
    `modelsForModule(catalog, moduleSlug, userPerms)` (from SLICE 2),
    NOT the flat `visibleModels(catalog)`. Fields selector = existing
    `measureFieldsOf` / `dimensionFieldsOf` calls, unchanged.
  - `apps/web/src/dashboards/smartWizardCatalog.ts` — add a
    `shapeToDefaults(shape): Partial<WizardChoice>` helper mapping
    Shape → `{ chartType, ... }` defaults, so shape selection is a one-click
    win (KPI ⇒ `chartType: "kpi"`, count metric; Trend ⇒ `line`; Breakdown ⇒
    `bar` unless `donut` is more natural for ≤5 dimensions; List ⇒ table
    once the widget system supports it — otherwise fall back to `bar`).
  - `apps/web/src/dashboards/__tests__/SmartWizardModal.test.tsx` — case:
    picking "Breakdown" then a model with `dimension` fields prefills
    `chartType: "bar"` and enables the group-by select; the model dropdown
    for the Estimating module NEVER contains a Payroll or Asset model
    (permission-filter regression guard for the build-your-own path).
  - `apps/web/src/dashboards/__tests__/smartWizardCatalog.spec.ts` —
    `shapeToDefaults` coverage.
- **Verify:** `pnpm build && pnpm lint`; specs green.
- **Requires:** SLICE 3.
- **CI-testable assertion:** the permission-filter regression case above
  is the load-bearing one — it locks in constraint 2 (permission filtering
  survives every on-ramp).

### SLICE 5 — AI free-text on-ramp (BYOK, guarded) `size:6`
- **Files:**
  - `apps/api/src/modules/metadata/wizard-suggest.controller.ts` (new) —
    `POST /meta/wizard/suggest` accepting `{ module: string, prompt: string }`.
    Guarded by the same auth stack as `/meta/catalog`.
  - `apps/api/src/modules/metadata/wizard-suggest.service.ts` (new) —
    resolves the module's permission-filtered catalog slice for the caller,
    calls `AiProvidersService.resolveChosenProvider(userId, "tendering")` (or
    a new dedicated persona slug — decide at implementation time; safest is
    the existing tendering persona to reuse the BYOK path), sends a
    system-prompt-locked completion that MUST return a `WizardChoice`-shape
    JSON restricted to the slice's models and fields. Rejects any field name
    not in the slice (GLOBAL_RATE_FABRICATION_PROHIBITION guardrail —
    hard-fail rather than degrade). 503 with a clear body when no provider is
    configured (mirrors `assist.controller.ts:50`).
  - `apps/api/src/modules/metadata/__tests__/wizard-suggest.service.spec.ts`
    (new) — cases: (i) valid prompt + provider configured → returns the
    parsed `WizardChoice`; (ii) provider returns a field name outside the
    slice → the service throws (fabrication guard); (iii) no provider
    configured → 503 with the expected message; (iv) permission filter is
    honoured (the slice given to the model excludes models the caller can't
    see).
  - `apps/api/src/modules/metadata/metadata.module.ts` — wire the new
    controller + service; inject `AiProvidersService` from
    `apps/api/src/modules/ai-providers/ai-providers.module.ts`.
  - `apps/web/src/dashboards/SmartWizardModal.tsx` — render the AI text
    box in the intent view as on-ramp (a). Submitting POSTs to the new
    endpoint, parses the returned `WizardChoice`, and pre-fills the
    "build your own" panel with a "Review and add" affordance. On 503,
    the box disables submit and renders a one-line hint; the other on-ramps
    stay live.
  - `apps/web/src/dashboards/__tests__/SmartWizardModal.test.tsx` — cases:
    (v) mocked 200 response → the intent view shows the prefilled panel;
    (vi) mocked 503 response → the box disables submit + shows the hint,
    templates + build-your-own still render; (vii) auto-add regression
    guard: the AI response never triggers `onAdd` without a user click.
- **Verify:** `pnpm build && pnpm lint`; API + web spec suites green.
- **Non-goal:** no persistence of AI conversations, no tool-calling, no
  multi-turn. This is a one-shot NL → prefill helper.
- **Requires:** SLICE 4.
- **CI-testable assertion:** the fabrication-guard case (ii) — the service
  refuses any AI response containing a field name not in the caller's
  permission-filtered slice. Locks in constraint 5.
- **Rollback:** revert the two new files + the modal delta; the guided path
  from SLICES 2–4 continues to work with zero AI dependency. This slice is
  the riskiest (AI provider path, prompt-injection surface, permission
  bypass surface) and the most-isolatable — ships last for that reason.

### SLICE 6 — sot reconcile (docs-only, sot-purity PR) `size:1`
- **Files:** `sot/01-charter-and-architecture.md` §12 — update the
  "Dashboard creation flow" and "Widget categories" prose to describe the
  intent-first Smart Wizard: five business-module cards, three on-ramps
  (templates / build-your-own / AI), permission-filtered from day one. One
  paragraph, one link back to this plan. No changes to §9 (sidebar IA).
- **Landed by:** 05-sot-keeper via a doc-reconcile PR. Never mixed with
  code (CP-24 sot-purity gate blocks the mix).
- **Verify:** `pnpm build && pnpm lint`; sot-purity gate green.
- **Requires:** SLICES 2, 3, 4, 5.

---

## 5. Redirect / behaviour map

- Route: no change. The Smart Wizard remains the `+` action on Dashboard,
  same modal, same `onAdd(entry)` contract.
- Emitted widget shape: no change. `WidgetConfigEntry` is stable; SLICE 3
  emits pre-built widget entries verbatim; SLICES 4–5 emit the existing
  `CUSTOM_WIDGET_TYPE` shape from `smartWizardCatalog.ts:127-138`.
- Wire contract for `/meta/catalog`: additive only (`modules?` array
  appended; existing consumers unaffected).
- Wire contract for `/meta/wizard/suggest`: new endpoint, no consumer
  outside the wizard itself. If the endpoint is absent (SLICE 5 not yet
  deployed), the wizard renders SLICES 2–4 unchanged.

---

## 6. Risks

### 6.1 Curated module map drifts from the schema
`domains` grows as models are added; the curated `modules` list does not
auto-follow. Mitigation: `build-relationship-map.mjs --check` flags any
new model whose `domain` is not covered by any module's `models` list,
prompting the author to either add it to a module or mark it wizard-invisible.
This is the equivalent of the existing per-model `reviewed` gate.

### 6.2 Permission filter regression
Any slice that skips `visibleModulesForUser` / `modelsForModule` reintroduces
the pre-plan leak. Mitigation: SLICE 2 RTL case 4 (flat-dropdown testid
absent) and SLICE 4 permission-regression case are load-bearing guards; a
future refactor that reintroduces `visibleModels(catalog)` on the initial
view fails those tests. Do NOT weaken those cases.

### 6.3 AI slice fabrication surface
The AI on-ramp is the softest surface for GLOBAL_RATE_FABRICATION_PROHIBITION
violations — a hallucinated field name or a hallucinated $-value would
silently degrade user trust. Mitigation: SLICE 5 case (ii) hard-fails the
service on any field name outside the caller's slice; the wizard NEVER
auto-adds an AI-produced widget (case (vii)); AI produces only prefill, the
user confirms. If in doubt at review time, ship SLICE 5 disabled behind an
env flag rather than not at all.

### 6.4 AI provider not configured on prod
`assist.controller.ts:50` already 503s when no BYOK / company key exists.
SLICE 5's endpoint MUST return the same 503 shape; SLICES 2–4 MUST render
the intent view fully without an AI on-ramp response. Do NOT hard-couple
the intent view to the AI response.

### 6.5 CI cannot prove the App Service module list
The five-card render depends on both catalog fields (SLICE 1) and user
permissions (SLICE 2) being served correctly by the deployed API. CI unit
tests cover the units; the LL-58 runbook (`docs/runbooks/smart-wizard-
catalog-verify.md`) already defines the post-deploy manual check for the
wizard — extend it in SLICE 2 with a one-line "assert 5 module cards, not
a flat dropdown" step. No new deploy smoke required.

### 6.6 Template shortlist relies on `widgetRegistry.ts` shape
If `widgetRegistry.ts` is refactored (path move, entry shape change)
between SLICE 2 and SLICE 3, SLICE 3 rebases before merge. Mitigation: at
implementation time, verify the registry path with `Glob`
(`apps/web/src/dashboards/widgetRegistry*`) and pin the file in the slice
PR body.

### 6.7 Module → permission-family map is best-guess for HR / Operations
Exact permission code names for Operations (`scheduler.view`,
`procurement.view`?) and HR (`payroll.view`, `timesheets.view`?) need to
be reconciled against the registry at SLICE 1 implementation time —
`docs/plans/settings-restructure-permission-map.md` is the reference.
Mitigation: SLICE 1 lands the curated overlay with the ACTUAL codes; the
five families in §3 above are the design intent, not the final code list.
Any missing code is either (a) added as a new registry entry via the
settings-restructure plan, or (b) omitted from that module's family
(module card still shows if the user holds any of the remaining codes).

### 6.8 No slice requires an Azure/env change
Confirmed against constraint 8. If a future slice proposes one, that
slice fails the plan and MUST be re-planned as a separate `platform:`
ticket outside this document.

---

## 7. Out of scope

- Any change to the `/meta/catalog` resolver or the deploy bundling
  (`smart-wizard-catalog-deploy-plan.md` owns this; LL-58 codified).
- Any change to the widget canvas / placement flow — `onAdd(entry)`
  contract is fixed (`SmartWizardModal.tsx:20-25`).
- Any change to the generator's per-model auto-derivation
  (role / label / filterable / aggregations). SLICE 1 adds a `modules`
  overlay, not a per-model schema change.
- New widget content. Templates are the widgets already shipping on `main`.
- Multi-turn AI, tool-calling, or AI-driven auto-add. SLICE 5 is one-shot
  NL → prefill, human confirms.
- A "shared / team" dashboard system. §12 remains "each user owns their
  own set". This plan does not touch that invariant.
- `/sot/` edits outside SLICE 6 (05-sot-keeper doc-reconcile).
- Any Azure / App Service / Entra / SharePoint change. See constraint 8.

---

## 8. Verification of this document

- [x] `test -f docs/plans/smart-wizard-intent-flow-plan.md`
- [x] Root cause pinned to file:line on origin/main HEAD 2026-08-05
  (§1 items 1-5).
- [x] Every slice has an explicit `requires_merged` edge and a `size:`
  estimate ≤ ~10 files.
- [x] Target UX (§3) specifies module → intent → widget with the three
  on-ramps + permission filter from day one.
- [x] Curated module axis (§2 constraint 1) is generated + drift-checked by
  `build-relationship-map.mjs` and served via `/meta/catalog`; no parallel
  JSON.
- [x] Permission filter (§2 constraint 2) is a BINDING acceptance criterion
  from SLICE 2 and every subsequent slice inherits it.
- [x] AI slice (SLICE 5) routes through
  `AiProvidersService.resolveChosenProvider`, respects
  GLOBAL_RATE_FABRICATION_PROHIBITION, degrades gracefully on 503, never
  auto-adds.
- [x] sot reconcile (SLICE 6) is docs-only, landed by 05-sot-keeper, never
  mixed with code (CP-24).
- [x] No slice requires an Azure / App Service / Entra / SharePoint change.
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
