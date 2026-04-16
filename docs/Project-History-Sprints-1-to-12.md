# Project History: Sprints 1 to 12

Date prepared: 2026-04-14
Workspace: `C:\Dev\ProjectOperations`
Source material:
- [Sprint1.md](C:\Dev\ProjectOperations\docs\Sprint1.md)
- [Sprint2.md](C:\Dev\ProjectOperations\docs\Sprint2.md)
- [Sprint3.md](C:\Dev\ProjectOperations\docs\Sprint3.md)
- [Sprint4.md](C:\Dev\ProjectOperations\docs\Sprint4.md)
- [Sprint5.md](C:\Dev\ProjectOperations\docs\Sprint5.md)
- [Sprint6.md](C:\Dev\ProjectOperations\docs\Sprint6.md)
- [Sprint7.md](C:\Dev\ProjectOperations\docs\Sprint7.md)
- [Sprint8.md](C:\Dev\ProjectOperations\docs\Sprint8.md)
- [Sprint9.md](C:\Dev\ProjectOperations\docs\Sprint9.md)
- [Sprint10.md](C:\Dev\ProjectOperations\docs\Sprint10.md)
- [Sprint11.md](C:\Dev\ProjectOperations\docs\Sprint11.md)
- [Sprint12.md](C:\Dev\ProjectOperations\docs\Sprint12.md)

## Executive Summary

Across twelve sprint sessions, the project moved Tendering from a partially broken, foundation-grade ERP module into a pilot-ready CRM-style deal desk with:

- stable `Dashboard / Pipeline / Create / Workspace` flow
- stronger board/list/forecast register behavior
- unified activity workflow layered over notes, clarifications, and follow-ups
- stakeholder and communication context in the workspace rail
- reliable award / contract / convert / rollback lifecycle behavior
- safer tender-to-job conversion with archived-job reuse handling
- broad local Playwright browser coverage
- merged GitHub/CI follow-through for cross-platform Playwright startup

The work progressed through three major phases:

1. Recovery and stabilization
   - fixed broken Tendering create/workspace load paths
   - introduced safer managed-Windows validation paths
   - established handover and roadmap documentation

2. CRM-style transformation
   - redesigned Tendering UI to feel more like Pipedrive
   - introduced unified activity behavior and attention-management logic
   - reworked register, workspace, create, clients, and contacts surfaces
   - improved lifecycle drag/drop and conversion workflows

3. Runtime verification and rollout readiness
   - added and extended Playwright browser coverage
   - fixed real runtime/browser defects found during E2E
   - connected the workspace to GitHub
   - landed the Playwright CI compatibility fix in `main`
   - prepared rollout guidance for going online with SharePoint around the app

At the end of Sprint 12, Tendering is in a strong, pilot-ready state. The next best work is no longer basic Tendering implementation. It is:

- production hardening from pilot feedback
- award-to-job handover refinement
- Jobs/Delivery and Scheduler maturation
- real SharePoint Graph integration
- eventual Microsoft 365 SSO

## Management Summary

### What was achieved

- Recovered a broken Tendering workflow and made create/workspace usable again.
- Redesigned Tendering into a CRM-style pipeline and workspace experience.
- Added high-value deal-management features:
  - attention signals
  - next actions
  - stakeholder context
  - communication queue
  - unified activity handling
- Stabilized the tender-to-job conversion lifecycle.
- Added real browser automation coverage and got it passing locally.
- Proved the GitHub branch/PR/merge path and landed CI-compatible Playwright startup.
- Prepared an online rollout shape using hosted app infrastructure plus SharePoint as launch surface and file repository.

### Main business outcome

Tendering is no longer just a foundation module. It is now positioned to be the front door of the ERP, with a realistic path for pilot users to enter live tender data and then move naturally into downstream job/delivery workflows.

### Remaining business gaps

- real SharePoint integration is still mock-based in the app
- Microsoft 365 SSO is not yet implemented
- broader pilot feedback still needs to shape final production hardening

## Full Narrative History

### Sprint 1: Tendering Recovery And Roadmap Setup

Sprint 1 focused on recovering core Tendering behavior and creating the handover/documentation structure that guided all later work.

The most important issue at the time was that `Create Tender` and `Tender Workspace` were failing with `Unable to load tendering data`. The root cause was a frontend pagination mismatch:

- frontend requested clients and contacts with `pageSize=200`
- the API enforced a maximum page size of `100`
- this caused `400 Bad Request`
- one failed optional reference load broke the full Tendering screen

That was fixed by:

- reducing requests to `pageSize=100`
- making the load path more fault tolerant
- treating non-critical reference data more defensively

Once recovered, Tendering UX refinement began:

- dashboard pulse summary band
- due-this-week, high-confidence, award-ready, contracts-pending metrics
- spotlight cards for high-value tenders
- stronger next-action rows
- create-form readiness panel
- stronger workspace quick metrics
- richer import preview summaries

This sprint also created the local handover backbone:

- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)
- [tendering-pipedrive-roadmap.txt](C:\Dev\ProjectOperations\docs\tendering-pipedrive-roadmap.txt)

It also added convenience launcher utilities:

- `open-erp.bat`
- `stop-erp.bat`

### Sprint 2: Attention Logic And Unified Activity Layer

Sprint 2 shifted Tendering from a passive register toward a more operational CRM-style module.

It added attention-management and execution signals:

- idle / rotting heuristics
- last activity
- next action
- stage age
- tender age
- estimator / due / value / client / contact / attention filters

At the same time, the sprint introduced a unified Tender Activity API layer without taking on Prisma/schema risk. Instead of creating a new persisted activity model immediately, the implementation exposed notes, clarifications, and follow-ups as one unified activity stream.

Added endpoints:

- `GET /tenders/:id/activities`
- `POST /tenders/:id/activities`
- `PATCH /tenders/:id/activities/:activityId`

This was a major architectural decision. It allowed product progress without destabilizing the schema.

Sprint 2 also hardened validation for the managed Windows environment, where Vite/esbuild/Jest worker spawning could fail. It introduced:

- `pnpm test:web:logic`
- `pnpm test:api:serial`

Those became the safe validation path for later work.

### Sprint 3: CRM Styling For Tendering, Clients, And Contacts

Sprint 3 focused on visible product polish and moved the app to version `0.1.2`.

Major UI improvements:

- flatter Tender register toolbar and header
- visible topbar with pipeline value and workspace state
- denser CRM-style list cards
- lighter board columns
- stronger workspace left-rail/right-canvas structure
- more guided Create Tender flow

A major insight emerged around `Clients` and `Contacts`: they still felt like generic admin screens because they were mostly thin wrappers over `MasterDataPage`. That shared page was then reworked into a CRM-style shell so clients and contacts would read like operational relationship screens rather than admin forms.

This sprint also reinforced the safe validation philosophy:

- do not rely on Vite/Vitest as the primary signal
- use TypeScript and the no-spawn logic lane

### Sprint 4: Multi-View Register And Read-First Workspace

Sprint 4 moved the app to version `0.1.3` and made the Tender register meaningfully stronger.

The biggest change was the introduction of a coherent three-view model:

- `Pipeline`
- `List`
- `Forecast`

The register became much more CRM-like:

- `List` behaved as a real CRM table/grid
- `Forecast` gained month navigation
- filter/action chrome was tightened
- active filter count, clear search, reset filters, and denser chips were added

Workspace refinement continued:

- overview became more read-first
- right rail was strengthened
- activity tab was reorganized into a clearer workbench

At this point, the register began to outpace the workspace in UX maturity.

### Sprint 5: Runtime Mismatch Investigation

Sprint 5 was less about adding visible new value and more about solving a confusing runtime problem: edited `.tsx` source was not reliably matching the visible UI.

Key findings:

- stale sibling `.js` files existed beside maintained `.tsx` files
- older board buttons visible in runtime were confirmed in stale JS
- the visible runtime did not match the current `.tsx` code

Examples found:

- `TendersPage.js`
- `TenderingDashboardPage.js`
- `CreateTenderPage.js`
- `TenderWorkspacePage.js`

This was a critical turning point, because it explained why some UI changes appeared not to take effect. The sprint updated Vite config to prefer `.tsx/.ts` before `.js` and clearly established that runtime/source verification had to come before more board/workspace experimentation.

### Sprint 6: Lifecycle Drag/Drop And Safe Conversion

Sprint 6 focused on making lifecycle movement and tender-to-job conversion safer and more ERP-realistic.

Major lifecycle work:

- drag/drop across pre-award, awarded, contract, and converted stages
- rollback from later stages to earlier stages
- awarded-client selection popup when needed
- cancel/abort paths for accidental drops
- same-client confirmation flows for some rollback scenarios

Conversion work:

- added confirmation before converting to a live job
- changed converted rollback behavior from delete to archive
- added archived-job conflict handling
- repaired archived-job reuse
- reactivated reused jobs correctly
- ensured reactivated jobs appeared in active job views

This sprint also compacted layout heavily and attempted to move the workspace into popup/modal behavior from the full register flow. That popup work was only partially complete because the dedicated `/tenders/workspace` route still intentionally rendered inline `mode="workspace"`.

### Sprint 7: Structural Cleanup And Dense ERP Surfaces

Sprint 7 stabilized Tendering structurally and applied the “dense, subsection-based, no dead space” rule more broadly across the ERP.

Tendering route and layout improvements:

- fixed `/tenders/workspace` so the register no longer rendered above the dedicated workspace
- preserved explicit mode split:
  - `full`
  - `create`
  - `workspace`
- restored Tendering nav to the dashboard
- exposed `Pipeline` as a submenu route
- hid direct sidebar access to `Tender Workspace` while preserving deep-link access

UX improvements:

- denser filters and actions
- visible pipeline value and weighted forecast strip
- stronger create rail
- tighter workspace rail/canvas hierarchy
- more usable activity tab with capped internal scroll

Cross-module changes:

- Master Data was repositioned as shared ERP reference data
- Jobs, Assets, Maintenance, Forms, Documents, Dashboards, and Master Data were compacted or reorganized into denser layouts

Critical cleanup:

- stale `.js` siblings shadowing `.ts/.tsx` were removed

By the end of Sprint 7, Tendering was functionally implemented and the biggest remaining questions were runtime/browser feel issues, not core missing behavior.

### Sprint 8: Playwright Scaffolding And Communication Context

Sprint 8 introduced repo-local Playwright scaffolding and deepened Tendering’s stakeholder/communication experience.

New browser automation foundation:

- [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)
- [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts)
- root script `pnpm test:tendering:e2e`

Product work:

- probability-band filtering
- stronger last-touch and overdue/open activity context
- card-level `Add activity` shortcuts
- focused activity views:
  - all
  - open
  - overdue
  - completed
  - by owner
- stakeholder roles surfaced from `TenderClient.relationshipType`
- relationship notes surfaced from `TenderClient.notes`
- richer stakeholder cards
- communication summary panel in workspace rail

Technical fix:

- converted-job seed path was made more idempotent with `upsert`

Main blocker:

- Playwright discovery worked
- actual browser launch still failed due to `spawn EPERM`

### Sprint 9: Stakeholder Editing Behavior

Sprint 9 used the continuation log as source of truth and focused on a very specific CRM polish area while browser execution remained blocked.

The change:

- stakeholder role and notes no longer persisted on every keystroke
- they now draft locally and save on blur
- cards show `Saved / Unsaved / Saving`

This was important because the earlier behavior felt too noisy and admin-like. The new behavior made the workspace rail feel more deliberate and more CRM-like.

No route/mode or lifecycle rewrites were introduced. This was a clean behavioral refinement.

### Sprint 10: Browser Verification Breakthrough

Sprint 10 was one of the biggest milestones in the full history. It turned browser verification from blocked to passing.

Product refinements:

- stakeholder save-on-blur plus explicit save/revert
- normalized role labels
- denser relationship cards
- communication summaries reframed as:
  - Coverage
  - Owners
  - Cadence
  - Recent voices
- communication queue sourced from unified activity
- queue ordering fixed by real due time

Browser/CI work:

- Playwright expanded to Chromium, Firefox, and WebKit
- GitHub Actions workflow added
- Playwright `webServer` wiring fixed for `127.0.0.1`
- selectors updated to current UI and exact role-based matches

Runtime/browser bugs fixed:

- invalid nested interactive patterns removed from Tender register surfaces
- workspace modal now opens immediately while details hydrate

Validation result:

- Tendering smoke passed locally in real browsers across Chromium, Firefox, and WebKit

This sprint effectively proved that Tendering was not just type-safe but genuinely working in a browser.

### Sprint 11: Coverage Completion And UX Bug Fixes

Sprint 11 completed the next browser-coverage pass and fixed real UX defects found during E2E.

Coverage added:

- board drag/drop conversion prompt
- popup modal close/reopen
- modal inner scroll
- dedicated workspace loading via `tenderId`
- stakeholder explicit save/revert flow

Real UX/runtime bugs fixed:

1. Target-tab preservation
- opening via `Add activity` was intended to land on `activity`
- `selectTender()` had been resetting back to `overview`
- fixed by allowing target tab to flow through selection

2. Stakeholder explicit actions vs blur-save
- blur-save could pre-empt `Save stakeholder` / `Revert`
- fixed by skipping blur-save when focus moved to action buttons

Testing philosophy improvement:

- tests switched toward runtime tender discovery instead of brittle seed assumptions

Result:

- Tendering browser suite passed locally across Chromium, Firefox, and WebKit with this wider coverage

### Sprint 12: GitHub/CI Closure And Rollout Planning

Sprint 12 moved the work from “local success” into “repo-backed and merged.”

Repo/GitHub work:

- confirmed repo connection to `GH-Mantova/ProjectOperations`
- identified remaining local diff in `playwright.config.ts`
- validated safe checks again
- discovered local git branch creation failed because `.git/refs` lockfile permissions were blocked
- used GitHub connector as a publishing fallback
- created branch `codex/playwright-ci-compat`
- opened PR `#1`
- later confirmed PR merged into `main`

Code/workflow fixes landed:

- [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)
  - OS-aware startup for Windows vs non-Windows
- [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml)
  - Prisma generate before API build

Rollout planning:

- recommended app URL: `https://tendering.initialservices.com.au`
- recommended hosting: Azure-hosted web + API
- recommended DB: Azure Database for PostgreSQL
- recommended SharePoint role:
  - Intranet site as app launch surface
  - Initialservices site as file/backups repository
- recommended pilot users:
  - estimator / tender lead
  - operations lead
  - project delivery lead
  - admin support
  - reviewer / manager

End-state conclusion:

- Tendering is pilot-ready
- CI compatibility is merged
- next work should be rollout support, production hardening, or the next operational workflow

## Sprint-by-Sprint Table

| Sprint | Primary Goal | Key Actions | Important Files | Validation / Result | Main Blockers / Notes |
|---|---|---|---|---|---|
| 1 | Recover broken Tendering and create roadmap | Fixed create/workspace load bug, added dashboard/readiness improvements, created continuation log and roadmap | [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx), [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md), [tendering-pipedrive-roadmap.txt](C:\Dev\ProjectOperations\docs\tendering-pipedrive-roadmap.txt) | `tsc --noEmit` passed | Page load failed because optional refs used `pageSize=200` against API max `100` |
| 2 | Add CRM attention logic and unified activity layer | Added idle/rotting heuristics, next action, stage age, unified activity endpoints, safe no-spawn validation | [tendering.controller.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.controller.ts), [tendering.service.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.service.ts), [tendering-page-helpers.ts](C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.ts) | Safe API/web checks green | Avoided risky Prisma migration by using adapter-backed activity model |
| 3 | Make Tendering, Clients, Contacts feel CRM-like | Version bump to `0.1.2`, redesigned register/workspace/create, rewrote Master Data shell for CRM-like Clients/Contacts | [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx), [MasterDataPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\MasterDataPage.tsx), [styles.css](C:\Dev\ProjectOperations\apps\web\src\styles.css) | Safe web checks green | Vite/Vitest still not safe primary lane |
| 4 | Strengthen register into a multi-view CRM surface | Added Pipeline/List/Forecast register views, improved forecast navigation, continued read-first workspace | [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx), [styles.css](C:\Dev\ProjectOperations\apps\web\src\styles.css) | API build/tests and safe web checks green | Workspace still lagged behind register quality |
| 5 | Prove runtime/source mismatch | Investigated stale `.js` siblings shadowing `.tsx`, updated Vite resolution priority, paused UI assumptions until runtime was mapped | [vite.config.ts](C:\Dev\ProjectOperations\apps\web\vite.config.ts), [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx) | Safe checks still green | Visible runtime did not match edited TSX due to stale JS shadowing |
| 6 | Fix drag/drop lifecycle and safe conversion | Repaired award/contract/convert/rollback flows, archived-job reuse, compacted layout, started popup workspace architecture | [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx), [jobs.service.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.ts), [job-conversion.dto.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\dto\job-conversion.dto.ts) | Safe API/web checks used | Popup workspace behavior remained incomplete because route/mode split still mattered |
| 7 | Stabilize Tendering structure and dense layouts | Fixed dedicated workspace route, preserved explicit modes, restored nav, removed stale `.js`, compacted more ERP modules | [App.tsx](C:\Dev\ProjectOperations\apps\web\src\App.tsx), [TenderWorkspacePage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderWorkspacePage.tsx), [ShellLayout.tsx](C:\Dev\ProjectOperations\apps\web\src\components\ShellLayout.tsx) | Full safe debug path green | Browser/runtime feel still needed confirmation |
| 8 | Add Playwright scaffolding and communication context | Added Playwright config/spec, probability-band filter, activity shortcuts/views, stakeholder roles/notes, comms summary, seed upsert fixes | [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts), [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts), [seed.ts](C:\Dev\ProjectOperations\apps\api\prisma\seed.ts) | Playwright install/discovery worked | Actual browser launch blocked by `spawn EPERM` |
| 9 | Reduce stakeholder editing friction | Added local drafts and save-on-blur for stakeholder role/notes, added save-state badges | [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx), [styles.css](C:\Dev\ProjectOperations\apps\web\src\styles.css) | Safe web checks green | Browser verification still blocked at that point |
| 10 | Move browser verification to passing | Added explicit save/revert, communication queue, multi-browser Playwright, GitHub Actions workflow, fixed E2E host/CORS/runtime issues | [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts), [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts), [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml) | Local Tendering smoke passed in Chromium/Firefox/WebKit | This was the browser-verification breakthrough sprint |
| 11 | Finish pending browser coverage and runtime fixes | Added drag/drop prompt, popup close/reopen, modal scroll, `tenderId` route coverage, stakeholder save/revert browser checks, fixed activity-tab reopen and blur-save pre-emption | [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx), [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts) | `pnpm test:tendering:e2e` passed locally | Remaining high-signal gap was communication queue and direct-link switching coverage |
| 12 | Close loop with GitHub/CI and rollout planning | Connected repo flow, published CI-compat fix via GitHub connector, opened/merged PR `#1`, captured rollout plan with SharePoint positioning | [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts), [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml), [Sprint12.md](C:\Dev\ProjectOperations\docs\Sprint12.md) | Safe checks re-run; PR merged into `main` | Local git branch creation still unreliable due to `.git/refs` lockfile permissions |

## Technical Appendix

### Key files by theme

#### Tendering UI core

- [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)
- [TenderingDashboardPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderingDashboardPage.tsx)
- [TenderPipelinePage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderPipelinePage.tsx)
- [CreateTenderPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\CreateTenderPage.tsx)
- [TenderWorkspacePage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderWorkspacePage.tsx)
- [styles.css](C:\Dev\ProjectOperations\apps\web\src\styles.css)
- [tendering-labels.ts](C:\Dev\ProjectOperations\apps\web\src\tendering-labels.ts)

#### Tendering logic and tests

- [tendering-page-helpers.ts](C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.ts)
- [tendering-page-helpers.test.ts](C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.test.ts)
- [tendering-page-helpers.smoke.ts](C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.smoke.ts)
- [tsconfig.tendering-smoke.json](C:\Dev\ProjectOperations\apps\web\tsconfig.tendering-smoke.json)

#### Tendering backend

- [tendering.controller.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.controller.ts)
- [tendering.service.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.service.ts)
- [tender.dto.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tendering\dto\tender.dto.ts)
- [tender-documents.controller.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tender-documents\tender-documents.controller.ts)
- [tender-documents.service.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tender-documents\tender-documents.service.ts)

#### Conversion / Jobs

- [jobs.service.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.ts)
- [jobs.service.spec.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.spec.ts)
- [job-conversion.dto.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\dto\job-conversion.dto.ts)
- [tender-conversion.controller.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\tender-conversion.controller.ts)

#### Browser verification / CI

- [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)
- [playwright.reuse.config.ts](C:\Dev\ProjectOperations\playwright.reuse.config.ts)
- [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts)
- [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml)

#### Build/runtime support

- [vite.config.js](C:\Dev\ProjectOperations\apps\web\vite.config.js)
- [package.json](C:\Dev\ProjectOperations\package.json)
- [apps/web/package.json](C:\Dev\ProjectOperations\apps\web\package.json)
- [apps/api/package.json](C:\Dev\ProjectOperations\apps\api\package.json)
- [seed.ts](C:\Dev\ProjectOperations\apps\api\prisma\seed.ts)

### Important recurring blockers

#### Managed Windows process issues

Recurring across multiple sprints:

- `spawn EPERM`
- unreliable Vite/esbuild child-process startup
- unreliable `tsx` execution for seed path
- detached background server launch instability

Response:

- created safe no-spawn validation path
- created manual E2E runtime path
- moved some work to connector-based or browser-based validation instead of assuming all tooling worked

#### Runtime/source mismatch

Found most clearly in Sprint 5:

- stale `.js` siblings shadowed `.tsx`
- visible runtime could differ from maintained source

Response:

- identify and remove stale `.js`
- verify routing and actual rendered file path before assuming a TSX edit affected runtime

#### Git limitations in local environment

In later sprints:

- `git` unavailable on PATH for part of the history
- later, branch creation failed because `.git/refs` lockfile creation was denied

Response:

- used the GitHub connector to create branches/commit PR changes when local git write paths were unreliable

### Validation evolution

#### Early safe validation path

Used repeatedly:

```powershell
pnpm --filter @project-ops/api build
pnpm test:api:serial
pnpm --filter @project-ops/web exec -- tsc -p . --noEmit
pnpm test:web:logic
```

#### Later browser path

When environment allowed:

```powershell
pnpm test:tendering:e2e
```

#### Final recommended manual browser path

```powershell
pnpm dev:api:e2e
pnpm dev:web:e2e
pnpm test:tendering:e2e:reuse
```

### Strategic decisions that shaped the project

1. Work only in the local workspace
   - `C:\Dev\ProjectOperations`
   - not the SharePoint-synced path

2. Preserve popup vs dedicated workspace modes
   - do not casually recombine them

3. Do not rush into risky schema changes
   - especially around a true persisted `TenderActivity` model

4. Use runtime/browser evidence to guide polish
   - not assumptions from static code alone

5. Treat SharePoint as surrounding enterprise infrastructure first
   - launch surface and document repository now
   - full Graph-backed integration later

## Current End State

By the end of Sprint 12:

- Tendering is stable and pilot-ready
- local browser coverage is broad and passing through the reuse-runtime path
- GitHub repo wiring and merge flow are proven
- Playwright CI compatibility is merged into `main`
- rollout planning exists for putting Tendering online

The most likely next high-value work is:

- pilot rollout support
- Tendering production hardening from real users
- award-to-job handover refinement
- Jobs/Delivery and Scheduler expansion
- real SharePoint integration
- Microsoft 365 SSO

## Recommended Use Of This Document

Use this file as:

- a management-level summary of what the project has accomplished
- a sprint-by-sprint audit trail
- a technical handover for the next AI agent or developer

If a shorter operational handover is needed, the best companion files are:

- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)
- [Sprint12.md](C:\Dev\ProjectOperations\docs\Sprint12.md)
