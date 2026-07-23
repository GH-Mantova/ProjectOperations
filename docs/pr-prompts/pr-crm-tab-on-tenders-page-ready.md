---
premise: '! grep -riq "crm" apps/web/src/pages/tendering/TenderingPage.tsx'
premise_means: The Tenders page has no CRM tab yet — the CRM board still lives only on the orphaned /crm route with no sidebar entry.
scope:
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/crm/**
  - apps/web/src/App.tsx
  - apps/api/src/modules/crm/**
done_when: pnpm build && pnpm lint && grep -riq "crm" apps/web/src/pages/tendering/TenderingPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# CRM board becomes a tab on the Tenders page — build the CRM, do NOT change Tenders

Marco (2026-07-23, mockup v3 APPROVED): the CRM board (informal intake: emails, referrals,
phone-ins) moves onto the Tenders page as a second tab. His exact constraint, binding:
*"don't mess with the current tender schema/functionalities though. we're building the CRM,
not changing tenders."*

Branch: `feat/crm-tab-on-tenders-page`. Reviewer: `GH-Mantova`. No migration.

## What to build

1. `TenderingPage.tsx`: a top-level tab strip — **Tenders | CRM**. The Tenders tab renders the
   register EXACTLY as it renders today (same columns, filters, presets, wizard — a pure
   wrap, zero behavioural change; the diff inside the register section should be
   indentation/extraction only). The CRM tab renders the existing `CrmBoardPage` content
   (extract its body into a reusable component if needed so /crm and the tab share one
   implementation — do not fork it).
2. Routes in `App.tsx`: `/crm` and `/crm/opportunities/:id` keep working — `/crm` may redirect
   to `/tenders?tab=crm` (support that query param so the tab is deep-linkable); the
   opportunity detail page stays a standalone route.
3. Opportunity cards in Quoting/Won/Lost show a live tender chip — `T-#### · <status label>` —
   when `convertedTenderId` is set, click-through to `/tenders/:id`. If the CRM list endpoint
   does not already include the converted tender's number/status, extend the include in the
   CRM module (`opportunityInclude`) — that is a CRM-module change, allowed.
4. Status labels for the chip come from the existing `tenderStatusLabels.ts` exports — import
   them; do not redeclare labels or colours.

## Do NOT — Marco's constraint, verbatim scope
- Do NOT touch `apps/api/src/modules/tendering/**`, `schema.prisma`, or any migration.
- Do NOT change the tender register's columns, filters, statuses, wizard, or any tender API.
- Do NOT add a CRM sidebar entry — the tab IS the entry point (sidebar/nav groups unchanged;
  no sot/ edit needed).
- Do NOT change CRM board behaviour (stages, forecast, Board|Leads sub-tabs stay as-is) beyond
  the tender chip in item 3.
- Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- Update affected unit/e2e specs in the same PR (nav/route specs reference /crm and /tenders).
- If size would exceed 10 files, split (tab shell / chip include) and say so.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
