---
premise: 'grep -q "accountId: null, contactId: null" apps/web/src/pages/crm/RelationshipsPage.tsx'
premise_means: >-
  The relationship-note form posts both foreign keys as null, which the service rejects, so "Add note"
  returns 400 on every click and the Last contact / Going cold surfaces can never populate.
scope:
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/RelationshipsPage.tsx
  - apps/web/src/pages/crm/__tests__/**
done_when: >-
  pnpm build && pnpm lint && ! grep -q "accountId: null, contactId: null"
  apps/web/src/pages/crm/RelationshipsPage.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: crm-build
cluster_order: 1
requires_on_main: docs/plans/crm-build-order-plan.md :: CRM_BUILD_ORDER_V1
---

# CRM S1 — two features that render empty for every user, forever

Web-only. The API already accepts everything needed. Measured 2026-08-27 at `478112c5`.

## Defect 1 — "My to-dos" is always empty

`CommsHubPage.tsx:165` queries `assigneeId: user.id`. `createTask` (`:482-500`) posts
`{entityType, entityId, title, dueAt}` — **no assigneeId**. Control: `assigneeId` appears exactly once
in the whole 705-line file, at line 165. Every task is created unassigned; the query can never match.

**Fix: send `assigneeId: user.id`** from `createTask`, and add `user` to its dependency array. The API
already accepts it — `comms.controller.ts:67,83` declare it, `:225` maps `dto.assigneeId ?? null`,
`comms.service.ts:52` carries it through create and update. No API change.

## Defect 2 — "Add note" returns 400 on every click

`RelationshipsPage.tsx:214-216` hard-codes both keys to null and says so in a comment.
`relationships.service.ts:58-62` throws `BadRequestException` on exactly that case.

**Fix: add an account picker and send a real `accountId`.** Source it from `GET /crm/accounts/summary`
— the endpoint `AccountsListPage.tsx:127` already calls, gated `crm.view` (`accounts.controller.ts:92-93`).
Disable submit until an account is chosen. `CreateNoteDto` (`relationships.controller.ts:38-42`) already
accepts both as optional strings. No API change.

A contact picker is **optional** in this slice. If you add one, source it from
`GET /master-data/contacts?clientId=...` — but **verify that route's permission gate first**
(`master-data.controller.ts:61` has no route-level `@RequirePermissions` and I did not confirm a
class-level guard). If a `crm.view`-only user could not call it, ship without the contact picker and
say so in the PR body. Do not add an endpoint to work around it.

## Why defect 2 matters more than one button

`Contact.lastContactedAt` is written in exactly one place — `relationships.service.ts:78-83`, only when
a note supplies `contactId`. `Account.lastContactedAt` derives from it (`accounts.service.ts:386-395`).
So today **Last contact** renders "—" for every account, the **Going cold** chip never appears, and its
stat tile is permanently 0. Say this in the PR body; do not change those three call sites.

## Do NOT

- **Do NOT build an assignee picker.** `users.controller.ts:39` and `admin-users.controller.ts:43` both
  require `users.view`, and `/admin/users` additionally 403s anyone who is not Admin or Super User. A
  picker on either would 403 for exactly the CRM users who need it. Default-to-self needs no endpoint.
  **If you find yourself adding an API route, stop and report.**
- **Do NOT touch `apps/api/`.** Both DTOs already accept these fields.
- **Do NOT do the Comms "new thread" work** (`CommsHubPage.tsx:453`). That is S9 and needs an entity picker.
- Do NOT change the inbox query at `:165`, or any file outside `scope`.

## Tests

`apps/web/src/pages/crm/__tests__/`. The workspace has **no jsdom / testing-library** — see the note in
`DropReasonAdminPage.test.ts` and follow it: extract the request-body builders as exported pure functions
and test those. Do not add a test framework.

1. `buildCreateTaskBody({...userId})` returns `assigneeId === userId`. Assert the **key is present** — a
   test checking only `title` passes today and is worthless.
2. Negative control: the builder never omits `assigneeId` or returns it `undefined`, for any input.
3. `buildCreateNoteBody({body, accountId, contactId})` cannot produce both-null through the exported path.
4. Pin the service's guard rule in a comment so the next reader knows why both-null is forbidden.

## STOP AND REPORT

- Any quoted line number does not match your branch point. Re-measure; report the difference.
- `/crm/accounts/summary` does not return the fields the picker needs.
- Making the note form work requires an API change — that contradicts the measurement and needs reporting.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
