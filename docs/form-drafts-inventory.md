# Form Drafts — Discovery Inventory

Phase 0 inventory for the IndexedDB form drafts feature
(branch `feat/form-drafts-indexeddb`, deferred FIX 4 from PR F #108).

**Method**: ripgrep for `<form` and `onSubmit=` across `apps/web/src`,
plus per-file inspection of identified files. The codebase uses
controlled inputs / native HTML forms — no `react-hook-form`.

**Confirmed forms identified**: 24 (per per-file inspection)
**Additional CRUD forms identified by grep count**: see "Pending review"
section below — these have at least one `<form>` element but I haven't
confirmed the slug/context/wire decision yet.

---

## Confirmed inventory

| File path (relative to apps/web/src) | Form description | Form type slug | Context key source | Wire? | Reason if skipped |
|---|---|---|---|---|---|
| pages/forms/FormFillPage.tsx | Dynamic form submission (multi-section, conditional fields, GPS capture, photo/signature). **Already has localStorage draft logic — primary migration target.** | form_submission_fill | submissionId (URL param) | YES | — |
| pages/forms/FormsListPage.tsx | Approval comment textarea (approve/reject modal) | form_approval_comment | submissionId | NO | Single-textarea approval modal — transient, not persistent data entry |
| pages/forms/FormSubmitPage.tsx | Older form-template submission flow (multi-step + review) | form_template_submit | templateId | SKIP | Older flow superseded by FormFillPage; minimal traffic. Re-evaluate if usage data shows otherwise. |
| pages/forms/FormDesignerPage.tsx | Form template designer (field/section/rule editor) | form_template_design | templateId | NO | Configuration tool — not user data entry. Designer state is editor-internal. |
| pages/safety/SafetyPage.tsx | Incident report form (desktop) | safety_incident_create | null | YES | — |
| pages/safety/SafetyPage.tsx | Hazard observation form (desktop) | safety_hazard_create | null | YES | — |
| pages/field/FieldTimesheetPage.tsx | New timesheet | field_timesheet_create | allocationId | YES | Field worker daily timesheet, mobile-first |
| pages/field/FieldTimesheetPage.tsx | Edit timesheet | field_timesheet_edit | timesheetId | YES | — |
| pages/field/FieldSafetyPage.tsx | Incident report (mobile) | field_safety_incident_create | null | YES | — |
| pages/field/FieldSafetyPage.tsx | Hazard report (mobile) | field_safety_hazard_create | null | YES | — |
| pages/field/FieldPreStartPage.tsx | New pre-start checklist | field_pre_start_create | allocationId | YES | — |
| pages/field/FieldPreStartPage.tsx | Edit pre-start checklist | field_pre_start_edit | preStartId | YES | — |
| components/contacts/ContactsTab.tsx | Add/edit contact (used inside Subcontractor + Client detail panels) | contact_create / contact_edit | organisationId + (contactId for edit) | YES | Reassignment confirmation in PR #106 already needs draft preservation if user backs out mid-edit |
| pages/tendering/TenderClarificationLog.tsx | Add RFI | tender_clarification_rfi_create | tenderId | YES | — |
| pages/tendering/TenderClarificationLog.tsx | Add clarification note (call/email/meeting/note/response) | tender_clarification_note_create | tenderId | YES | — |
| pages/projects/AdvanceStatusModal.tsx | Project status transition (with optional date) | project_status_advance | projectId | NO | Two-field modal, single-step confirmation. Not worth a draft round-trip. |
| pages/workers/AvailabilitySection.tsx | Add leave request | worker_leave_create | workerProfileId | YES | — |
| pages/workers/AvailabilitySection.tsx | Add unavailability hold | worker_unavailability_create | workerProfileId | YES | — |
| pages/LoginPage.tsx | Login | login | null | NO | **DENYLIST** — password field |
| pages/LoginPage.tsx | Password reset | password_reset | null | NO | **DENYLIST** — password field |
| portal/pages/PortalLoginPage.tsx | Portal login | portal_login | null | NO | **DENYLIST** — password field |
| portal/pages/PortalAcceptInvitePage.tsx | Portal account activation (set password) | portal_account_activate | null | NO | **DENYLIST** — password field |

---

## Pending review (admin CRUD pages — grep found `<form>` but per-file
## inspection not yet completed)

These pages each contain at least one `<form>` element. Most are admin
CRUD forms (create/edit a master-data entity) — defaulting to **YES**
for the wire decision unless the user reviews and adjusts.

| File path | Forms (count) | Likely form type slug(s) | Context key source | Tentative decision |
|---|---|---|---|---|
| pages/UsersPage.tsx | 1 | user_create / user_edit | userId or null | YES — admin user CRUD, real data entry |
| pages/RolesPage.tsx | 1 | role_create / role_edit | roleId or null | YES — admin role CRUD |
| pages/directory/SubcontractorsPage.tsx | 3 | subcontractor_create, subcontractor_edit, subcontractor_document_upload | subcontractorId or null | YES — confirmed in PR #106 work; document_upload is the metadata modal added in PR D |
| pages/sites/SitesListPage.tsx | 1 | site_create / site_edit | siteId or null | YES — site CRUD modal (the new SiteDetailPage from PR E uses inline edit, not a form here) |
| pages/TenderingSettingsPage.tsx | 1 | tendering_settings | null | SKIP — settings forms, single-tab persistence; rarely abandoned mid-edit |
| pages/workers/WorkersListPage.tsx | 1 | worker_create / worker_edit | workerId or null | YES — worker CRUD |
| pages/contracts/ContractDetailPage.tsx | 1 | contract_variation OR contract_progress_claim (verify which) | contractId | YES — contract data entry (variation or progress claim) |
| pages/jobs/JobsListPage.tsx | 1 | job_create / job_edit | jobId or null | YES — job CRUD |
| pages/projects/ProjectDetailPage.tsx | 1 | project_edit | projectId | YES |
| pages/maintenance/MaintenancePage.tsx | 1 | maintenance_event_create | assetId | YES — log a maintenance event |
| pages/AssetsPage.tsx | 3 | asset_create, asset_edit, asset_breakdown_log (verify) | assetId or null | YES — asset CRUD + breakdown logging |
| pages/MaintenancePage.tsx | 4 | maintenance variants (verify — 4 forms is unusual) | varies | YES (verify — 4 forms suggests multiple entity types in one page) |
| pages/SchedulerPage.tsx | 3 | scheduler_event_create, scheduler_assign_worker, etc. | varies | YES (verify forms vs filter forms) |
| pages/ResourcesPage.tsx | grep not run, presence inferred | resource CRUD | varies | PENDING — not yet inspected |
| pages/MasterDataPage.tsx | grep not run | master-data CRUD | varies | PENDING |
| pages/master-data/MasterDataWorkspacePage.tsx | grep not run | master-data CRUD | varies | PENDING |
| pages/JobsPage.tsx | grep not run | job CRUD | jobId | PENDING |
| pages/PlatformPage.tsx | grep not run | platform admin | null | PENDING |
| pages/DocumentsPage.tsx | grep not run | document upload | varies | PENDING |
| pages/documents/DocumentsWorkspacePage.tsx | grep not run | document upload | varies | PENDING |
| pages/timesheets/TimesheetApprovalPage.tsx | grep not run | timesheet approval comments | timesheetId | LIKELY NO — approval comments, transient |
| pages/account/GlobalListsSection.tsx | grep not run | global list value CRUD | listId | YES |
| pages/workers/WorkerDetailPage.tsx | grep not run | worker edit | workerId | YES |
| pages/workers/QualificationsSection.tsx | grep not run | qualification CRUD | workerId | YES |
| pages/master-data/MasterDataWorkspacePage.tsx | grep not run | master-data CRUD | varies | PENDING |
| pages/MasterDataPage.tsx | grep not run | master-data CRUD | varies | PENDING |
| pages/FormsPage.tsx | grep not run | likely older index page | null | LIKELY SKIP — superseded by FormsListPage |
| pages/tendering/TenderDetailPage.tsx | grep not run | likely status/owner edit | tenderId | YES |
| pages/tendering/TenderingPage.tsx | grep not run | likely filter/search form | null | LIKELY NO — list filters |
| pages/tendering/ScopeOfWorksTab.tsx | grep not run | inline scope row editing | tenderId | SKIP — already has its own backend autosave per scope item |
| pages/projects/GanttChart.tsx | grep not run | likely date pickers | projectId | NO — visualisation form, not data entry |

---

## Summary

**Confirmed YES (wire)**: 15
- FormFillPage (1) — primary migration target (replaces existing localStorage logic)
- Field worker forms (6): timesheets ×2, pre-starts ×2, safety reports ×2
- Safety desktop forms (2): incident + hazard
- Contact CRUD (2): create + edit
- Tender clarifications (2): RFI + note
- Worker availability (2): leave + unavailability

**Confirmed NO (denylisted)**: 4
- LoginPage (login, password reset)
- PortalLoginPage
- PortalAcceptInvitePage

**Confirmed NO (not data entry / transient)**: 2
- FormsListPage approval comment
- AdvanceStatusModal

**Confirmed SKIP**: 2
- FormSubmitPage (older flow, superseded)
- FormDesignerPage (config tool)

**Pending user review**: ~20 admin CRUD pages defaulted to YES.
The `<form>` count is from grep but per-form inspection needed before
wiring. Most are likely YES (genuine CRUD). A few (settings, list
filters, inline-autosave) likely become SKIP.

---

## Open questions for the user

1. **Admin CRUD scope**: do you want every YES-defaulted admin form
   wired in this PR, or limit Phase 1 to the **17 confirmed forms**
   (FormFillPage + field workers + safety + contacts + tender
   clarifications + worker availability) and leave admin CRUD for a
   follow-up PR?
   - Recommendation: **limit to 17 confirmed forms** for this PR.
     Admin CRUD forms are lower-traffic and the foundation can prove
     itself on the higher-value mobile/field path first.

2. **FormFillPage migration**: replace its existing localStorage logic
   wholesale with `useFormDraft`, or keep localStorage as a fallback
   when IndexedDB is unavailable (private mode)?
   - Recommendation: **wholesale replace**. The new store should
     handle the unavailable case gracefully (try/catch + console warn).

3. **TenderingSettingsPage**: settings forms — wire or skip?
   - Recommendation: **skip**. Settings are usually completed in one
     sitting; adding draft state confuses the "did I save?" question.

4. **ScopeOfWorksTab inline autosave**: confirm the existing
   per-row backend autosave is genuinely an autosave (not just a
   submit-on-blur). If autosave: skip. If submit-on-blur: wire.
   - Will verify before Phase 1 starts.

5. **FormFillPage ↔ FormSubmitPage**: confirm FormSubmitPage is truly
   superseded and unused, or whether it still serves some subset of
   templates.

---

## Next step

Per the chain spec, **STOP after this commit**. User reviews,
confirms or adjusts the inventory, then says GO to start Phase 1
(foundation: FormDraftStore, useFormDraft hook, components, purge job,
tests).
