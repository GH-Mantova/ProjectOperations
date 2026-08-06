---
premise: '! test -f apps/web/src/pages/administration/MapLocationsPage.tsx'
premise_means: >-
  The three low-traffic AdminSettings tabs (Site geofences, Client versions,
  Map locations) have not yet been extracted into standalone Administration
  pages; they still live as inline tabs on AdminSettingsPage.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: >-
  pnpm build && test -f apps/web/src/pages/administration/SiteGeofencesPage.tsx
  && test -f apps/web/src/pages/administration/AdminClientVersionsPage.tsx
  && test -f apps/web/src/pages/administration/MapLocationsPage.tsx
size: 6
gate_allow: none
escalates: false
seed_only: false
rollback_strategy: >-
  Pure front-end move. Revert the PR: the three tabs return to AdminSettingsPage
  and the new Administration pages/routes are removed. No data, no schema.
---

# SLICE 14 — dissolve three low-traffic tabs into the Administration hub

## Why

`AdminSettingsPage.tsx` carries eight top-level tabs. Three of them are
set-once infrastructure config that rarely gets touched: **Site geofences**,
**Client versions**, and **Map locations**. This slice moves those three out of
the settings tab-row and into the `/settings/administration` hub (built in
SLICE 16), leaving the five everyday tabs (Notifications, Email, Access
requests, AI & Integrations, Integrations / API keys) as first-class.

This is a MOVE, not a rewrite. The three tab bodies keep their exact current
behaviour and API calls — they are relocated, not re-implemented.

## What to do

1. **Extract the three inline tab components** currently defined inside
   `apps/web/src/pages/AdminSettingsPage.tsx` — `SiteGeofencesTab`,
   `AdminClientVersionsTab`, and `MapLocationsTab` — into three new standalone
   page components, moving their bodies **verbatim** (same JSX, same
   `authFetch` calls, same helpers):
   - `apps/web/src/pages/administration/SiteGeofencesPage.tsx`
   - `apps/web/src/pages/administration/AdminClientVersionsPage.tsx`
   - `apps/web/src/pages/administration/MapLocationsPage.tsx`
   Follow the export/structure convention of the existing files under
   `apps/web/src/pages/administration/` (e.g. `AdministrationLandingPage.tsx`).
   Move any helper functions/types those three components use exclusively; keep
   shared helpers where they are and import them.

2. **Remove the three from the settings tab-row.** In `AdminSettingsPage.tsx`
   delete the `geofences`, `client-versions`, and `map-locations` entries from
   the `TABS` array, delete their three inline render lines
   (`{tab === "geofences" && ...}` etc.), and remove the now-unused inline
   component definitions. The remaining five tabs and their behaviour are
   untouched. Ensure `TabId` and any default-tab logic still compile (the
   default tab must be one of the five that remain).

3. **List them in the Administration hub.** Add three entries to
   `ADMINISTRATION_ITEMS` in `apps/web/src/components/SettingsShell.tsx`:
   - `{ to: "/settings/administration/geofences", label: "Site geofences", requiresPermission: <code> }`
   - `{ to: "/settings/administration/client-versions", label: "Client versions", requiresPermission: <code> }`
   - `{ to: "/settings/administration/map-locations", label: "Map locations", requiresPermission: <code> }`
   For `<code>`, use the **same permission these tabs are gated by today** on
   AdminSettingsPage (they are admin-gated — mirror the `requiresPermission`
   code the existing admin-level `ADMINISTRATION_ITEMS` entries already use).
   Do NOT invent a new permission code and do NOT loosen the gate — SLICE 17
   handles any per-screen permission refinement later.

4. **Register the three routes** in `apps/web/src/App.tsx` under the same
   `/settings/administration` route group the hub uses, each rendering the
   matching new page component from step 1, behind the same guard the other
   administration children use.

5. **Update the tests** that assert the old tab list so the suite stays green:
   - `tests/e2e/**` specs asserting the AdminSettings section tabs (e.g. the
     admin-portal batch spec) must drop `Site geofences` / `Client versions` /
     `Map locations` from the tab-row assertions.
   - Any nav/unit test enumerating `ADMINISTRATION_ITEMS` or the settings tabs
     (e.g. `ShellLayout.nav` test) must reflect the three new Administration
     destinations.
   Add coverage that hitting `/settings/administration/geofences` (and the other
   two) renders the relocated page.

## Done when

`pnpm build` passes, the three new page files exist under
`apps/web/src/pages/administration/`, the three tabs are gone from
`AdminSettingsPage`, the three appear in the Administration hub, and all e2e +
unit suites are green.

## Guardrails

- Front-end only. No API, prisma, or schema changes — the geofences /
  client-versions / map-locations endpoints are unchanged and still called
  from the relocated pages.
- Behaviour parity: a person who could edit these before can still edit them
  at the new location, with the same permission gate.
- Do not touch the five remaining tabs, and do not alter any shared layout
  file beyond adding the three routes / nav entries.
