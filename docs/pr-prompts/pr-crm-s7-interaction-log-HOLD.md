---
premise: '! grep -q "InteractionChannel" apps/api/prisma/schema.prisma'
premise_means: >-
  There is no interaction log. RelationshipNote anchors to account and contact only and carries no
  channel, so Last interaction and Logged by cannot be served on a tender or opportunity row.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/crm/relationships/**
  - apps/api/src/modules/crm/**/__tests__/**
done_when: 'pnpm build && pnpm lint && grep -q "InteractionChannel" apps/api/prisma/schema.prisma'
size: 5
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  Additive schema only. Reversible by dropping the added column(s)/enum before any consumer ships.
cluster: crm-build
cluster_order: 7
requires_on_main: apps/api/src/modules/crm/accounts/accounts.service.ts :: rollUpContracts
---

<!-- watcher: do-not-arm -->

> **DO NOT ARM.** This slice is blocked on a schema decision that is Marco's, recorded as §5 of
> `docs/plans/crm-build-order-plan.md` and unanswered as of 2026-08-27. The Do section below cannot be
> written correctly until he rules, because the three options produce materially different schemas.
> Station 06 will rewrite this prompt once the decision lands. Do not arm it, do not promote it, and do
> not pick an option yourself.

# CRM S7 — the interaction log (BLOCKED — decision pending)

## What is settled

Marco's decision 5: **next action is an output, not a typed field.** One action — Log — records what
happened (channel, author, body, anchor) and sets `nextActionAt` / `nextActionNote` in the same write.
`Last interaction`, `Logged by` and `Next action` read together because the first two produce the third.

## What is not settled

The register and follow-up rows are **tenders and opportunities**. `RelationshipNote` anchors to
**account and contact** only (`schema.prisma`, `accountId?` / `contactId?`) and has no channel field.
So the columns cannot be served by what exists. Three options, materially different:

- **(a) Extend `RelationshipNote`** — add `channel`, plus optional `opportunityId` / `tenderId`.
  One log, one read path, additive migration. Makes the model broader than its name.
- **(b) Reuse `CommThread`** — it already carries the polymorphic `entityType`/`entityId` anchor the
  register needs. No new model, but every logged phone call becomes a conversation thread.
- **(c) A new interaction model** — cleanest conceptually, one more table, two note-ish things in the
  schema for people to confuse.

Station 06 leans (a): additive, one read path, and the account view still works by rolling up its
tenders' interactions. **That is a lean, not a decision.**

## Blocked consumers

`S8` (register columns) and `S12` (TR re-scope) both gate on `InteractionChannel` reaching main, so
they are parked behind this correctly and need no separate hold.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
