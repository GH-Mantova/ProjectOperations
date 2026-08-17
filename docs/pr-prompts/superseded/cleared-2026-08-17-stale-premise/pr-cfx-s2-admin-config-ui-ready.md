---
premise: '! test -f apps/web/src/pages/admin/FieldDefinitionAdminPage.tsx'
premise_means: The admin field-config page does not exist yet — CFX-2 has not run.
scope:
  - apps/api/src/modules/field-definitions/field-definitions.controller.ts
  - apps/api/src/modules/field-definitions/dto/**
  - apps/web/src/pages/admin/FieldDefinitionAdminPage.tsx
  - apps/web/src/App.tsx
  - apps/web/src/components/SettingsShell.tsx
  - apps/web/src/pages/admin/__tests__/FieldDefinitionAdminPage.test.tsx
requires_file_on_main: apps/api/src/modules/field-definitions/field-definitions.service.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/admin/FieldDefinitionAdminPage.tsx && grep -q "FieldDefinitionAdminPage" apps/web/src/App.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# feat(web): CFX-2 — admin screen to configure client/vendor field definitions

Implement **SLICE 2** of `docs/plans/configurable-fields-xero-exchange-plan.md`.

Read that plan in full before writing any code. §2 decision 2 is the load-bearing rule:
**built-in fields can only be HIDDEN, never deleted** — the UI must enforce this
visually and the API must enforce it in code (the service, shipped in CFX-1, already does).

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
`pnpm build` and `pnpm lint` must pass.

---

## What to build

### 1. `apps/api/src/modules/field-definitions/field-definitions.controller.ts` (new)

REST controller exposing the service shipped in CFX-1:

- `GET /field-definitions?appliesTo=CLIENT|VENDOR|BOTH` → list.
- `GET /field-definitions/:id` → get.
- `POST /field-definitions` → createCustom (super-user only).
- `PATCH /field-definitions/:id` → update (super-user only).
- `DELETE /field-definitions/:id` → remove (super-user only; service refuses BUILTIN).

Guard every mutating route with the existing super-user guard used by
`apps/api/src/modules/admin-settings/admin-settings.controller.ts` (find it first — do
NOT invent a new permission code). Wire the controller into
`apps/api/src/modules/field-definitions/field-definitions.module.ts`.

### 2. `apps/api/src/modules/field-definitions/dto/` (new)

- `create-field-definition.dto.ts` — `key` (kebab-slug validator), `label`, `group`,
  `appliesTo` (enum), `required` (boolean, optional).
- `update-field-definition.dto.ts` — `label?`, `group?`, `sortOrder?`, `visible?`,
  `required?`. Do NOT declare `key`, `source`, or `appliesTo` here — the service
  independently rejects them, but the DTO shape gives clean 400s.

### 3. `apps/web/src/pages/admin/FieldDefinitionAdminPage.tsx` (new)

Admin page with three tabs (CLIENT / VENDOR / BOTH). For each tab render a table with
columns: **Sort**, **Label**, **Key**, **Group**, **Visible**, **Required**, **Source**,
**Actions**.

Row behaviour:
- **Sort**: up / down arrows (or drag handle) — PATCH `sortOrder` on move.
- **Label**: inline-editable text.
- **Group**: inline-editable text.
- **Visible**: toggle switch. BUILTIN rows show this toggle enabled; toggling off is the
  supported "delete" path for a built-in.
- **Required**: toggle switch.
- **Source**: read-only badge (BUILTIN / CUSTOM).
- **Actions**: Remove button. **Disabled for BUILTIN rows** with tooltip
  "Hide built-in fields instead of deleting them." Enabled for CUSTOM rows → confirm
  modal → DELETE.

"Add custom field" button opens a modal with fields: key (kebab-slug), label, group,
appliesTo, required. On submit, POST `/field-definitions` with `source: "CUSTOM"`.

Use the same table + modal primitives as `apps/web/src/pages/admin/RatesListsAdminPage.tsx`
— do NOT introduce a new UI library.

### 4. `apps/web/src/App.tsx`

Register the route `/admin/field-definitions` → `FieldDefinitionAdminPage`, gated on
super-user (mirror the guard used by other `/admin/*` routes in the same file).

### 5. `apps/web/src/components/SettingsShell.tsx`

Add nav entry **"Field definitions"** under the Administration section (mirror the
existing entries — do NOT invent a new nav group).

### 6. `apps/web/src/pages/admin/__tests__/FieldDefinitionAdminPage.test.tsx` (new)

Vitest cases:
- BUILTIN row's Remove button is disabled with the tooltip text.
- Toggling Visible on a BUILTIN row fires a PATCH with `visible: false` (built-in hide path).
- Add-custom modal round-trip: submitting the modal fires a POST with `source: "CUSTOM"`.
- Deleting a CUSTOM row fires DELETE after confirm.

Use `@testing-library/react` + mocked fetch (the pattern used elsewhere in
`apps/web/src/pages/admin/__tests__/`).

## Do NOT

- Do NOT allow deleting a BUILTIN row from the UI or the API (the service already refuses;
  the UI must not surface a Delete affordance for BUILTIN either).
- Do NOT add a permission code — reuse the existing super-user guard.
- Do NOT touch `apps/api/prisma/schema.prisma`, migrations, seeds, or `Client` /
  `SubcontractorSupplier` service code — those are shipped by CFX-1 and CFX-3.
- Do NOT touch `xero.service.ts`, `/sot/`, Azure/Entra/SharePoint.
- Do NOT exceed 10 files.
