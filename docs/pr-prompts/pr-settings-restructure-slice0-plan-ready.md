---
premise: '! test -f docs/plans/settings-restructure-plan.md'
premise_means: The Settings restructure plan document does not exist on main yet.
scope:
  - docs/plans/settings-restructure-plan.md
done_when: pnpm lint && test -f docs/plans/settings-restructure-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0: author the Settings restructure plan (docs-only — the plan IS the first PR)

Marco approved a full restructure of the Settings area on 2026-07-31 after a grounded audit.
Your job: write `docs/plans/settings-restructure-plan.md` — the binding slice plan the code
slices will chain behind. Docs-only PR; no code changes here.

## Audit findings the plan must address (all verified on origin/main 2026-07-31)

1. Sidebar "Settings" group is adminOnly (`ShellLayout.tsx` NAV_GROUPS) — non-admins have NO menu
   path to their own account/notifications/calendar settings (only the topbar avatar).
2. Company-wide Lists manager rendered inside personal My account
   (`UserProfilePage.tsx:25` -> `GlobalListsSection.tsx`); duplicates the Lists tab of
   `/admin/rates-lists`.
3. `/settings/notifications` (`NotificationsPage.tsx`) is a 766-line operational triage inbox,
   not settings; no notification-preferences screen exists anywhere.
4. `AdminSettingsPage` is a 13-tab mega-page duplicating Users (richer `AdminUsersTab` vs weaker
   `UsersPage`), Roles/Permissions (`AdminRolesPermissionsTab` editable matrix vs read-only
   pages), Platform, and shipping a "Coming soon" audit stub beside the working `AuditLogsPage`.
5. Orphan routes: `/admin/automations` (596-line rules engine, zero nav entries) and
   `/admin/estimate-rates` (legacy, duplicates writes into the same tables as the Rates & Lists
   importer under a DIFFERENT permission: estimates.admin vs rates.manage).
6. `/settings/administration` has a breadcrumb title but no route -> 404.
7. Ungated nav entries dead-ending on NoAccess: Company, AI settings (shell), Rates & Lists
   (sidebar, no requiresPermission).
8. `JobRolesPage` (scheduler competency bundles) filed under Administration, colliding with RBAC
   "Roles".
9. Commercial config split three ways: AdminCompanyPage "Commercial defaults" vs AdminSettingsPage
   Operations/Fuel vs Rates & Lists.
10. SharePoint config split between AdminSettingsPage Platform tab and PlatformPage.
11. Off-schema pages (worst first): AdminCompanyPage (96 inline styles/46 raw hex), JobRolesPage,
    AutomationsPage, CalendarSyncPage, PlatformPage; plus a zero-s7 legacy-DS cluster
    (UsersPage, RolesPage, PermissionsPage, AuditLogsPage, NotificationsPage).
12. Guard inconsistency: AdminOnly is role-NAME-string based (`r.name === "Admin"`) while
    out-of-shell surfaces gate on permission codes — renaming the Admin role silently unguards
    eight routes.

Already handled elsewhere — the plan must NOT re-include: Tender Settings deletion + CRM tab
(pr-tenders-fold-crm-settings-nav), list-item masterdata.manage guards (pr-sec-lists-item-guards),
AI-key single write path (pr-sec-ai-keys-single-path).

## Marco's locked decisions (binding)

- Settings sidebar group visible to ALL users; gating moves per-item/per-group inside.
- Target grouping (rethought, replaces current 3-group content):
  - **Personal** (all users): Account (profile only — Lists REMOVED), Notification preferences
    (NEW screen), Calendar sync.
  - **Company** (permission-gated per item): Company profile + consolidated commercial defaults;
    Reference data / Lists (SINGLE home); AI settings; Data model (super-user).
  - **Administration** (admin): ONE Users screen (keep the richer AdminUsersTab capabilities),
    ONE editable Roles & Permissions screen, Audit (working page, stub deleted), Platform
    (integrations single home incl. SharePoint dedup), Automations (adopted into nav),
    AdminSettingsPage mega-page DISSOLVED into the above.
- Notifications inbox moves OUT of Settings to its own page (e.g. /inbox); the bell points there;
  Settings gets the new preferences screen.
- Job roles moves to the HR/Workers area (out of Administration; resolves the Roles collision).
- `/admin/estimate-rates`: plan its retirement — verify Rates & Lists parity first; if parity
  holds, delete; if not, list the gap as a slice.
- Old URLs: prefer redirects into new homes for moved surfaces (these are heavily-used admin
  bookmarks); outright 404 only where a surface is deleted.

## What the plan document must contain

1. Target IA: the final nav tree (sidebar + shell sub-nav), with the gate for every entry
   (permission code, not role name, wherever feasible — propose the unification and name the
   permission codes; flag any that need a Marco decision).
2. Slice list: ordered, each slice <= 10 files, each independently shippable and CI-green, with
   premise + rough scope + dependency edges (requires_merged chains). Small slices beat big ones.
   Include the sot/01 SECTION 9 nav-IA doc-reconcile as its own slice (doc-reconcile PR — never
   mixed with code; CP-24).
3. Re-skin slices for the off-schema pages, separate from the move/merge slices (never move AND
   re-skin in one PR).
4. Redirect map: every old URL -> new home (or 404-by-deletion), explicit.
5. Risks: e2e specs asserting old nav/labels (grep tests/e2e and list the files each slice must
   update), the CI blind spot around ShellLayout.nav.test.ts (flag; do not fix CI config in the
   restructure slices — list it as its own tiny slice).
6. Out of scope: no behaviour changes to underlying admin functions; no schema/migrations except
   where a slice explicitly needs one (declare gate_allow + rollback_strategy in that slice).

Ground every claim you carry forward: re-verify each audit finding against the tree you run in
(grep, with a positive control) before writing it into the plan — the audit is evidence, not
gospel.

## Do NOT

- Do NOT write any code, tests, or sot/ edits in this PR — the plan document only.
- Do NOT re-plan work already queued (tenders-fold, the two security prompts).
- Do NOT invent new features beyond the notification-preferences screen Marco approved.

## VERIFY

- `test -f docs/plans/settings-restructure-plan.md`
- `pnpm lint`
- The plan lists every route from the audit's route table with an explicit disposition
  (keep / move / merge / delete / redirect).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
