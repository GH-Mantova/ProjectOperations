---
premise: '! grep -q ''claims/pro-forma"'' apps/web/src/pages/contracts/BillingTab.tsx'
premise_means: The contract Billing tab can only preview a pro-forma claim (POST /contracts/:id/claims/pro-forma/preview); nothing on main calls the real draft-creating endpoint (POST /contracts/:id/claims/pro-forma) or lets a user edit the resulting draft before issuing it.
scope:
  - apps/api/src/modules/contracts/contracts.controller.ts
  - apps/api/src/modules/contracts/contracts.service.ts
  - apps/api/src/modules/contracts/__tests__/contracts.service.spec.ts
  - apps/web/src/pages/contracts/BillingTab.tsx
  - apps/web/src/pages/contracts/ClaimDraftEditor.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/contracts/ClaimDraftEditor.tsx && grep -q 'claims/pro-forma"' apps/web/src/pages/contracts/BillingTab.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Generate this month's claim — editable pro-forma draft

On `main`, `apps/api/src/modules/contracts/contracts.controller.ts` already exposes the full
pro-forma engine: `POST /contracts/:id/claims/pro-forma/preview` (build lines, don't persist) and
`POST /contracts/:id/claims/pro-forma` (`ContractsService.createProFormaClaim`, `contracts.service.ts`)
which persists a `ProgressClaim` with `isProForma=true` via the same line-item build as
`createClaim` — one claim per contract+month, enforced with a `ConflictException` ("A claim already
exists for this contract + month."). `apps/web/src/pages/contracts/BillingTab.tsx` today only wires
the `/preview` endpoint behind a "Preview pro-forma" button (`previewProForma()`), rendered read-only
in `ProFormaPreviewCard`. There is no button that calls the persisting endpoint, and no UI anywhere
that lets a user edit a claim's line items — `PATCH /contracts/:id/claims/:claimId/items/:itemId`
(`updateClaimItem`) exists on the API but nothing on the web side calls it. `ProgressClaim` has a
`notes` column (`schema.prisma`) that no endpoint currently writes.

This slice adds a "Generate this month's claim" action that creates (or reopens) the pro-forma DRAFT
and opens it in an editable review surface. **The claim is never auto-issued** — submitting stays a
separate explicit action the user takes afterwards via the existing `submitClaim` flow, out of scope
here.

## What to build

1. **Backend — minimal additions to close the "edit before issuing" gap** (`contracts.controller.ts`
   / `contracts.service.ts`):
   - `POST /contracts/:id/claims/:claimId/items` — add a line item to a DRAFT claim (`description`,
     optional `discipline`, `contractValue`, `thisClaimAmount`). Reject (400) if the claim is not
     `DRAFT`. Recalculate and persist `totalClaimed` the same way `updateClaimItem` does.
   - `DELETE /contracts/:id/claims/:claimId/items/:itemId` — remove a line item from a DRAFT claim.
     Reject (400) if the claim is not `DRAFT`. Recalculate `totalClaimed`.
   - `PATCH /contracts/:id/claims/:claimId` — update only `notes` on a DRAFT claim (reuse the
     `finance.manage` guard already used by the sibling claim endpoints).
   - Follow the existing patterns in `contracts.service.ts` exactly (Decimal handling, `getClaim`
     re-fetch-and-return shape, `NotFoundException`/`BadRequestException` usage already established
     by `updateClaimItem` and `payClaim`).
   - Add unit tests for the three new service methods in
     `apps/api/src/modules/contracts/__tests__/contracts.service.spec.ts`, following the file's
     existing mock-Prisma pattern.

2. **`apps/web/src/pages/contracts/BillingTab.tsx`** — add a **"Generate this month's claim"** button
   next to the existing "Preview pro-forma" button (same month-prompt UX as `previewProForma`).
   On click:
   - `POST` to `/contracts/${contractId}/claims/pro-forma` with `{ claimMonth }`.
   - On success, open the new `ClaimDraftEditor` (below) with the returned claim.
   - On a 409 conflict ("already drafted this month"), **do not show an error** — `GET
     /contracts/${contractId}/claims` (already exists), find the existing claim for that
     `claimMonth`, and open `ClaimDraftEditor` with it instead. This is the "handle already-drafted
     gracefully" requirement from `docs/plans/progress-claim-autogen-plan.md` — edit the existing
     draft, never error out.

3. **`apps/web/src/pages/contracts/ClaimDraftEditor.tsx` (new)** — a modal or inline panel (match the
   existing `CenteredModal` convention used elsewhere in `apps/web/src/pages/contracts/`, e.g.
   `NewContractModal.tsx`) that:
   - Lists the claim's line items with editable `thisClaimPct` / `thisClaimAmount` (PATCH
     `.../items/:itemId`), an "Add line" control (POST `.../items`), and a remove control per line
     (DELETE `.../items/:itemId`).
   - Has a notes textarea (PATCH `.../claims/:claimId`).
   - Shows a clear "DRAFT — not yet issued" banner. Do **not** add a submit/issue button here — that
     stays on the existing claim list/detail surface; this editor's job is drafting only.
   - Refreshes the parent (`onRefresh` prop already passed into `BillingTab`) on close.

## Do NOT

- Do not call `submitClaim`, `approveClaim`, or `payClaim` from the new editor, and do not add any
  auto-issue path — the pro-forma DRAFT must stay a DRAFT until the user explicitly submits it
  elsewhere.
- Do not touch `previewProForma` / `createProFormaClaim` conflict semantics on the backend — the
  409 is handled by the UI fetching the existing draft, not by relaxing the one-claim-per-month guard.
- Do not touch `apps/api/prisma/schema.prisma` or add a migration — every field this slice needs
  (`ClaimLineItem.description/contractValue/thisClaimAmount/thisClaimPct`, `ProgressClaim.notes`)
  already exists.
- Do not touch Azure/Entra/SharePoint, Xero, or any other contract endpoints not listed above.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If something is genuinely impossible given the stated scope, do not exit silently —
  say `NO-OP: <reason>` and explain what blocked it.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log before diagnosing — do not guess.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
