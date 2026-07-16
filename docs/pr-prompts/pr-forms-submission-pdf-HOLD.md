---
premise: '! grep -rqi "renderSubmissionPdf\|submissionPdf\|renderFormPdf" apps/api/src/modules/forms'
premise_means: A form submission cannot be rendered to a branded PDF / evidence pack (pdfExport is a settings flag only).
scope:
  - apps/api/src/modules/forms/**
  - apps/api/src/modules/pdf-rendering/**
  - apps/web/src/pages/forms/**
done_when: pnpm build && pnpm lint && grep -rqi "renderSubmissionPdf\|submissionPdf\|renderFormPdf" apps/api/src/modules/forms
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | Forms engine gap 5/6 | submission -> branded PDF / evidence pack -->
# Forms engine — submission to branded PDF / evidence pack

STATUS: DRAFTED, STAGED, arm-eligible. Extends the EXISTING forms engine (PR #97). The template settings
blob already carries a `pdfExport` flag, but nothing renders a submission to PDF. Reuse the existing
`pdf-rendering` module (the quote-PDF engine) so a completed inspection/permit/credential can be exported
as a branded PDF + attachments evidence pack.

## What to build
Branch: `feat/forms-submission-pdf`. Reviewer: `GH-Mantova`. No migration.
1. API — a `renderSubmissionPdf(submissionId)` path in the `forms` module that composes the submission
   (template layout, answers, score/outcome if present, signatures, photos/attachments, GPS + timestamp)
   and renders via the existing `pdf-rendering` service; endpoint to download it. Honour the `pdfExport`
   setting/branding already used by the quote PDF.
2. Web — a "Download PDF" action on `FormSubmissionDetailPage`.

## Do NOT
- Do NOT stand up a new PDF engine — REUSE `pdf-rendering`. Do NOT touch Azure/prod. If the quote-PDF
  Chrome/Puppeteer path is broken locally, say so as `NO-OP` and reference the known fix; do not
  re-diagnose. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
