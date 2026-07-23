---
premise: '! grep -rq "generateDraftTender" apps/web/src'
premise_means: There is no one-click "Generate draft" path from a CRM lead to a draft tender yet — users must convert lead→opportunity→tender in separate manual steps.
scope:
  - apps/api/src/modules/crm/**
  - apps/web/src/pages/crm/**
done_when: pnpm build && pnpm lint && grep -rq "generateDraftTender" apps/web/src
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# One-click "Generate Draft" tender from a CRM lead

Marco (2026-07-23): CRM leads should generate a draft in Tenders — his chosen shape (2026-07-23,
follow-up): *a button, "Generate Draft" or similar*. A tender REQUIRES a Site (siteId NOT NULL,
#646 — do not weaken), so the button asks for the site and nothing else.

Branch: `feat/crm-lead-generate-draft-tender`. Reviewer: `GH-Mantova`. No migration.

## What to build

1. API: `POST /crm/leads/:id/generate-draft-tender` in the CRM module. Body: `{ siteId, title? }`.
   Composes the two EXISTING service calls in one transaction-ish flow — do NOT re-implement:
   - If the lead is unconverted: `convertLeadToOpportunity` (requires the lead's clientId or a
     clientId in the body — same 400 message as the existing convert).
   - Then `convertOpportunityToTender` with the given siteId → DRAFT tender via
     `TenderingService.create` (numbering, SharePoint folders, audit all fire as today).
   - Idempotent: if the lead's opportunity already has a convertedTenderId, 409 with that id.
2. Web: on the lead detail/card in `apps/web/src/pages/crm/` (board + any lead drawer), a
   **"Generate draft tender"** action. Opens a small dialog asking ONLY for the Site (reuse the
   existing site picker used by tender create) with optional title override, then calls the
   endpoint (handler named `generateDraftTender` — the name is the done_when contract) and
   navigates to the new tender on success.
3. Show the linked tender chip on the lead/opportunity afterwards (data already comes back via
   convertedTender include).

## Do NOT
- Do NOT make Tender.siteId optional or relax any tender validation.
- Do NOT auto-fire on lead creation/qualification — button-triggered only.
- Do NOT bypass TenderingService.create or the CRM services' existing guards.
- Do NOT touch Azure/prod or SharePoint settings (folder creation via existing code path only).

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- Update affected unit specs (crm.service/controller) in the same PR.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
