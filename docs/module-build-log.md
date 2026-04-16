# Module Build Log

## Module 1: Platform Foundation

Purpose:

- establish the monorepo
- scaffold the API and web apps
- add PostgreSQL and Prisma foundations
- add Docker-based local database startup
- provide health and API docs bootstrapping
- provide the initial responsive shell

Added:

- root workspace manifests
- API foundation and Prisma schema
- web foundation and placeholder navigation
- environment reference and setup docs

Known limitations:

- no installed dependencies in this environment
- no business modules implemented yet
- no real authentication yet
- no SharePoint integration yet

## Module 2: Auth / Users / Roles / Permissions / Audit

Purpose:

- provide local authentication
- establish user, role, permission, and audit entities
- add permission-based API protection
- add responsive admin screens

Added:

- login, refresh, and current-user endpoints
- user and role CRUD foundations
- permission registry listing
- audit log capture and listing
- responsive screens for login, users, roles, permissions, and audit logs

Known limitations:

- no password reset flow yet
- no Microsoft Entra / Microsoft 365 SSO yet
- admin screens are foundation-grade rather than final polished workflows

## Module 3: SharePoint + Platform Services Foundation

Purpose:

- provide a SharePoint integration abstraction
- add document-link metadata foundations
- add notifications, search, and dashboard base entities
- expose minimal admin/config surfaces for shared platform services

Added:

- mock-backed SharePoint adapter and service layer
- tracked SharePoint folder/file/document link entities
- notification foundation and current-user notifications endpoint
- search entry foundation and search endpoint
- dashboard and dashboard widget base entities and CRUD foundation
- responsive platform and dashboard screens

Known limitations:

- SharePoint uses a mock adapter in this module rather than live Graph calls
- generic document workflows are not built yet
- notifications and search are foundation-level and will expand as later modules register real data

## Module 4: Master Data

Purpose:

- provide reusable core records for clients, contacts, sites, workers, crews, assets, resource types, competencies, worker competencies, and lookup values
- add search/filter/pagination and duplicate protection where sensible
- keep these services reusable for later modules

Added:

- master data entities and relationships
- CRUD/list APIs with pagination and audit logging
- seed/demo master data
- responsive master data workspace in the web app

Known limitations:

- the master data UI is a compact foundation workspace, not the final polished operational design
- delete/archive flows are not yet implemented
- some advanced validation will be tightened as later modules consume these records

## Module 5: Tendering and Estimating

Purpose:

- implement the tender register and estimating workflow
- support multiple linked clients per tender
- keep awarded-client selection constrained to one linked client
- provide notes, clarifications, pricing snapshots, follow-ups, and outcomes

Added:

- tendering entities and relationships
- tender list/detail/create-update APIs
- seed tender with multiple linked clients
- responsive tender register and create workflow

Known limitations:

- tender create/edit UI is foundation-grade rather than final production polish
- contract issuance and job conversion are intentionally deferred to later modules
- tender document workflows are not included until Module 6

## Module 6: Tender Documents

Purpose:

- add tender-specific document workflows on top of the SharePoint platform foundation
- create and track Tendering folder structure usage
- store tender document metadata in the application database

Added:

- tender document link entity
- tender document APIs for list/create
- tender detail document integration in the web app
- seeded tender document backed by mock SharePoint folder/file links

Known limitations:

- uploads are mock-registered through the SharePoint abstraction rather than true binary upload
- the full generic documents module is still deferred to Module 14

## Module 7: Award / Contract / Job Conversion

Purpose:

- enforce the awarded-client and contract-issued rules on tender lifecycle records
- create one linked job from the contracted awarded client
- carry selected tender data and document links into the new job context
- provide a minimal job register/detail foundation ahead of the deeper Jobs module

Added:

- contract-issued tracking on tender clients
- jobs and job-conversion entities
- award, contract issue, and convert-to-job APIs
- audit coverage for award, contract, and conversion actions
- seeded awarded/contracted tender converted to a job
- tender detail actions and a basic job register/detail web screen

Known limitations:

- jobs remain a foundation slice until Module 8 expands delivery management
- carried documents are linked metadata records rather than copied binaries
- SharePoint folder creation still uses the mock adapter in this phase

## Module 8: Jobs and Delivery

Purpose:

- turn converted jobs into live delivery records
- add stage and activity hierarchy under each job
- track issues, variations, progress entries, daily notes, and status history
- provide a stronger operational job detail workspace ahead of the scheduler module

Added:

- job stages, activities, issues, variations, progress entries, and status history entities
- job update and status update APIs
- create/update APIs for stages, activities, issues, variations, and progress entries
- seeded delivery data for the sample converted job
- expanded jobs web workspace showing linked source tender visibility and live delivery detail

Known limitations:

- scheduler-linked shifts and allocations are still deferred to Module 9
- the jobs UI is still a compact operations workspace rather than the final high-density production experience
- generic documents remains deferred to Module 14 even though job-linked document metadata is visible

## Module 9: Scheduler and Work Planning

Purpose:

- make the scheduler a primary operating surface
- plan shifts under jobs, stages, and activities
- assign workers and assets against shifts
- surface visible red/amber conflict signals for overlapping allocations

Added:

- scheduler entities for shifts, worker assignments, asset assignments, and scheduling conflicts
- scheduler workspace API
- shift create/update APIs and worker/asset assignment APIs
- seeded scheduler data with overlapping worker and asset assignments
- three-pane scheduler web workspace with hierarchy, timeline/calendar modes, and resource assignment panel

Known limitations:

- current assignment interaction is fast-form based rather than full drag-and-drop
- conflict logic currently covers overlapping allocations and partial assignment warnings; competencies and maintenance restrictions will deepen in later modules
- resource-centric planner views will broaden further as Modules 10 to 12 land

## Module 10: Resources and Competencies

Purpose:

- manage worker availability windows, role suitability, and competency-aware assignment context
- expose resource data in a reusable service layer for the scheduler and later asset/forms modules
- warn planners when workers are unavailable, unsuitable for a role, or missing required competencies

Added:

- availability window, worker role suitability, and shift role requirement entities
- resources API for worker listing, availability capture, suitability capture, and shift requirement management
- resources web workspace for worker skills and planning constraints
- scheduler enrichment so worker competency, availability, and role-suitability data is visible in planning
- seeded resource data that triggers real scheduler warnings

Known limitations:

- crew composition support remains basic and will deepen later
- the scheduler resource interaction is still selection-based rather than drag-and-drop
- competency recommendations are rule-based warnings rather than scored recommendations

## Module 11: Assets and Equipment

Purpose:

- replace the basic asset placeholder with a real schedulable asset register
- classify assets by category/type and expose home base and current location
- show asset-to-shift and asset-to-job visibility for planners and supervisors

Added:

- asset category entity and richer asset fields
- dedicated assets API for category management, asset CRUD, and asset detail
- asset detail visibility for linked jobs and shift assignments
- assets web workspace with register, detail, category management, and asset creation
- scheduler asset-panel filtering by category and location-aware display

Known limitations:

- maintenance-driven restrictions are still deferred to Module 12
- the asset workflow is still register-first rather than deeply optimized for mobile field use
- status history and richer lifecycle tracking will expand in later modules

## Module 12: Maintenance

Purpose:

- track maintenance plans, service events, inspections, breakdowns, and asset status changes
- surface due and overdue maintenance states on asset detail and maintenance workspace screens
- feed maintenance impact back into the scheduler so unavailable assets trigger warnings or blocks

Added:

- maintenance entities for plans, events, inspections, breakdowns, and asset status history
- maintenance API for dashboard/detail views and create/update workflows
- maintenance web workspace with recurring plan, event, inspection, and breakdown forms
- asset detail maintenance summary visibility
- scheduler maintenance-aware conflict logic for blocked and warning states

Known limitations:

- maintenance configuration is currently plan-level rather than centralized admin policy
- mobile-first workshop workflows are still basic
- broader document linkage for maintenance records is deferred until the documents module

## Module 13: Forms and Compliance

Purpose:

- provide configurable form templates without code changes
- version templates so historical submissions remain fixed to the version they used
- support operational submissions across job, shift, asset, worker, and site contexts

Added:

- form template, version, section, field, rule, submission, submission value, attachment, and signature entities
- forms API for template listing/detail, version creation, submission listing/detail, and submission create
- forms web workspace for template review, template creation, submission create, and submission review
- seeded daily prestart template with two versions and two submissions bound to different versions

Known limitations:

- template editing currently creates new versions rather than offering a richer visual builder
- conditional logic is minimum viable and rule-based
- file uploads are represented as attachment metadata until the documents module expands storage workflows

## Module 14: Documents

Purpose:

- provide a general documents module backed by the SharePoint foundation
- link documents to jobs, assets, and form submissions through application metadata
- track document versions, tags, and access rules while preserving traceability to SharePoint items

Added:

- documents API for filtered list/detail, entity-scoped views, open/download link resolution, document creation, and version creation
- document tags and document access-rule entities
- version-aware fields on document and SharePoint file metadata
- documents web workspace with filters, document registration, and next-version workflow
- job and asset detail enrichment with linked document visibility
- seeded job, asset, and form-linked document records and SharePoint folder/file links

Known limitations:

- files are still mock-registered through the SharePoint abstraction rather than uploaded through Microsoft Graph
- access rules are app-side visibility controls and do not yet apply native SharePoint ACL changes
- dashboards, closeout, and final hardening still remain as downstream modules

## Module 15: Dashboards and Reporting

Purpose:

- render dashboards from live system data rather than placeholder widgets
- support user-owned and role-owned dashboards
- provide KPI, chart, and table widgets for operations, scheduler, maintenance, tender, and compliance reporting

Added:

- live dashboard render service with KPI, chart, and table widget support
- role ownership relation for dashboards
- list, render, create, and update dashboard APIs
- seeded operations and planner dashboards with live widget configs
- dashboards web workspace that displays rendered widget data and supports user/role dashboard creation via presets

Known limitations:

- widgets currently render from a curated set of metric keys rather than an unrestricted custom query builder
- charts are presented in compact textual form rather than full graphical charting components
- closeout, archive, and the final hardening pass still remain downstream

## Module 16: Closeout and Archive

Purpose:

- close jobs out through a dedicated lifecycle record instead of only a status flag
- preserve archived jobs as read-only historical records
- expose archive views for operational review, audit, and reporting continuity

Added:

- job closeout entity with summary, checklist JSON, archive timestamps, and read-only date
- archive list API and job closeout API
- read-only enforcement for archived jobs across update/create delivery actions
- jobs UI closeout form and archive panel
- seeded archived job for historical visibility

Known limitations:

- closeout checklist is currently JSON-backed rather than a richer configurable checklist builder
- archive UX currently lives inside the jobs workspace rather than a separate dedicated archive route
- the final hardening and consolidation pass still remains downstream

## Module 17: Hardening and Consolidation

Purpose:

- consolidate bootstrap and runtime setup so app initialization is reusable across the server and automated verification
- standardize API error responses for validation and runtime failures
- verify critical end-to-end business flows with a repeatable compliance smoke runner

Added:

- shared Nest app bootstrap helper reused by both `main.ts` and automated compliance checks
- global API exception filter with consistent JSON error payload shape
- repeatable compliance smoke runner that exercises login, tender creation, tender document registration, award, contract issue, tender-to-job conversion, stage/activity creation, shift assignment, conflict visibility, maintenance visibility, form template creation, form submission, documents open-link flow, dashboard rendering, and closeout/archive

Known limitations:

- the compliance runner is a smoke test, not an exhaustive UI automation suite
- SharePoint interactions are still mock-backed, so document verification covers integration flow and metadata rather than live Microsoft Graph file transfer
- scheduler interactions are still API-driven in the compliance pass rather than browser drag-and-drop automation

## Post-Module Hardening Notes

After the main module sequence, the project received additional Tendering-focused hardening and rollout work that is not captured as a separate numbered module.

Highlights:

- Tendering was reshaped toward a more CRM-style `Dashboard / Pipeline / Create / Workspace` flow
- board / list / forecast register surfaces were strengthened
- unified Tendering activity handling was introduced over notes / clarifications / follow-ups
- stakeholder role/note context and communication queue behavior were added to the Tendering workspace
- local Playwright browser coverage was extended across the major Tendering flows
- cross-platform Playwright startup compatibility was later merged into `main`

This means the module list above is accurate for implementation coverage, but the current Tendering experience is materially more mature than the original Module 5 baseline described earlier in this file.
