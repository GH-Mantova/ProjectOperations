VERDICT: MERGE

## Scope Compliance

**In scope:**
- Reorganised desktop sidebar from old 6 groups (Commercial, Operations, Directory, Platform, Admin, Field) into the 7 approved groups: Dashboards (Home only), Estimating, Projects, Operations, HR, Safety & Compliance, Settings.
- Updated NAV_GROUPS constant with new structure, labels, and ordering.
- Added NavItem.children field to support collapsible sub-groups (Assets & Equipment in Operations).
- Removed hardcoded seeded-dashboard links (/tenders/dashboard, the two old system dashboards).
- Settings group is the only role-gated group (adminOnly).
- Mobile navigation (shell__tab-bar) correctly uses the first item of each group—unchanged.
- All routes point to existing pages (Directory → /master-data, Rates & Lists → /admin/rates-lists, etc.)—no migrations or route changes.
- Comprehensive test suite rewritten to lock group ids, labels, ordering, role gating, collapsible structure, and Tenders active-match rule.

**Out of scope:** None detected.

## Self-Verification Claims

- [x] `pnpm build` — passed (web tsc + vite build)
- [x] `pnpm lint` — passed (eslint clean)
- [x] `vitest run src/components/__tests__/ShellLayout.nav.test.ts` — 15/15 pass (verified: admin gate, group order, labels, role gates, Estimating items, Projects items, Operations with collapsible Assets & Equipment, HR items, Safety & Compliance items, no /tenders/dashboard entries, Tenders active-match rule)
- [x] `grep -rq "Safety & Compliance" apps/web/src` — matches (premise met)
- [x] Commit message matches prompt intent: structure/labels/ordering only, no route changes, no page component deletions, FIELD nav untouched
- [x] Only 2 files changed: ShellLayout.tsx (295 insertions, 168 deletions) and ShellLayout.nav.test.ts (151 insertions, 151 deletions). No deletions of pages or routes.

## Risks Marco Should Know

None. This PR:
- Changes only the sidebar menu structure and labels—no business logic or route repoints.
- All existing routes continue to function; the 7-group reorganisation is purely a UI rearrangement of the desktop sidebar navigation.
- Mobile nav (field.manage scope, bottom tab bar) remains untouched.
- Role gating is preserved and clarified: Settings is the only admin-only group.
- Collapsible sub-group renderer (Assets & Equipment) is lightweight and defensive (auto-expands when a child route is active).
- Test coverage locks the new structure for future PRs.

The prompt explicitly allows the agent to finish, commit, push, and open the PR; this PR meets all requirements.

## Recommendation

Safe to merge. All self-verification criteria pass, scope is clean, CI pending jobs should complete successfully given the lint/build/test results verified locally. Monitor the remaining CI checks (API smoke, e2e) once they complete, but no code issues detected.
