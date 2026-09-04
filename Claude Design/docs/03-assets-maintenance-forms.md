# Assets, Maintenance & Forms

> ⚠️ **SNAPSHOT — describes the UI as at 2026-06-26.** Screens changed since then are not
> reflected here. Regeneration is tracked in `Claude Design/proposed/README.md`. Do not cite this
> document as the current design without checking it against the running app.

This section documents the **Assets / Maintenance / Forms** surfaces of the Initial Services —
ProjectOperations staff workspace: the plant & equipment register, asset detail, the maintenance
scheduler, the read-only plant utilisation report, and the full forms lifecycle (template gallery,
form builder/designer, two form fillers, and a submission record viewer). All pages render inside
`ShellLayout` (dark sidebar + 56px top bar injected by `chrome.js` in the gallery). Currency is AUD,
dates display in the browser locale (dd/mm/yyyy for `en-AU`), and sample data reflects SEQ
civil/construction work (Brisbane City Council, TMR Queensland, Urban Utilities, Redland/Logan City
Council; excavators, dozers, tippers, compactors; SWMS / pre-start / incident forms).

Shared conventions across these pages:
- `authFetch(path)` from `useAuth()` (`AuthContext`) is the single API client; it prefixes the
  configured API base (`/api/v1`). Endpoint paths below are written relative to that base.
- Asset status pills map via a `STATUS_CLASS` record onto `s7-badge` variants:
  `AVAILABLE → --active`, `IN_USE → --info`, `MAINTENANCE → --warning`, `OUT_OF_SERVICE → --danger`.
- Loading uses `Skeleton` blocks; empty uses the `EmptyState` component (icon + heading + subtext +
  optional CTA); errors render a red-bordered `s7-card[role="alert"]` (`tender-page__error`).
- The **Forms** module breaks from the `s7-badge` system: it uses a bespoke category colour palette
  (`CATEGORY_COLOUR`: safety `#E74C3C`, asbestos `#E67E22`, plant `#3498DB`, induction `#005B61`,
  environmental `#27AE60`, permits `#8E44AD`, quality `#95A5A6`, daily `#F39C12`, custom `#2C3E50`)
  and a recurring orange accent `#FEAA6D` (with `#242424` text) for primary CTAs. Forms pages are
  heavily inline-styled rather than class-driven, so the mockups replicate those inline styles.

---

## Assets — `/assets`

**Component file:** `pages/assets/AssetsListPage.tsx`

**Purpose:** The plant & equipment register — a filterable card grid of every asset (excavators,
dozers, tippers, compactors) with status, category, home base and last-service date at a glance.

**Layout & key sections:** A `workers-page__header` (label "Resources" + page title "Assets"), an
optional error banner, a filter bar (`jobs-page__filters assets-page__filters`: free-text search +
category / status / location selects, all populated dynamically from the loaded assets via `useMemo`),
and the `assets-grid` of `assets-card` links. Each card has a hexagon SVG photo placeholder
(`assets-card__photo`), name, asset code, a pill row (`assets-card__pills` — category neutral badge +
status badge) and a footer line (`assets-card__foot`) reading "{homeBase} · Last service {date}".
Last-service date is derived client-side from completed maintenance events and plan `lastCompletedAt`.

**Key components / CSS classes:** `assets-grid`, `assets-card`, `assets-card__photo/__body/__name/
__meta/__pills/__foot`, `jobs-page__filters`, `s7-input`, `s7-select`, `s7-badge --active/--info/
--warning/--danger/--neutral`. `EmptyState` and `Skeleton` from `@project-ops/ui`.

**Data sources (endpoints):** `GET /assets?page=1&pageSize=100` (single fetch; filtering is all
client-side). Cards link to `/assets/{id}`.

**States:** *Loading* — six skeleton cards (`s7-card` with stacked `Skeleton` blocks).
*Empty* — `EmptyState` "No assets match your filters" (only shown after load when filters exclude
everything). *Error* — red `tender-page__error` banner above the filters.

**Notable interactions:** All filtering is in-memory (no refetch). Search matches name, code, home
base and category name. Cards are whole-card anchor links.

Mockup: `mockups/assets.html`

---

## Asset Detail — `/assets/:id`

**Component file:** `pages/assets/AssetDetailPage.tsx`

**Purpose:** The full record for one asset — service KPIs, current location, notes, a unified
maintenance timeline (services + inspections + breakdowns), assigned scheduler shifts, and linked
documents.

**Layout & key sections:** Back link (`tender-detail__back`), an `asset-detail__header` (hexagon
photo, asset code label, name, "{category} · {homeBase}" subline, status badge), then a four-tab nav
(`tender-detail__tabs job-detail__tabs`):
- **Overview** — a `job-detail__overview` grid of `s7-card job-detail__overview-kpi` cards: Last
  service, Next service due, Total downtime (days + breakdown count), Current location, plus a Notes
  card. Last/next service and downtime are computed in a `useMemo` from events, plans and breakdown
  durations (open breakdowns counted to "now").
- **Maintenance history (n)** — a `tender-timeline` of merged, date-sorted entries; breakdowns use
  the `--clarification` marker, inspections `--follow-up`, services `--outcome`.
- **Assigned shifts (n)** — an `s7-table` (Shift / Job / When / Status) linking to `/scheduler` and
  `/jobs/{id}`.
- **Documents** — a `tender-docs` list (registration / calibration / service records) with "Open"
  buttons; fetched lazily only when the tab is first opened.

**Key components / CSS classes:** `worker-detail`, `asset-detail__header/__photo`, `tender-detail__
tabs/__tab/--active`, `job-detail__overview/-kpi/-value/-description`, `tender-timeline` (+ marker/
body/head/time/text variants), `s7-table`, `s7-table-scroll`, `tender-docs`.

**Data sources (endpoints):** `GET /assets/{id}` (on mount) and `GET /documents/entity/Asset/{id}`
(only when the Documents tab is activated).

**States:** *Loading* — `worker-detail` skeleton block stack. *Error / not found* — `EmptyState`
"Asset not found" with a "← Back to assets" CTA. *Empty (per tab)* — `EmptyState` for no maintenance
history / no assigned shifts / no documents. Documents tab shows a `Skeleton` until its fetch
resolves.

**Notable interactions:** Tab state is local; Documents fetch is deferred and cancellable.

Mockup: `mockups/asset-detail.html` (Overview tab shown active; a maintenance-history timeline is
included below it for reference).

---

## Maintenance — `/maintenance`

**Component file:** `pages/maintenance/MaintenancePage.tsx` (includes the inline `LogEventSlideOver`).

**Purpose:** The maintenance command centre — an "Upcoming & overdue" worklist beside a month
calendar that plots every scheduled service, inspection and open breakdown across the fleet.

**Layout & key sections:** A `workers-page__header` (label "Operations" + title "Maintenance") with
two actions — a "Utilisation report" secondary link to `/maintenance/utilisation` and a "+ Log event"
primary button that opens the slide-over. Below, a two-column `maint-split`:
- **Left** — `s7-card maint-upcoming`: a head with a count chip (`maint-upcoming__count`) and a list
  (`maint-upcoming__list`) of items. Each item (`maint-upcoming__item`, `--overdue` modifier) shows
  the asset link, a type badge (Scheduled `--info` / Inspection `--warning` / Breakdown `--danger`),
  title, subtitle, due date and an "Overdue" tag. The list is built in a `useMemo` that flattens
  events/inspections/breakdowns and sorts overdue-first then by due date.
- **Right** — `s7-card maint-calendar`: a month grid reusing the scheduler's `sched-month__*`
  classes, with prev/Today/next nav (`sched-main__nav`). Each day cell shows up to three event pills
  (`sched-pill sched-pill--compact`, danger for overdue/breakdown, warning for service/inspection)
  linking to the asset, with a "+N more" overflow.

**Key components / CSS classes:** `maint-split`, `maint-upcoming` (+ head/count/body/list/item/row/
asset/title/sub/due/overdue), `maint-calendar`, `sched-month__grid/__cell(--today/--dim)/__daynum/
__cellbody/__more`, `sched-pill --compact/--danger/--warning`, `sched-main__nav/__range`. The
**Log event slide-over** (`slide-over-overlay` / `slide-over`) is a tabbed form (service / inspection
/ breakdown via `tender-page__view-toggle`) with asset select and per-kind fields.

**Data sources (endpoints):** `GET /maintenance/assets?page=1&pageSize=100`. The slide-over POSTs to
`POST /maintenance/events`, `POST /maintenance/inspections`, or `POST /maintenance/breakdowns`
depending on the selected kind, then reloads the list.

**States:** *Loading* — a single `Skeleton` in the upcoming panel. *Empty* — `EmptyState`
"No maintenance due". *Error* — red `tender-page__error` banner. The slide-over surfaces validation
errors inline (`login-card__error`).

**Notable interactions:** Calendar month navigation is local state (`cursor`); "Today" resets it.
Logging an event closes the slide-over and refetches.

Mockup: `mockups/maintenance.html` (calendar centred on June 2026; slide-over not shown in the static
state — described above).

---

## Plant Utilisation Report — `/maintenance/utilisation`

**Component file:** `pages/maintenance/PlantUtilisationReportPage.tsx` (helpers in
`utilisation-report-helpers.ts`).

**Purpose:** A read-only report of how hard the fleet is being worked — hours allocated against a
Mon–Fri × 8h availability baseline for a chosen date window, with KPIs, a top-10 bar chart and a
full table.

**Layout & key sections:** A `workers-page__header` with an explanatory subline and a "Back to
maintenance" ghost link. A filter `s7-card` with From / To date inputs (each `min`/`max` constrained
against the other; an invalid range raises an inline error). Then a responsive KPI grid of four
`KpiCard`s (Fleet utilisation %, Assets in window, Hours allocated, Top asset + its rate as a trend),
a `BarChartWidget` ("Top 10 assets by utilisation (%)", Recharts), and a utilisation `s7-table`
(Asset / Category / Hours allocated / Hours available / Utilisation / Allocations; asset names link
to `/assets/{id}`). Summaries and chart data come from `summariseUtilisation` / `buildChartData`.

**Key components / CSS classes:** `KpiCard` and `BarChartWidget` from `@project-ops/ui` (Recharts);
`s7-card`, `s7-table`, `s7-input`. Table cell styling is inline (`cellHeader`/`cellBody` objects).
In the mockup the KPI cards and bar chart are reproduced with lightweight `cdx-kpi` / `cdx-bars`
stand-ins styled to match the real widgets.

**Data sources (endpoints):** `GET /maintenance/assets/utilisation?from={iso}&to={iso}` (refetched
whenever From/To change). Brand teal `--brand-primary` (`#005B61`) is used for bars and links.

**States:** *Loading* — KPI skeletons, a 260px chart skeleton, and table-row skeletons.
*Empty* — `EmptyState` "No utilisation in this window". *Error* — red `tender-page__error` banner;
*invalid range* — a separate inline alert ("From date must be on or before To date").

**Notable interactions:** Fully read-only; the only inputs are the two date pickers which re-run the
query.

Mockup: `mockups/maintenance-utilisation.html`

---

## Forms — `/forms`

**Component file:** `pages/forms/FormsListPage.tsx` (internal `TemplatesTab`, `MySubmissionsTab`,
`ApprovalsTab`, `AnalyticsTab`, `TabButton`, `Card`).

**Purpose:** The forms hub — browse and launch form templates, review your own submissions, action
pending approvals, and (for managers) see a compact analytics summary.

**Layout & key sections:** A plain header ("Forms" + subtitle) over a tab nav (`TabButton`s rendered
as `s7-btn` ghost/secondary). Tabs are permission-gated: everyone sees **Templates** and **My
submissions**; **Pending approvals** requires `forms.approve`; **Analytics** requires `forms.manage`
(or super-user). Tabs carry live counts.
- **Templates** — a search box plus a horizontally-scrolling category filter (pill buttons coloured
  from `CATEGORY_COLOUR`), then a responsive grid of template `s7-card`s. Each card has a 4px
  category colour bar, title, uppercase category pill, clamped description, a "Last submitted:
  {relative}" line, and a full-width orange "Fill out" CTA (`#FEAA6D`).
- **My submissions** — a table (Form / Date / Status / Approval / Actions). Status pills come from a
  bespoke `STATUS_PILL` map (draft/submitted/under_review/approved/rejected). Row actions branch on
  status: drafts → "Continue", rejected → "View" + "Resubmit", else "View".
- **Pending approvals** — a table (Form / Submitted by / Submitted / Due / Actions) with a red left
  border on overdue rows and inline Approve / Reject buttons that open a `CenteredModal` comment box
  (comment required to reject).
- **Analytics** — a stub grid of summary `Card`s (total submissions, drafts, submitted, approved,
  overdue approvals) with a note that full charts are roadmap Phase 5C.

**Key components / CSS classes:** mostly inline styles; `s7-card`, `s7-input`, `s7-btn s7-btn--sm`,
`s7-textarea`; `EmptyState`, `Skeleton`, `CenteredModal` from `@project-ops/ui`. Category palette and
`#FEAA6D` accent are hardcoded.

**Data sources (endpoints):** parallel on load — `GET /forms/templates?page=1&pageSize=100`,
`GET /forms/my-submissions`, and (if approver) `GET /forms/pending-approvals`. "Fill out" POSTs
`POST /forms/submissions {templateId}` then navigates to `/forms/fill/{draftId}`. Approve/Reject hit
`POST /forms/submissions/{id}/approve|reject`. Analytics reads `GET /forms/analytics`. Only
`status === "ACTIVE"` templates are shown.

**States:** *Loading* — skeleton cards (templates) / skeleton block (tables). *Empty* — `EmptyState`
per tab ("No forms match your filters", "No submissions yet", "No pending approvals ✓"). *Error* —
inline red banner (`#FEE2E2`/`#991B1B`).

**Notable interactions:** Tab + category + search are local state; "Fill out" creates a draft server-
side before redirecting; approval decisions refetch all data.

Mockup: `mockups/forms.html` (Templates tab active).

---

## Form Designer — `/forms/designer/:id`

**Component file:** `pages/forms/FormDesignerPage.tsx` (internal `FieldPropertiesEditor`).

**Purpose:** The drag-and-drop form builder — assemble sections and fields, set per-field properties,
add show/hide/require conditional rules, preview, then "Save & publish" as a new template version.

**Layout & key sections:** A `workers-page__header` (back link + "Designer" title) with a "Next: v{n}"
badge, "Preview" and "Save & publish" buttons. Below, the signature three-column `designer-grid`:
- **Palette** (`designer-palette`) — a list of nine field-type chips (`designer-chip`, each with an
  icon glyph): short/long text, number, date, checkbox, dropdown, signature, photo, file. Chips are
  `draggable` and also click-to-add-to-last-section.
- **Canvas** (`designer-canvas`) — editable form title / code / description inputs, then each
  `designer-section` (editable title, remove button, and either a `designer-section__dropzone` or a
  `designer-fields` list). Each `designer-field` shows its type tag, label (+ required asterisk) and
  up/down/delete actions; the selected field gets `--selected`. Sections accept dropped field types
  (`--drag-over` highlight). A "+ Add section" button sits below.
- **Properties** (`designer-properties`) — `FieldPropertiesEditor` for the selected field (label,
  type, placeholder, required toggle, and an options textarea for dropdowns), then a **Conditional
  rules** editor (`designer-rules` / `designer-rule`): source field + operator + value → effect
  (show/hide/require) + target field, with add/remove.

**Key components / CSS classes:** `forms-designer`, `designer-grid`, `designer-palette/__list`,
`designer-chip/__icon`, `designer-canvas`, `designer-title/-subtitle`, `designer-section(__head/
__title/__dropzone/--drag-over)`, `designer-fields`, `designer-field(__type/__label/__required/
__actions/--selected)`, `designer-properties`, `designer-rules/-rule(__row)`, `tender-form__field`.
Preview opens a `slide-over-overlay` / `preview-modal` rendering disabled inputs per field type.

**Data sources (endpoints):** `GET /forms/templates/{templateId}` (loads latest ACTIVE version into
the local draft). "Save & publish" POSTs `POST /forms/templates/{templateId}/versions` with the full
sections/fields/rules payload (status `ACTIVE`), returning the updated template.

**States:** *Loading* — `forms-designer` skeleton. *Error* — `EmptyState` "Could not load template"
with a back CTA; save failures show a `tender-page__error` banner. Empty section → dropzone prompt;
no rules → "No rules yet." text.

**Notable interactions:** Entirely local draft state until publish; drag-and-drop or click to add
fields; reordering/deleting fields renumbers `fieldOrder`; deleting a field also drops any rules that
reference its key.

Mockup: `mockups/forms-designer.html` (a Plant Pre-Start template mid-edit, with a field selected and
one conditional rule).

---

## Form Submit (stepped wizard) — `/forms/submit/:id`

**Component file:** `pages/forms/FormSubmitPage.tsx` (internal `FieldInput`, `SignaturePad`,
`PhotoInput`).

**Purpose:** A section-by-section wizard for filling out a template's active version, ending in a
review step before submitting. This is the simpler/legacy filler (template-driven; see also the
field-engine `FormFillPage`).

**Layout & key sections:** A `form-submit__head` (code · version label + form title + "Cancel"
link), a `form-submit__progress` bar (reusing `jobs-card__progress`), then one `s7-card form-submit__
card` per step. Each non-review step renders its section's visible fields via `FieldInput` (text,
textarea, number, date, checkbox, dropdown, signature canvas, photo/file), with Back / Next (or
"Review →" on the last section). Field visibility is computed locally from the version's rules
(`fieldVisible`). The final step is a "Review your answers" card listing every section as a
`tender-detail__dl` definition list, with Back / Submit.

**Key components / CSS classes:** `form-submit`, `form-submit__head/__progress(-head)/__card/__field/
__label/__help/__sig/__photo`, `jobs-card__progress(-bar)`, `tender-detail__dl`, `s7-input/-select/
-textarea`, `s7-badge`-free. `SignaturePad` is a pointer-drawn `<canvas>`; `PhotoInput` is a file
input with thumbnail preview.

**Data sources (endpoints):** `GET /forms/templates/{templateId}` (resolves the active version).
Submit POSTs `POST /forms/versions/{versionId}/submissions` with `{ status: "SUBMITTED", values }`,
where booleans/numbers/files are normalised into `valueText`/`valueNumber`.

**States:** *Loading* — header + body skeletons. *Error (load)* — `EmptyState` "Could not load
template". *No active version* — `EmptyState`. *Submitted (done)* — `EmptyState` "Submission
received" with a back CTA. Inline `tender-page__error` for submit failures. Per-section "Next" is
disabled until required visible fields are filled (`canNext`).

**Notable interactions:** Local `step` index and `values` map; required-field gating per step;
conditional fields show/hide live as values change.

Mockup: `mockups/forms-submit.html` (first section step shown).

---

## Form Fill (field-engine filler) — `/forms/fill/:id`

**Component file:** `pages/forms/FormFillPage.tsx` (internal `FieldRender`, `FieldInput`,
`SignaturePad`, `PhotoInput`, `SubmittedSuccess`).

**Purpose:** The mobile-first, autosaving form filler driven by the richer rules/field engine. It
operates on an existing draft submission, supports offline use, GPS auto-capture, and a broad set of
field types.

**Layout & key sections:** A largely inline-styled, max-720px column. A **sticky header** with a back
arrow, centred form name, and a save-status indicator ("Saving…" / "✓ Saved" / "⚠ Not saved"), plus a
"Section n of N" label and an orange (`#FEAA6D`) progress bar. An **offline banner** ("📴 Offline —
saved locally…") when `navigator.onLine` is false. A collapsible **Context** `<details>` card
(job / project / supervisor IDs). Then the current section: heading (teal `#005B61`), description, and
visible fields rendered by `FieldInput`. Layout field types (`section_header`, `divider`,
`instructions`) render without label scaffolding. A **sticky footer** holds Previous / Next, with the
last section showing a "Submit" button. The field engine covers many types: short/long text, email,
phone, number, currency, percentage, date/time/datetime, dropdown, multi_select/checkbox, radio,
toggle (custom switch), button_group, rating (stars), system_field (auto), gps, address (street/
suburb/state/postcode), signature, photo/file; unsupported advanced types render an amber fallback
notice.

**Key components / CSS classes:** mostly inline styles + `s7-input`, `s7-textarea`, `s7-card`,
`s7-btn(--ghost/--secondary/--primary/--sm)`. Orange `#FEAA6D`, teal `#005B61`, amber warning
`#FEF3C7`/`#92400E`. Local rules eval (`evalCondition`/`evalGroup`/`fieldVisible`/`fieldRequired`)
mirrors the server `RulesEngineService` for responsive UI; the server remains authoritative.

**Data sources (endpoints):** `GET /forms/submissions/{submissionId}` (loads the draft + template
version). Debounced (700ms) autosave PATCHes `PATCH /forms/submissions/{id}/values` and also writes
to IndexedDB via `FormDraftStore` (offline cache, 30-day purge). Submit POSTs
`POST /forms/submissions/{id}/submit` with `{ gpsLat, gpsLng }`; a 422 surfaces field errors or
compliance failures. On success the local draft is deleted.

**States:** *Loading* — plain "Loading…" text. *Error (load)* — message + back link. *Offline* —
yellow banner; saves go local-only until reconnect (then flushed). *Submitted* — full-screen
`SubmittedSuccess` (green tick, reference id, list of triggered records, "Done" → `/forms`).
Per-section validation blocks Next; full validation runs on Submit and jumps to the first errored
section.

**Notable interactions:** Continuous autosave (server + IndexedDB), GPS captured once on mount,
online/offline event tracking, signature canvas, multi-photo capture stored as base64. **State note:**
section progression is explicit `sectionIndex` state, not derived.

Mockup: `mockups/forms-fill.html` (section 2 of 4 of an Excavation SWMS, online + saved, with a mix of
field types).

---

## Form Submission Detail — `/forms/submissions/:id`

**Component file:** `pages/forms/FormSubmissionDetailPage.tsx` (internal `Info`, `FieldRow`,
`renderValue`).

**Purpose:** The read-only record of a completed (or in-flight) submission — status, metadata,
captured values per section, any records it triggered, the approval chain, and a PDF / resubmit
action bar.

**Layout & key sections:** A back link, then a **status banner** (`STATUS_BANNER` map; submitted/
under_review/approved/rejected each get bespoke bg/fg, and a rejection shows the reviewer comment). A
**meta card** (`s7-card`): form name, version, truncated reference, and an `Info` grid (submitted by,
submitted at, optional job/project context, optional GPS). Then one **section value card** per
template section — a teal-underlined heading and a definition-list (`<dl>`) of label → value, where
`renderValue` formats by field type (toggle Yes/No, rating stars, dates, signature image,
photo/file thumbnails/links, address join, multi-select join). Empty values are skipped. Optional
**Triggered records** card ("This submission created …"). Optional **Approval chain** card — an
ordered list of steps (approved/rejected/pending with names, timestamps, comments) and, if the viewer
can decide, inline Approve / Reject buttons opening a `CenteredModal`. An **action bar** with
"Download PDF" (links to `/api/v1/forms/submissions/{id}/pdf`) and, for the owner of a rejected
submission, a "Resubmit" button.

**Key components / CSS classes:** mostly inline styles; `s7-card`, `s7-btn(--ghost/--secondary/
--primary/--sm)`, `s7-textarea`, `CenteredModal` from `@project-ops/ui`. Teal `#005B61` section
headings; green `#16A34A` / red `#DC2626` decision buttons; orange `#FEAA6D` resubmit.

**Data sources (endpoints):** `GET /forms/submissions/{id}`. Approve/Reject POST
`POST /forms/submissions/{id}/approve|reject` with an optional/required comment, then reload. PDF is a
direct link; "Resubmit" navigates to `/forms/fill/{id}`.

**States:** *Loading* — plain "Loading…" text. *Error* — message + back link. The status banner and
section cards only appear once the submission resolves; sections/fields with no value are omitted.
Approve/Reject are gated by `forms.approve` (or super-user) and assignment.

**Notable interactions:** Decision modal requires a comment to reject; "Resubmit" only for the owner
of a rejected submission.

Mockup: `mockups/forms-submission-detail.html` (a submitted SWMS awaiting step-2 approval, with a
triggered permit and a partially-complete approval chain).
