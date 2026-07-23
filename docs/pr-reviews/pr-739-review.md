VERDICT: BLOCK

Scope compliance:
- In scope: SettingsShell component, left sub-nav with Personal/Company/Administration sections, role-gating of Administration at nav level, styling updates to AdminSettingsPage (UTF-8 fixes for mojibake, design-system tokens), route consolidation for /settings/*, legacy path redirects.
- Out of scope: None identified.

Self-verification claims:
- [PASS] pnpm lint passes
- [PASS] pnpm build passes
- [PASS] grep -rq "SettingsShell" apps/web/src (SettingsShell.tsx exists and is imported)
- [FAIL] Legacy paths redirect, but test "viewer sees NoAccess on admin settings, not a silent redirect (#544)" is failing

CI Status:
- CodeQL: PASS
- PR gates: PASS
- Data model sanity: PASS
- API lint/test/smoke: PASS
- Web lint/build: PASS
- tendering-e2e: FAIL — 1 test failure in batch8-admin-portal.spec.ts line 162

Test Failure Details:
Test: "viewer sees NoAccess on admin settings, not a silent redirect (#544)"
Expected URL: /admin/settings (to show failure honesty per sot/01 SECTION 6)
Actual URL: /settings/administration/system (silent redirect)

Root Cause:
The PR redirects /admin/settings to /settings/administration/system BEFORE permission checks occur. This violates PR #544's requirement that non-admin users stay at the legacy /admin/settings URL and see a NoAccess component in place, rather than being silently redirected. The redirect is at the route level in App.tsx (line 319 of diff), so it applies to all users regardless of role.

Recommended Fix:
The /admin/settings route should NOT redirect. Instead:
1. Keep /admin/settings route to render <AdminSettingsPage /> (which already has NoAccess guard logic at line 62 of AdminSettingsPage.tsx)
2. OR modify the route to render a shell that shows /admin/settings in the URL but displays NoAccess for non-admins when accessed directly

Recommendation: Re-fire the prompt with clarification that legacy /admin/settings must show NoAccess in-place for non-admins (no redirect), preserving failure honesty.
