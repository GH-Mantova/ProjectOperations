---
premise: grep -rc "FormOutputDelivery" apps/api/prisma/schema.prisma | grep -q ":0"
premise_means: The FormOutputDelivery delivery-log table (and the output-channel delivery pipeline it backs) does not exist on main yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/
  - apps/api/src/modules/forms/form-output-delivery.service.ts
  - apps/api/src/modules/pdf-rendering/builders/form-submission-html.builder.ts
  - apps/api/src/modules/forms/forms-engine.controller.ts
  - apps/api/src/modules/forms/forms-engine.service.ts
  - apps/api/src/modules/forms/forms.module.ts
  - docs/data-model/relationship-map.json
  - docs/data-model/relationship-map.md
  - docs/data-model/metadata-catalog.json
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/forms/form-output-delivery.service.ts && grep -q "FormOutputDelivery" apps/api/prisma/schema.prisma && grep -q "FormOutputDeliveryService" apps/api/src/modules/forms/form-output-delivery.service.ts
size: 10
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: "The migration only ADDs the new form_output_delivery_logs table (append-only, no other table's columns or FKs are touched, no data backfill). Rollback is a plain DROP TABLE form_output_delivery_logs — nothing else references it, so reverting loses only delivery-attempt log rows, never submission or template data."
---

# Output channels — Settings surface, SharePoint PDF, email copies, webhooks, delivery log + retry

**This is a DO-NOT-MERGE PR — open it and LEAVE IT UNMERGED.**

`FormTemplate.settings` (schema `model FormTemplate`, a `Json @default("{}")` column) is the
documented home for per-form config and already carries `pdfExport` as a legacy flag
(`forms-engine.service.ts`). The pieces this slice rides on already exist on `main`: the PDF
renderer (`apps/api/src/modules/pdf-rendering/pdf-renderer.service.ts`, exposing
`renderHtmlToPdf`/`renderTemplateToPdf`, today only used by
`apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts`), the SharePoint adapter
seam (`apps/api/src/modules/platform/sharepoint.adapter.ts` — `InjectSharePointAdapter` /
`SharePointAdapter` interface with `ensureFolder`/`uploadFile`, live Graph impl in
`graph-sharepoint.adapter.ts`, mock impl in the same adapter file) and the SharePoint service
wrapper (`apps/api/src/modules/platform/sharepoint.service.ts`), plus the notification/email
machinery (`apps/api/src/modules/platform/notifications.service.ts` and
`apps/api/src/modules/email/email.service.ts`). None of these have an outbound-webhook
equivalent — verified, no webhook infrastructure exists in the repo today. This slice adds a
per-form Settings surface, wires the SharePoint-PDF / email / webhook channels behind
`FormOutputDelivery`, and gives failures an immediate manual-retry path.

## What to build

1. **`apps/api/prisma/schema.prisma`** — add `model FormOutputDelivery` logging every channel
   attempt per submission: `submissionId`, `channel` (`sharepointPdf` | `email` | `webhook`),
   `status`, `detail Json`, `attempts Int`, timestamps, FK to `FormSubmission`. Add a migration
   under `apps/api/prisma/migrations/` (folder name containing `fv2_output_delivery_log`).
   `outputChannels: { sharepointPdf: {...}, email: {...}, webhooks: [...] }` is read from
   `FormTemplate.settings` — no schema change needed for the config itself, only the log table.
2. **`GATE-ALLOW: migrations`** — put this bare line at column 0 of the PR body.
3. **`apps/api/src/modules/forms/form-output-delivery.service.ts`** (new) — `FormOutputDeliveryService`
   orchestrates all three channels for a submission (fired after the submission transaction
   commits, or after final approval when the form requires approval — per-channel toggle), each
   attempt logged to `FormOutputDelivery`; exposes a manual retry method
   (`forms.manage`-gated) that re-attempts a specific failed row.
4. **`apps/api/src/modules/pdf-rendering/builders/form-submission-html.builder.ts`** (new) —
   builds the submission HTML `pdf-renderer.service.ts` renders to PDF, mirroring
   `quote-html.builder.ts`'s shape; the delivery service resolves the job's SharePoint folder
   (via `sharepoint.service.ts`) and uploads via the existing adapter — **do not weaken any
   existing Azure/Entra/SharePoint auth; use the existing SharePoint client seam**
   (`SHAREPOINT_ADAPTER` token / `InjectSharePointAdapter`), never call Graph directly.
5. **`forms-engine.controller.ts`** — add the Settings-surface config endpoints (read/write
   `outputChannels` on `FormTemplate.settings`) and a manual-retry endpoint for a failed
   `FormOutputDelivery` row.
6. **`forms-engine.service.ts`** — after submit/approval, queue the enabled channels through
   `FormOutputDeliveryService`, outside the submission transaction, same failure-visibility
   pattern as push bindings (surface immediately, no silent auto-retry).
7. **`forms.module.ts`** — import `EmailModule` (wherever `EmailService` is provided) alongside
   the already-imported `PdfRenderingModule` / `PlatformModule`; register the new service.
8. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json` + `.md` + `metadata-catalog.json`.

## Do NOT

- Do not build the deferred Teams channel — V1 is SharePoint PDF, email, webhooks only.
- Do not create a new Azure app registration, rotate any secret, change any App Service
  environment variable, or touch `graph-sharepoint.adapter.ts`'s credential resolution.
- Do not call Microsoft Graph directly from the new builder/service — go through the existing
  `SharePointAdapter` seam only.
- Do not add a silent scheduled auto-retry — manual retry only (LOCKED).
- Do not touch the push-binding executor's own retry/idempotency logic.

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
- Do not weaken any existing Azure/Entra/SharePoint auth; use the existing SharePoint client seam.
- This PR must be opened and left UNMERGED — do not merge it under any circumstance.
