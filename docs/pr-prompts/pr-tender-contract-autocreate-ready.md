---
premise: '! grep -rq "createFromTender" apps/api/src/modules/contracts'
premise_means: Moving a tender to CONTRACT_ISSUED does not auto-create a Contract yet — contracts are still hand-created per project.
scope:
  - apps/api/src/modules/contracts/**
  - apps/api/src/modules/tendering/**
  - apps/api/src/modules/projects/**
done_when: pnpm build && pnpm lint && grep -rq "createFromTender" apps/api/src/modules/contracts
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# Auto-create a Contract when a tender moves to CONTRACT_ISSUED

Marco (2026-07-23, ERP review): *"when a tender is moved to contract it should generate a new
contract under contracts automatically."*

Today the chain is fully manual: tender → AWARDED → `POST /tenders/:id/convert` (project) →
someone remembers to create a Contract on the Contracts page. This PR closes the gap at the
status transition.

Branch: `feat/tender-contract-autocreate`. Reviewer: `GH-Mantova`. No migration.

## What to build

1. `ContractsService.createFromTender(tenderId, actorId)` in
   `apps/api/src/modules/contracts/contracts.service.ts`:
   - Resolve the tender's converted Project (via its JobConversion/project link). If the project
     already has a contract, return it unchanged (idempotent — status flips back and forth must
     not create duplicates).
   - contractValue: the tender's latest client quote total if one exists, else the tender
     estimate total incl. markup, else the tender's estimatedValue, else 0. Record which source
     was used in the audit metadata.
   - Reuse the existing `createContract` internals (IS-C### numbering, active T&C pinning,
     audit write) — do NOT duplicate the numbering or T&C-pinning logic.
2. In `TenderingService.updateStatus` (`apps/api/src/modules/tendering/tendering.service.ts`):
   on a transition INTO `CONTRACT_ISSUED`:
   - If the tender has not been converted to a project yet, run the existing
     `ProjectsService.convertFromTender` first. That method currently requires status
     `AWARDED` — extend its guard to also accept `CONTRACT_ISSUED` (do not weaken it further).
   - Then call `createFromTender`. Failures here must NOT roll back or block the status update
     itself — log + audit and surface a warning in the response, the same
     fire-and-forget discipline as the SUBMITTED email.
3. Update the affected unit specs (`contracts.service.spec.ts`, tendering specs) — new
   `toHaveBeenCalledWith` payloads where mocks change.

## Do NOT
- Do NOT touch schema.prisma (Contract/Project models already carry everything needed).
- Do NOT auto-create contracts for tenders already sitting in CONTRACT_ISSUED (no backfill —
  transition-triggered only).
- Do NOT change the one-contract-per-project constraint or contract numbering.
- Do NOT touch Azure/prod, Xero, or SharePoint.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
