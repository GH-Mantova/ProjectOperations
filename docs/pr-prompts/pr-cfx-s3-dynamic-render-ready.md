---
premise: '! test -f apps/web/src/components/DynamicFieldSection.tsx'
premise_means: The DynamicFieldSection component does not exist yet — CFX-3 has not run.
scope:
  - apps/web/src/components/DynamicFieldSection.tsx
  - apps/web/src/hooks/useFieldDefinitions.ts
  - apps/web/src/pages/tendering/AddClientModal.tsx
  - apps/web/src/pages/tendering/ClientDetailDrawer.tsx
  - apps/web/src/pages/directory/SubcontractorsPage.tsx
  - apps/api/src/modules/directory/directory.service.ts
  - apps/api/src/modules/master-data/master-data.service.ts
  - apps/web/src/components/__tests__/DynamicFieldSection.test.tsx
requires_file_on_main: apps/web/src/pages/admin/FieldDefinitionAdminPage.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/components/DynamicFieldSection.tsx && grep -rq "DynamicFieldSection" apps/web/src/pages
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# feat(web+api): CFX-3 — dynamic field rendering on client + vendor forms

Implement **SLICE 3** of `docs/plans/configurable-fields-xero-exchange-plan.md`.

Read that plan in full before writing any code. §2 decisions 1 and 7 are load-bearing:
BUILTIN fields bind to typed columns (`record.<key>`); CUSTOM fields bind to
`record.customFields[key]`. Hidden fields do not render. The everyday form stays lean —
custom fields grouped, collapsed by default.

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

### 1. `apps/web/src/hooks/useFieldDefinitions.ts` (new)

Cached fetch of `/field-definitions?appliesTo=<CLIENT|VENDOR>` via the standard fetch
wrapper used elsewhere in `apps/web/src/hooks/**`. Return `{ definitions, loading, error }`.
Cache TTL 60s (mirror the pattern in the existing hooks — do NOT introduce a new cache
library).

### 2. `apps/web/src/components/DynamicFieldSection.tsx` (new)

```tsx
type Props = {
  appliesTo: "CLIENT" | "VENDOR";
  record: Record<string, unknown> & { customFields?: Record<string, unknown> };
  onChange: (patch: Partial<typeof record>) => void;
  errors?: Record<string, string>;
};
```

Behaviour:
- Fetch definitions via `useFieldDefinitions(appliesTo)`.
- Group by `group`, order groups by first-appearance in the sorted list, order fields
  within a group by `sortOrder`.
- **Skip any definition with `visible: false`.**
- BUILTIN fields render bound to `record[key]`; onChange fires
  `onChange({ [key]: newValue })`.
- CUSTOM fields render bound to `record.customFields?.[key]`; onChange fires
  `onChange({ customFields: { ...record.customFields, [key]: newValue } })`.
- Required fields render with a `*` and surface `errors[key]` if present.
- Custom-field groups are collapsed by default (built-in groups expanded) — mirror the
  collapse pattern used in `apps/web/src/pages/tendering/ClientDetailDrawer.tsx`.

Type inference: use string input for now (Marco has locked no custom-type widget in this
slice — that is a follow-up). Keep the component ready to accept a `type` field later.

### 3. `apps/web/src/pages/tendering/AddClientModal.tsx`

Replace the hand-written field grid with:
```tsx
<DynamicFieldSection
  appliesTo="CLIENT"
  record={form}
  onChange={(patch) => setForm({ ...form, ...patch })}
  errors={validationErrors}
/>
```

Preserve every existing submit-time validation and the existing `POST /clients` (or the
current submit endpoint used by this modal) call shape. Do NOT change the submit endpoint.

### 4. `apps/web/src/pages/tendering/ClientDetailDrawer.tsx`

Swap the edit-panel fields for `<DynamicFieldSection appliesTo="CLIENT" ... />`. Preserve
the existing PATCH call shape.

### 5. `apps/web/src/pages/directory/SubcontractorsPage.tsx`

Add/edit form uses `<DynamicFieldSection appliesTo="VENDOR" record={form} onChange={...} />`.
Preserve the existing submit call shape.

### 6. `apps/api/src/modules/directory/directory.service.ts`

Accept `customFields` in the vendor update DTO. On write, load
`FieldDefinition` rows for `appliesTo IN (VENDOR, BOTH)` with `source=CUSTOM`; drop any
key in `dto.customFields` that is not in that whitelist. Log a warning for dropped keys.
Do NOT touch the typed-column update path.

### 7. `apps/api/src/modules/master-data/master-data.service.ts`

Same for `upsertClient`: accept `customFields`, validate keys against `FieldDefinition`
where `appliesTo IN (CLIENT, BOTH)` and `source=CUSTOM`, drop unknown keys.

### 8. `apps/web/src/components/__tests__/DynamicFieldSection.test.tsx` (new)

Vitest cases:
- Given a fixture where field `phone` has `visible: false`, `phone` input is not rendered.
- Given a required field `name`, submitting without a value shows the error passed via
  `errors.name`.
- A CUSTOM field's onChange fires with `{ customFields: { <key>: value } }` (not
  `{ <key>: value }`).
- A BUILTIN field's onChange fires with `{ <key>: value }` (not under customFields).

Use `@testing-library/react` + mocked fetch.

## Do NOT

- Do NOT touch `apps/api/prisma/schema.prisma`, migrations, or seeds (shipped by CFX-1).
- Do NOT touch the FieldDefinition admin page or its API controller (shipped by CFX-2).
- Do NOT touch `xero.service.ts`, `/sot/`, Azure/Entra/SharePoint.
- Do NOT render hidden fields; do NOT let the user submit invalid required fields.
- Do NOT write custom-field keys to typed columns (or vice versa) — the split is strict.
- Do NOT exceed 10 files.
