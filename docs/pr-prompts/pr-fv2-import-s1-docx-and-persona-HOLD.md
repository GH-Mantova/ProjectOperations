---
premise: 'grep -q "resolveProviderConfig(actorId, \"tendering\")" apps/api/src/modules/forms/inspection-builder.service.ts'
premise_means: The form importer still resolves its AI key against the tendering persona scope and accepts PDF only.
scope:
  - apps/api/src/modules/forms/inspection-builder.service.ts
  - apps/api/src/modules/forms/inspection-builder.controller.ts
  - apps/api/src/modules/forms/__tests__/inspection-builder.service.spec.ts
  - apps/web/src/pages/forms/ImportFromPdfModal.tsx
  - apps/web/src/pages/forms/FormsListPage.tsx
done_when: pnpm build && grep -q "resolveProviderConfig(actorId, \"forms\")" apps/api/src/modules/forms/inspection-builder.service.ts && grep -q "mammoth" apps/api/src/modules/forms/inspection-builder.service.ts
size: 5
gate_allow: none
seed_only: false
escalates: false
module: forms
cluster: fv2-import
cluster_order: 1
design_ref: https://claude.ai/code/artifact/8e7dbd46-dbbe-4f74-8a8a-d317c9a9fd33
---

# Form import: the persona scope, and Word alongside PDF

Replaces `pr-fv2-ai-import-HOLD.md`, retired to `superseded/` in the same PR. That prompt
carried three premises that no longer hold [MEASURED on origin/main 7d1f00bf, 2026-09-11]:

- "persona-registry.ts only registers tenderingPersona" - it registers `formsPersona` too
  (`persona-registry.ts:3-5`).
- "create definitions/forms.persona.ts" - it exists, slug `forms`, three sub-modes
  (`forms.persona.ts:115`).
- "permissionRequired: forms.manage" - the shipped persona uses `ai.persona.forms`
  (`:126`); `forms.manage` is the endpoint permission (`inspection-builder.controller.ts:69`).

What is left of that slice is small and this prompt is only that.

## What is true today [MEASURED]

- `inspection-builder.service.ts:81` is the **one remaining call site** resolving against
  `"tendering"`. `ai-form-describe`, `ai-form-fill-assist` and `ai-rule-draft` already resolve
  against `"forms"`.
- `POST /forms/templates/build-from-pdf` (`controller.ts:68`) takes one file under
  `MAX_UPLOAD_BYTES` = 10 MB (`:38`), extracts with `pdfjs-dist`, sends the first 40,000
  characters (`service.ts:192`), coerces to `UpsertFormTemplateDto` and creates a DRAFT
  template. The modal (`ImportFromPdfModal.tsx`) is one "Choose PDF..." button and a busy
  label; on success it navigates to `/forms/designer/:id`.
- `mammoth ^1.12.0` is already a dependency of `apps/api` (`package.json:49`). No new package.
- No Cognito parser, fixture or type exists anywhere.

## What to build

### API

- `service.ts:81`: `"tendering"` becomes `"forms"`. Add the spec that asserts the scope.
- Text extraction dispatches on mimetype: `application/pdf` stays on `pdfjs-dist`;
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document` goes through
  `mammoth.extractRawText`. Same 20-character floor, same 40,000-character cap, same
  page-marker concatenation (a .docx has no pages - one marker, `--- Document ---`).
  Anything else is 400 with the accepted list in the message.
- Controller: widen the multer filter to both mimetypes. **The route name and the response
  shape do not change** - `build-from-pdf` stays; the mock-up notes the misnomer and leaves it.

### Web

- `ImportFromPdfModal.tsx`: mock-up **state 1** - a drop zone that accepts the two types, the
  PDF / Word source tiles, the Cognito tile drawn disabled and labelled *API only*, the staged
  file row (name, size, type). **Do not show an extracted-character count before upload** -
  extraction is server-side; the mock-up's own note says so. Busy state is the existing
  label; state 2's six-step progress list is S2's.
- `FormsListPage.tsx:373-385`: the button reads **Import from document...**. Nothing else on
  the page moves.

## Do NOT

- Do NOT create `ai-form-import.service.ts`, a new persona, or touch `persona-registry.ts`
  or `forms.persona.ts`. They are done.
- Do NOT build the review step, a preview endpoint, provenance, confidence or the
  `/forms/import/:jobId` route. That is S2, chained behind this.
- Do NOT invent a Cognito page, parser or fixture. The tile is disabled and that is all.
- Do NOT rename the route, the component or the DTO. Response shape is frozen.
- Do NOT touch `sot/**`, `schema.prisma` or migrations.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- inspection-builder
pnpm build
grep -n '"tendering"' apps/api/src/modules/forms/inspection-builder.service.ts   # must be empty
grep -n "wordprocessingml" apps/api/src/modules/forms/inspection-builder.controller.ts
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

**HOLD.** Marco arms this. Head of the `fv2-import` cluster; S2 waits on
`inspection-builder.service.ts :: resolveProviderConfig(actorId, "forms")`.
