---
premise: ! test -f apps/web/src/pages/forms/FormRulesBuilderPage.tsx
premise_means: There is no full-screen visual rule builder route/component yet — authors can only attach rules by hand-editing FormField.conditions/actions JSON.
scope:
  - apps/web/src/pages/forms/FormRulesBuilderPage.tsx
  - apps/web/src/pages/forms/FormDesignerPage.tsx
  - apps/web/src/App.tsx
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/api/src/modules/forms/rules-engine.service.ts
  - apps/api/src/modules/forms/forms-engine.service.ts
  - apps/api/src/modules/forms/dto/forms.dto.ts
  - packages/config/src/forms-rule-definition.ts
  - apps/web/src/pages/forms/__tests__/FormRulesBuilderPage.test.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/forms/FormRulesBuilderPage.tsx && grep -q "FormRulesBuilderPage" apps/web/src/App.tsx && grep -q "WARN" apps/api/src/modules/forms/rules-engine.service.ts
size: 9
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# F-2c — full-screen rules builder + WARN/BLOCK submit actions + acknowledgement

## What exists on main (after F-2a/F-2b)

- `apps/web/src/pages/forms/FormDesignerPage.tsx` (route `/forms/designer/:templateId`, registered in
  `apps/web/src/App.tsx`) is the form builder shell — fields, sections, palette. There is no rules UI:
  authors have no way to attach a `FieldRule` to a field except by API/JSON.
  `apps/web/src/pages/forms/FormFillPage.tsx` and `apps/api/src/modules/forms/rules-engine.service.ts`
  now share one condition/group evaluator (`@project-ops/config/forms-rule-definition`, F-2a/F-2b) that
  evaluates form-value conditions only — no submit-time WARN/BLOCK gate, no acknowledgement trail.
- `RulesEngineService.collectOnSubmitActions` (`apps/api/src/modules/forms/rules-engine.service.ts`)
  already gathers `on_submit`-triggered `RuleAction[]`, but the `RuleActionType` union
  (`show`/`hide`/`require`/.../`submit_form`/`send_notification`/`create_record`/...) has no WARN or
  BLOCK action type, and nothing records that a user acknowledged a WARN.
- Per sot/06 (locked decision, restated in `docs/plans/forms-v2-f2-rules-slice-plan.md`): **form-value
  conditions ONLY** here — system-value conditions (e.g. current user role, date/time) are F-10 and out
  of scope.

## What to build

1. **New route/component** `apps/web/src/pages/forms/FormRulesBuilderPage.tsx` — a full-screen visual
   rule builder for one `FormTemplateVersion`: pick a target field, build a `ConditionGroup` (AND/OR,
   nested groups, one row per `Condition` using the shared `ConditionOperator` list from
   `@project-ops/config/forms-rule-definition`), and attach `RuleAction[]` (show/hide/require/unrequire/
   set_value/WARN/BLOCK). Only form-value conditions — the field picker sources from the template's own
   fields, not system values.
2. Register the route in `apps/web/src/App.tsx`, e.g.
   `<Route path="/forms/designer/:templateId/rules" element={<FormRulesBuilderPage />} />`, and add an
   entry point (button/link) from `apps/web/src/pages/forms/FormDesignerPage.tsx`.
3. **WARN/BLOCK actions**: extend `RuleActionType` in `@project-ops/config/forms-rule-definition` (shared
   type from F-2a) with `"warn"` and `"block"`. Update
   `apps/api/src/modules/forms/rules-engine.service.ts`'s `collectOnSubmitActions` consumer path and
   `apps/api/src/modules/forms/forms-engine.service.ts`'s submit flow so a matched `block` action stops
   submission (return a validation-style error) and a matched `warn` action requires an acknowledgement
   before the submission proceeds.
4. **Acknowledgement recording**: add an `acknowledgedWarnings` capture on submit — thread it through
   `apps/api/src/modules/forms/dto/forms.dto.ts` (submit DTO) and persist it (reuse
   `FormSubmissionValue.valueJson` or `FormSubmission` — do not add a new table/column without a
   migration, which is out of scope for this non-schema slice; store it as part of the existing
   submission payload shape).
5. **Timing field**: add a `trigger` control in the builder UI mapping to the existing
   `FieldRule.trigger` (`on_change` | `on_load` | `on_submit`) — no new type needed, `FieldRule` already
   has it (`apps/api/src/modules/forms/rules-engine.service.ts` / shared type).
6. Wire `apps/web/src/pages/forms/FormFillPage.tsx` to render the WARN acknowledgement prompt (modal or
   inline banner) on submit when a `warn` action matches, and to block submission entirely on `block`.
7. Add `apps/web/src/pages/forms/__tests__/FormRulesBuilderPage.test.tsx` covering: adding a condition
   row, nested AND/OR group, attaching a WARN action, and attaching a BLOCK action.

## Do NOT

- Do not add system-value conditions (current user, date/time, worker qualifications, etc.) — that is
  F-10, explicitly out of scope per sot/06.
- Do not touch `apps/api/prisma/schema.prisma` or add a migration — reuse existing JSON columns/fields.
- Do not touch repeating-section operators (`has-any-entry-where`, `count`, column-total) — that's F-3.
- Do not touch Azure/Entra/SharePoint.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt; never exit silently — if something is genuinely impossible, say `NO-OP: <reason>` instead
  of stopping quietly.
- Never ask for or wait on approval.
- If CI fails, read the actual job log before diagnosing — don't guess.
- `pnpm build` and `pnpm lint` must both pass before opening the PR.
