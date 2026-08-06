---
premise: ! test -f apps/web/src/pages/handover/HandoverWizardPage.tsx
premise_means: B-HW-7 (handover wizard UI shell — launched from confirm, renders pinned template as steps, draft/resume) is not built.
scope:
  - apps/web/src/pages/handover/**
  - apps/web/src/pages/contracts/**
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/handover/HandoverWizardPage.tsx
size: 9
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main:
  - apps/api/src/modules/handovers/handovers.service.ts
  - apps/web/src/pages/settings/HandoverTemplatePage.tsx
---

# feat(web): handover wizard shell (B-HW-7)

Implement **B-HW-7** of `docs/plans/contract-handover-wizard-plan.md`. Add `HandoverWizardPage.tsx`:
launched from the Move-to-Contract confirmation, it loads the handover (B-HW-6) and renders the
**pinned template version** as a step-per-section wizard (Pricing & budget first = item #1). Support
draft save/resume, a per-section "Section Done" toggle, and an overall completion bar on both the
wizard and the `/contracts` row. Field rendering follows each field's type/sourceType. Route in
`App.tsx`.

## Do NOT
- Do NOT implement the edited/reset safeguards, variance, compliance derivation, subbies, or the
  finalise→create-job flow (B-HW-8/9/10/11). Do NOT add a migration. Do NOT touch `/sot/`.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
