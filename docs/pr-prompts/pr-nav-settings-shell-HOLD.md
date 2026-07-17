---
premise: '! grep -rq "SettingsShell" apps/web/src'
premise_means: There is no unified Settings shell; the settings and admin pages are still scattered across separate top-level routes.
scope:
  - apps/web/src/**
done_when: pnpm build && pnpm lint && grep -rq "SettingsShell" apps/web/src
size: 9
gate_allow: none
seed_only: false
escalates: false
---

# Settings shell: one area with Personal / Company / Administration sections

Per Marco 2026-07-17: fold the scattered settings + admin pages into ONE `SettingsShell` with a left
sub-nav:
- **Personal:** Account (`/account`), Notifications (`/notifications`), Calendar sync (`/account/calendar-sync`)
- **Company:** Company (`/admin/company`), AI Settings (`/admin/ai-settings`), Data Model (`/admin/data-model`)
- **Administration (admin/super ONLY):** Users (`/admin/users`), Roles (`/admin/roles`),
  Permissions (`/admin/permissions`), Audit (`/admin/audit`), Platform (`/admin/platform`),
  Job Roles (`/admin/job-roles`)
- Admin Settings (`/admin/settings`)

Reuse the existing page components as panels inside the shell. Keep existing routes working (redirect
them into the shell, e.g. `/admin/users` -> `/settings/administration/users` or render in-shell).
Role-gate the Administration section so non-admin roles never see it.

This shell REPLACES the current `AdminSettingsPage` (`/admin/settings`), which already hosts these
tabs but is built with ad-hoc inline styles and a hand-rolled grid. Rebuild it with the design-system
(`AppCard`, `s7-type-page-heading`, theme tokens) instead of inline styles, AND fix the ~11 mojibake
characters in that file (corrupted em-dashes/apostrophes such as `â€"` -> `—`, `â€™` -> `’`) — save the
file as UTF-8. This closes the `/admin/settings` "broken page" report.

## Do NOT
- Do NOT change auth/permission logic itself — only gate visibility of the Administration section
  using the existing role checks.
- Do NOT touch the FIELD (mobile) nav.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
One attempt. Never exit silently (`NO-OP: <reason>`). Never ask or stand by. `pnpm build` +
`pnpm lint` must pass. Read the CI job log before diagnosing any failure.
