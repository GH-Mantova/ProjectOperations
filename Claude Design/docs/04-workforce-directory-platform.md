# Workforce, Directory & Platform

> ⚠️ **SNAPSHOT — describes the UI as at 2026-06-26.** Screens changed since then are not
> reflected here. Regeneration is tracked in `Claude Design/proposed/README.md`. Do not cite this
> document as the current design without checking it against the running app.

This section documents the workforce, directory, document, compliance, safety and archive surfaces of the Initial Services — ProjectOperations ERP. Each page below maps a live React component to a faithful static mockup. Routes, class names, and data sources are taken directly from the component source under `apps/web/src/`. All sample data reflects the South-East-Queensland civil/construction business context (Brisbane City Council, TMR Queensland, Urban Utilities; AUD; dd/mm/yyyy dates).

A recurring structural note: most of these pages render their own bespoke layout classes (`admin-page`, `crm-page`, `docs-page`, `mdata-page`) or use raw inline styles rather than the `s7-*` design-system primitives. The newer pages (Master Data, Documents, Workers) lean on `s7-card` / `s7-btn` / `s7-badge`; the directory, compliance and safety pages are largely hand-styled with inline colour tokens and ad-hoc tables. This inconsistency is the primary redesign opportunity across the module.

---

## Workers — `/workers`

**Component file:** `apps/web/src/pages/workers/WorkersListPage.tsx`

**Purpose:** The HR / compliance roster of all field and office workers. It is explicitly *not* the login-provisioning surface — mobile access is provisioned per-worker from the detail page. Distinct from the legacy `/resources` planning rail.

**Layout & key sections:** A `admin-page` wrapper. `admin-page__header` is a spread row: left holds the `s7-type-label` eyebrow ("Workforce"), `s7-type-page-title`, and a muted subline; right holds an `s7-input` search box (filters name/role) and an "Add worker" `s7-btn s7-btn--primary` (shown only with `resources.manage`). Below is an `admin-page__tabs` tablist toggling Active vs Inactive (drives the `isActive` query param). The body is a single `s7-card` containing `admin-page__table` with columns Name / Role / Phone / Email / Mobile access / Status, plus a footer count line.

**Key components / CSS classes:** `admin-page`, `admin-page__header`, `admin-page__tabs`, `admin-page__tab(--active)`, `admin-page__table`, `s7-card`, `s7-input`, `s7-btn--primary`, and a bespoke `type-badge` pill. Name cells link to `/workers/:id` in brand-accent colour; preferred name renders parenthetically. Mobile-access and Status are rendered as colour-mixed pills (teal for enabled/active, slate/red for disabled/inactive) — not `s7-badge`. The Add modal (`AddWorkerModal`) uses `CenteredModal` from `@project-ops/ui` with a two-column grid of `s7-input` fields (name, role, contact, emergency contact, licence number/class, ticket numbers).

**Data sources (endpoints):** `GET /workers?isActive={bool}&search=` (list); `POST /workers` (create from the modal).

**States:** Loading → `s7-card` with a full-width `Skeleton`. Empty → `EmptyState` ("No active/inactive workers") with a CTA hint that varies by manage permission. Error → red-bordered `s7-card` alert. A transient toast (fixed bottom-right, teal) confirms "Worker profile created".

**Notable interactions:** Search and the Active/Inactive tabs both re-trigger the list fetch via a memoised `load`. Toast auto-dismisses after 3s. The Add button and modal are permission-gated on `resources.manage`.

Mockup: `mockups/workers.html`

---

## Worker Detail — `/workers/:id`

**Component file:** `apps/web/src/pages/workers/WorkerDetailPage.tsx` (with `QualificationsSection.tsx` and `AvailabilitySection.tsx`)

**Purpose:** Single worker profile — identity, licence/tickets, current project allocations, qualifications with expiry tracking, leave/unavailability, mobile-access provisioning, and deactivation.

**Layout & key sections:** `admin-page` wrapper with a `tender-detail__back` link, then an `admin-page__header` showing role eyebrow, display name (preferred name shown in quotes), an active/inactive pill, and an Edit button (gated on `resources.manage`). Below it, a vertical stack of `s7-card` sections each headed by `s7-type-section-heading`:
- **Profile** — a four-column `<dl>` (name, phone, email, emergency contact).
- **Licence & tickets** — `<dl>` for licence number/class and a full-width tickets row, with a "full tracking coming in Compliance module" note.
- **Current allocations** — `admin-page__table` (Project # / name / role-on-project / start / end), project numbers linking to `/projects/:id`; `EmptyState` if none.
- **Qualifications** (`QualificationsSection`) — header with "+ Add qualification"; a table of Type / Licence # / Authority / Issued / Expiry / Status with a coloured status pill driven by a `not_set | active | expiring_30 | expiring_7 | expired` enum (slate / green / amber / orange / red). Edit (✎) and delete (×) per row. Qual types are a fixed list: White Card, Asbestos A/B, Forklift, EWP, Rigger, Scaffolder, First Aid, Warden, Dogman, Crane, Electrical, Plumbing, Other.
- **Availability** (`AvailabilitySection`) — two side-by-side tables: Leaves (type / window / status, with Approve/Decline on PENDING rows) and Unavailability (reason / window-or-recurrence). "+ Leave" and "+ Unavailability" open a `CenteredModal` form that supports draft save/restore (`useFormDraft`, separate draft per mode).
- **Mobile access** — a status pill plus context-dependent buttons (Provision / Send welcome SMS / Revoke). Provisioning issues a one-time temporary password shown in an amber copy-to-clipboard banner.
- **Deactivate footer** — danger button (gated, only when active), confirms via `window.confirm`.

**Key components / CSS classes:** `admin-page`, `s7-card`, `s7-type-section-heading`, `admin-page__table`, `type-badge`, `s7-btn--secondary/--danger/--ghost/--sm`, `CenteredModal`, `EmptyState`, `Skeleton`, `DraftBanner` / `SaveDraftButton`. Qualification and availability tables are hand-styled (inline `borderCollapse`, `surface-muted` header) rather than `s7-table`.

**Data sources (endpoints):** `GET /workers/:id`; `PATCH /workers/:id` (edit); `DELETE /workers/:id` (deactivate); `POST /workers/:id/provision-mobile-access`. Qualifications: `GET/POST /compliance/workers/:id/qualifications`, `PATCH/DELETE …/qualifications/:qid`. Availability: `GET /workers/leaves?workerProfileId=`, `GET /workers/unavailability?workerProfileId=`, `POST /workers/leaves`, `POST /workers/unavailability`, `PATCH /workers/leaves/:id/status`.

**States:** Page-level loading → stacked `Skeleton` blocks. Not found / error → `EmptyState` with a back-to-workers CTA. Qualifications: inline "Loading…", "No qualifications recorded yet". Availability: per-column "No leave / unavailability on file". Deactivation and qualification delete use native confirm dialogs.

**Notable interactions:** Edit and Provision use modals; the provisioned temp password is deliberately surfaced once with copy/dismiss. Leave status changes (Approve/Decline) and qualification CRUD reload their own subsection independently.

Mockup: `mockups/worker-detail.html`

---

## Resources — `/resources`

**Component file:** `apps/web/src/pages/ResourcesPage.tsx` *(legacy)*

**Purpose:** The older operational resourcing workspace — a grouped worker directory for fast availability/suitability checks, kept alongside the newer `/workers` HR roster. Master Data links here with a "Workers →" tab.

**Layout & key sections:** A two-column `crm-page crm-page--operations` split. **Left rail** (`crm-page__sidebar`) is a single `AppCard` titled "Resource Directory" containing: a 2×2 `module-summary-grid` of counters (workers in scope, unavailable now, coverage risks, with-competencies), a search `admin-form`, and a `dashboard-list` of collapsible `planner-group` sections grouped by `resourceType.name`. Each `planner-list-card` shows the worker, a skills count `pill`, employee code/type, and availability/suitability pills; selection state is `planner-list-card--active`. **Right main** (`crm-page__main`) holds an `AppCard` "Worker Detail" (selected worker's competency tags, availability-windows list, role-suitability list) and a `compact-two-up` pair of `AppCard` composer forms — "Availability Windows" (worker / datetime start-end / status / notes) and "Role Suitability" (worker / role label / suitability / notes).

**Key components / CSS classes:** `crm-page`, `crm-page__sidebar`, `crm-page__main`, `AppCard`, `module-summary-grid`, `planner-group(__header/__body/__toggle)`, `planner-list-card(--active)`, `pill pill--slate/--green/--amber/--blue`, `resource-tag`, `resource-card`, `compact-two-up`, `record-row--card`, `admin-form`. Collapsed-group state persists to `localStorage` (`project-ops-resource-groups`).

**Data sources (endpoints):** `GET /resources/workers?page=&pageSize=&q=`; `POST /resources/availability-windows`; `POST /resources/role-suitabilities`.

**States:** Errors render as a top `error-text` paragraph. Empty search → "No workers matched the current search." No selected worker → main shows a muted prompt. Empty availability/suitability lists show inline muted text. (No skeleton loaders — this is a legacy page.)

**Notable interactions:** Auto-selects the first worker when the list loads; group collapse toggles persist across sessions; submitting either composer form reloads the directory.

Mockup: `mockups/resources.html`

---

## Master Data — `/master-data`

**Component file:** `apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx`

**Purpose:** The shared reference-data hub for Clients and Sites (Workers redirect out to `/workers`). Records are browsed as cards or table and edited in a right-hand slide-over; clients carry contacts and progress-claim configuration.

**Layout & key sections:** `mdata-page` wrapper. The `workers-page__header` carries the "Data" eyebrow + "Master data" title and a `tender-page__view-toggle` acting as the top-level tab strip (Clients / Sites / a "Workers →" link to `/resources`). Each tab (`ClientsTab` / `SitesTab`) renders an `mdata-section` with an `mdata-toolbar` (search `s7-input` + status/client/state `s7-select` filters on the left; a Cards/Table `tender-page__view-toggle` and "+ New" `s7-btn--primary` on the right). **Cards view** = `assets-grid` of `mdata-card` buttons reusing `jobs-card__head/__number/__title/__meta` plus status `s7-badge`. **Table view** = `s7-table-scroll` > `s7-table` with `s7-table__row--clickable` rows. Clicking a card/row opens a `ClientSlideOver` or `SiteSlideOver`.

**Slide-over detail (CRM split, right panel):** `slide-over-overlay` + `slide-over` panel with header/subtitle/close, and — for existing clients — a `tender-detail__tabs` strip (Details / Contacts). The Details form uses `mdata-fieldset` legends (Identification, Contact, Notes, Progress claims) of `tender-form__field` rows; the Progress-claims fieldset captures a 1–28 monthly claim cut-off day and a reminder-assignee user. The Contacts tab embeds the shared `ContactsTab`. Sites have an analogous form (Identification, Address with suburb/state/postcode, Notes) and AU-postcode validation.

**Key components / CSS classes:** `mdata-page`, `mdata-section`, `mdata-toolbar(__filters/__actions)`, `mdata-card`, `assets-grid`, `s7-table`, `s7-table-scroll`, `s7-table__row--clickable`, `s7-badge--active/--neutral/--warning`, `tender-page__view-toggle`, `slide-over(-overlay)`, `mdata-fieldset`, `tender-form__field`, `ContactsTab`. The `STATUS_CLASS` map binds ACTIVE/INACTIVE/ARCHIVED to badge variants.

**Data sources (endpoints):** `GET /master-data/clients?page=&pageSize=`, `POST/PATCH /master-data/clients[/:id]`; `GET /master-data/sites`, `POST/PATCH /master-data/sites[/:id]`; `GET /users?page=&pageSize=` (reminder-assignee options). The `?tab=` query param is synced to URL; a `?tab=workers` value redirects to `/resources`.

**States:** Loading → `assets-grid` of skeleton `s7-card`s. Empty → `EmptyState` with a "+ New" CTA. Error → `tender-page__error` alert. Slide-over surfaces field-level errors (`mdata-field-error`) and a form-level `login-card__error`. Escape closes the slide-over.

**Notable interactions:** Client/Site filters are client-side over the loaded page; view toggle is per-tab; the slide-over restores focus on close; client form computes an ordinal-suffixed cut-off helper line live.

Mockup: `mockups/master-data.html`

---

## Subcontractors & Suppliers — `/directory/subcontractors`

**Component file:** `apps/web/src/pages/directory/SubcontractorsPage.tsx`

**Purpose:** The business directory of subcontractors and suppliers, tracking prequalification status, licences, insurances, documents (SWMS, insurance certs, rate cards), contacts, and a credit ledger.

**Layout & key sections:** A plain `padding:20` wrapper (no page class). Header = page heading + subline + "+ New entry" `s7-btn--primary` (gated on `directory.manage`). A hand-styled filter bar holds five controls: type, category, prequal, status, and a name/ABN search (`s7-select`/`s7-input` with `s7-input--sm`). The body is a flex split: **left** a master table (Name / Type / Categories / Prequal / Alerts) with clickable rows, prequal colour chips (approved=green, pending=orange, suspended=red, rejected=grey) and an orange "N expiring" alerts chip; inactive rows render at 0.5 opacity. **Right** (fixed 480px, only when a row is selected) a `SubcontractorDetail` `s7-card`: name/trading-name/entity header, a `PrequalBanner` (coloured left-border callout), and a `tender-detail__tabs` strip — **Overview** (contact, categories chips, licences list, insurances list, internal notes), **Contacts** (embedded `ContactsTab`), **Documents** (`DocumentsTab` table + upload modal), **Credit** (`CreditLedgerTab` with AUD summary tiles and a charge/payment ledger). Admin actions (Approve prequal / Suspend / Deactivate) sit at the card footer.

**Key components / CSS classes:** `s7-card`, `s7-btn--primary/--secondary/--ghost/--sm`, `s7-select`/`s7-input--sm`, `tender-detail__tab(--active)`, `CenteredModal` (Create + Document upload). Most tables, chips, banners, and section labels are inline-styled rather than `s7-*`. `SummaryTile` cards show credit limit / balance / remaining / approved with a danger tone for negative remaining; ledger amounts are AUD-formatted via `toLocaleString("en-AU")`.

**Data sources (endpoints):** `GET /directory?type=&category=&prequal=&status=&q=`; `GET /lists/subcontractor-categories`; `GET /directory/:id`; `PATCH /directory/:id/prequal`; `POST/DELETE /directory/:id/documents[/:docId]`; `DELETE /directory/:id` (soft delete); `GET/POST /directory/:id/credit-ledger`; `POST /directory` (create).

**States:** List loading/empty/error are inline muted/red paragraphs (no skeletons in the list). Detail card has its own "Loading…" / error states; credit tab uses `s7-skeleton` blocks. Licences/insurances/documents/ledger each show their own "None recorded" empty line.

**Notable interactions:** Promoting prequal to "approved" runs a soft compliance check — if documents, an active licence, or active insurance are missing it warns via `window.confirm` but still allows approval; a follow-up `window.prompt` captures prequal notes. Create modal hides ABN/trading-name for `private_person`; categories are a multi-select.

Mockup: `mockups/directory-subcontractors.html`

---

## Contacts — `/directory/contacts`

**Component file:** `apps/web/src/pages/directory/ContactsPage.tsx`

**Purpose:** A cross-organisation register of every external contact across clients, subcontractors and suppliers, with type filtering, search, pagination and CSV export.

**Layout & key sections:** Plain `padding:20` wrapper. Header = "Contacts" heading + subline; an admin-only "Export CSV" `s7-btn--secondary` (disabled when empty). A hand-styled filter bar holds a name/email search, an org-type segmented control (All / Clients / Subcontractors / Suppliers, rendered as `s7-btn--secondary/--ghost --sm` toggles), and an "Active only" checkbox. The body is a wide table: Name / Organisation / Type / Role / Phone / Mobile / Email / Primary / edit-affordance. Organisation cells link out (clients → `/master-data?tab=clients`, subs/suppliers → `/directory/subcontractors`) and stop row-click propagation. Type is a coloured chip (CLIENT teal, SUBCONTRACTOR blue, SUPPLIER orange). Primary contacts show a green dot. A footer shows "Page X of Y · N total" with Prev/Next.

**Key components / CSS classes:** Inline-styled table and chips; `s7-input--sm`, `s7-btn--secondary/--ghost/--sm`, `ContactFormModal` (from `ContactsTab`). Org names are resolved through client/subcontractor lookup maps fetched once on mount. CSV export builds a Blob client-side (`IS_Contacts_{date}.csv`).

**Data sources (endpoints):** `GET /contacts?organisationType=&search=&isActive=&page=&limit=`; lookups: `GET /master-data/clients?page=1&limit=100` and `GET /directory?status=`.

**States:** Loading/empty/error are inline muted/red paragraphs ("No contacts found — add contacts from the client or subcontractor detail pages."). Inactive contacts render at 0.5 opacity. Pagination buttons disable at bounds.

**Notable interactions:** Filters and search reset to page 1; clicking a row opens the `ContactFormModal` (contacts are created from the owning org's detail page, edited here). Export is admin-gated (super-user or Admin role).

Mockup: `mockups/directory-contacts.html`

---

## Documents — `/documents`

**Component file:** `apps/web/src/pages/documents/DocumentsWorkspacePage.tsx`

**Purpose:** A central document browser across the whole ERP, grouped by the entity a document is linked to (Jobs, Tenders, Assets, Form submissions, Sites, Workers, Clients), with drag-drop upload and version history. File bytes live in SharePoint; this surface manages metadata + version chains.

**Layout & key sections:** `docs-page` wrapper. `workers-page__header` carries the "Data" eyebrow + "Documents" title and a "+ Upload" `s7-btn--primary`. The body is a `docs-split` two-pane grid: **left** `docs-tree` context rail — an "All documents" item plus collapsible `docs-tree__group` sections (one per entity type, ordered Job→Tender→Asset→FormSubmission→Site→Worker→Client) whose entities expand to `docs-tree__item` buttons showing a resolved label/sublabel and a per-context `sched-hierarchy__count`. **Right** `docs-list` pane with a persistent drop-zone banner (lists accepted extensions) and a `docs-list__body` of `docs-row` items: a coloured file-type icon chip (by extension — pdf red, office blue/teal, images amber), title + entity·category·size, a version `s7-badge--neutral`, uploader, updated date, and Download / New-version actions. Superseded (non-current) versions render dimmed via `docs-row--superseded`.

**Key components / CSS classes:** `docs-page`, `docs-split`, `docs-tree(__head/__body/__group/__group-head/__caret/__group-label/__entities/__item/__item--active/__item-text/__item-sublabel)`, `sched-hierarchy__count`, `docs-list(--drag-over/__dropzone/__body)`, `docs-row(__icon/__meta/__name/__sub/__uploader/__date/__actions)`, `s7-badge--neutral`, `s7-btn--secondary/--ghost/--sm`, `EmptyState`, `Skeleton`. Upload uses a `slide-over` panel (`UploadSlideOver`) with a file input, title/category/description (new) or version-label (new version), posting `multipart/form-data`.

**Data sources (endpoints):** `GET /documents?page=&pageSize=`; `GET /documents/:id/download` (returns a signed URL); `POST /documents` (new doc, multipart); `POST /documents/:id/versions` (new version, multipart).

**States:** Loading → skeleton tree item + five skeleton `docs-row`s. Empty → `EmptyState` whose subtext differs for "all" vs a selected context. Error → `tender-page__error` alert. Uploading without a selected context surfaces a guard error ("Pick a job / asset / form on the left…").

**Notable interactions:** Drag-drop anywhere on the list pane validates extensions and pre-fills the upload slide-over (via a `s7-docs-prefill` custom event); upload requires a selected context for new docs. Tree groups toggle independently; the active context filters the list.

Mockup: `mockups/documents.html`

---

## Compliance — `/compliance`

**Component file:** `apps/web/src/pages/compliance/CompliancePage.tsx`

**Purpose:** A consolidated expiry look-ahead across licences, insurances and qualifications for clients, subcontractors and workers — plus a register of compliance-blocked subcontractors. This is the central WHS/commercial-compliance watchtower.

**Layout & key sections:** Plain `padding:20` wrapper. Header shows the "Compliance" heading, an orange alert-count badge (from `countComplianceAlerts`), and an explanatory subline. Four `s7-card` `SummaryCard`s (left-border accent) report Expired now / Expiring ≤7d / Expiring ≤30d / Compliance blocked. A hand-styled filter bar holds three `FilterChips` groups — Days-ahead (7/14/30/60/90), Type (All/Licences/Insurances/Qualifications), Entity (All/Clients/Subcontractors/Workers) — rendered as `s7-btn--secondary/--ghost --sm` chips, plus a "Show expired" checkbox. The main table lists Entity (name + type subline) / Type / Item (+ number) / Expiry / Days (colour-graded) / Status pill (expired red, expiring orange/amber, active green, not-set slate). A separate "Blocked subcontractors" section table (Name / Reason / Blocked-at / Unblock) appears when any exist.

**Key components / CSS classes:** `s7-card`, `s7-type-page-heading`, `s7-type-section-heading`, `s7-btn--secondary/--ghost/--sm`, `EmptyState`; `SummaryCard` and `FilterChips` are local components; tables and status pills are inline-styled. Days-cell colour is computed by `daysCellTone`; status tone by `statusTone`.

**Data sources (endpoints):** `GET /compliance/expiring?days={n}`; `GET /compliance/blocked-subcontractors`; `PATCH /compliance/subcontractors/:id/block` (unblock, admin only).

**States:** Loading → inline "Loading…". Two distinct empties: when nothing is at risk at all → a positive `EmptyState` ("✅ All current"); when filters hide everything but data exists → `EmptyState` ("🛡️ No items match…") with a "Show all" reset CTA. Error → red paragraph.

**Notable interactions:** Changing the days window refetches; type/entity/expired filters are client-side over the merged rows. Unblock is gated on `compliance.admin` / super-user and reloads on success. The alert badge count mirrors the sidebar compliance badge.

Mockup: `mockups/compliance.html`

---

## Safety — `/safety`

**Component file:** `apps/web/src/pages/safety/SafetyPage.tsx`

**Purpose:** The WHS register of incident reports and hazard observations, with at-a-glance open/overdue counts and quick links into the structured forms-submission flow (IS-INC / IS-HAZ).

**Layout & key sections:** Plain `padding:20` wrapper. Header = "Safety" heading + subline, and two quick-action anchors that route to the forms flow: "+ Report Incident" (`s7-btn--primary`, overridden to the brand-orange `#FEAA6D`) → `/forms?category=safety&template=IS-FORM-INCIDENT`, and "+ Log Hazard" (`s7-btn--secondary`) → the near-miss template. Three `SummaryCard`s (left-border accent) report Open incidents / Open hazards / Overdue hazards from the dashboard endpoint. A `role="tablist"` toggle (Incidents (n) / Hazards (n), as `s7-btn--secondary/--ghost --sm`) switches the table below. **Incidents table:** # / Date / Location / Type / Severity pill / Status / truncated description. **Hazards table:** # / Date / Location / Type / Risk pill / Status / Due / description, with overdue rows tinted red and a "(overdue)" suffix.

**Key components / CSS classes:** `s7-card`, `s7-type-page-heading`, `s7-btn--primary/--secondary/--ghost/--sm`; `SummaryCard` is local; tables and severity/risk pills are inline-styled (`SEVERITY_TONE` low→critical, `RISK_TONE` low→extreme). Descriptions truncate at ~100 chars.

**Data sources (endpoints):** `GET /safety/dashboard`; `GET /safety/incidents?limit=50`; `GET /safety/hazards?limit=50`.

**States:** Loading → inline "Loading…". Per-tab empties: "No incidents recorded." / "No hazards recorded." Error → red paragraph. Dashboard cards only render once the dashboard payload resolves.

**Notable interactions:** The quick-action buttons are plain anchors (deep links into Forms), not API calls — creation happens in the structured form flow. Tab counts come from the loaded list lengths. Overdue hazard detection is computed client-side against `now` and excludes closed hazards.

Mockup: `mockups/safety.html`

---

## Archive — `/archive`

**Component file:** `apps/web/src/pages/archive/ArchivePage.tsx`

**Purpose:** A read-only register of closed and archived jobs, filterable and CSV-exportable. Entry point into the frozen per-job archive export.

**Layout & key sections:** The whole page is wrapped in an `AppCard` ("Archive" / "Read-only register of closed and archived jobs") with an "Export CSV" action in the card header. The body has a four-up `compact-filter-grid compact-filter-grid--four` (Search / Client / Year / Status) above a `data-table` (Job # / Name / Client / Closed / Status / View). Status renders as a `pill pill--amber`; each row's "Closed" cell falls back to the archived date; the View column links to `/archive/:jobId` (44px touch target). Pagination (Previous / "Page X of Y" / Next) appears below when the total exceeds the page size (20).

**Key components / CSS classes:** `AppCard`, `compact-filter-grid(--four)`, `data-table`, `pill pill--amber`, `EmptyState`, `error-text`, `muted-text`, `pagination`. Client options are loaded for the filter dropdown; year options are the last six years.

**Data sources (endpoints):** `GET /archive?search=&clientId=&year=&status=&page=&pageSize=`; `GET /master-data/clients?page=1&pageSize=100` (filter dropdown).

**States:** Loading (first page) → a single "Loading archive…" row. Two empties: with active filters → `EmptyState` ("🗃️ No archive entries match…") + "Clear filters" CTA; with no filters → `EmptyState` ("🗃️ Nothing archived yet") + "Go to Jobs" CTA. Error → `error-text` paragraph.

**Notable interactions:** Every filter change resets to page 1 and refetches. Export CSV builds a Blob client-side (`archive-{date}.csv`) from the current page's rows. Status pill styling is a single amber treatment regardless of CLOSED vs ARCHIVED.

Mockup: `mockups/archive.html`

---

## Archive Detail — `/archive/:jobId`

**Component file:** `apps/web/src/pages/archive/ArchiveDetailPage.tsx`

**Purpose:** The frozen, read-only export of a single closed/archived job — a complete point-in-time snapshot of summary, closeout, stages/activities, issues/variations, form submissions, linked documents and status history. Downloadable as JSON.

**Layout & key sections:** Wrapped in an `AppCard` whose title is "{jobNumber} — {name}" and subtitle notes the export timestamp; the header actions are a "← Archive" back link and an "Export record" (JSON download) button. The body is a stack of local collapsible `Panel` sections (each a bordered `<section>` with a 44px toggle header showing ▾/▸): **Job summary** (client, site, status, PM, supervisor, description), **Closeout & checklist** (status, archived date, summary, raw checklist JSON in a `<pre>`), **Stages & activities** (each stage as a heading + amber status `pill` + nested activity list), **Issues & variations** (two sub-lists; variations show AUD amounts), **Form submissions** (template name + version + status + timestamp), **Linked documents** (title + category + version + filename), **Status history** (timestamped from→to transitions with notes).

**Key components / CSS classes:** `AppCard`, local `Panel` (inline-styled bordered collapsible), `pill pill--amber`, `muted-text`, `error-text`, `<pre>` for JSON. All panels default to open. No `s7-*` table primitives — content is plain `<p>` / `<ul>` lists.

**Data sources (endpoints):** `GET /archive/:jobId/export` — returns the full `ArchiveExport` payload (summary, closeout, checklist, stages, activities, issues, variations, progressEntries, statusHistory, documents, formSubmissions, exportedAt).

**States:** Loading → an `AppCard` with "Retrieving archive record…". Error / not found → an `AppCard` with `error-text` and a back link. Each panel has its own empty line ("No issues recorded.", "No documents linked.", "No status changes recorded.", etc.).

**Notable interactions:** Panels toggle open/closed independently. "Export record" serialises the in-memory payload to a downloadable `archive-{jobNumber}.json`. The entire surface is read-only by design — it is the closed-job source of truth, with no edit affordances.

Mockup: `mockups/archive-detail.html`
