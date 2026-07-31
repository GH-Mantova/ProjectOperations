# Marco decisions queue — system audit 2026-07-31

Items the weekend run deliberately did NOT act on: each needs your intent, not a fix. Evidence in
2026-07-31-system-audit.md. Recommendation ≠ decision — nothing below is staged.

1. **Jobs vs Projects.** /projects is a live duplicate of /jobs with no sidebar entry; resourcing
   a Job requires its Project. Known: pr-nav-jobs-projects-merge-HOLD awaits the B-P0a model
   merge. Decide: prioritise the model merge, or give /projects an interim nav entry?
2. **Scheduler dual model.** Board tab schedules Shift→Job; Grid tab schedules
   ScheduleAllocation→Project. Two entity graphs behind sibling tabs; work booked in one is
   invisible in the other. Tied to #1.
3. **Worker vs WorkerProfile.** Workers page Roster tab lists workerProfile; the other three tabs
   list worker (no FK between them). A worker added on Roster never appears in
   Availability/Suitability/Competencies. Data-model decision.
4. **Three leave systems.** FieldLeavePage (LeaveRequest, self-service) /
   WorkerLeaveApprovalsPage (LeaveRequest, workers.manage — orphan page!) / AvailabilitySection
   (WorkerLeave, resources.manage). Approving in one silently mutates another; statuses disagree
   (REJECTED vs DECLINED). Pick the canonical flow.
5. **Three issue registers.** Case / CorrectiveAction / SafetyIncident — same shape, three UIs,
   three permission namespaces, no cross-links. Consolidate or formally distinguish?
6. **Orphan pages — adopt into nav, or delete:** /dockets (desktop docket register, well-guarded),
   /expenses (desktop expenses), /workers/leave-approvals, /field/leave + /field/dockets (missing
   from the field nav — product call on what field workers see), /tenders/reports (duplicate of
   /reports — delete?), /master-data/clients-grid (self-described "reference implementation" —
   delete?), /resources (legacy Workers — delete after tab parity check?), surveys pages (where
   do they live?), /admin/automations + /admin/estimate-rates (already in the Settings
   restructure plan's remit).
7. **Directory vs Master-data.** Sidebar "Directory" opens /master-data (Clients+Sites); the real
   unified /directory (Clients/Subs/Contacts) is reachable only via redirects — Subcontractors
   and Contacts are unfindable from the menu. Which page is canonical? (Likely: point nav at
   /directory and give Sites its own home — but Sites already has one under Projects.)
8. **Field Worker role lacks expenses permissions.** The field app ships an Expenses tab every
   field worker sees; the seeded role lacks expenses.view/manage, so it 403s. Granting
   permissions is an authorization decision — approve adding expenses.view+manage to the seeded
   Field Worker role?
9. **Field bell ejects field users.** Bell → /settings/notifications inside the desktop shell,
   no path back to /field. Needs a field-native notifications surface or an in-layout list.
10. **?highlight= search params.** CommandPalette/GlobalSearch emit highlight params on 9 list
    pages; none read them. Implementing = per-page highlight/scroll behaviour (real feature);
    removing = search results just open lists. Which?
11. **Mobile tab bar.** One item per group, no Home tab, admin-shifting layout, and a latent
    crash if group item 0 ever gets gated (sub-group parent has a relative non-route path).
    Needs a designed mobile nav, not a patch.
12. **Global gating model.** isAdminUser is a role-NAME string check; APIs use permission codes.
    The Settings plan fixes its own area; approve extending permission-code gating app-wide?
13. **Payroll export ×2.** TimesheetApprovalPage embeds the same CSV export as PayrollExportPage;
    HR menu lists both. Keep one?
14. **Re-skin program.** Approve an off-schema re-skin slice series (worst-first list in the
    audit doc), mirroring the Settings-restructure re-skin slices?
15. **Notification linkUrl contract.** Several API-emitted linkUrls carry params pages ignore
    (safety ?incident=, jobs ?jobId=...). After #10 is decided, sweep the emitters to match.
