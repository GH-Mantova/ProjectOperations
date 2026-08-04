---
premise: "! test -f apps/api/src/modules/forms/ai-form-import.service.ts"
premise_means: There is no multi-source (Word/PDF/Cognito) AI form-import service backed by a registered forms persona on main yet.
scope:
  - apps/api/src/modules/personas/definitions/forms.persona.ts
  - apps/api/src/modules/personas/persona-registry.ts
  - apps/api/src/modules/forms/ai-form-import.service.ts
  - apps/api/src/modules/forms/inspection-builder.controller.ts
  - apps/api/src/modules/forms/forms.module.ts
  - apps/web/src/pages/forms/ImportFromPdfModal.tsx
  - apps/api/src/modules/forms/__tests__/inspection-builder.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/forms/ai-form-import.service.ts && test -f apps/api/src/modules/personas/definitions/forms.persona.ts && grep -q "formsPersona" apps/api/src/modules/personas/persona-registry.ts
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# Forms persona registration + Word/PDF/Cognito AI import

`apps/api/src/modules/forms/inspection-builder.service.ts` already ships a working
PDF-to-draft-template importer (`POST /forms/templates/build-from-pdf`, wired to the
`ImportFromPdfModal.tsx` UI on `FormsListPage.tsx`): it extracts text with `pdfjs-dist`, sends it
to a one-shot AI JSON schema prompt via `AiProvidersService`, and calls
`FormsService.createTemplate` with `status: "DRAFT"` — always human-reviewed before publish. What
is missing is (a) a real **forms persona** in the registry — today `persona-registry.ts` only
registers `tenderingPersona` (`personas/definitions/tendering.persona.ts`), and the PDF importer
piggybacks on the `"tendering"` provider-key scope (`resolveProviderConfig(actorId, "tendering")`)
rather than having its own; and (b) **Word (.docx) and Cognito JSON export** as additional import
sources. `mammoth` (`^1.12.0`) is already a dependency (used today by
`personas/tools/handlers/read-asbestos-register.handler.ts`) — reuse it, do not add a new
package.

## What to build

1. **`apps/api/src/modules/personas/definitions/forms.persona.ts`** (new) — a `formsPersona`
   `PersonaDefinition` (same shape as `tendering.persona.ts`: `slug`, `displayName`,
   `description`, `rootRoutePattern`, `subModes`, `permissionRequired: "forms.manage"`) with one
   sub-mode for import today (further sub-modes are added by later slices — leave `subModes` easy
   to extend, do not over-build).
2. **`persona-registry.ts`** — add `formsPersona` to the `PERSONAS` array.
3. **`apps/api/src/modules/forms/ai-form-import.service.ts`** (new) — `AiFormImportService`,
   the general multi-source importer: keep the existing PDF extraction path
   (`inspection-builder.service.ts`'s `extractPdfText` — call it, do not duplicate it), add a
   `.docx` path using `mammoth.extractRawText`, and add a Cognito JSON export path (parse the
   export's question list into the same intermediate shape `normaliseToUpsertDto` already
   consumes). Route provider resolution through the new `"forms"` persona scope instead of the
   borrowed `"tendering"` one. Always produces a `DRAFT` `FormTemplate` via
   `FormsService.createTemplate` — never auto-publishes.
4. **`inspection-builder.controller.ts`** — add routes/parameters for `.docx` and Cognito-export
   uploads (accept the new mimetypes / a `source` field), delegating to `AiFormImportService`;
   keep `build-from-pdf` working exactly as today (existing tests must keep passing).
5. **`forms.module.ts`** — register `AiFormImportService`.
6. **`ImportFromPdfModal.tsx`** — widen the accepted file types (`.pdf`, `.docx`) and label copy;
   keep the same DRAFT-then-navigate-to-designer flow. Cognito export stays an API capability for
   now if there's no natural UI slot — do not invent a new page for it.
7. Update `inspection-builder.service.spec.ts` coverage/imports if the shared extraction helper
   moves; keep every existing PDF-path assertion green.

## Do NOT

- Do not touch `apps/api/prisma/schema.prisma` — this slice is schema-free.
- Do not change `build-from-pdf`'s existing response shape or its DRAFT-only guarantee.
- Do not add vision/OCR fallback for scanned PDFs — out of scope, unchanged from today.
- Do not auto-publish an imported template under any circumstance.
- Do not touch Azure/Entra/SharePoint, the rules engine, or the push engine.

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
