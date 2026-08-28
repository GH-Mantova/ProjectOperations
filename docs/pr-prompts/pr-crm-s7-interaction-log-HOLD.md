---
premise: '! grep -q "InteractionChannel" apps/api/prisma/schema.prisma'
premise_means: >-
  There is no interaction log. RelationshipNote anchors to account and contact only and carries no
  channel, so Last interaction and Logged by cannot be served on a tender or opportunity row.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/crm/relationships/**
  - apps/api/src/modules/comms/**
  - apps/api/src/modules/crm/**/__tests__/**
  - apps/api/src/modules/comms/**/__tests__/**
  - apps/web/src/pages/crm/**
  - apps/web/src/pages/crm/__tests__/**
done_when: 'pnpm build && pnpm lint && grep -q "InteractionChannel" apps/api/prisma/schema.prisma'
size: 5
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  Additive schema only - one new enum, one nullable column on relationship_notes, one nullable
  discriminator on comm_threads. No column is dropped, renamed or retyped; no row is written or
  deleted by the migration. Reversible by dropping the added column(s)/enum before any consumer ships.
cluster: crm-build
cluster_order: 7
requires_on_main: apps/api/src/modules/crm/accounts/accounts.service.ts :: rollUpContracts
---

# CRM S7 — interaction log, split by anchor (Marco's §5 ruling, 2026-08-28)

## The decision this implements

§5 is **decided**. Marco ruled a **mix of (a) and (b)**, with the deciding constraint that on the
Tenders Register, "Last interaction" means **tender-anchored contact only** — not a call logged
against the parent account.

That scoping is what makes the mix clean: **each surface reads exactly one table. There is no union
anywhere.** If you find yourself writing a query that reads both `relationship_notes` and
`comm_threads` to answer one question, stop — you have misread this prompt.

| Anchor | Stored in | Read by |
|---|---|---|
| Account, Contact | `RelationshipNote` (+ new `channel`) | Account 360 |
| Tender, Opportunity | `CommThread` + one `CommMessage` | Tenders Register |

**Do NOT add `tenderId` or `opportunityId` FKs to `RelationshipNote`.** CRM must not gain foreign keys
into Tendering. `CommThread` already carries `entityType`/`entityId` as Strings, and its own schema
comment says why: *"stored as a String for sub-module decoupling."* Honour that.

## Do

**1. `enum InteractionChannel`** in `schema.prisma`:

    phone  email  meeting  site_visit  other

Do **not** reuse or rename `LeadCaptureChannel` (`email phone portal referral cold_outreach other`).
It answers a different question — how a lead *originated* — and its `referral` / `cold_outreach` /
`portal` values are acquisition sources, not communication media. Merging them would offer
"referral" as a way to contact someone, which is how meaningless data gets entered. Two enums that
share three values by coincidence is correct here. Leave `LeadCaptureChannel` untouched.

**2. `RelationshipNote.channel InteractionChannel?`** — nullable.

Existing rows stay `NULL`. **Do not backfill a guessed value.** We do not know how historic notes were
made, and inventing `phone` to make a column look populated is worse than an honest gap. The UI
renders `NULL` as `—`. No row is written by this migration.

**3. Tender/opportunity logging → thread plus one message.** Logging a contact on a tender creates:

- one `CommThread` with `entityType` = the tender/opportunity kind, `entityId` = its id, a `subject`
  derived from the log, and `createdById` = the logging user;
- exactly one `CommMessage` on that thread carrying the body, `authorId`, and `createdAt`.

**4. `CommThread` needs a kind discriminator.** Add `enum CommThreadKind { conversation logged_contact }`
and `CommThread.kind CommThreadKind @default(conversation)`. Existing rows default to `conversation`,
so nothing changes for them and no backfill is needed.

Why: without it, every logged phone call appears in the Comms hub thread list beside real email
threads and the hub becomes noise. Marco's mock-up point 8 already covers the remedy —
*"one merged list is right as long as we can filter in/out what we want to see"* — but the filter
needs something to filter **on**. S10 wires the filter; S7 must give it the field, or S10 cannot be
built without a second migration.

**5. Register columns — `Last interaction` and `Logged by` only.** No channel column.
Marco: *"just when + who. when we open the individual register we have access to all the information
anyway."*

- `Last interaction` = MAX(`CommMessage.createdAt`) across threads where
  `entityType`/`entityId` match the tender row.
- `Logged by` = the author of that most-recent message.
- Rows with no logged contact render `—`, and must sort last rather than as epoch-zero.

**6. Account 360 reads `RelationshipNote` only.** Documented consequence, stated here so it is not
discovered later: **a call logged against a tender will NOT appear on that tender's parent account.**
This follows directly from Marco's tender-only scoping and is the price of having no union. If it
turns out to be wrong in use, that is a later slice and an explicit reversal — not something to
quietly "fix" inside this one by adding a union.

## Do NOT

- Do not add FKs from CRM into Tendering.
- Do not union `relationship_notes` and `comm_threads` in any read path.
- Do not backfill `channel` on existing notes.
- Do not rename, retype or drop any existing column or enum.
- Do not touch `sot/`.
- Do not write or delete a single row in the migration. It is DDL only.

## Verification

    pnpm build && pnpm lint
    pnpm --filter api test -- relationships
    pnpm --filter api test -- comms
    npx prisma migrate diff --from-schema-datasource --to-schema-datamodel   # additive only
    grep -q "InteractionChannel" apps/api/prisma/schema.prisma

Tests must cover: a note keeps `NULL` channel and renders `—`; logging on a tender creates exactly
one thread and exactly one message; the Register's Last interaction picks the newest message and its
author; a tender with no logged contact sorts last; a `logged_contact` thread is distinguishable
from a `conversation` thread.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and open the PR without asking for
confirmation. The scope above is the approval. Work on a branch — never commit on `main`.

This slice carries `escalates: true`. It will open a PR and hold for Marco's merge. Do not merge it.
