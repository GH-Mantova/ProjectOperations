<!-- DISARMED 2026-08-18T02:15Z.
     Premise 	est ! -f docs/plans/settings-home-plan.md is DEAD: PR #1167 merged and
     created docs/plans/settings-home-plan.md on origin/main (measured at d008af68).
     The work this prompt describes has landed. Left armed it would burn a watcher run
     or re-write a plan that already exists. Renamed, not deleted, so the history stays.
     Follow-on work is SLICE 1/2/3 of that plan, which need their own prompts. -->

---
premise: test ! -f docs/plans/settings-home-plan.md
premise_means: The Settings Home slice plan has not been written yet. `/settings` still has no landing page - its index route redirects straight to `account` (`App.tsx:395`) - and the nav model carries no descriptions and no tab entries, so neither the Home screen nor its search can be built from it.
scope:
  - docs/plans/settings-home-plan.md
done_when: test -f docs/plans/settings-home-plan.md && grep -q "SLICE 3" docs/plans/settings-home-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Settings Home + search - SLICE 0: write the plan

Briefs **Â§2.2** (a Control-Panel style Settings "Home" with search) and **Â§2.3** (a plain-English
description for every setting). Same surface, run together. Â§2.1 was split out as its own brief.

This slice writes `docs/plans/settings-home-plan.md` and NOTHING else. No component, no route,
no nav-model change. The plan is the first PR; the code slices chain behind it one at a time.

## Approved decisions this plan must encode (do not re-open any of these)

| # | Decision |
|---|---|
| D43 | Settings Home is **flat by default, with a Grouped toggle**. |
| D44 | Search covers **name + description + tab name**, and deep-links to the tab. |
| D45 | Permission-locked settings are **shown, not hidden** - greyed, with a lock, the permission they need, and a working **Request access** button. |
| D46 | Locked settings are grouped at the **BOTTOM** under a `Needs access - N` divider, in BOTH views. Header count reads "N settings you can open". |
| D47 | Descriptions are drafted from the code for Marco's single review pass, with guesses flagged. |

## Grounding the plan must build on (verified against origin/main @ f1265c02)

- **There is no Settings landing page.** `App.tsx:395` - `<Route index element={<Navigate to="account" replace />} />`. This fills a hole; it replaces nothing.
- **A landing-page precedent already exists:** `apps/web/src/pages/administration/AdministrationLandingPage.tsx` (62 lines) imports `ADMINISTRATION_ITEMS` and `filterSettingsNavItems` from `SettingsShell`, renders `Link` cards, and falls back to `NoAccess`. **Settings Home must mirror this pattern, not invent a second one.**
- **The nav model is already declarative:** `SECTIONS` (Personal / Company / Administration) and the exported `ADMINISTRATION_ITEMS` in `apps/web/src/components/SettingsShell.tsx`, each item `{ to, label, requiresPermission? }`. **Settings Home must be generated from that model. A second hand-maintained list of settings will drift and is forbidden.**
- **Two things the model does NOT have, and both are required:**
  - `description` - zero occurrences in `SettingsShell.tsx` today.
  - **tabs** - not declared centrally anywhere. 26 tabs live inside 3 pages (Company profile 7, Admin settings 6, Reference data & Lists 5, plus others). Without tab entries, D44's search would misrepresent Settings as 21 destinations when it is really 47.
- **`filterSettingsNavItems` currently HIDES locked items** - and `AdministrationLandingPage` depends on that behaviour. D45/D46 need the opposite. The plan must add a NEW partition function and leave `filterSettingsNavItems` untouched, or it silently changes the Administration landing page too.
- **The Request access backend exists**: `POST request-access` (`access-requests.controller.ts:19`) with admin approve/deny alongside. D45's button has a real endpoint - no new API needed.
- **Real inventory: 21 top-level pages, 26 tabs, 9 of the 21 permission-locked** for an ordinary user.
- **Nothing comparable is queued.** No settings-home or settings-search prompt exists in `docs/pr-prompts/` (root, HOLD, or superseded).
- **Adjacent BACKLOG item:** `settings-restructure-sot-nav-reconcile` (SLICE 20, `sot/01` Â§9 nav-IA doc-reconcile) is gate-passed and READY. Settings Home changes nav IA, so the plan must state that the reconcile runs AFTER these slices, not before.

## The slice breakdown the plan must specify

**SLICE 1 - extend the nav model (data + pure functions, no UI).**
Add `description: string` and `tabs?: { id, label, description }[]` to `SettingsNavItem`; populate
all 21 pages and 26 tabs; add `partitionSettingsNavItems(items, user)` returning
`{ open, locked }`. Leave `filterSettingsNavItems` exactly as it is. Unit tests for the partition
function and a **coverage test that fails when any nav item lacks a description or a tab list**
(panel OBJECT, QA lens - a hand-written description set with no coverage test rots the first time
someone adds a settings page). No component touched.

**SLICE 2 - `SettingsHomePage`.**
Flat by default, Grouped toggle, locked cards bottom-grouped under `Needs access - N` in both
views, header reading "N settings you can open", Request access wired to the existing endpoint.
Point the `/settings` index route at it instead of the `account` redirect. Mirror
`AdministrationLandingPage`'s structure and tokens. Note in the slice that showing the 9 locked
settings is a visible change in what ordinary staff can see - deliberate under D45/D46, but it
should not arrive unannounced.

**SLICE 3 - search.**
Search across name + description + tab name; a tab hit deep-links to the parent route with the
tab pre-selected. Must work in both flat and grouped views and must respect the locked partition.

Each slice must be <= 10 files including tests, and must declare `requires_merged` on the slice
before it so the watcher chains them in order rather than opening all three at once.

## What the plan must NOT do

- Do NOT write any component, route, or nav-model code in this slice. Plan only.
- Do NOT change menu positions or the existing Settings sub-nav ordering (D40: themes and
  restructures never move menu positions without a decision that says so).
- Do NOT touch `filterSettingsNavItems` or `AdministrationLandingPage`.
- Do NOT edit anything under `/sot/` - the nav-IA reconcile is BACKLOG SLICE 20, a separate
  doc-reconcile PR (CP-24 hard-fails a PR mixing code and `sot/`).
- Do NOT draft the 47 descriptions in this slice; that is SLICE 1's payload, for Marco's review.

## Verification

`test -f docs/plans/settings-home-plan.md` and the plan names SLICE 1, SLICE 2 and SLICE 3 with
per-slice scope lists and file-count estimates.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

