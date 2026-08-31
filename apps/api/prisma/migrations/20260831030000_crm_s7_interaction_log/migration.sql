-- CRM-S7: Interaction log — split by anchor (Marco ruling 2026-08-28).
-- Additive only. One new enum on relationship_notes, one nullable column on
-- relationship_notes, one new enum + one column with DEFAULT on comm_threads.
-- Zero rows written or deleted. No column dropped, renamed, or retyped.
--
-- Decision: Account/Contact logging stays in RelationshipNote (+ new channel).
--           Tender/Opportunity logging goes in CommThread + CommMessage.
--           The two surfaces never union — each reads exactly one table.
--
-- Changes:
--   1. Enum: InteractionChannel (phone | email | meeting | site_visit | other)
--   2. relationship_notes.channel  InteractionChannel? (nullable, NULL for historic rows)
--   3. Enum: CommThreadKind (conversation | logged_contact)
--   4. comm_threads.kind  CommThreadKind NOT NULL DEFAULT 'conversation'
--      (existing rows default to 'conversation' — no backfill needed)
--
-- Rollback (before any consumer ships):
--   ALTER TABLE "comm_threads"    DROP COLUMN "kind";
--   DROP TYPE "CommThreadKind";
--   ALTER TABLE "relationship_notes" DROP COLUMN "channel";
--   DROP TYPE "InteractionChannel";

-- 1. InteractionChannel enum
CREATE TYPE "InteractionChannel" AS ENUM (
  'phone',
  'email',
  'meeting',
  'site_visit',
  'other'
);

-- 2. channel column on relationship_notes (nullable — no backfill)
ALTER TABLE "relationship_notes"
  ADD COLUMN "channel" "InteractionChannel";

-- 3. CommThreadKind enum
CREATE TYPE "CommThreadKind" AS ENUM (
  'conversation',
  'logged_contact'
);

-- 4. kind column on comm_threads with DEFAULT so all existing rows get 'conversation'
ALTER TABLE "comm_threads"
  ADD COLUMN "kind" "CommThreadKind" NOT NULL DEFAULT 'conversation';
