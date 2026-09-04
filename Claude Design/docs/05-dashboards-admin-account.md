# Dashboards, Admin & Account

> ⚠️ **SNAPSHOT — describes the UI as at 2026-06-26.** Screens changed since then are not
> reflected here. Regeneration is tracked in `Claude Design/proposed/README.md`. Do not cite this
> document as the current design without checking it against the running app.

This section documents the dashboard, system-administration, and personal-account surfaces of the Initial Services — ProjectOperations ERP. Each page below maps a live React component to a faithful static mockup. Routes, class names, and data sources are taken directly from the component source under `apps/web/src/`. Sample data reflects the South-East-Queensland civil/construction business context (Brisbane City Council, TMR Queensland, Urban Utilities, Redland City Council; AUD; dd/mm/yyyy dates) and the seeded role set (Admin / Estimator / Supervisor / Field Worker).

A recurring structural note: this module is stylistically split into three families. The **dashboards** (`/`, `/dashboards/:id`) share one polished `td-v2` / `td-canvas` widget-grid component. The **newer admin pages** (Settings, Estimate Rates, AI Settings, Platform's AI block) lean on `s7-card` / `s7-btn` / `s7-badge` plus heavy inline styling and a custom 200px left sub-nav pattern. The **older admin pages** (Users, Roles, Permissions, Audit, Notifications) are built on the legacy `AppCard` + `admin-grid` / `crm-page` + `data-table` + `pill` primitives. That three-way inconsistency — especially the left-nav vs. tab-strip vs. AppCard divergence — is the primary redesign opportunity across the module.

---

## Operations Overview — `/`

**Component file:** `apps/web/src/pages/DashboardPlaceholderPage.tsx` (renders `dashboards/DashboardCanvas.tsx`)

**Purpose:** The application landing page — the company-wide operations dashboard. It is a thin wrapper that mounts `DashboardCanvas` in `mode="by-slug"` against the `"operations"` slug with a hard-coded `DEFAULT_OPERATIONS_CONFIG` (4 KPIs + 5 chart widgets). If no dashboard exists for the slug yet, the canvas auto-creates one from that default config on first load.

**Layout & key sections:** A `td-v2` root. `td-v2__header` is a spread row: left holds the `s7-type-label` eyebrow ("Dashboard") and the dashboard name as an `s7-type-page-title`; right holds "+ Add widget" and "Customise" `s7-btn s7-btn--secondary s7-btn--sm` buttons. Below is the `td-canvas__widgets` grid — a 4-column responsive grid where each widget is a `td-canvas__slot` whose `grid-column: span N` is driven by the widget's resolved col-span. The seeded operations layout: row 1 is four span-1 KPI tiles (Active jobs, Tender pipeline value, Open issues, Upcoming maintenance); the remaining widgets are span-2 (half-width) charts — Jobs-by-status donut, Tender-pipeline-by-stage donut, Monthly-revenue line, Form-submissions bar, Upcoming-maintenance bar.

**Key components / CSS classes:** `td-v2`, `td-v2__header`, `td-canvas__widgets`, `td-canvas__slot`, `s7-card`, `s7-type-label`, `s7-type-section-heading`, `s7-badge`. KPI tiles are `s7-card`s with a label + large value + muted subline. Each chart widget is its own component from `dashboards/widgets/*` (registered in `widgetRegistry.ts`) and renders a **Recharts** donut / line / bar inside an `s7-card`. In the mockup, every chart is a static placeholder (CSS conic-gradient donut, flexbox bars, or a hatched `.chart-ph` block) and the real ones are Recharts widgets.

**Data sources (endpoints):** `GET /user-dashboards?slug=operations` (load list for slug); `POST /user-dashboards` (auto-create default if none exist). Each widget component fetches its own analytics endpoint independently (e.g. job-status counts, tender pipeline, form submissions, maintenance plans) — the canvas itself only persists layout/config.

**States:** Loading → the canvas renders a full-width `Skeleton` (200px) until `active` resolves. Empty (dashboard exists but all widgets hidden) → `EmptyState` "No widgets enabled" with a Customise CTA. Error → a red-bordered `s7-card` alert at the top. Each widget additionally manages its own loading/empty/error inside its card.

**Notable interactions:** This route is read-mostly for end users but still fully interactive: "Customise" opens the `CustomisePanel`, "+ Add widget" opens `CustomWidgetBuilderModal`, widgets are drag-reorderable (`@dnd-kit`) and edge-resizable, and each carries a period-override pill — see the custom-dashboard page below for those mechanics.

Mockup: `mockups/dashboard-operations.html`

---

## My Dashboard — `/dashboards/:id`

**Component file:** `apps/web/src/pages/dashboards/UserDashboardPage.tsx` (renders `dashboards/DashboardCanvas.tsx` in `mode="by-id"`)

**Purpose:** A user-built / user-owned dashboard loaded by id rather than by slug. Same `DashboardCanvas` engine as the operations dashboard, but here the title is click-to-rename, the `DashboardSwitcher` lets the user hop between their dashboards, and the full customise/build/drag/resize toolkit is the point of the page.

**Layout & key sections:** Identical `td-v2` / `td-canvas__widgets` shell. The header differs: the title is an `InlineDashboardName` (click the `s7-type-page-title` to edit inline — Enter saves, Escape cancels, blur saves), a `DashboardSwitcher` `s7-select` sits beside it, and a transient "Saving…" hint appears during the 500ms-debounced auto-save. Each `td-canvas__slot` carries a `td-canvas__slot-chrome` overlay in its top-right: a **period-override pill** (`<select>` — orange `#FEAA6D` when the widget overrides the dashboard period, muted grey when inheriting), an optional **settings gear** (only when the widget has a `configSchema`/`fieldSchema`), and a **drag handle**. Slots also expose three resize affordances (`td-canvas__resize--col/--row/--corner`) and show a `td-canvas__resize-ghost` "C × R" preview while dragging.

**Key components / CSS classes:** `td-v2`, `td-canvas__widgets`, `td-canvas__slot(--dragging/--over)`, `td-canvas__slot-chrome`, `td-canvas__slot-icon(--drag)`, `td-canvas__resize(--col/--row/--corner)`, `td-canvas__resize-ghost`, `s7-card`, `s7-btn--secondary--sm`. Supporting components: `CustomisePanel` (toggle widgets on/off + reorder), `CustomWidgetBuilderModal` (build a user widget: data source + metric + chart type, stored as the `CUSTOM_WIDGET_TYPE` widget), `WidgetSettingsPopover` (per-widget filters/fields), `DashboardSwitcher`, `WIDGET_BY_TYPE` registry. Layout is a 4-column grid; col/row spans come from `resolveSpan(meta, entry)` clamped to each widget's min/max.

**Data sources (endpoints):** `GET /user-dashboards/:id` (load one); `PATCH /user-dashboards/:id` (persist config and/or name — debounced auto-save; name changes save immediately). Reorder, resize, widget add, period override, and widget settings all funnel through that single PATCH. Individual widgets fetch their own analytics endpoints as on the operations dashboard.

**States:** Loading / not-yet-resolved → full-width `Skeleton`. Not found → the by-id loader throws "Dashboard not found." surfaced as the red `s7-card` alert. Empty (all widgets hidden) → `EmptyState` "No widgets enabled" + Customise CTA. Save failure → error alert; otherwise the "Saving…" hint flips on/off.

**Notable interactions:** Inline rename; dashboard switching; drag-to-reorder (`DndContext` + `SortableContext`, `arrayMove` re-indexes `order`); pointer-driven edge resize that snaps to grid columns/rows; per-widget period override and settings popover; auto-save debounce (with name changes bypassing the debounce). A documented gotcha (PR #391): widget filter + field writes are merged in a single PATCH to avoid a React-18 stale-closure race.

Mockup: `mockups/dashboard-custom.html`

---

## Admin Settings — `/admin/settings`

**Component file:** `apps/web/src/pages/AdminSettingsPage.tsx` (with `pages/admin/AdminUsersTab.tsx` and `AdminRolesPermissionsTab.tsx`)

**Purpose:** The consolidated system-configuration console. Admin-only (`isAdmin` check; non-admins `<Navigate to="/" />`). One page, seven sub-sections selected from a left rail: Notifications, Email, Users, AI & Integrations, Platform, Permissions, Audit log.

**Layout & key sections:** A plain `padding:24px; max-width:1200px` page (no `s7`/`admin-page` wrapper) with `s7-type-page-heading` + muted subline. Below, a CSS grid `200px 1fr`: a left `nav` of seven hand-styled tab buttons (active = teal `#005B61` text, teal left-border, `rgba(0,91,97,0.08)` background) and a content panel. **Notifications** (default tab) renders two `s7-card`s — "Enabled triggers" and a dimmed "Disabled triggers" — each containing `TriggerRow`s. A `TriggerRow` is a custom `ToggleSwitch` (orange when on) + label/description; when enabled it expands to a delivery-method segmented control (Both / Email only / In-app only, orange active segment) and a role-grouped recipient tree built from `<details>`/checkboxes with indeterminate states. **Email** tab is a single `s7-card`: provider buttons (Microsoft 365 active, Gmail "Coming soon" disabled), sender-address / sender-name `s7-input`s, Save + Test connection, and a `Mail.Send`-permission warning banner. **Users** delegates to `AdminUsersTab`; **Permissions** to `AdminRolesPermissionsTab`; **AI & Integrations** and **Platform** render `IntegrationTab` cards that deep-link to `/admin/platform`, plus a `SharePointTestPanel` and a `XeroPanel` (Connect / Sync all clients / Disconnect). **Audit** is a "Coming soon" `StubCard`.

**Key components / CSS classes:** `s7-card`, `s7-type-section-heading`, `s7-input`, `s7-btn--primary/--ghost`, `estimate-editor__field`, bespoke `ToggleSwitch` and delivery segmented control, native `<details>` recipient tree. The left rail and toggles are entirely inline-styled — not design-system components.

**Data sources (endpoints):** `GET /admin/settings/notifications` + `GET /admin/settings/users` (notifications tab); `PATCH /admin/settings/notifications/:trigger` (toggle/delivery/recipients). `GET /admin/settings/email`, `PATCH /admin/settings/email`, `GET /admin/settings/email/test`. `GET /sharepoint/test`. Xero: `GET /xero/status`, `GET /xero/connect`, `POST /xero/disconnect`, `POST /xero/contacts/sync-all`.

**States:** Per-tab "Loading…" muted text. Notifications: empty enabled/disabled lists show "No triggers enabled." / "All triggers are enabled."; a transient "✓ Saved" flash per row (1.5s). Email: red error text; success/failure test banner; conditional Mail.Send banner. SharePoint/Xero panels show inline status chips and error lines.

**Notable interactions:** Tab switching is local state only. Each notification trigger PATCHes independently and optimistically updates. Xero connect opens an OAuth consent window in a new tab; disconnect and sync-all use `window.confirm`. The Audit tab is intentionally a stub (the real register lives at `/admin/audit`).

Mockup: `mockups/admin-settings.html`

---

## Estimate Rates — `/admin/estimate-rates`

**Component file:** `apps/web/src/pages/EstimateRatesAdminPage.tsx`

**Purpose:** The company-wide locked rate library that feeds the estimate editor — labour, plant, disposal, saw-cutting, core-holes, fuel, enclosures, miscellaneous, and material densities. Rates are *snapshotted* per submitted quote, so editing here never alters historical quotes.

**Layout & key sections:** An `admin-page` wrapper. `admin-page__header` carries a "Tendering" eyebrow, `s7-type-page-title` ("Estimate rate library"), and a subline. Below, `admin-page__tabs` is a 9-tab tablist whose labels include live counts (e.g. "Labour (6)"). A spread row holds a search `s7-input` (per-tab search state) and an "N of M entries" counter. The body is one `s7-card` containing a `RatesTable`: an `admin-page__add-row` of `s7-input`s + "Add" button (only with `estimates.admin`), then an `admin-page__table` whose rows are `EditableRateRow`s. Several tabs (Saw Cutting, Core holes, Other rates, Densities) prepend an explanatory note about multipliers/usage. A **sticky footer** carries the rate-snapshot disclaimer.

**Key components / CSS classes:** `admin-page`, `admin-page__header`, `admin-page__tabs`, `admin-page__tab(--active)`, `admin-page__add-row`, `admin-page__table`, `rates-row(--editing)`, `s7-card`, `s7-input(--sm)`, `s7-btn--primary--sm`, `EmptyState`, `Skeleton`. Currency cells render via an `en-AU` AUD formatter. Rows are click-to-edit: clicking a cell enters edit mode and (LL-27) synchronously focuses the *clicked* cell's input; Enter commits, Escape cancels, blur outside the row commits; a per-row × delete button confirms via `window.confirm`.

**Data sources (endpoints):** On load, nine parallel GETs: `/estimate-rates/labour`, `/plant`, `/waste`, `/cutting`, `/core-holes`, `/fuel`, `/enclosure`, `/other-rates`, `/material-densities`. Mutations per table base path: `POST {basePath}` (add), `PATCH {basePath}/:id` (edit), `DELETE {basePath}/:id` (delete) — each followed by a full reload.

**States:** No view permission (`estimates.view`/`estimates.admin`) → `EmptyState` "Not authorised". Loading → `s7-card` + `Skeleton`. Error → red-bordered `s7-card` alert. Empty/filtered-empty per tab → `EmptyState` "No rates match". Read-only viewers see the tables without the add-row or delete buttons.

**Notable interactions:** Per-tab independent search; inline cell editing with careful focus management; add-row clears on submit; all writes optimistic-reload. The snapshot footer is `position: sticky`.

Mockup: `mockups/admin-estimate-rates.html`

---

## AI Settings — `/admin/ai-settings`

**Component file:** `apps/web/src/personas/pages/AiSettingsPage.tsx` (with `CompanySettingsTab.tsx`, `MySettingsTab.tsx`, `ProviderKeyManager.tsx`)

**Purpose:** Configure the AI persona system — which providers the company allows, whether users may add personal instructions or bring their own keys (BYOK), per-persona company instructions, and each user's personal persona preferences. Access and tab visibility are gated by `isSuperUser` + permissions (`canViewAiSettingsPage`, `canViewCompanyTab`).

**Layout & key sections:** A `padding:24px; max-width:1200px` page with `s7-type-page-heading` + subline. For super-users, a `200px 1fr` grid with the same hand-styled left-rail pattern as Admin Settings, but only two items: **Company** and **My Settings**. Non-super-users skip the rail and see only `MySettingsTab` (max-width 1000px); users with no AI access at all get a single info card ("AI features are not enabled for your account"). **Company tab** (`CompanySettingsTab`): `Section` blocks for Provider Access (checkbox list; Anthropic locked-on), User Customisation (two toggles + Save), Personas (a `PersonaInstructionEditor` per persona — a card with a monospace company-instruction `textarea` and Save), and `ProviderKeyManager` scope="company". **My Settings tab** (`MySettingsTab`): an optional `ProviderKeyManager` scope="me" (BYOK, only if allowed), then a `PersonaSettingsCard` per persona — provider-override `<select>`, a read-only company-instruction box, and (if allowed) a personal-instruction `textarea`.

**Key components / CSS classes:** Mostly bespoke inline styles plus `s7-type-page-heading`. Section headings use the `'Syne'/'Outfit'` display font. Cards are inline-styled `surface-card` boxes (not `s7-card`). Buttons use a local teal `primaryButtonStyle`. `ProviderKeyManager` is shared between scopes. Toasts are fixed bottom-right teal banners (2.4s).

**Data sources (endpoints):** `GET /personas` (persona list) and `GET /personas/global-settings` (provider/feature flags) on both tabs. Company tab: `PUT /personas/global-settings`; per persona `GET /personas/:slug` then `PUT /personas/:slug/company-instruction`. My tab: per persona `GET /personas/:slug` + `GET /personas/:slug/my-settings`, then `PUT /personas/:slug/my-settings`. `ProviderKeyManager` manages provider keys under its own scope-specific endpoints (validated live, encrypted AES-256-GCM at rest).

**States:** Per-component "Loading…" muted text; a `LoadError` row with Retry on failed global/persona loads. My-settings BYOK section shows a "disabled by your administrator" card when BYOK is off. Save buttons are disabled until a field is dirty. Empty persona list → "You don't have any AI personas assigned yet."

**Notable interactions:** Dirty-tracking gates every Save; the personal-instruction field is omitted from the My-settings PUT entirely when the global toggle is off (undefined = don't touch, null = clear — PR #118). Provider override defaults to "Use system default (Anthropic)".

Mockup: `mockups/admin-ai-settings.html`

---

## Users — `/admin/users`

**Component file:** `apps/web/src/pages/UsersPage.tsx`

**Purpose:** Application user administration for the local-auth phase — list users with status/roles and create new ones.

**Layout & key sections:** An `admin-grid` of two `AppCard`s. **Users** card: a `module-summary-grid` of three tiles (Total users / Active users / Available roles), then a `table-shell table-shell--capped` wrapping a `data-table` (Name / Email / Status / Roles). Status renders as a `pill pill--green` (Active) or `pill pill--amber` (Inactive); roles are a comma-joined list. **Add User** card: an `admin-form` with Email, First name, Last name, Password, and a single-select Role dropdown, plus a Create User submit.

**Key components / CSS classes:** `AppCard` (legacy titled card — represented as `s7-card` + header in the mockup), `admin-grid`, `module-summary-grid`, `module-summary-card`, `table-shell(--capped)`, `data-table`, `pill(--green/--amber)`, `admin-form`. This page predates the `s7-*` primitives and uses raw `<input>`/`<select>`/`<button>` elements styled by `admin-form`.

**Data sources (endpoints):** `GET /users` and `GET /roles` in parallel on load (both paginated — `.items`). `POST /users` (create) then reload.

**States:** Load failure → `error-text` paragraph in the Users card. Empty list → `module-empty-state` "No users have been created yet." The Create button shows "Saving..." while posting and clears the form on success.

**Notable interactions:** Single role selection only (the form holds a `roleIds` array but the select sets one). No edit/deactivate from this page in the current source — it is create + review.

Mockup: `mockups/admin-users.html`

---

## Roles — `/admin/roles`

**Component file:** `apps/web/src/pages/RolesPage.tsx`

**Purpose:** Manage reusable permission bundles — list roles with their permission codes and create new roles by name/description/permission set.

**Layout & key sections:** An `admin-grid` of two `AppCard`s. **Roles** card: a `module-summary-grid` (Total roles / Available permissions / Largest permission set), then a `table-shell--capped` `data-table` (Role / Description / Permissions — the last is a comma-joined list of permission codes). **Create Role** card: an `admin-form` with Name, Description, and a **multi-select** Permissions list, plus a Create Role submit.

**Key components / CSS classes:** `AppCard`, `admin-grid`, `module-summary-grid`, `module-summary-card`, `table-shell--capped`, `data-table`, `admin-form`, native `<select multiple>`. Same legacy styling family as Users.

**Data sources (endpoints):** `GET /roles` (paginated, `.items`) + `GET /permissions` (flat array) in parallel. `POST /roles` (create) then reload.

**States:** Error → `error-text` in the Roles card. Empty list → `module-empty-state` "No roles have been created yet." The permission multi-select reads selected option values into `permissionIds`.

**Notable interactions:** Multi-select drives the permission set; no per-row edit in the current source. Roles created here become assignable on the Users page.

Mockup: `mockups/admin-roles.html`

---

## Permissions — `/admin/permissions`

**Component file:** `apps/web/src/pages/PermissionsPage.tsx`

**Purpose:** A read-only registry of every application permission code, grouped conceptually by module, for role design and review. No mutations.

**Layout & key sections:** A two-column `crm-page crm-page--operations` layout. The `crm-page__sidebar` holds a "Permission pulse" `AppCard` with a `module-summary-grid` of three derived tiles (Total permission codes / Covered modules / Longest code length). The `crm-page__main` holds a "Permission Registry" `AppCard`: a `module-table-intro` blurb (`muted-text`) over a `table-shell--capped` `data-table` (Code / Module / Description), intentionally dense for fast scanning.

**Key components / CSS classes:** `AppCard`, `crm-page(__sidebar/__main)`, `module-summary-grid`, `module-summary-card`, `module-table-intro`, `muted-text`, `table-shell--capped`, `data-table`, `module-empty-state`.

**Data sources (endpoints):** `GET /permissions` (flat array). Summary counts are derived client-side (`useMemo`) — module set size and longest code length.

**States:** Fetch failure → silently sets an empty list. Empty → `module-empty-state` "No permissions are registered yet." No loading skeleton.

**Notable interactions:** None — this is a pure reference table. Roles (above) consume these codes.

Mockup: `mockups/admin-permissions.html`

---

## Audit Logs — `/admin/audit`

**Component file:** `apps/web/src/pages/AuditLogsPage.tsx`

**Purpose:** The security/admin write-history register — authentication events, admin changes, and operational writes, attributed to a user or to "System".

**Layout & key sections:** Same two-column `crm-page crm-page--operations` shell as Permissions. Sidebar "Audit pulse" `AppCard` with a `module-summary-grid` (Total audit entries / Recorded today / User-attributed entries — all derived). Main "Audit Logs" `AppCard` with a `muted-text` intro over a `table-shell--capped` `data-table` (When / Actor / Action / Entity). Actor is the actor's full name or "System"; Entity is `entityType (entityId)`.

**Key components / CSS classes:** `AppCard`, `crm-page(__sidebar/__main)`, `module-summary-grid`, `module-table-intro`, `muted-text`, `table-shell--capped`, `data-table`, `module-empty-state`. Timestamps render via `toLocaleString()`.

**Data sources (endpoints):** `GET /audit-logs` (paginated, `.items`). "Today" and "user-attributed" counts derived client-side.

**States:** Fetch failure → empty list. Empty → `module-empty-state` "No audit entries have been recorded yet." No loading skeleton; no filtering/pagination UI in the current source.

**Notable interactions:** None beyond reading. Note this is the *real* audit register; the Admin Settings "Audit log" tab is a separate "Coming soon" stub.

Mockup: `mockups/admin-audit.html`

---

## Platform — `/admin/platform`

**Component file:** `apps/web/src/pages/PlatformPage.tsx`

**Purpose:** The SharePoint + AI-provider integration console. Configure the preferred AI provider and per-provider API keys/models with live connection tests, inspect SharePoint configuration and tracked folders, and ensure/create folders.

**Layout & key sections:** An `admin-grid` of three `AppCard`s plus a floating toast. **AI & Integrations** card: an active-provider banner (`s7-badge`, green when a real provider is live, amber for mock fallback), a pill selector for the preferred provider (Auto / Claude / Gemini / Groq / OpenAI — orange active pill), then a block per provider (`PROVIDERS` list) with a Connected/Not-configured/In-use `s7-badge` row, a masked-key + Update key + Test connection row, a model `s7-input` with a "Fetch available models" button and hint chips, and a result line; the card ends with a SharePoint mode block. **Platform Configuration** card: a `notice-banner`, a `module-summary-grid` (SharePoint mode / Tracked folders / Root folder), a `detail-list` `<dl>` (mode / site ID / library ID / root folder), and a `data-table` of tracked folders (Module / Name / Relative path). **Ensure Folder** card: an `admin-form` (Name / Relative path / Module) + Ensure Folder.

**Key components / CSS classes:** `AppCard`, `admin-grid`, `s7-badge`, `s7-btn(--secondary/--ghost/--sm)`, `s7-input`, `module-summary-grid`, `detail-list`, `notice-banner`, `data-table`, `module-empty-state`, `admin-form`, plus heavy inline styling for the provider blocks, hint chips, model dropdown, and the fixed teal toast. This card mixes `s7-*` primitives with legacy `AppCard`/`admin-form`.

**Data sources (endpoints):** Load: `GET /platform/config`, `GET /sharepoint/folders`, `GET /admin/platform-config` (provider statuses). Mutations: `PATCH /admin/platform-config` (save key / save model / set preferred provider); `POST {provider.testEndpoint}` e.g. `/admin/platform-config/test-anthropic` (connection test); `GET /admin/ai-providers/:key/models` (fetch models); `POST /sharepoint/folders/ensure` (ensure folder).

**States:** Load error → `error-text` in the Platform Configuration card. Empty folders → `module-empty-state` "No SharePoint folders have been tracked yet." Per-provider inline test results (green/red); a 3s auto-dismiss toast confirms model saves and model-fetch failures. Test/Fetch buttons disable while busy or when the provider is unconfigured.

**Notable interactions:** Preferred-provider pills PATCH immediately; key editing toggles a masked → password-input flow with Show/Hide; model field saves on blur; "Fetch available models" lists clickable model names; SharePoint mode is env-driven (read-only here).

Mockup: `mockups/admin-platform.html`

---

## My Account — `/account`

**Component file:** `apps/web/src/pages/account/UserProfilePage.tsx` (with `account/GlobalListsSection.tsx`)

**Purpose:** The personal account page. After PR #132 it is deliberately lean: identity line, the shared global-lookup lists (admin-editable, otherwise read-only), and a pointer to where notification preferences are actually managed. Personal AI keys were moved off this page to `/admin/ai-settings`.

**Layout & key sections:** A narrow `padding:24px; max-width:980px` page. `s7-type-page-heading` ("My account") + a "Signed in as **Name** · email" line. Then `GlobalListsSection` (passed `isAdmin`) — the shared lookup-list manager, shown read-only for non-admins. Finally a "Notification preferences" `s7-card` that is purely informational, directing the user to **Admin → Settings** and explaining that they auto-receive any trigger naming them or their role.

**Key components / CSS classes:** `s7-card`, `s7-type-page-heading`, `s7-type-section-heading`, plus `GlobalListsSection`'s own internal markup. Minimal page-level styling.

**Data sources (endpoints):** The page itself reads `user` from `AuthContext` (no fetch). `GlobalListsSection` fetches and (for admins) mutates the global lookup lists via its own endpoints.

**States:** If `user` is null the identity line is omitted. The notification-preferences card is static. Loading/empty/error states live inside `GlobalListsSection`.

**Notable interactions:** For non-admins this is essentially a read-only profile. Admins can edit the global lists in-place. No avatar, password-change, or personal-AI-key controls on this page in the current source.

Mockup: `mockups/account.html`

---

## Notifications — `/notifications`

**Component file:** `apps/web/src/pages/NotificationsPage.tsx`

**Purpose:** The notification & operational-follow-up workspace. A left rail surfaces *live planning prompts* derived from current job/scheduler state (blocked jobs, awaiting hold points, etc.) with triage and reassignment controls; the main column is the plain platform-notification inbox.

**Layout & key sections:** A two-column `crm-page crm-page--operations` layout. **Sidebar** "Operational Follow-ups" `AppCard`: a `tab-row` scope filter (All / Assigned to me / Team follow-up / Manual assignments), a dense `tendering-focus-list--activity` pulse grid of ~12 counts (blocked/warning/low, assigned-to-me, team, urgent-today, due-soon, handling-it, watch, manual, shift-lead, activity-owner), `inline-fields` of owner-count and triaged-today pills, then a capped `dashboard-list` of prompt cards. Each prompt card has a `split-header` (title + severity pill), a body, an `inline-fields` row of pills (urgency, audience, owner-role, next-owner, triage-state), a context sentence, an action-button row (Open job / Open documents, I'm handling this, Watch only, Reset), and an assignment row (owner `<select>` + Reassign, plus Resolve / Accept handoff / Accept escalation for manual prompts). A "Recent triage activity" subsection follows. **Main** "Notification Inbox" `AppCard`: total/unread `pill`s and a `data-table` (Title / Body / Severity / Status) where clicking a row marks it read.

**Key components / CSS classes:** `AppCard`, `crm-page(__sidebar/__main)`, `tab-row`, `tab-button(--active)`, `tendering-focus-list(--activity)`, `tendering-focus-list__item`, `dashboard-list(--capped)`, `split-header`, `inline-fields`, `pill(--red/--amber/--blue/--green/--slate)`, `subsection`, `table-shell`, `data-table`, `muted-text`. Severity/urgency/owner-role each map to a pill colour via helper functions. Entirely legacy-styled (no `s7-*`).

**Data sources (endpoints):** Load: `GET /notifications/me`, `GET /notifications/follow-ups/shared`, `GET /users?page=1&pageSize=100` (assignable users). Mutations: `PATCH /notifications/:id/read`; follow-up triage `PATCH /notifications/follow-ups/:id/triage`; reassign `…/assign`; manual prompt `…/resolve`, `…/accept-handoff`, `…/accept-escalation` — each followed by a refetch of the shared follow-ups.

**States:** Failed loads degrade gracefully to empty arrays per dataset. No live prompts → "No live planning prompts are surfacing right now." No platform notifications → "No platform notifications yet. Live planning prompts are still available in the follow-up rail." Recent-triage subsection only renders when non-empty.

**Notable interactions:** Scope tabs filter the prompt list client-side; prompts are sorted by a multi-factor priority score (mine-boost, recent-manual-assignment boost, triage state, urgency, severity, dependency-wait penalty). Triage buttons set Acknowledged/Watch/Open; reassignment drafts a new owner then PATCHes; manual handoffs/escalations show Accept buttons only to the targeted owner. Inbox rows mark-read on click and navigate (job/documents) via router state.

Mockup: `mockups/notifications.html`

---

## Page Not Found — `*`

**Component file:** `apps/web/src/pages/NotFoundPage.tsx`

**Purpose:** The catch-all route when no other route matches. It deliberately replaced an earlier silent `<Navigate to="/" />` redirect that masked broken routes (e.g. an `/admin/ai-settings` typo appearing as a navigate-to-overview bug during PR #120 smoke).

**Layout & key sections:** A single centred `role="main"` flex column (min-height 60vh): a 72px circular "404" badge, a "Page not found" heading, a paragraph echoing the attempted path inside a `<code>` chip (`location.pathname`), and a brand-primary "Back to dashboard" `<Link to="/">` sized to a 44×44 minimum touch target.

**Key components / CSS classes:** No design-system classes — entirely inline-styled with CSS variables (`--border-subtle`, `--text-primary/-secondary`, `--brand-primary`, `--radius-md`). React-Router `Link` + `useLocation`.

**Data sources (endpoints):** None.

**States:** Single static state; the only dynamic content is the echoed `location.pathname`.

**Notable interactions:** The single "Back to dashboard" link returns the user to `/`.

Mockup: `mockups/not-found.html`
