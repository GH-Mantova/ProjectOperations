VERDICT: MERGE

Scope compliance:
- In scope: All six files match the prompt's scope exactly:
  - apps/web/src/pages/FormsPage.tsx (removed rules type, rules literal, Rules display subsection)
  - apps/web/src/pages/forms/FormDesignerPage.tsx (removed rules from type, initial draft, load mapping, publish payload)
  - apps/web/src/pages/forms/FormRulesBuilderPage.tsx (removed rules from publish payload; added sentinel export)
  - apps/web/src/pages/forms/formDesignerState.ts (removed DraftRule type, rules from DesignerDraft, simplified deleteFieldFromDraft)
  - apps/web/src/pages/forms/__tests__/formDesignerState.test.ts (updated test fixtures and assertions; it() block remains non-empty)
  - docs/pr-prompts/superseded/pr-formrule-legacy-payload-retire-HOLD.md (prompt retired with SUPERSEDED marker)
- Out of scope: None detected. Zero API, SOT, or prisma files touched. CorrectiveActionDetailPage.tsx correctly left untouched (different model's sourceFieldKey).

Self-verification claims:
- FORMRULE_LEGACY_PAYLOAD_RETIRED_V1 sentinel in FormRulesBuilderPage.tsx: PASS (grep confirmed in diff)
- sourceFieldKey NOT in FormDesignerPage.tsx: PASS (all instances removed)
- sourceFieldKey NOT in FormsPage.tsx: PASS (all instances removed)
- sourceFieldKey NOT in formDesignerState.ts: PASS (all instances removed)
- pnpm build (web): PASS (CI job "Web — lint, logic tests, vitest, build" = SUCCESS)
- pnpm lint (web): PASS (same CI job = SUCCESS)

Risks Marco should know:
- Two CI checks remain IN_PROGRESS (tendering-e2e, API — lint, test, compliance smoke) but both are unrelated to this web-only PR. Web build/lint already green. These will not block merge once they complete.
- Prompt deviation: File was ADDED to superseded/ rather than moved via `git mv`. The old HOLD file (gitignored) becomes orphaned but causes no harm. Substantive intent (retire prompt to superseded) is achieved.
- Outside-caller question: PR body correctly reports no internal callers send `rules` to /forms/templates endpoints, and correctly documents that external callers (if any) cannot be verified. This matches the prompt's instruction.
- Ordering gate: This PR must merge BEFORE #2158 to prevent API 400s. The premise is sound: today's API has `rules` as optional; once #2158 lands (which removes rules from DTO), any lingering web payload sends to 400. This PR eliminates the web-side sends, so it's safe to land on main right now, and safe to land before #2158.

Recommendation: Wait for tendering-e2e and API tests to complete (both unrelated to scope), then merge. No red flags in the diff, all web verifications pass, scope is clean.
