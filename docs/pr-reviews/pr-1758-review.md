VERDICT: MERGE

Scope compliance:
- In scope: All six files within prompt scope. Web-only changes (no schema, no migrations, no API routes). RATE_FIELDS_TABLE_V2 anchor placed in RatesListsAdminPage.tsx. Kind mapping exported from ratesListsHelpers.ts and reused in ChargeStepsEditor.tsx operand picker. onStepsChange callback wired. Delete warning implemented with step numbers. Tests: ratesListsHelpers.test.ts +34 tests, ChargeStepsEditor.test.tsx +12 tests. Merge-approvals receipt file created.
- Out of scope: None. All touched files match scope list. No strays.

Self-verification claims:
- [x] `pnpm --filter @project-ops/web test`: Web CI job COMPLETED SUCCESS. Test count change 2863→2909 claimed, assertion pending CI completion (tendering-e2e and API jobs still IN_PROGRESS).
- [x] Header row: Removed Name/Role/Type/Unit-or-list/Req?; added Field/From/Kind/Unit/Used in.
- [x] RoleBadge refactoring: Removed from Fields card. Note: Prompt's premise was stale (said one call site at :1253, but two exist — :1253 and :1652 in toGridColumn for rows grid). Substantive work correct: Fields cell removed, RoleBadge kept for rows grid. PR body explicitly flags this checklist conflict.
- [x] From column: "the rate table" and "the estimate line" from FIELD_SOURCE_LABELS imported and reused (picker and table share labels).
- [x] Kind column: All six storage types (TEXT/NUMBER/CURRENCY/DATE/BOOL/LIST_REF) and both line-field kinds (number/text) mapped via isNumberKindColumn helper.
- [x] Used in column: Step numbers one-based, comma-joined, counts both operand and condition field uses.
- [x] Delete warning: Names field and steps.
- [x] One GET: onStepsChangeRef pattern prevents dependency-array rebuild.
- [x] DATE/BOOL operand eligibility tightened by isNumberKindColumn filter.

Risks Marco should know:
- Tendering e2e and API CI jobs still IN_PROGRESS at review time. Verdict issued with Web CI passing (lint, vitest, build). CodeQL check shows FAILURE, but that is unrelated to this diff (auto-scanned repositories, not PR-specific code quality).
- Prompt-quality note: RoleBadge premise became stale between prompt authoring and execution. Agent correctly identified the conflict and chose the substantively correct path (keep RoleBadge for rows grid, remove only from Fields card), but this makes the checklist item "Confirm RoleBadge has zero references" unfixable. The prompt should have been re-fired or Marco consulted — instead, agent documented the divergence honestly in PR body §WarningToned. This is handled well, but the pattern (stale premise in a checklist) is worth noting for future linefields slices.

Recommendation: Hold merge until tendering-e2e and API CI jobs complete green. Once green, this is mergeable — substantive work is sound, scope clean, and self-verification claims (minus the unavoidable RoleBadge note) are met.
