# System-wide UI/nav/guard audit — 2026-07-31 (PR Master, weekend handover)

Scope: every module/menu/surface, same six checks as the Settings audit (placement, duplicates,
dead links/dead-ends, off-schema, orphans, guards). Grounded on origin/main @ 5f3c0e7 by five
parallel sweeps (Estimating, Projects/Ops, HR/Field, Safety/Docs, cross-cutting). All findings
carry file:line evidence; key claims re-verified by hand before prompts were staged.

## Fixed by prompts staged 2026-07-31 (see docs/pr-prompts/)

| Prompt | Defect |
|---|---|
| pr-sec-admin-users-declared-guards | admin-users + access-requests mutations: JwtAuthGuard only, no PermissionsGuard/@RequirePermissions (user create/deactivate/password-reset, access approve/deny) |
| pr-sec-timeline-notes-fail-closed | timeline notes endpoint fails OPEN for unknown entity types (`if (!required) return;`) |
| pr-sec-lists-item-guards (earlier) | list-item PATCH/DELETE/reorder missing masterdata.manage |
| pr-sec-ai-keys-single-path (earlier) | AI keys writable via 2 surfaces, different guards/validation |
| pr-fix-public-form-api-path | public form capture + submission PDF hit wrong API origin/path — broken end-to-end |
| pr-fix-corrective-action-create | "+ New Action" 404s (no create branch) |
| pr-fix-field-docket-worker-source | docket Driver select serves WorkerProfile ids against a Worker FK — every submit fails |
| pr-fix-procurement-notification-link | notifications deep-link to nonexistent /procurement/:id → 404 |
| pr-nav-permission-gates-breadcrumbs | 16/24 sidebar items ungated vs permission-guarded APIs; badge pollers 403 for everyone; 8 live routes breadcrumb to "Workspace"; 15 stale keys |
| pr-route-hygiene-redirects | /archive live orphan duplicate (no redirect); query-dropping redirects; Muster deep-link dead-end; scheduler legacy-segment swallow; double-hop/raw-anchor links |
| pr-quickcreate-new-param | ?new=1 read by zero pages — the "+ Create" menu is decorative |

## Parked for Marco — see 2026-07-31-marco-decisions.md

Structural/product items: Jobs-vs-Projects (known, HOLD prompt exists), scheduler dual resourcing
model, Worker vs WorkerProfile split, three leave systems, three issue registers
(Case/CorrectiveAction/SafetyIncident), orphan-page adoption/deletion set, Directory vs
Master-data canonical home, ?highlight= search params (9 pages), mobile tab-bar redesign (no Home
tab; one-item-per-group), field bell ejecting field users to desktop, Field Worker role missing
expenses permissions, payroll export duplication, role-name-string vs permission-code gating
(global unification), off-schema re-skin program (worst list below), surveys pages (unstyled +
unreachable + undefined s7 classes).

## Off-schema re-skin shortlist (for the eventual program)

Absolute worst: ClientQuotesPanel (167 inline/48 hex), SubcontractorsPage (130/26),
ContractDetailPage (108/34), CompliancePage (91/42), FormFillPage (115/64), FormsListPage
(92/82), CrmBoardPage (70/56, zero s7), ExpensesPage (68/26, zero s7). Zero-s7 clusters: Cases,
Knowledge, CRM, OpportunityDetail, DocketsRegister, WorkerLeaveApprovals, Users/Roles/
Permissions/Audit/Notifications (legacy DS). Undefined class vocabularies: `s7-page*`,
`s7-alert*`, `s7-label`, `s7-form-row`, `s7-section-title`, `s7-type-page-heading` — used by
Surveys/Contracts pages, defined nowhere.

## Full sweep outputs

The five sweep reports (per-surface tables, route|guard|nav matrices, dead-reference lists) are
preserved in the PR Master session of 2026-07-31; the material facts are captured above and in
the staged prompts. Re-run the sweeps rather than trusting this document after significant nav
changes.
