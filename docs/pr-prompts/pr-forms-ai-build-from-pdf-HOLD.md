---
premise: '! grep -rqi "fromPdf\|inspectionBuilder\|buildFromDocument" apps/api/src/modules/forms'
premise_means: There is no AI path that turns an uploaded PDF/paper form into a draft form template.
scope:
  - apps/api/src/modules/forms/**
  - apps/api/src/modules/ai-providers/**
  - apps/web/src/pages/forms/**
done_when: pnpm build && pnpm lint && grep -rqi "fromPdf\|inspectionBuilder\|buildFromDocument" apps/api/src/modules/forms
size: 9
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: DO-NOT-ARM (gated) | Forms engine gap 6/6 | AI build-a-form-from-PDF -->
# HOLD — Forms engine: AI build-a-form-from-PDF

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**. Gated on: (1) the integration-keys settings store shipping,
and (2) a document-AI / vision key entered there (or reuse an existing BYOK provider capable of document
parsing). Matches D365 Field Service + SafetyCulture: upload a paper SWMS/checklist PDF, get a draft
`FormTemplate` the user can edit and publish. **Arm only after those two conditions hold.**

## What to build (when armed)
Branch: `feat/forms-ai-build-from-pdf`. Reviewer: `GH-Mantova`. No migration expected.
1. API in the `forms` module — accept an uploaded PDF/image, call the configured document-AI/BYOK provider
   (via the existing `ai-providers` seam + encrypted key store) to extract sections/questions/field types,
   and create a DRAFT `FormTemplate` + version + sections + fields. Never publish automatically.
2. Web — an "Import from PDF" action on `FormsListPage` that shows the generated draft in `FormDesignerPage`
   for review before publish.

## Do NOT
- Do NOT hardcode a provider or key — use the `ai-providers` seam + integration-keys store. Do NOT
  auto-publish generated templates. Do NOT send documents to any provider not configured by the admin.
  Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
