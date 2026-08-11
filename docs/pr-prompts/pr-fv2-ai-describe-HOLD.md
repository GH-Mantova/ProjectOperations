---
premise: "! test -f apps/api/src/modules/forms/ai-form-describe.service.ts"
premise_means: There is no describe-to-generate draft-template service and no AI rule-drafting bar on main yet.
scope:
  - apps/api/src/modules/forms/ai-form-describe.service.ts
  - apps/api/src/modules/forms/ai-rule-draft.service.ts
  - apps/api/src/modules/forms/inspection-builder.controller.ts
  - apps/api/src/modules/personas/definitions/forms.persona.ts
  - apps/api/src/modules/forms/forms.module.ts
  - apps/web/src/pages/forms/DescribeToGenerateModal.tsx
  - apps/web/src/pages/forms/RuleAiDraftBar.tsx
  - apps/web/src/pages/forms/FormsListPage.tsx
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/forms/ai-form-describe.service.ts && grep -q "AiFormDescribeService" apps/api/src/modules/forms/ai-form-describe.service.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Describe-to-generate + AI rule-drafting bar

The forms persona (`apps/api/src/modules/personas/definitions/forms.persona.ts`, registered in
`persona-registry.ts`) and the DRAFT-only AI import pipeline
(`apps/api/src/modules/forms/ai-form-import.service.ts`, `FormsService.createTemplate` with
`status: "DRAFT"`) already exist on main from the prior AI-import slice. This slice adds the
second AI-order item (LOCKED order, per `sot/06-active-specs.md` section 6): **describe-to-generate**
— a plain-language prompt ("a working-at-heights permit with 2-stage sign-off") produces a draft
template the same way import does — plus the **AI rule-drafting bar** in the rules builder: a
plain-words description of a rule produces a drafted condition/action tree for review, never
saved enabled without a human clicking save (`form-rules-builder-mockup.html`'s AI bar).

## What to build

1. **`apps/api/src/modules/forms/ai-form-describe.service.ts`** (new) — `AiFormDescribeService`,
   takes a free-text description, prompts the AI (through the `"forms"` persona scope the prior
   slice registered) for the same JSON envelope shape `ai-form-import.service.ts` already
   produces, and calls `FormsService.createTemplate` with `status: "DRAFT"`. Reuse the JSON
   parsing/coercion helpers from the import service rather than re-implementing them — extract a
   shared helper if needed, do not duplicate the parser.
2. **`apps/api/src/modules/forms/ai-rule-draft.service.ts`** (new) — `AiRuleDraftService`, takes
   a plain-language rule description plus the current form's field list and returns a **drafted**
   `FormRule.definition`-shaped condition/action tree (per the grammar an earlier rules-storage
   slice landed) for the builder to render — this is a draft object returned to the caller, never
   persisted or enabled by this service itself.
3. **`inspection-builder.controller.ts`** — add `build-from-description` and `draft-rule`
   endpoints, both `forms.manage`-gated, delegating to the two new services.
4. **`forms.persona.ts`** — add `describe` and `rule-draft` sub-modes alongside the existing
   import sub-mode.
5. **`forms.module.ts`** — register both new services.
6. **`DescribeToGenerateModal.tsx`** (new) — the new-form strip tile from the builder mockup;
   posts to `build-from-description`, then navigates to the designer on the returned draft id
   (mirror `ImportFromPdfModal.tsx`'s call/navigate pattern).
7. **`RuleAiDraftBar.tsx`** (new) — a labelled "AI suggestion" input in the rules builder that
   posts to `draft-rule` and hands the returned tree to the existing rule-builder UI state for
   the human to review/edit/save — it must never call a save/enable action itself.
8. **`FormsListPage.tsx`** — wire the new "Describe a form" tile next to the existing PDF import
   entry point.

## Do NOT

- Do not touch `apps/api/prisma/schema.prisma` — this slice is schema-free.
- Do not let the rule-drafting bar save or enable a rule directly — draft-for-review only, a
  human must click save in the existing builder UI.
- Do not duplicate the AI-envelope JSON parser — reuse/share it with the import service.
- Do not touch Azure/Entra/SharePoint, push engine, or output-channel code.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if genuinely nothing to do, say `NO-OP: <reason>` and stop.
- Never ask for or wait on approval.
- If CI fails, read the actual job log before diagnosing — do not guess.
- `pnpm build` and `pnpm lint` must both pass before opening the PR.
