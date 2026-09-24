---
premise: 'grep -q "sourceFieldKey" apps/web/src/pages/forms/FormDesignerPage.tsx'
premise_means: The web app still sends and reads the retired flat FormRule shape, so the moment the API stops accepting it three screens start returning 400 - the rules builder save, the designer publish, and template creation.
scope:
  - apps/web/src/pages/FormsPage.tsx
  - apps/web/src/pages/forms/FormDesignerPage.tsx
  - apps/web/src/pages/forms/FormRulesBuilderPage.tsx
  - apps/web/src/pages/forms/formDesignerState.ts
  - apps/web/src/pages/forms/__tests__/formDesignerState.test.ts
  - docs/pr-prompts/superseded/pr-formrule-legacy-payload-retire-HOLD.md
done_when: pnpm build && pnpm lint && grep -q "FORMRULE_LEGACY_PAYLOAD_RETIRED_V1" apps/web/src/pages/forms/FormRulesBuilderPage.tsx && ! grep -q "sourceFieldKey" apps/web/src/pages/forms/FormDesignerPage.tsx && ! grep -q "sourceFieldKey" apps/web/src/pages/FormsPage.tsx && ! grep -q "sourceFieldKey" apps/web/src/pages/forms/formDesignerState.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
module: forms
fixes_pr: 2158
---

<!-- SUPERSEDED: shipped in PR opened 2026-09-25. -->

This prompt has been executed and retired. The web-side FormRule legacy payload has been
removed from FormRulesBuilderPage, FormDesignerPage, FormsPage, and formDesignerState.
