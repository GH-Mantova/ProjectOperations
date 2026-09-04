# Commercial — Tendering & Contracts

> ⚠️ **SNAPSHOT — describes the UI as at 2026-06-26.** Screens changed since then are not
> reflected here. Regeneration is tracked in `Claude Design/proposed/README.md`. Do not cite this
> document as the current design without checking it against the running app.

This module covers the deal-to-contract lifecycle: the tender pipeline/register, the
configurable tender dashboard, per-tender detail (scope, estimate, quote), the scoped
Master Data views for tender clients and contacts, estimating reports, the Tendering
label-rename settings surface, and the downstream contract/variation/progress-claim
ledger. All currency is AUD (`Intl.NumberFormat("en-AU", …)`), dates render via
`toLocaleDateString` (effectively dd/mm/yyyy in en-AU). Auth is via `useAuth().authFetch`;
permission gates are `tenders.manage`, `estimates.manage`, `estimates.admin`,
`tenderconversion.manage`, `finance.manage`, `finance.admin`.

---

## Pipeline / Register — `/tenders`

- **Component file:** `apps/web/src/pages/tendering/TenderingPage.tsx` (≈2,200 lines; many local sub-components). Status enum/labels/accents from `tendering/tenderStatusLabels.ts`.
- **Purpose:** Primary tendering workspace. A single page with two toggleable views — a drag-and-drop **Pipeline** kanban (default) and a filterable **Register** table.
- **Layout & key sections:**
  - Header (`tender-page__header`): label "Tendering" + page title "Pipeline"; right side has a view toggle (`tender-page__view-toggle` / `__view-btn` / `--active`) for Pipeline | Register, then a `+ New tender` primary button (opens a slide-over).
  - **Pipeline view** (`tender-kanban`): one `tender-column` per stage (Draft, In progress, Submitted, Awarded, Contract issued, Lost, Withdrawn). Each column header shows an accent bar, stage label, item count, and summed `$` total. Cards (`tender-card`) are `draggable`; dropping on a column PATCHes status (optimistic). Card shows number, title, client(s), value, "N days since activity", an estimator avatar, and (with `tenders.manage`) a kebab menu (Edit / Delete).
  - **Register view** (`tender-register`): a stats bar (`s7-card` with Total / Active pipeline / Win rate / Avg value), a two-row `FilterBar` (search, status select, estimator select, Hot/Warm/Cold probability toggles, "More filters" → client, min/max $, due-from/to, DEM/CIV/ASB/Other discipline toggles, preset dropdown, "Save filter"), an active-filter pill row with "Clear all", a "⚙ Columns" popover (localStorage key `tenders-register-columns:v1`), and an `s7-table` inside `s7-table-scroll`. Columns are user-configurable (Tender #, Name always visible; plus Client, Estimator, Status, Probability, Value, Due date, Days until due, Created); sortable headers toggle asc/desc/off. Row checkboxes drive a sticky dark `BulkActionBar` (bulk status change + Export CSV).
- **Key components / CSS classes:** `tender-page`, `tender-kanban`, `tender-column`/`__header`/`__accent`/`__count`/`__total`/`__body`/`__empty`, `tender-card`/`__head`/`__number`/`__avatar`/`__title`/`__meta`/`__footer`/`__value`/`__activity`, `tender-register`, `s7-table`/`s7-table-scroll`/`s7-table__row--clickable`, `s7-badge` (status uses inline `color-mix` accents; probability uses Hot `#FEAA6D` / Warm `#FED7AA` / Cold `#E2E8F0`), `s7-btn` variants, `slide-over`/`slide-over-overlay`/`slide-over__header/body/footer`, `tender-form`/`__field`.
- **Data sources (endpoints):** `GET /tenders?{query}` (page,pageSize,q,status,estimatorId,clientId,probability,valueMin,valueMax,dueDateFrom,dueDateTo,discipline,sortBy,sortDir); `GET /tenders/filter-presets`, `POST /tenders/filter-presets`, `DELETE /tenders/filter-presets/:id`; `GET /users?...`; `GET /master-data/clients?...`; `PATCH /tenders/:id/status`; `POST /tenders/bulk-status`; `PATCH /tenders/:id/quick-edit`; `GET /tenders/:id/delete-preflight`, `DELETE /tenders/:id`; `POST /tenders` (create — number auto-generated server-side as `T{YYMMDD}-{CLIENT}-Rev1`).
- **States:**
  - *Loading:* kanban renders 2 `tender-card--skel` skeletons per column; register renders 6 skeleton rows.
  - *Empty:* register shows `EmptyState` ("No tenders match these filters" with Clear-filters CTA when filters active, else "+ New tender"); each empty kanban column shows "No tenders in this stage."
  - *Error:* `tender-page__error` alert banner above the views; failed status drag reverts and reloads.
- **Notable interactions:** drag-and-drop stage moves; "New tender" slide-over (client + title required, number auto-generated); Quick-edit modal (status, probability 0–100, due, value, estimator); column-picker popover; saveable filter presets (with default); bulk status + CSV export toast; delete confirm dialog with cascade preflight counts.
- Mockup: `mockups/tenders.html`

---

## Tender Dashboard — `/tenders/dashboard`

- **Component file:** `apps/web/src/pages/tendering/TenderingDashboardPage.tsx` — a thin wrapper that renders `dashboards/DashboardCanvas.tsx` with `dashboardSlug="tendering"` and a default widget config.
- **Purpose:** A personalised, drag-resizable dashboard of tendering KPIs and Recharts widgets. Each user gets their own saved dashboard(s) per slug.
- **Layout & key sections:**
  - `td-v2` wrapper. Header (`td-v2__header`): "Dashboard" label + inline-editable dashboard name, a `DashboardSwitcher`, a "Saving…" hint, and right-side actions: `Reports →` link, `+ Add widget`, `Customise`.
  - Widget grid (`td-canvas__widgets`, a 4-column CSS grid; collapses to 2 cols ≤1024px, 1 col ≤640px). Each widget is a `td-canvas__slot` with chrome (period-override pill, settings gear, drag handle) and three resize handles. Default tendering widgets: KPIs — **Active pipeline**, **Submitted MTD**, **Win rate YTD**, **Avg lead time**; panels — **Due this week** (half), **Follow-up queue** (full), **Win rate — last 6 months** (half, bar chart), **Pipeline by estimator** (half, donut), **Recent wins** (half).
- **Key components / CSS classes:** `td-v2`/`td-v2__header`, `td-canvas__widgets`/`td-canvas__slot`/`--kpi`/`--half`/`--chart`/`--list`/`--table`, `td-canvas__slot-chrome`/`-icon`/`--drag`, `td-canvas__resize`/`--col`/`--row`/`--corner`, `s7-card`, `s7-type-label`. Charts use Recharts (per project conventions). **In the mockup, charts are static placeholder blocks** styled inside `s7-card`.
- **Data sources (endpoints):** `GET /user-dashboards?slug=tendering`, `GET /user-dashboards/:id`, `POST /user-dashboards`, `PATCH /user-dashboards/:id` (config + name auto-save, 500ms debounce). Individual widgets fetch their own tendering aggregates (widget registry in `dashboards/widgetRegistry.ts`).
- **States:**
  - *Loading:* full-width `Skeleton` (height 200) until the active dashboard resolves.
  - *Empty:* if a dashboard has no visible widgets, an `EmptyState` ("No widgets enabled") with a Customise CTA. If no dashboard exists, one is auto-created from the default config.
  - *Error:* red-bordered `s7-card` alert at top.
- **Notable interactions:** drag-reorder widgets (dnd-kit), pointer-drag resize (col/row/both with a live ghost `N × M`), per-widget period override pill (orange when overriding global period), settings popover (filters/fields), inline dashboard rename, Customise side panel, Add-custom-widget modal, dashboard switcher.
- Mockup: `mockups/tenders-dashboard.html`

---

## Tender Detail — `/tenders/:id`

- **Component file:** `apps/web/src/pages/tendering/TenderDetailPage.tsx`. Tab panels: `QuoteTab.tsx`, `scope-cards/ScopeCardsTab.tsx`, plus `TeamEstimatorPanel`, `TenderDocumentsPanel`, `TenderEntriesPanel`, `CorrespondencePanel`, `AddClientModal`, `ConvertToProjectModal`, `ConfirmDeleteDialog`, `AssumptionsExclusionsFloatingEditor`.
- **Purpose:** The single-tender workspace. URL-driven tabs: **Overview** (`/tenders/:id`), **Scope of Works** (`/scope`), **Quote** (`/quote`).
- **Layout & key sections:**
  - `tender-detail` (two-column shell `__main` + `__rail`). Back link, title row (`__title-row`): tender number label + title; right side has a status badge + (with `tenders.manage`) a status select, Duplicate, "Mark as new revision", Delete, and — when status is `CONTRACT_ISSUED` and `tenderconversion.manage` — "Convert to project →".
  - Tabs nav (`tender-detail__tabs` / `__tab` / `--active`).
  - **Overview:** info-card band (`tender-detail__info-cards` → `__info-card`/`__info-card-value`): Stage, Value, Probability (Hot/Warm/Cold select), Due date, Rate snapshot (Locked / Live rates / No estimate). Then a two-col section (Description + Scope notes via click-to-edit `InlineEditableText`; `TeamEstimatorPanel`), a Documents section, a Correspondence section, an optional Estimate-breakdown grid (labour/equip/plant/disposal/cutting/tender price), and `TenderEntriesPanel` (linked clients with preference stars, award flags, contacts).
  - **Scope of Works:** `ScopeCardsTab` (scope item cards/quantities — separate sub-tree).
  - **Quote:** `QuoteTab` → `ClientQuotesPanel` (per-client quote versions), a "Generate Quote" toggle, and `GenerateQuoteSection` (Download PDF quote `#FEAA6D` / Download Excel, "Rates as of …", and an Export-history list with PDF/Excel badges + who/when). `TandCSection` (exported from QuoteTab) renders editable T&C clauses with per-clause "Reset to standard" via `OverrideField`.
- **Key components / CSS classes:** `tender-detail`/`__main`/`__rail`/`__back`/`__title-row`/`__tabs`/`__tab`/`__info-cards`/`__info-card`/`__info-card-value`/`__section-head`/`__two-col`/`__sections`, `s7-card`, `s7-badge`, `s7-btn` variants, `slide-over*`. The floating "A" button (top-right, `Alt+A`) opens the Assumptions & Exclusions editor (Overview + Scope only).
- **Data sources (endpoints):** `GET /tenders/:id`; `GET /tenders/:id/estimate/summary` + `GET /tenders/:id/estimate`; `PATCH /tenders/:id/probability`; `PATCH /tenders/:id/status`; `PATCH /tenders/:id/quick-edit` (description/notes); `POST /tenders/:id/duplicate`; `POST /tenders/:id/bump-revision`; `GET /tenders/:id/delete-preflight` + `DELETE /tenders/:id`; `PATCH /master-data/clients/:id` (preference); `DELETE /tenders/:id/clients/:clientId`. Quote tab: `GET/PATCH /tenders/:id/tandc`, `POST /tenders/:id/tandc/reset[/:number]`, `GET /tenders/:id/exports`, `GET /tenders/:id/export/:kind` (pdf|excel, blob download). Plus child-panel endpoints (documents, correspondence, team estimator, client quotes).
- **States:**
  - *Loading:* `tender-detail` skeleton (label/title/body + rail skeleton).
  - *Error / not found:* `EmptyState` "Tender not found" with a back-to-pipeline CTA.
  - *Empty (within tabs):* T&C "No clauses yet."; Export history "No exports yet"; Description/notes show placeholders.
- **Notable interactions:** URL-routed tabs; inline click-to-edit text (Cmd/Ctrl+Enter saves, Esc cancels, blur saves); probability quick-set; status select; Duplicate; "Mark as new revision" slide-over (optional reason → toast); Convert-to-project modal; Add-client modal; delete confirm with cascade preflight; PDF/Excel quote generation with download + history refresh; debounced T&C autosave (500ms).
- *Approximated:* the mockup renders the **Quote tab** active with the Overview info-card band shown for context (real app shows one tab body at a time). Scope-of-Works card internals were not expanded.
- Mockup: `mockups/tender-detail.html`

---

## Tender Clients — `/tenders/clients`

- **Component file:** `apps/web/src/pages/TenderClientsPage.tsx` — renders `pages/MasterDataPage.tsx` with `initialTab="clients"`, `allowedTabs=["clients"]`, and tendering-scoped title/subtitle/context copy.
- **Purpose:** A tender-scoped, single-tab view of the shared Master Data CRM for maintaining client (organization) records used as the commercial anchor for tenders.
- **Layout & key sections:** `crm-page crm-page--operations` split — left `crm-page__sidebar` (a context `AppCard` with metrics `crm-toolbar`/`__metric`, a `crm-context-banner` with "Create tender / Open pipeline / Open Master Data hub" links, a "Used by" pill row [Tendering / Jobs / Sites], and a `crm-nav` with the single Clients item; plus an "Add organization" composer `AppCard` with `admin-form crm-composer`: name, code, status select [Active/Prospect/Inactive], email, phone, notes). Right `crm-page__main` — a directory `AppCard` (`crm-directory` → `crm-directory__item`/`--active` with avatar + name + meta + status pill) and a record-detail `AppCard` (`crm-record`/`__hero`/`__pills`/`__pill-card`/`__body`/`__panel`/`__details`). Clients also show a `ClientPreferencePanel` with a star rating + win-rate line.
- **Key components / CSS classes:** `AppCard` (from `@project-ops/ui`), `crm-page`/`--operations`/`__sidebar`/`__main`, `crm-toolbar`/`__metric`, `crm-context-banner`/`__links`, `tendering-inline-link`, `crm-nav`/`__item`/`--active`, `admin-form`/`crm-composer`, `crm-directory`/`__item`/`__avatar`/`__content`, `crm-record`/`__hero`/`__pills`/`__pill-card`/`__body`/`__panel`/`__details`, `pill pill--blue`, `muted-text`, `ClientStarRating`.
- **Data sources (endpoints):** `GET /master-data/clients`; `GET /master-data/references` (for composer selects); `POST /master-data/clients` (create); `PATCH /master-data/clients/:id` (preference score).
- **States:**
  - *Loading:* no explicit skeleton — the directory/detail render once `load()` resolves; before that the lists are empty.
  - *Empty:* directory shows `crm-empty` ("No clients yet." + composer hint); detail shows `crm-empty crm-empty--detail` ("No client selected.").
  - *Error:* failed list silently empties the directory (no banner in this view).
- **Notable interactions:** select a directory item to load its detail panel; submit the composer to create + reload; click stars in `ClientPreferencePanel` to PATCH the preference score; context links route into the tender workflow / Master Data hub.
- Mockup: `mockups/tenders-clients.html`

---

## Tender Contacts — `/tenders/contacts`

- **Component file:** `apps/web/src/pages/TenderContactsPage.tsx` — renders `MasterDataPage` with `initialTab="contacts"`, `allowedTabs=["contacts"]`, contacts-scoped copy.
- **Purpose:** Tender-scoped, single-tab view of the Master Data CRM for the people used in client-side communication, clarifications, and follow-up ownership.
- **Layout & key sections:** identical CRM split to Tender Clients, scoped to contacts. Sidebar "Used by" pills are Tendering / Notifications / Documents; the "Add person" composer fields are client select, first name, last name, email, phone, position, notes. Directory items show name + "Client {name}" meta + email pill. Record detail shows First/Last name, Email, Client; the preference panel does not apply to contacts.
- **Key components / CSS classes:** same set as Tender Clients (`crm-*`, `AppCard`, `admin-form crm-composer`, `pill pill--blue`, `muted-text`, `tendering-inline-link`).
- **Data sources (endpoints):** `GET /master-data/contacts`; `GET /master-data/references`; `POST /master-data/contacts`.
- **States:** *Empty:* "No contacts yet." (directory) / "No contact selected." (detail). *Loading/Error:* as per Tender Clients (no skeleton, silent empty on failure).
- **Notable interactions:** select to view detail; create via composer; client link via the `clientId` reference select sourced from `/master-data/references`.
- Mockup: `mockups/tenders-contacts.html`

---

## Estimating Reports — `/tenders/reports`

- **Component file:** `apps/web/src/pages/tendering/TenderingReportsPage.tsx`.
- **Purpose:** Read-only scorecards computed client-side from the tender list — by estimator, by pipeline stage, and by client. (Distinct from the configurable Dashboard.)
- **Layout & key sections:** `admin-page` with `admin-page__header` (label + "Estimating reports" title + "Back to dashboard" link) and a `admin-page__tabs` nav (three tabs: **Estimator scorecard**, **Pipeline**, **Clients**).
  - *Estimator scorecard:* "Win rate by estimator" `s7-card` with stacked bar fills (submitted track + won overlay), "Won $ by estimator" `s7-card` with accent bars, and a "Detail" table (`admin-page__table`: Estimator, Submitted, Won, Lost, Win rate, Won $, Avg tender $, Avg lead time).
  - *Pipeline:* "Tender count by stage" grid of stat tiles (count + % of pipeline, coloured per stage) and "Pipeline $ by stage" coloured bar list.
  - *Clients:* a single table (Client, Submitted, Won, Win rate, Won $).
- **Key components / CSS classes:** `admin-page`/`__header`/`__tabs`/`__tab`/`--active`/`__table`, `s7-card`, `s7-type-section-heading`, `s7-type-page-title`, `Skeleton`. Charts are **CSS bar fills** (not Recharts) using absolute-positioned `div`s; stage colours map DRAFT `#94A3B8`, IN_PROGRESS `#FEAA6D`, SUBMITTED `#005B61`, AWARDED/CONTRACT_ISSUED `#22C55E`, LOST `#EF4444`, WITHDRAWN `#E2E8F0`.
- **Data sources (endpoints):** `GET /tenders?page=1&pageSize=100` (single fetch; all aggregation is in-memory via `useMemo`).
- **States:**
  - *Loading:* an `s7-card` with a 200px `Skeleton`.
  - *Empty:* "No submitted tenders yet." messages per section/table.
  - *Error:* a danger-styled `s7-card` alert banner.
- **Notable interactions:** tab switching only (no drill-down or filters); "Back to dashboard" link.
- Mockup: `mockups/tenders-reports.html`

---

## Tendering Settings — `/tenders/settings`

- **Component file:** `apps/web/src/pages/TenderingSettingsPage.tsx` (label store in `pages/tendering-labels.ts`).
- **Purpose:** A safe "rename surface" — lets users relabel visible Tendering terms without touching data keys, lifecycle states, or relationships. Persisted to **localStorage** only.
- **Layout & key sections:** `admin-grid` of two `AppCard`s.
  - *Settings card:* `module-summary-grid` (three `module-summary-card`s: Visible labels, Customised labels, Last local save), a `notice-banner` ("Safe rename surface"), and an `admin-form` of label inputs (one per default key; placeholder = default value) with "Save labels" + "Reset defaults" buttons.
  - *Preview card:* a `detail-list detail-list--single` (`dt`/`dd` per key) reflecting current label values, plus a "Saved at …" note after saving.
- **Key components / CSS classes:** `admin-grid`, `AppCard`, `module-summary-grid`/`module-summary-card`, `notice-banner`, `admin-form`, `inline-fields`, `detail-list`/`--single`, `muted-text`.
- **Data sources (endpoints):** none — read/write via `readTenderingLabels()` / `writeTenderingLabels()` (localStorage). No API calls.
- **States:** no loading/empty/error states (purely local). "Last local save" reads "Not saved yet" until first save; the customised count derives from values differing from defaults.
- **Notable interactions:** edit any label input (live preview updates); Save labels (writes localStorage, stamps save time); Reset defaults (restores + writes defaults).
- Mockup: `mockups/tenders-settings.html`

---

## Contracts — `/contracts`

- **Component file:** `apps/web/src/pages/contracts/ContractsListPage.tsx` (+ `NewContractModal.tsx`).
- **Purpose:** Registry of project contracts (one per project) tracking variations, progress claims, retention, and payment status. This page is largely **inline-styled** rather than using `s7-table`.
- **Layout & key sections:** a padded container (`padding:24px; max-width:1200px`). Header (title `s7-type-page-heading` + descriptive line + `+ New contract` for `finance.manage`). A pill-style status filter row (All / Active / Practical completion / Defects liability / Closed — active pill has a `#005B61` border). Then a plain table (Contract #, Project [number + name], Client, Status pill, Contract value, Retention %, Created). Contract # links to `/contracts/:id`; project links to `/projects/:id`.
- **Key components / CSS classes:** mostly inline styles + `s7-card` (for empty/loading wrappers), `s7-btn s7-btn--primary`, `s7-type-page-heading`. Status colours: ACTIVE `#005B61`, PRACTICAL_COMPLETION `#3B82F6`, DEFECTS `#F59E0B`, CLOSED `#9CA3AF` (white text pills).
- **Data sources (endpoints):** `GET /contracts` or `GET /contracts?status={status}` when a filter is active.
- **States:**
  - *Loading:* a muted "Loading…" line.
  - *Empty:* centred `s7-card` "No contracts yet."
  - *Error:* a danger-coloured paragraph above the table.
- **Notable interactions:** status pill filter (re-fetches); `+ New contract` opens `NewContractModal`; row links to contract/project detail.
- Mockup: `mockups/contracts.html`

---

## Contract Detail — `/contracts/:id`

- **Component file:** `apps/web/src/pages/contracts/ContractDetailPage.tsx` (sub-components `OverviewTab`, `VariationsTab`, `AddVariationForm`, `ClaimsTab`, `ClaimEditor`).
- **Purpose:** The full contract ledger — financial summary, variations workflow, and monthly progress claims with line-item editing and approval/payment transitions.
- **Layout & key sections:** padded container. Header: back link, contract number + status pill (ACTIVE `#005B61`, others `#9CA3AF`), and a project/client subline (links to `/projects/:id`). An inline tab nav (border-bottom underline style): **Overview**, **Variations (n)**, **Progress claims (n)**.
  - *Overview:* two-column grid of `s7-card`s — "Contract details" (`dl`: value, retention %, start, end, notes) and "Financial summary" (`dl`: original value, approved variations, revised value, total claimed/approved/paid, outstanding, retention held).
  - *Variations:* `s7-card` with `+ Add variation` (inline `AddVariationForm`) and a table (Variation #, Description, Status pill, Requested by, Priced, Approved, Received, action). A `finance.manage` action button advances RECEIVED → PRICED → SUBMITTED → APPROVED (amounts captured via `window.prompt`). Variation status colours: RECEIVED `#9CA3AF`, PRICED `#FEAA6D`, SUBMITTED `#005B61`, APPROVED `#22C55E`.
  - *Progress claims:* `s7-card` with `+ New claim`, a claim table (Claim #, Month, Status pill, Claimed, Approved, Paid, Submitted). Clicking a row expands a `ClaimEditor` (line-item table with editable "% this claim", a totals box [Total / Retention / Net], and Submit / Approve / Record-payment buttons gated by `finance.manage` / `finance.admin`). Claim status colours: DRAFT `#9CA3AF`, SUBMITTED `#FEAA6D`, APPROVED `#005B61`, PAID `#22C55E`.
- **Key components / CSS classes:** mostly inline styles; `s7-card`, `s7-type-page-heading`, `s7-type-section-heading`, `s7-btn` variants, `s7-input`. VAR/claim line items use a small `VAR` badge for variation-sourced lines.
- **Data sources (endpoints):** `GET /contracts/:id`; `POST /contracts/:id/variations`, `PATCH /contracts/:id/variations/:vid`; `POST /contracts/:id/claims`, `GET /contracts/:id/claims/:cid`, `PATCH /contracts/:id/claims/:cid/items/:itemId`, `POST /contracts/:id/claims/:cid/{submit|approve|pay}`.
- **States:**
  - *Loading / not loaded:* renders a plain "Loading…" (or the error text) until the contract resolves — no skeleton.
  - *Empty:* "No variations yet." / "No progress claims yet." within their tabs.
  - *Error:* danger-coloured paragraphs within the active section; top-level shows the error string in place of the body when the contract never loads.
- **Notable interactions:** inline tab switching (local state, not URL); add/advance variations via prompts; create claim (month prompt); expand a claim row to edit line items (debounced PATCH on blur) and run status transitions with amount/date prompts.
- *Approximated:* the mockup shows the **Overview tab** plus the **Variations table** beneath it for representativeness (real app shows one tab at a time); the expandable `ClaimEditor` line-item panel is described but not drawn.
- Mockup: `mockups/contract-detail.html`
