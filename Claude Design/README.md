# Claude Design — Project Ops UI gallery

A self-contained, lightweight snapshot of **every page** in the Initial Services ProjectOperations platform, built so a design-focused Claude (or any designer) can understand and redesign the UI **without loading the whole codebase or database**.

Nothing here runs the app or touches the database. Every screen is a static HTML mockup that links the platform's **real stylesheets**, so it looks like the running product but weighs almost nothing.

---

## Start here

1. Open **`index.html`** in a browser → the visual gallery. A sidebar lists all 65 pages grouped by surface; click any one to preview it inside the real app chrome. Use the filter box to jump around, or "Open in new tab" to see a page full-screen.
2. Open **`docs/index.html`** (or the "Docs" button in the gallery) → the written breakdown of every screen, plus the design-system reference.

---

## What's tracked in git

Only the **written half** of this folder lives in git:

- `README.md` (this file)
- `docs/*.md` — the 7 spec documents
- `assets/routes.js` — the route → mockup manifest, used by tools outside this folder
- `proposed/` — design intent that has not yet shipped

Everything else — the 65 `mockups/*.html` files, the top-level `index.html` gallery, the docs
reader, the copied `styles.css`/`tokens.css`, and the other assets — is regenerated locally
from the running app and is deliberately **not** in git. Do not check them in.

The written specs are dated **2026-06-26**. Each one carries a banner saying so. Regeneration
is tracked in `proposed/README.md`.

---

## What's inside

```
Claude Design/
├── index.html              ← visual gallery (start here)
├── README.md               ← this file
├── assets/
│   ├── tokens.css          ← REAL design tokens (copy of the app's tokens.css)
│   ├── styles.css          ← REAL app stylesheet (copy of the app's styles.css)
│   ├── mockup-extras.css   ← small helpers + field-app classes for the mockups
│   ├── routes.js           ← single source of truth: every route → mockup file
│   ├── chrome.js           ← injects the real shell (sidebar/topbar/field/portal)
│   └── gallery.css         ← styling for the gallery launcher itself
├── mockups/                ← 65 static page mockups (one .html per route)
└── docs/
    ├── index.html          ← docs reader (renders the markdown below)
    ├── 00-design-system.md ← colours, type, components, layouts, a11y rules
    ├── 01-commercial.md            (Tendering & Contracts)
    ├── 02-operations.md            (Projects, Jobs, Scheduler, Sites)
    ├── 03-assets-maintenance-forms.md
    ├── 04-workforce-directory-platform.md
    ├── 05-dashboards-admin-account.md
    └── 06-field-portal-auth.md     (mobile field app, client portal, login)
```

## The three surfaces

The platform isn't one app — it's three, each with its own chrome (faithfully reproduced in the gallery):

- **Desktop staff workspace** — black collapsible sidebar + top bar. ~45 pages: tenders, contracts, projects, jobs, scheduler, sites, assets, maintenance, forms, workers, documents, compliance, safety, dashboards, admin, archive.
- **Field mobile crew app** — offline-capable, bottom tab bar, big touch targets. 5 pages.
- **Client portal** — external, read-mostly, teal header. 6 pages + its own login.

Plus the auth screens. See `docs/00-design-system.md` for the full breakdown.

---

## For the designer / design Claude

Each mockup (`mockups/<page>.html`) contains **only the page body** inside `<div id="po-page">`; the surrounding shell is injected by `assets/chrome.js`. The mockups use the **real class names** (`s7-card`, `s7-table`, `s7-badge`, `s7-btn--primary`, etc.) defined in the real `styles.css`. So:

- To **see** the current design, browse the gallery.
- To **understand** a page (its purpose, data, states, interactions), read the matching section in `/docs`.
- To **restyle the whole system at once**, edit the tokens in `assets/tokens.css` — colours, radii, shadows, type scale all flow from there, and every mockup updates instantly. This is the cleanest way to prototype a new visual direction before touching the real code.
- To propose page-level redesigns, edit a copy of the relevant `mockups/<page>.html` — it's plain HTML.

Two brand colours to know: **teal `#005B61`** is identity/active; **orange `#FEAA6D`** is the primary action colour (primary buttons are orange).

---

## How this maps back to the code

Each documented page names its real component file (e.g. `apps/web/src/pages/jobs/JobsListPage.tsx`) and the API endpoints it calls. The route → component map mirrors `apps/web/src/App.tsx`, and the nav grouping mirrors `apps/web/src/components/ShellLayout.tsx`. When the real app changes, regenerate the affected mockup + doc.

> Mockups are populated with realistic SEQ-construction **sample data** (Brisbane City Council, TMR Queensland, drainage/culvert/retaining-wall jobs, AUD, dd/mm/yyyy) — illustrative only, not real records.
