# Cleared 2026-08-17 - stale premise

All 72 prompts here were armed in `docs/pr-prompts/` and could never dequeue: the intake linter
reports STALE for each, meaning the work its premise asserts is missing has ALREADY SHIPPED. The
watcher would bin every one of them before spawning an agent.

Verified twice: once in a full audit of all 101 armed prompts against origin/main 96b79510, and
again individually at the moment of the move, so nothing was retired on stale evidence.

## Why this mattered
Of 101 armed prompts, only 17 would actually have run. 72 were stale and 12 were rejected. Restarting
the watcher lanes against that queue would have churned through 84 dead prompts and left a dozen
quarantine artifacts before reaching any real work. The standing worry was that a restart would
flood the board with 102 PRs - it would not have; the real problem was rot, not volume.

## Not touched by this PR
- The 17 that lint ADMIT remain armed.
- The 12 that lint REJECT remain in place pending triage - most are schema prompts missing
  `escalates: true`, which is now a genuine merge hold since #1142.

## Retired here

- pr-cfx-s2-admin-config-ui
- pr-cfx-s3-dynamic-render
- pr-cfx-s4-xero-file-export
- pr-cfx-slice0
- pr-claim-autogen-ui
- pr-crm-leads-s1-migration
- pr-crm-leads-s2-reason-list-api
- pr-crm-leads-s3-unified-api
- pr-crm-leads-s4-web-triage
- pr-crm-leads-s5-rename-route
- pr-crm-nav-1-tendering-rename-crm-group
- pr-crm-nav-2-accounts-index
- pr-crm-nav-3-relocate-leads-register
- pr-crm-nav-4-directory-redirects
- pr-crm-s1-account-foundation
- pr-crm-s2-relationship-intelligence
- pr-crm-s3-lead-front-door
- pr-crm-s4-comms-hub-internal
- pr-crm-s5-comms-hub-email
- pr-crm-s6-pipeline-dashboard
- pr-directory-archive-action
- pr-directory-client-centered-modal
- pr-directory-tabs-remove-workers
- pr-fix-789-crm-tab-occlusion
- pr-fix-841-tenders-fold-conflicts
- pr-fix-page-title-nav-alignment
- pr-fix-settings-company-route-adminonly
- pr-fix-tracker-followup-notes-feed
- pr-fv2-fields-whs
- pr-fv2-weather-field
- pr-gate-a-backfill-ci-test
- pr-gate-b-authz-route-guard-test
- pr-hw-10-subcontractors
- pr-hw-2-template-api
- pr-hw-3-template-ui
- pr-hw-6-handover-api
- pr-hw-7-wizard-shell
- pr-hw-8-autofield-safeguards
- pr-mig-s2-tender-import
- pr-mig-s3-sharepoint-legacy-copy
- pr-qa-env-metadata-catalog-path
- pr-r3-t2-fuel-price-feed
- pr-ratehub-s1-hub-tabs
- pr-ratehub-s2-delete-safeguard
- pr-ratehub-s3-sor-source-markup
- pr-rates-lists-settings-only
- pr-rates-s11b-retire-legacy-page
- pr-realtime-presence
- pr-repdash-1-conventions
- pr-repdash-2-parity-audit
- pr-repdash-3-table-widget
- pr-repdash-4-chart-widget
- pr-repdash-5-filters
- pr-repdash-6-export
- pr-repdash-7-starter-template
- pr-roles-perms-admin-redesign-slice0-plan
- pr-settings-s14-dissolve-admin-tabs
- pr-settings-s17-per-screen-permissions
- pr-sor-master-schema
- pr-sor-s2-master-admin-ui
- pr-sor-s4-attach-to-job-wizard
- pr-sor-s6-vc-priced-from-sor
- pr-sor-s7-ar-field-capture
- pr-subbie-rate-cards-ui
- pr-synthetic-fixtures-forms-ingestion-slice3
- pr-synthetic-fixtures-graph-mail-slice2
- pr-tender-lifecycle-s1-pipeline-register-fix
- pr-tender-outcome-capture-api
- pr-tendering-assistant-ae-tab
- pr-timeline-pagination-daterange
- pr-unified-api-key-vault-slice4b-page
- pr-wl3-baseline

## Also retired here ÔÇö rejected AND stale (added in the second pass)

These 10 linted REJECT, which fires BEFORE the premise check and therefore MASKED the fact that
their premises are also dead. Repairing their front-matter would have resurrected finished work.
Each premise was evaluated directly against origin/main before the move.

- pr-cfx-s1-field-registry ÔÇö `model FieldDefinition` is already in schema.prisma
- pr-fv2-fields-wave1 ÔÇö `FormNumberSequence` already exists
- pr-hw-1-template-schema ÔÇö the seed file already exists
- pr-hw-5-handover-schema ÔÇö handover.types.ts already exists
- pr-rates-s11a-build-migrate ÔÇö STEP-11A-DONE.md is already on main
- pr-scope-material-waste-autofill ÔÇö `defaultWasteGroup` already exists
- pr-subbie-rate-cards-model ÔÇö `model SubcontractorRate` already exists
- pr-swms-a1-template-catalog ÔÇö `model SwmsTemplate` already exists
- pr-tenant-mt0-foundation ÔÇö tenant.constants.ts already exists
- pr-tender-withdrawn-review ÔÇö withdrawal-review.service.ts already exists (shipped in #1122)
