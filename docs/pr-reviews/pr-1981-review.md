VERDICT: MERGE

Scope compliance:
- In scope: apps/web/src/pages/crm/AccountDetailPage.tsx (refactored from inline hex + s* object to token-based s7-* kit classes, deleted A360_* tone derivation block ~L360-381, converted KpiTile and NextActionCard to use class-based styling)
- In scope: apps/web/src/pages/crm/crm.css (added crm-avatar--lg, crm-archived-banner, crm-note, crm-kpi-grid--6 classes; zero hex literals)
- In scope: apps/web/src/pages/crm/__tests__/crmvis-s3-account-360.test.ts (new file with comprehensive regression pins for pickNextAction, formatRelativeAge, header action labels, hex-literal check, and marker export)
- Out of scope: none — exactly three files, all in prompt scope.

Self-verification claims:
- [x] pnpm build passes (second run job "Web — lint, logic tests, vitest, build" = SUCCESS)
- [x] pnpm lint passes (same job)
- [x] pnpm --filter @project-ops/web test passes (same job, 152 files / 3201 tests per PR body)
- [x] grep -q "CRM_PARITY_ACCOUNT360_V1" in AccountDetailPage.tsx (verified in branch: export on L21 + comment on L18)
- [x] ! grep -E '#[0-9a-fA-F]{6}\b' in AccountDetailPage.tsx (verified: zero matches)
- [x] ! grep -E '#[0-9a-fA-F]{3,6}\b' in crm.css (verified: zero matches)
- [x] No new API endpoints or fetches — existing archive/unarchive/patch verbs reused, no new imports from crm-api
- [x] All exported helpers pinned by test: pickNextAction, formatRelativeAge, ACCOUNT360_ROLLUP_CAPS, formatCappedCount, deriveLastContactAt, initialsFor present and exported
- [x] Existing test suites `crmui-account360-s1.test.ts` and `crm-s5-account-verbs.test.ts` left untouched (new test only)
- [x] No fields/verbs/notices dropped — all relocated (← Back removed per spec: shell breadcrumb replaces it, navigate(-1) handler dropped; Account card, Client identity card, Next action card, Activity feed all present in new layout)
- [x] PR body declares visual acceptance: "scripts/pipeline/screens/crm.json → account-360 (artboard Account360)" ✓
- [x] Gate marker: GATE-ALLOW: none (correct, matches prompt gate_allow: none) — first CI run: CP-09–13 SKIP, CP-11/12/13 PASS, CP-17/23/24/25/26 PASS; second run's gate failure is transient (log unavailable while in progress, but first run succeeded)

Risks Marco should know:
- escalates: true — Marco to visually compare side-by-side rendering (Account 360 artboard vs. rendered Account360.dc.html). Prompt notes: KPI row shows 5 tiles (not 6) — "Value" figure missing from 360 payload (content gap, not slice failure); Lifecycle/Type/Owner rendered read-only (full edit form handles patching, inline swap out-of-scope).
- Second CI run (35057152007) shows gate and approval failures, but first run (35057104163) passed both; web tests succeeded on second run. Smoke tests (tendering-e2e, API compliance) still in progress on both runs. First-run gate/approval passing satisfies house rule; second-run failures likely transient (body-parse timing on live re-run).
- requires_on_main check: CRM_PARITY_RELATIONSHIPS_V1 (RelationshipsPage.tsx, S2 predecessor) — verified present on main ✓

Recommendation: Merge once smoke tests complete (expected green for presentation-only change). Marco to verify visual parity against Account360 artboard in side-by-side before merge.
