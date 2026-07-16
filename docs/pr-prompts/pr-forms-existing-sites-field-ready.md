---
premise: '! grep -rqiE "existing_site|existingSite|SITE_PICKER|site_dropdown" apps/api/src/modules/forms apps/web/src/pages/forms'
premise_means: The form builder has no "existing sites" picker field type yet (scoped to the forms module, so it does not false-match the dashboard widget code).
scope:
  - apps/api/src/modules/forms/**
  - apps/web/src/pages/forms/**
done_when: pnpm build && pnpm lint && grep -rqi "existing_site" apps/api/src/modules/forms
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Form builder: an "existing sites" picker field type (author can mark required)

Marco's decision (2026-07-15): `FormSubmission.siteId` STAYS NULLABLE at the DB level. Site capture on
forms is a per-form choice, NOT a schema NOT NULL constraint. A form author can add an "existing sites"
dropdown field (populated from the `Site` table) and toggle it required; enforcement is per-form, at
submission-validation time, driven by the field's `required` flag.

## What to build

1. **New field type** `existing_site` (or the module's existing naming convention) added to the form
   field-type union/validator in `apps/api/src/modules/forms/dto/forms.dto.ts` and wherever the
   field-type set is enumerated (`forms.service.ts`, `forms-engine.service.ts`). This is a string
   field-type value — **no Prisma schema change, no migration.**
2. **Option source**: when a form renders/validates an `existing_site` field, populate/validate its
   value against the `Site` table (id + name). Add the read path the fill page needs (reuse the
   existing sites list endpoint if one exists; do not duplicate it).
3. **Builder UI** (`apps/web/src/pages/forms/FormDesignerPage.tsx` + `formDesignerState.ts`): the new
   field type appears in the palette; the author can toggle `required`.
4. **Fill + validate** (`FormFillPage.tsx`): renders a dropdown of existing sites; on submit, if the
   field is `required` and empty, block submission with a field error. Show the chosen site on
   `FormSubmissionDetailPage.tsx`.

## Do NOT

- Do NOT add a DB `NOT NULL` on `FormSubmission.siteId`, and do NOT add a Prisma migration. This is a
  form-builder field type only, enforced per-form at submit time.
- Do NOT touch the dashboard "site" code (`apps/web/src/dashboards/**`) — unrelated.
- Do NOT build a free-text site field; it must pick from existing `Site` rows.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. Never exit silently -- if the field type already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval -- there is no human in this run.
- Read the CI job log before diagnosing any failure. `pnpm build` + `pnpm lint` must pass.
