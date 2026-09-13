---
premise: '! grep -q "preview-import" apps/api/src/modules/forms/inspection-builder.controller.ts'
premise_means: The importer creates the DRAFT template straight from the AI's guesses; nothing lets a person review, correct or reject a field before the rows are written.
scope:
  - apps/api/src/modules/forms/inspection-builder.controller.ts
  - apps/api/src/modules/forms/inspection-builder.service.ts
  - apps/api/src/modules/forms/dto/inspection-builder.dto.ts
  - apps/api/src/modules/forms/__tests__/inspection-builder.service.spec.ts
  - apps/web/src/App.tsx
  - apps/web/src/pages/forms/FormImportReviewPage.tsx
  - apps/web/src/pages/forms/__tests__/FormImportReviewPage.test.tsx
  - apps/web/src/pages/forms/ImportFromPdfModal.tsx
done_when: pnpm build && grep -q "preview-import" apps/api/src/modules/forms/inspection-builder.controller.ts && grep -q "forms/import/:jobId" apps/web/src/App.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
module: forms
cluster: fv2-import
cluster_order: 2
requires_on_main: apps/api/src/modules/forms/inspection-builder.service.ts :: resolveProviderConfig(actorId, "forms")
design_ref: https://claude.ai/code/artifact/8e7dbd46-dbbe-4f74-8a8a-d317c9a9fd33
---

# Form import: review the extraction before anything is written

The mock-up (`design_ref`) states 2, 3, 4 and 5. Marco's rulings (Station 06 interview,
2026-09-11): **the review step is in; it lives on its own route `/forms/import/:jobId`, not
in the 480px modal; an unknown field type is still coerced to `text` but the row is flagged
so the reviewer can change it before create.**

## What is true today [MEASURED on origin/main 7d1f00bf]

- One endpoint does everything: `POST /forms/templates/build-from-pdf` extracts, calls the
  model, coerces and **creates** the DRAFT in one request; the modal then navigates to
  `/forms/designer/:id`. The extracted text is discarded after the model call.
- `coerceField` (`inspection-builder.service.ts:392-401`) rewrites any type outside the
  17-value allow-list (`:198-216`) to `text` silently. The designer palette has 28 types.
- `deriveTemplateCode` (`:447-455`) slugs the *name* and appends `-AI-` + 4 random chars,
  discarding the document's own number when it has one.
- The empty-result guard (`:377-379`) emits one empty Section 1 rather than failing.
- `FormsListPage.tsx:461-476` mounts the modal; the route table is `App.tsx:389-390`.

## What to build

### API - split the one request into three

1. `POST /forms/templates/preview-import` (multipart, same multer limits, `forms.manage`):
   extracts, calls the model, coerces - **and does not create**. Returns
   `{ jobId, extractedText, pages, proposal: UpsertFormTemplateDto, provenance }`. The
   proposal is held in a **server-side in-memory store keyed by `jobId` with a 30-minute
   TTL** - no schema, no migration. It survives a page refresh inside the TTL and dies with
   the process; the page handles a miss (see below).
2. `GET /forms/templates/preview-import/:jobId` returns the same payload, or 404 when
   expired.
3. `POST /forms/templates/preview-import/:jobId/create` takes the reviewer's edited
   `UpsertFormTemplateDto` (name, code, category, sections, fields, with rejected rows
   removed by the client), creates the DRAFT exactly as the old path did, and returns the
   template id. `code` is honoured as sent; a collision is the existing 409.

`provenance` is per field, **review-only, never persisted, no new column**: `confidence`
(0-1), `sourcePage`, `sourceLine`, `sourceText`, and `coercedFrom` (the type the model
proposed, when `coerceField` rewrote it). Extend the model envelope to ask for the first
four; `coercedFrom` comes from `coerceField` itself. `normaliseToUpsertDto` stays the single
coercion path.

The old `build-from-pdf` route stays for API callers; the modal stops using it.

### Web - the review page

- `App.tsx`: `<Route path="/forms/import/:jobId" element={<FormImportReviewPage />} />`.
- `ImportFromPdfModal.tsx`: on Extract, call `preview-import`, then navigate to
  `/forms/import/:jobId`. While waiting, show state 2's six-step list. Steps 1-3 and 5-6 are
  countable; **step 4 (the model call) is not** - draw it as an indeterminate shimmer inside
  the determinate list. Do not fake progress across it.
- `FormImportReviewPage.tsx`: state 3 as drawn. Meta bar (sections, fields kept, rejected,
  read verbatim, guessed, type coerced, "will be created as DRAFT v1"); editable name /
  **code** / category up top; the filter segment (All / Needs a look / Guessed / Rejected);
  the two-pane body - source text on the left with page markers and line numbers, the
  proposal on the right grouped by section, one row per field with label, key, type select,
  required tick, options chips, a provenance chip (read / guessed / invented), a confidence
  bar, a source reference that highlights the matching line on the left, and a reject
  toggle. A coerced row carries the `type coerced` marker and the type the model wanted.
  Rejected rows strike through and are excluded from create. Section titles editable;
  rejecting a section rejects its rows.
- State 4 (failure) reuses `sanitiseProviderError` text; state 5 (done) shows what was
  created, what was rejected, and a button into the designer. An expired job (404) renders
  *This extraction has expired - import the document again* with a button back to `/forms`.
- Style with the page's own tokens and the forms module's existing classes. No new colours.

## Do NOT

- Do NOT add a `FormImportJob` table, a column, or a migration. In-memory TTL is the
  ruling for this slice; say in the PR body that a restart forfeits open reviews and that
  the store is per-process, so it holds only while the API runs as one instance.
- Do NOT persist provenance or confidence on `FormField`. Review-only.
- Do NOT change `coerceField`'s allow-list or make it reject. Flag, keep the coercion.
- Do NOT remove or rename `build-from-pdf`.
- Do NOT build a Cognito parser. The tile stays disabled.
- Do NOT widen `CenteredModal`. The review is a page.
- Do NOT touch `sot/**`, `schema.prisma` or migrations.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- inspection-builder
pnpm --filter @project-ops/web test -- FormImportReviewPage
pnpm build
grep -n "preview-import" apps/api/src/modules/forms/inspection-builder.controller.ts
grep -n "forms/import/:jobId" apps/web/src/App.tsx
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the
  absence of a human, not a stop signal. Proceed on best judgement and record the assumption in
  the PR body.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

**HOLD.** Marco arms this. Second in the `fv2-import` cluster; dispatches once S1's
persona-scope change is on `main`.
