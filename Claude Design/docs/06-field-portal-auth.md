# Field, Portal & Auth surfaces

> ⚠️ **SNAPSHOT — describes the UI as at 2026-06-26.** Screens changed since then are not
> reflected here. Regeneration is tracked in `Claude Design/proposed/README.md`. Do not cite this
> document as the current design without checking it against the running app.

This batch covers three distinct surfaces of the Initial Services — ProjectOperations
platform that sit outside the main desktop ERP shell: the **mobile field/crew app**
(`/field/*`), the **client portal** (`/portal/*`), and the **authentication** screens
(`/login`, `/portal/login`, `/portal/accept-invite`).

Each surface has its own React layout and its own auth context. In the mockups, the
`data-surface` attribute on `<body>` tells `chrome.js` which chrome to inject:
`field` → mobile phone frame + black bottom tab bar; `portal` → teal client-portal
header + top nav; `auth` → no chrome (the card is centred by the page itself).

> **How these surfaces differ from the desktop app.** The field app uses a separate
> `FieldLayout` tuned for slow mobile connections (sticky white header, bottom tab bar,
> 44×44px touch targets) and is wired into an **offline subsystem** (`OfflineContext`,
> `DeadLetterBanner`, and a `drafts` module / `useFormDraft` hook) so partly-filled
> forms survive tab-switches and reloads and failed syncs surface a dead-letter banner;
> the desktop app has none of this. The client portal runs on an **entirely separate
> auth context** — `PortalAuthContext` / `usePortalAuth()` with its own
> `authFetch`, login, `acceptInvite`, and `logout` — so portal users are never mixed
> with staff `AuthContext` sessions, and every portal endpoint is namespaced under
> `/portal/client/*`. The staff `/login` page additionally supports an optional M365
> SSO redirect path (MSAL) that the portal login deliberately does not.

---

## Field (mobile crew app)

All field pages render inside `FieldLayout` (`layouts/FieldLayout.tsx`): a sticky white
top header showing an `IS` logo tile + the page title, a notifications bell and a
sign-out button (each a 44×44 target), and a fixed black bottom navigation bar with five
tabs — Home (`/field/allocations`), Pre-Start, Timesheet, Documents, Safety. The active
tab turns teal (`#005B61`) with a 3px top border. Data is fetched through the staff
`useAuth().authFetch`. The layout defines the shared `.field-*` CSS helper classes
(`field-card`, `field-btn`, `field-btn--ghost`, `field-btn--teal`, `field-pill`,
`field-input`, `field-label`) inline; these are reproduced in `mockup-extras.css` so the
mockups render authentically. Brand palette: teal `#005B61`, orange CTA `#FEAA6D`,
page background `#F6F6F6`.

### My Jobs — `/field/allocations`

- **Component file:** `pages/field/FieldAllocationsPage.tsx`
- **Purpose:** The crew member's landing screen — a single-column list of their active
  job allocations, each a launchpad to that job's pre-start and timesheet.
- **Layout & key sections:** One `field-card` per allocation. Each card shows the
  project number (muted), the project name (large Syne heading), a status pill
  (`Mobilising` neutral / `Active` teal via the `STATUS_COLOUR` map), a tappable
  Google-Maps address link (`📍`), optional role line, the start–end date range
  (`formatDate` → "Ongoing" when no end), scope-code pills, and a Project Manager block
  (name + tappable `tel:` link). Footer: a two-up grid of **Pre-Start** and **Timesheet**
  buttons that deep-link with `?allocationId=` so the target page opens straight into its
  "new" view for that job.
- **Key components/CSS classes:** `field-card`, `field-pill`, `field-btn`;
  `EmptyState` and `Skeleton` from `@project-ops/ui`.
- **Data sources:** `GET /field/my-allocations`.
- **States:** Skeleton (two 120px placeholders) while `allocations === null`; a
  dedicated **403 "Mobile access not provisioned"** empty state (lock icon + "Back to
  web view" button) when the user has no linked worker profile; a generic error empty
  state for other failures; an empty state ("No active job allocations") for an empty
  list; populated otherwise.
- **Notable interactions:** Address opens Google Maps in a new tab; PM phone uses
  `tel:`; the two buttons navigate within the field surface carrying the allocation id.
- Mockup: `mockups/field-allocations.html`

### Pre-Start — `/field/pre-start`

- **Component file:** `pages/field/FieldPreStartPage.tsx`
- **Purpose:** Daily pre-start safety checklist — create, draft, and submit a
  per-job-per-day pre-start declaration before work begins.
- **Layout & key sections:** A three-mode page (`list` / `new` / `edit`). **List:**
  header with "Pre-starts" + "+ New", then one tappable `field-card` per past pre-start
  (project number, name, date, Draft/Submitted pill). **New:** a small form to pick a job
  (allocation `<select>`) and date, then "Start". **Edit (the mockup's view):** a stack
  of `field-card` sections — Site details (supervisor name), Site hazards (acknowledge
  checkbox + notes), PPE confirmed (hard hat / gloves / boots / high-vis / respirator +
  "other"), Plant & equipment checks, **conditional Asbestos section** (shown when a
  scope code starts `asb`), **conditional Civil section** (scope starts `civ`), and a
  Fit-for-work declaration with a free-text note and an HTML-canvas **signature pad**.
  Footer actions: Save draft / Submit (or a "Back" button when read-only/submitted).
- **Key components/CSS classes:** `field-card`, `field-input`, `field-label`,
  `field-btn`/`--ghost`; local `Check` (large checkbox row) and `SignaturePad` (canvas)
  components; `EmptyState`, `Skeleton`.
- **Data sources:** `GET /field/pre-starts?limit=50` (list);
  `POST /field/pre-starts` (create, returns 409 if one already exists today);
  `GET /field/pre-starts/:id` (open a row); `PATCH /field/pre-starts/:id` (save draft);
  `POST /field/pre-starts/:id/submit` (submit); `GET /field/my-allocations` (job picker
  and to resolve scope codes for the conditional sections).
- **States:** Skeleton while the list loads; empty state ("No pre-starts yet"); inline
  error card; a **409 duplicate** path with a "Open the existing one" link; submit guards
  that require the fit-for-work checkbox and a signature; a full-screen "✅ Submitted"
  success card; once `status !== DRAFT` the whole form is **read-only**.
- **Notable interactions:** Submit does a PATCH-then-submit. The signature pad captures a
  PNG data URL via pointer events (`touchAction:none` for mobile). Form template is
  intentionally fixed across disciplines (a configurable builder is a future PR).
- Mockup: `mockups/field-pre-start.html`

### Timesheet — `/field/timesheet`

- **Component file:** `pages/field/FieldTimesheetPage.tsx`
- **Purpose:** Log and submit daily hours per job, with optional GPS clock-on/off
  pinning.
- **Layout & key sections:** Same three-mode pattern. **List:** "+ New" header and one
  card per timesheet (project number, name, date · hours, status pill —
  Draft / Submitted / Approved, plus a synthetic **Returned** pill when a DRAFT carries a
  `rejectedReason`); only DRAFT rows are tappable into edit. **New (shown in the mockup):**
  job `<select>`, date, hours (number 0.5–24, step 0.5), break `<select>`, free-text
  "what did you work on", clock-on/clock-off `<time>` inputs, and a **GPS clock-on**
  consent panel — an opt-in checkbox that persists server-side, and once enabled two "Pin
  clock-on / Pin clock-off" buttons using `navigator.geolocation` (showing `±Nm` accuracy
  when captured). **Edit:** hours/break/description plus a "Returned" banner when the
  draft was rejected; actions Cancel / Save draft / Submit.
- **Key components/CSS classes:** `field-card`, `field-input`, `field-label`,
  `field-btn`/`--ghost`, `field-pill`; `STATUS_PILL` map; `EmptyState`, `Skeleton`.
- **Data sources:** `GET /field/timesheets?limit=50` (list);
  `POST /field/timesheets` (create, 409 on duplicate-for-day);
  `POST /field/timesheets/:id/submit`; `PATCH /field/timesheets/:id` (edit draft);
  `GET /field/my-allocations` (job picker);
  `GET /field/location-consent` & `POST /field/location-consent` (GPS opt-in toggle).
- **States:** Skeleton; "No timesheets yet" empty state; client-side validation (hours
  0.5–24); 409 duplicate with "Open the existing one"; GPS status line covering
  unsupported geolocation, consent-required, in-progress and pinned-with-accuracy;
  "✅ Submitted" success card.
- **Notable interactions:** New-timesheet creates then immediately submits. GPS readings
  are only sent when both consent is on **and** a reading was captured. Clock times are
  combined with the date into ISO strings before posting.
- Mockup: `mockups/field-timesheet.html`

### Documents — `/field/documents`

- **Component file:** `pages/field/FieldDocumentsPage.tsx`
- **Purpose:** Read-only access to site documents (SWMS, inductions, drawings, plans)
  grouped by the crew member's allocated jobs.
- **Layout & key sections:** One `field-card` section per allocation (project name +
  number heading). Inside, a borderless `<ul>` of document rows: file name, a MIME badge
  pill (`mimeBadge()` → PDF / DOCX / XLSX / IMG / FILE), the upload date, and an **Open**
  button (`field-btn`) linking to `fileUrl` in a new tab — or "No file" when absent. A
  project with no documents shows an inline "No documents uploaded for this project yet."
- **Key components/CSS classes:** `field-card`, `field-pill` (the MIME badge), `field-btn`;
  `EmptyState`, `Skeleton`.
- **Data sources:** `GET /field/my-allocations`, then per allocation
  `GET /field/my-allocations/:id/documents` (fetched sequentially in a loop).
- **States:** Skeleton (single 180px) while loading; error card; "No documents available"
  empty state when the worker has no allocations at all; per-group empty note when an
  allocation has zero docs; populated otherwise.
- **Notable interactions:** Documents open in a new tab; no upload/edit — strictly
  read-only on this surface.
- Mockup: `mockups/field-documents.html`

### Safety — `/field/safety`

- **Component file:** `pages/field/FieldSafetyPage.tsx`
- **Purpose:** One-tap incident and hazard reporting from the field, plus a list of the
  crew member's recent reports.
- **Layout & key sections:** Three-mode page (`home` / `incident` / `hazard`). **Home
  (shown in the mockup):** an "Safety" heading, a large red **🔴 Report Incident**
  button, a large amber **🟡 Report Hazard** button, then "My recent reports" — a list of
  up to 5 merged incident/hazard cards (number · kind · `en-AU` date · severity or risk).
  **Incident form:** when, location\*, type (`INCIDENT_TYPES`: near miss → property
  damage), severity (low→critical), description\*, immediate action, witnesses
  (comma-separated). **Hazard form:** when, location\*, hazard type
  (`HAZARD_TYPES`: physical→other), risk level (low→extreme), description\*, immediate
  action, follow-up due date. Both forms use a shared draft banner + "Save draft" button.
- **Key components/CSS classes:** `field-btn`, `field-card`; local `FieldInput`,
  `FieldSelect`, `FieldTextarea`; `DraftBanner`, `SaveDraftButton`, `useFormDraft` from
  the `../../drafts` module.
- **Data sources:** `GET /safety/incidents?limit=5` & `GET /safety/hazards?limit=5`
  (recent list, merged and sorted by date); `POST /safety/incidents`;
  `POST /safety/hazards`.
- **States:** "No reports yet" when the merged list is empty; per-form validation
  (location + description required); a transient toast ("Incident … reported." /
  "Hazard … logged.") fixed above the bottom nav for 3s after save; **offline draft
  persistence** — `useFormDraft` keeps a partly-filled incident/hazard form across
  tab-switches and reloads and surfaces a `DraftBanner` (Restore / Discard) when a draft
  exists; the draft is discarded on successful submit.
- **Notable interactions:** Recent-reports list refreshes after each successful submit.
  Witnesses are split on commas into an array before posting.
- Mockup: `mockups/field-safety.html`

---

## Client portal

All portal pages render inside `PortalLayout` (`portal/PortalLayout.tsx`): a teal
(`#005B61`) header reading "Initial Services — Client Portal" with the signed-in client
name + contact name and a "Sign out" button, a white top nav with six tabs (Dashboard,
Projects, Jobs, Quotes, Documents, Account) where the active tab is teal with a 2px
underline, and a centred main column capped at 1280px. Pages are deliberately
**light and read-mostly** — mostly white cards and plain tables with inline styles; the
only shared class commonly used is `s7-input` (on the login screens). Data is fetched via
`usePortalAuth().authFetch`, hitting the `/portal/client/*` namespace.

### Dashboard — `/portal`

- **Component file:** `portal/pages/PortalDashboardPage.tsx`
- **Purpose:** A welcome screen with three headline counts for the signed-in client.
- **Layout & key sections:** "Welcome back, {firstName}" heading + sub-line, then an
  auto-fit grid of three `Stat` cards — **Active projects**, **Open quotes**, **Documents
  available** — each a white bordered card with an uppercase label and a large teal number.
- **Key components/CSS classes:** local `Stat` card; inline styles only.
- **Data sources:** `GET /portal/client/dashboard` (returns `{ client, counts }`).
- **States:** "Loading…" text while `data === null`; red error line on failure; populated
  grid otherwise. (No skeletons on the portal — plain "Loading…" text is the convention.)
- **Notable interactions:** None — purely informational.
- Mockup: `mockups/portal-dashboard.html`

### Projects — `/portal/projects`

- **Component file:** `portal/pages/PortalProjectsPage.tsx`
- **Purpose:** List the client's projects with site address and status.
- **Layout & key sections:** "Projects" heading, then a stack of white bordered cards.
  Each card: project number (muted), name (bold), site address line + suburb + state, and
  an uppercase teal pill showing `status` on the right.
- **Key components/CSS classes:** inline-styled cards; status pill (`#005B61` background).
- **Data sources:** `GET /portal/client/projects`.
- **States:** explicit `loading` flag → "Loading…"; "No projects to show yet." when empty;
  red error line; populated stack otherwise.
- **Notable interactions:** Cards are static (no drill-in on this surface).
- Mockup: `mockups/portal-projects.html`

### Jobs — `/portal/jobs`

- **Component file:** `portal/pages/PortalJobsPage.tsx`
- **Purpose:** Tabular view of the client's jobs.
- **Layout & key sections:** "Jobs" heading, then a full-width white `<table>` with
  columns **Job # / Name / Status / Created** (grey header row, 1px row dividers,
  date via `toLocaleDateString`).
- **Key components/CSS classes:** plain `<table>` with inline styles.
- **Data sources:** `GET /portal/client/jobs`.
- **States:** "Loading…"; "No jobs yet."; red error line; populated table otherwise.
- **Notable interactions:** None — read-only table.
- Mockup: `mockups/portal-jobs.html`

### Quotes — `/portal/quotes`

- **Component file:** `portal/pages/PortalQuotesPage.tsx`
- **Purpose:** Tabular view of quotes issued to the client, each tied to a tender.
- **Layout & key sections:** "Quotes" heading, then a white `<table>` with columns
  **Quote ref / Tender / Rev / Status / Sent**. The Tender cell renders
  `tenderNumber — title` (or "—" when null), Rev as `R{revision}`, Sent as a date or "—".
- **Key components/CSS classes:** plain `<table>` with inline styles.
- **Data sources:** `GET /portal/client/quotes`.
- **States:** "Loading…"; "No quotes available."; red error line; populated table.
- **Notable interactions:** None — read-only table.
- Mockup: `mockups/portal-quotes.html`

### Documents — `/portal/documents`

- **Component file:** `portal/pages/PortalDocumentsPage.tsx`
- **Purpose:** Client-visible documents (certificates, invoices, quality records,
  reports), optionally tied to a project.
- **Layout & key sections:** "Documents" heading, then a stack of white bordered cards.
  Each card: title (bold), optional project reference (`projectNumber — name`), optional
  description, and an uppercase **amber** (`#FEAA6D`) category chip on the right.
- **Key components/CSS classes:** inline-styled cards; amber category chip.
- **Data sources:** `GET /portal/client/documents`.
- **States:** "Loading…"; "No documents available."; red error line; populated stack.
- **Notable interactions:** None in source — cards are display-only (no download link is
  rendered on this page, unlike the field documents page).
- Mockup: `mockups/portal-documents.html`

### Account — `/portal/account`

- **Component file:** `portal/pages/PortalAccountPage.tsx`
- **Purpose:** Read-only view of the signed-in contact's details and their organisation.
- **Layout & key sections:** "Account" heading, then a two-column grid of two `Card`s —
  **Your details** (Name, Email, Phone, Last sign-in) and **Organisation** (Client, Code,
  Email, Phone). Each row is a `Field` (tiny grey label + value).
- **Key components/CSS classes:** local `Card` and `Field` components; inline styles.
- **Data sources:** `GET /portal/client/account`.
- **States:** "Loading…" while `account === null`; red error line; populated two-card grid.
- **Notable interactions:** None — no editing on this surface.
- Mockup: `mockups/portal-account.html`

---

## Authentication

All three auth screens are **full-bleed with no chrome** (`data-surface="auth"`) — the
page centres its own card. They split across two auth contexts: `/login` uses the staff
`AuthContext`; `/portal/login` and `/portal/accept-invite` use `PortalAuthContext`.

### Staff sign in — `/login`

- **Component file:** `pages/LoginPage.tsx`
- **Purpose:** Staff sign-in for the desktop ERP (and the entry point that the field app
  also authenticates through), with an optional Microsoft 365 SSO path.
- **Layout & key sections:** A centred `.login-card` (real classes live in `styles.css`):
  brand row (`PO` logo tile + "Project Ops" / "Initial Services platform"), an Email
  field, a Password field with a **show/hide eye toggle**, a primary "Sign in" button,
  and — only when SSO is enabled — an "or" divider and a **"Sign in with Microsoft"**
  button (4-square Microsoft glyph). The page pre-fills the seed credentials
  (`admin@projectops.local` / `Password123!`).
- **Key components/CSS classes:** `login-page`, `login-card`, `login-card__brand/__logo/
  __title/__subtitle/__field/__label/__form/__password/__password-toggle/__submit/
  __divider/__sso/__error`; shared `s7-input`, `s7-btn s7-btn--primary s7-btn--lg`; local
  `SsoButton` using `useMsal()`.
- **Data sources:** `useAuth().login(email, password)`; `resetPassword(tempToken, …)`;
  `loginWithSso(idToken)`; SSO redirect via MSAL `instance.loginRedirect(loginRequest)`,
  gated by `isSsoEnabled` (`VITE_SSO_ENABLED`). Redirects to `/` when already
  authenticated.
- **States:** Default sign-in form; a **password-reset variant** ("Set a new password" —
  new + confirm password, min 8 chars, must match) rendered when `login` returns
  `requiresPasswordReset` + a `tempToken`; inline `login-card__error` alert; submitting /
  SSO-connecting button labels; SSO block hidden entirely when SSO is off.
- **Notable interactions:** SSO uses **redirect, not popup** (the Static Web Apps popup
  handoff hangs); the redirect response is consumed in `main.tsx` before React renders.
  Eye toggle flips the password input type.
- Mockup: `mockups/login.html`

### Portal sign in — `/portal/login`

- **Component file:** `portal/pages/PortalLoginPage.tsx`
- **Purpose:** Client-portal sign-in (separate auth context from staff).
- **Layout & key sections:** A bespoke **inline-styled white card** (no shared card
  classes) centred on a teal gradient background
  (`linear-gradient(135deg,#005B61,#003d42)`). Card: "Initial Services" heading (teal),
  "Client portal sign-in" sub-line, Email field, Password field (both `s7-input`), and a
  full-width teal "Sign in" button. No SSO option here.
- **Key components/CSS classes:** `s7-input`; otherwise pure inline styles.
- **Data sources:** `usePortalAuth().login(email, password)`, then `navigate("/portal")`
  on success.
- **States:** Default; red error line on failure ("Sign-in failed"); button reads
  "Signing in…" with a wait cursor while submitting.
- **Notable interactions:** On success it routes to the portal dashboard.
- Mockup: `mockups/portal-login.html`

### Accept invite — `/portal/accept-invite`

- **Component file:** `portal/pages/PortalAcceptInvitePage.tsx`
- **Purpose:** Let a newly-invited client contact activate their portal account by setting
  a password against an emailed invitation token.
- **Layout & key sections:** Same bespoke teal-gradient card as portal login. "Welcome"
  heading, "Set a password to activate your portal account." sub-line, then a New password
  + Confirm password pair (`s7-input`) and an "Activate account" button. The token comes
  from the `?token=` query param.
- **Key components/CSS classes:** `s7-input`; inline styles.
- **Data sources:** `usePortalAuth().acceptInvite(token, password)`, then
  `navigate("/portal")`.
- **States:** **Missing-token** state — when `?token` is absent the form is replaced by a
  red "Missing invitation token." message; password-mismatch and complexity validation
  ("at least 8 characters and include lowercase, uppercase, and a number" via the regex
  guard); red error line; "Creating account…" while submitting.
- **Notable interactions:** Client-side password-policy enforcement before the call;
  success routes to the portal dashboard.
- Mockup: `mockups/portal-accept-invite.html`
