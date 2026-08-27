---
premise: '! grep -q "archiveReasonId" apps/api/prisma/schema.prisma'
premise_means: >-
  Archive is a bare stage change with no reason captured and no audit fields on Opportunity, and there is
  no delete route at all. Marco's decision 8 requires a governed reason on archive and a delete that
  exists only for an empty lead.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/crm/**
  - apps/web/src/pages/crm/**
  - apps/api/src/modules/crm/**/__tests__/**
done_when: 'pnpm build && pnpm lint && grep -q "archiveReasonId" apps/api/prisma/schema.prisma'
size: 4
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  Additive columns plus one new guarded delete route. Reversible by dropping the columns and the route;
  no existing row is modified by the migration.
cluster: crm-build
cluster_order: 11
requires_on_main: apps/web/src/pages/crm/CommsHubPage.tsx :: CommsInboxTriage
---

# CRM S11 — archive with a reason, delete only when empty

## The measured state

Archive today is `stage: "archived"` through the update-entry route (`crm.controller.ts:342`). No reason
is captured, and `Opportunity` has **no** `archivedAt` / `archivedById` (unlike `Account`, which does).
There is **no delete route** for an entry — `deleteDropReason` (`crm.service.ts:738`) is the only delete
in the module.

`DropReason` is the governed list already used for "Don't pursue" (`dropReasonId` + `dropReasonDetail`),
seeded twice over and with an admin screen at `/settings/administration/crm-drop-reasons`.

## Do

1. Additive schema on `Opportunity`: `archiveReasonId` (FK to `DropReason`, `onDelete: SetNull`),
   `archiveReasonDetail`, `archivedAt`, `archivedById`. **Reuse `DropReason`** — do not create a second
   reason list; that is what keeps archive reasons reportable alongside drop reasons.
2. An archive endpoint requiring a reason. Restore clears the archive fields and is unrestricted.
3. A delete endpoint, permission-gated, that **refuses unless the entry is empty** — no description, no
   contact, no account, no estimated value, no drop reason, no converted tender, and no comms thread
   anchored to it. Refuse with a message naming which of those blocked it.
4. UI: Archive on any row (opens the reason form); Delete offered **only** when the emptiness predicate
   holds, styled as destructive.

## Do NOT

- **Do NOT allow deleting anything with content.** Archive is the only removal for a real record, and it
  is reversible. If the predicate is ambiguous for a case, refuse — a false refusal is recoverable, a
  false delete is not.
- **Do NOT create a second reason table.** Reuse `DropReason`.
- Do NOT remove the legacy stage values from `OpportunityStage`; Postgres cannot drop enum values in
  place and the migration that added the new ones deliberately left them.
- Do NOT delete a `DropReason` row as part of this work.

## Tests

1. Archive without a reason is rejected.
2. Archive records `archivedAt`, `archivedById` and the reason; Restore clears all three.
3. **Delete refuses** an entry with a description; with a contact; with a value; with a thread. Four
   separate cases — a single happy-path test is not adequate for a destructive route.
4. Delete succeeds on a genuinely empty entry and the row is gone.
5. The refusal message names the blocking field.

## STOP AND REPORT

- The emptiness predicate cannot see comms threads without importing across the module boundary. Report
  how you would read it rather than importing.
- Any existing consumer reads `stage === "archived"` in a way the new fields would break.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
