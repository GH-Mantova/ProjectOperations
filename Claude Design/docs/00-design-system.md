# Project Ops — Design System Reference

> ⚠️ **SNAPSHOT — describes the UI as at 2026-06-26.** Screens changed since then are not
> reflected here. Regeneration is tracked in `Claude Design/proposed/README.md`. Do not cite this
> document as the current design without checking it against the running app.

This is the current visual language of the Initial Services ProjectOperations platform, extracted directly from the live codebase (`apps/web/src/styles/tokens.css` + `apps/web/src/styles.css`). The real stylesheets are shipped in `../assets/` and every mockup links them, so what you see in the gallery is the **actual** styling, not an approximation.

The system is internally referred to as **"s7"** (the Section 7 UI overhaul). New components should follow these tokens and class patterns.

---

## Brand & colour tokens

Defined as CSS custom properties on `:root` in `tokens.css`.

| Token | Value | Use |
|---|---|---|
| `--brand-primary` | `#005B61` (teal) | Primary brand, active states, links, focus accents |
| `--brand-primary-light` | `#E6F0F1` | Tinted backgrounds, selected rows |
| `--brand-primary-dark` | `#004449` | Hover on primary, dark teal text |
| `--brand-accent` | `#FEAA6D` (orange) | **Primary buttons**, key CTAs, field-app actions |
| `--brand-accent-dark` | `#E8914F` | Hover on accent buttons |
| `--brand-dark` | `#242424` | Near-black text / portal text |
| `--surface-page` | `#F6F6F6` | App page background |
| `--surface-card` | `#FFFFFF` | Cards, tables, inputs |
| `--surface-sidebar` | `#000000` | Desktop sidebar background (black) |
| `--sidebar-text` / `--sidebar-text-active` | `#A8AEBB` / `#FFFFFF` | Sidebar nav text |
| `--text-primary` / `--text-secondary` / `--text-muted` | `#000` / `#6B7280` / `#9CA3AF` | Text hierarchy |
| `--border-default` / `--border-subtle` | `#E5E7EB` / `#F3F4F6` | Dividers, card borders |

**Status colours:** `--status-active` `#005B61`, `--status-warning` `#F59E0B`, `--status-danger` `#EF4444`, `--status-info` `#3B82F6`, `--status-neutral` `#6B7280`.

**Radii:** `--radius-sm` 6px · `--radius-md` 8px · `--radius-lg` 12px · `--radius-xl` 16px.

**Shadows:** `--shadow-card` (subtle 2-layer) · `--shadow-dropdown` (elevated).

> Note the two-colour brand: **teal `#005B61`** is the identity/active colour, but the **orange `#FEAA6D`** is the primary *action* colour. Primary buttons are orange with black text, not teal.

---

## Typography

Font families in use: **Outfit** (body/UI) and **Syne** (some headings, field app). Scale classes:

| Class | Size / weight | Use |
|---|---|---|
| `.s7-type-page-title` | 22px / 600 | Page H1 |
| `.s7-type-section-heading` | 16px / 600 | Section headers |
| `.s7-type-card-title` | 15px / 500 | Card titles |
| `.s7-type-body` | 14px / 400 | Body text |
| `.s7-type-label` | 12px / 500, uppercase, tracked | Eyebrow labels above titles |

The common page-header pattern is an eyebrow `.s7-type-label` followed by `.s7-type-page-title`.

---

## Core components (class reference)

These classes live in `tokens.css`/`styles.css` and are used across the app. Use the gallery mockups to see them in context.

**Cards** — `.s7-card` (white, 1px border, 12px radius, card shadow, 16–20px padding). Grid wrappers: `.s7-card-grid` (auto-fill 280px) and `.s7-card-grid--kpi` (4-up, collapses to 2-up ≤1024px, 1-up ≤640px).

**Buttons** — `.s7-btn` base + a variant:
- `.s7-btn--primary` → orange `#FEAA6D`, black text (the main CTA)
- `.s7-btn--secondary` → white, bordered
- `.s7-btn--ghost` → transparent
- Sizes: `.s7-btn--sm` (28px), default (36px), `.s7-btn--lg` (40px).

**Badges** — `.s7-badge` + `.s7-badge--active|--warning|--danger|--info|--neutral`. Coloured text on a 10%-opacity tint of the same colour. Used heavily for record status.

**Tables** — `.s7-table` (inside `.s7-table-scroll` for horizontal scroll): sticky uppercase header, 40px zebra rows, hover highlight, `.s7-table__row--clickable` for navigable rows.

**Inputs** — `.s7-input`, `.s7-select`, `.s7-textarea`: 36px tall, 8px radius, teal-tinted focus ring (`box-shadow 0 0 0 3px rgba(254,170,109,0.35)`).

**Feedback** — `Skeleton` and `EmptyState` components (`@project-ops/ui`). `.skeleton` uses a pulse animation. Every data area shows skeletons while loading and an `EmptyState` (icon + heading + subtext + CTA) when empty — never a blank screen.

**Charts** — `@project-ops/ui` Recharts widgets: `KpiCard`, `BarChartWidget`, `LineChartWidget`, `DonutChartWidget`. In the static mockups these appear as styled placeholder blocks (noted per page in the docs).

---

## Layout shells (three surfaces)

The platform has **three distinct surfaces**, each with its own chrome (reproduced by `assets/chrome.js` in the gallery):

1. **Desktop staff workspace** (`ShellLayout`) — black left sidebar (240px, collapsible) with brand "PO / Project Ops", grouped nav (Dashboards, Commercial, Operations, Directory, Platform, Admin), a sticky 56px white top bar (breadcrumb, ⌘K command palette, notifications bell, avatar). Content area `.shell__content` has 24px padding on `--surface-page`. Below 768px the sidebar becomes a bottom tab bar.

2. **Field mobile crew app** (`FieldLayout`) — offline-capable, single column, ~390px. White sticky header with the teal "IS" logo + page title, **black bottom tab bar** (Home / Pre-Start / Timesheet / Documents / Safety), large 44px+ touch targets. Uses its own `field-*` classes and the orange `field-btn`. Has offline drafts/outbox + dead-letter banner not present on desktop.

3. **Client portal** (`PortalLayout`) — external, read-mostly. Teal `#005B61` header band ("Initial Services — Client Portal" + client name), white top nav (Dashboard / Projects / Jobs / Quotes / Documents / Account), centered 1280px content. Separate `PortalAuthContext` (clients are not staff users).

**Auth** screens (`/login`, `/portal/login`, `/portal/accept-invite`) render full-bleed with no chrome — a centered card on a tinted/gradient background.

---

## Responsive & accessibility rules (from the codebase)

- Sidebar → bottom tab bar below 768px.
- Card grids: 4-up KPI → 2-up ≤1024px → 1-up ≤640px; standard grids → 1 col ≤640px.
- Tables stay full width and scroll horizontally on small screens (`.s7-table-scroll`).
- Touch targets minimum 44×44px (`.s7-touch-target`).
- Skeleton loaders on all data-fetching areas; empty states on all lists/tables.

---

## How the mockups are built

Each mockup in `../mockups/` contains only the page body inside `<div id="po-page">`, links the three real stylesheets, and declares `data-surface` / `data-route` / `data-title` on `<body>`. `assets/chrome.js` injects the correct shell (desktop/field/portal/auth) and highlights the active nav item. This keeps every mockup tiny and consistent while looking like the running app. To restyle the whole system, edit the tokens in `assets/tokens.css` (a copy of the real file) and every mockup updates at once.
