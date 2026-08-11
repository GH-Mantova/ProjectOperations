---
premise: ! grep -rq "CenteredModal" apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx
premise_means: The Directory Client detail (ClientsTab, exported from MasterDataWorkspacePage) opens as a right-side slide-over, not the shared centered modal used by "+ New Tender". Marco wants it centered like New Tender.
scope:
  - apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx
  - apps/web/src/pages/directory/**
done_when: pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test && grep -rq "CenteredModal" apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# fix(web): Directory — open Client detail in a centered modal (#3)

## What exists on main
- Clicking a Client card in the Directory (`ClientsTab`, exported from `apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx`) opens the detail/edit panel as a **right-side slide-over**.
- The tendering flow's "+ New Tender" / Add-Client already uses the shared **`CenteredModal`** from `@project-ops/ui` (see `apps/web/src/pages/tendering/AddClientModal.tsx`). Marco wants the Client detail to match that centered pattern.

## What to build
1. Locate the Client-detail slide-over rendered by `ClientsTab` and re-present it inside `CenteredModal` (`@project-ops/ui`) — centered, roomy, edit-in-place — matching the New-Tender modal's look/behaviour.
2. Because `CenteredModal`'s docstring warns against using it where an accidental close = data loss, add a **discard-changes confirm on close** when the form is dirty (reuse the existing `useConfirm` primitive).
3. Apply the same centered-modal treatment to the Subcontractor and Contact detail views (`SubcontractorsPage` / `ContactsPage`) **only if** they use the same slide-over pattern — keep them consistent; if they already differ, leave a note in the PR body and scope to Clients.
4. Preserve all existing fields, validation, save/create behaviour and API calls — this is presentation only.

## Do NOT
- Do NOT change any API, data model, or the fields captured.
- Do NOT alter the tendering AddClientModal; only reuse the shared component.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** Not wait-before-starting, not
> do-then-ask. There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if genuinely impossible.
- `pnpm --filter @project-ops/web lint` and `...test` must pass before opening the PR.
- Never ask for or wait on approval.
