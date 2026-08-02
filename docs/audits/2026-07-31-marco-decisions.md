# Marco decisions queue — system audit 2026-07-31

**STATUS 2026-08-03: ALL 15 DECIDED by Marco (PR Master session). Outcomes below; execution
staged the same day. This file is now a record, not a queue.**

1. **Jobs vs Projects — DECIDED: prioritise the model merge.** SLICE-0 plan prompt staged
   (`pr-plan-model-merge-slice0`); Phase A = Job<->Project, Phase B = Worker<->WorkerProfile,
   strictly sequential. `pr-nav-jobs-projects-merge-HOLD` stays HOLD pending the plan.
2. **Scheduler dual model — DECIDED: resolved through the model-merge plan** (Phase A
   includes scheduler unification).
3. **Worker vs WorkerProfile — DECIDED: Phase B of the same plan**, behind Job<->Project.
4. **Three leave systems — DECIDED: LeaveRequest canonical, one approvals home.**
   Slice 1 staged (`pr-leave-consolidation-s1`: approvals surfaced + gated, status vocabulary
   unified); slice 2 (retire AvailabilitySection approve/decline, data reconciliation) follows.
5. **Three issue registers — DECIDED: CONSOLIDATE into one register** (Marco went beyond the
   cross-link recommendation). SLICE-0 plan prompt staged
   (`pr-plan-issue-register-consolidation-slice0`); WHS append-only constraints explicitly in
   the plan's remit; nothing irreversible before Marco reviews the plan.
6. **Orphans — DECIDED:** ADOPT /dockets + /expenses (desktop nav,
   `pr-nav-adopt-dockets-expenses`) and /field/dockets + /field/leave (field nav — explicit
   opt-in, `pr-field-nav-dockets-leave`); /maintenance/utilisation stays link-only.
   DELETE /tenders/reports, /master-data/clients-grid, /resources (route; parity-checked),
   /surveys pages (`pr-delete-orphan-pages`, `pr-directory-canonical`).
7. **Directory vs Master-data — DECIDED: /directory canonical.** Nav retargeted,
   /master-data redirects, clients-grid dies (`pr-directory-canonical`).
8. **Field Worker expenses — DECIDED: grant expenses.view + expenses.manage.** Seed staged
   (`pr-seed-fieldworker-expenses`); PROD grant is Marco's manual step via Settings -> Roles.
9. **Field bell — DECIDED: field-native notifications list** (`pr-field-notifications-list`).
10. **?highlight= — DECIDED: implement.** Pattern slice staged
    (`pr-search-highlight-slice1`: Jobs/Tenders/Workers); rollout slice follows.
11. **Mobile tab bar — DECIDED: quick fix now** (`pr-mobile-tabbar-quickfix`: Home tab, skip
    sub-group parents, respect gates); full mobile-nav design = future PR Master brief.
12. **Global permission-code gating — DECIDED: yes, app-wide after Settings slice 17.**
    Follow-up sweep prompt to be staged once slice 17 merges (tracked here).
13. **Payroll export ×2 — DECIDED: dedicated page wins**; tab links to it
    (`pr-payroll-export-dedup`).
14. **Re-skin program — DECIDED: worst-first drip-feed.** Scanner stages 1-2 style-only
    re-skin prompts per week from the ranked list in 2026-07-31-system-audit.md; never mixed
    with moves.
15. **Notification linkUrl contract — DECIDED: follows #10.** After the highlight rollout,
    sweep API linkUrl emitters to the same consumed-param contract.

**Settings plan decisions (same session):** plan approved as written; missing permission
codes CREATED AS NAMED (company.manage, automations.manage, audit.view, platform.manage,
ai.manage); Job roles -> /workers/job-roles; Automations surfaced in Administration nav.
Slices 1+2 staged (`pr-settings-s1-permission-map`, `pr-settings-s2-ci-vitest`); later waves
chain behind merges.
