---
premise: '! test -f apps/web/src/pages/administration/MapLocationsPage.tsx'
premise_means: >-
  The two low-traffic AdminSettings tabs (Client versions, Map locations) have
  not yet been extracted into standalone Administration pages; they still live
  as inline tabs on AdminSettingsPage.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: >-
  pnpm build && test -f apps/web/src/pages/administration/AdminClientVersionsPage.tsx
  && test -f apps/web/src/pages/administration/MapLocationsPage.tsx
size: 5
gate_allow: none
escalates: false
seed_only: false
rollback_strategy: >-
  Pure front-end move. Revert the PR: the two tabs return to AdminSettingsPage
  and the new Administration pages/routes are removed. No data, no schema.
---

# SLICE 14 — dissolve two low-traffic tabs into the Administration hub

## Why

`AdminSettingsPage.tsx` carries eight top-level tabs. Two of them are set-once
infrastructure config that rarely gets touched: **Client versions** and **Map
locations**. This slice moves those two out of the settings tab-row and into
the `/settings/administration` hub (built in SLICE 16), leaving the everyday
tabs as first-class.

This is a MOVE, not a rewrite. The two tab bodies keep their exact current
behaviour and API calls — they are relocated, not re-implemented.

**Scope note — geofences is deliberately OUT of this slice.** The `Site
geofences` tab is being redesigned separately into a per-job feature (geofences
scoped to each job, not a global admin list). Do NOT touch the geofences tab in
this slice: leave `SiteGeofencesTab`, its `geofences` TABS entry, and its render
line exactly as they are on AdminSettingsPage. Only Client versions and Map
locations move here.

## What to do

1. **Extract the two inline tab components** currently defined inside
   `apps/web/src/pages/AdminSettingsPage.tsx` — `AdminClientVersionsTab` and
   `MapLocationsTab` — into two new standalone page components, moving their
   bodies **verbatim** (same JSX, same `authFetch` calls, same helpers):
   - `apps/web/src/pages/administration/AdminClientVersionsPage.tsx`
   - `apps/web/src/pages/administration/MapLocationsPage.tsx`
   Follow the export/structure convention of the existing files under
   `apps/web/src/pages/administration/` (e.g. `AdministrationLandingPage.tsx`).
   Move any helper functions/types those two components use exclusively; keep
   shared helpers where they are and import them.

2. **Remove the two from the settings tab-row.** In `AdminSettingsPage.tsx`
   delete the `client-versions` and `map-locations` entries from the `TABS`
   array, delete their two inline render lines
   (`{tab === "client-versions" && ...}` and `{tab === "map-locations" && ...}`),
   and remove the now-unused inline component definitions. The `geofences` tab
   and all other tabs, and their behaviour, are untouched. Ensure `TabId` and
   any default-tab logic still compile.

3. **List them in the Administration hub.** Add two entries to
   `ADMINISTRATION_ITEMS` in `apps/web/src/components/SettingsShell.tsx`:
   - `{ to: "/settings/administration/client-versions", label: "Client versions", requiresPermission: <code> }`
   - `{ to: "/settings/administration/map-locations", label: "Map locations", requiresPermission: <code> }`
   For `<code>`, use the **same permission these tabs are gated by today** on
   AdminSettingsPage (they are admin-gated — mirror the `requiresPermission`
   code the existing admin-level `ADMINISTRATION_ITEMS` entries already use).
   Do NOT invent a new permission code and do NOT loosen the gate — SLICE 17
   handles any per-screen permission refinement later.

4. **Register the two routes** in `apps/web/src/App.tsx` under the same
   `/settings/administration` route group the hub uses, each rendering the
   matching new page component from step 1, behind the same guard the other
   administration children use.

5. **Update the tests** that assert the old tab list so the suite stays green:
   - `tests/e2e/**` specs asserting the AdminSettings section tabs must drop
     `Client versions` and `Map locations` from the tab-row assertions (leave
     `Site geofences` assertions intact).
   - Any nav/unit test enumerating `ADMINISTRATION_ITEMS` or the settings tabs
     (e.g. `ShellLayout.nav` test) must reflect the two new Administration
     destinations.
   Add coverage that hitting `/settings/administration/client-versions` and
   `/settings/administration/map-locations` renders the relocated page.

## Done when

`pnpm build` passes, the two new page files exist under
`apps/web/src/pages/administration/`, the two tabs are gone from
`AdminSettingsPage` (geofences still present), the two appear in the
Administration hub, and all e2e + unit suites are green.

## Guardrails

- Front-end only. No API, prisma, or schema changes — the client-versions and
  map-locations endpoints are unchanged and still called from the relocated
  pages.
- Behaviour parity: a person who could edit these before can still edit them
  at the new location, with the same permission gate.
- Do NOT touch the geofences tab (separate per-job redesign) or any other
  remaining tab, and do not alter any shared layout file beyond adding the two
  routes / nav entries.
