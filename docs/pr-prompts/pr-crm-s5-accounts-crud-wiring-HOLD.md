---
premise: '! grep -q "patchAccount" apps/web/src/pages/crm/crm-api.ts'
premise_means: >-
  All six Accounts endpoints exist on the API and none has a web caller. The account list and detail
  pages are read-only, so lifecycle, type, owner and notes are permanently whatever the backfill set.
scope:
  - apps/web/src/pages/crm/crm-api.ts
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/web/src/pages/crm/AccountDetailPage.tsx
  - apps/web/src/pages/crm/__tests__/**
done_when: 'pnpm build && pnpm lint && grep -q "patchAccount" apps/web/src/pages/crm/crm-api.ts'
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: crm-build
cluster_order: 5
requires_on_main: apps/web/src/pages/crm/AccountsListPage.tsx :: AccountLinkPreview
---

# CRM S5 — give Accounts its verbs

**Wiring, not building.** Every endpoint below is already on main with no caller.

## The measured gap

`accounts.controller.ts` — `:80` list, `:100` get, `:120` create, `:128` patch, `:138` archive,
`:152` unarchive. Grepping `/crm/accounts` across `apps/web/src` finds only GETs to `/summary` and
`/360`, plus navigation. `accounts.service.ts:151-172` implements updates for `lifecycleStatus`,
`accountType`, `source`, `notes`, `clientId` and `ownerId`; `AccountDetailPage.tsx:244-269` renders all
six as static text. `AccountsListPage.tsx:220-221` tells the user accounts are "created from the
Directory when a Client is promoted" — **that path does not exist**; grepping `promote` across the web
tree returns only Schedule-of-Rates hits.

## Do

1. `crm-api.ts`: `createAccount`, `patchAccount`, `archiveAccount`, `unarchiveAccount`.
2. **New account** on `AccountsListPage` — name, optional client link, type, source, owner.
3. Inline editing on `AccountDetailPage` for lifecycle, type, source, owner and notes. Owner options
   come from the same source S1 established for assignees — **do not invent a second one**.
4. Archive with confirm, and Unarchive on an archived account. `Account.archivedAt` is displayed today
   (`AccountDetailPage.tsx:227-239`) and unsettable; this makes it settable.
5. Delete the false empty-state copy at `AccountsListPage.tsx:220-221` and replace it with the real
   affordance.

## Do NOT

- Do NOT add, change or remove any API route. All six exist.
- Do NOT touch `getAccount360` or its roll-ups — that is S6.
- Do NOT add an account **delete**. Archive is the only removal, and it is reversible.
- Do NOT build a second owner/user picker if S1 established one; reuse it.

## Tests

Pure helpers, per `DropReasonAdminPage.test.ts`.
1. `buildPatchAccountBody` sends only changed fields — an unchanged field must be absent, not `null`.
2. Create requires a name; everything else optional.
3. Archive and unarchive hit distinct endpoints and send no body fields beyond what the DTO accepts.
4. Negative control: the patch builder never emits `clientId` unless explicitly changed — silently
   re-linking an account to a different client is the dangerous mistake here.

## STOP AND REPORT

- `PATCH /crm/accounts/:id` rejects a field the detail page renders as editable.
- No owner/user source is reachable for a `crm.view`-only caller. Ship without the owner control and
  say so rather than adding an endpoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
