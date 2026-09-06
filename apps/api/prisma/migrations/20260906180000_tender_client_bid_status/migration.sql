-- tender-lifecycle S2a -- TenderClient.bidStatus (per-client bid intent).
--
-- ADDITIVE ONLY. One new enum type and ONE new column on "tender_clients".
-- No existing column is dropped, renamed, retyped or widened. There is no
-- UPDATE, INSERT or DELETE in this file and no backfill: not one existing
-- row is rewritten by it.
--
-- NULLABLE WITH NO DEFAULT, deliberately, and that is the safety property.
-- NULL means "we never recorded whether we bid for this builder", which is
-- the truth for every row that exists when this runs. A default of any
-- member would retro-label historical rows with a decision nobody made --
-- e.g. stamping PRICED on builders we never priced for, which would then
-- read straight through into win-rate and bid/no-bid reporting. So there is
-- no default, and the enum deliberately has no UNKNOWN member: "unknown" is
-- the NULL, not a label.
--
-- IDEMPOTENT. Every step is guarded, so a partial application (a run killed
-- between the CREATE TYPE and the ADD COLUMN) can be re-run safely. Prisma
-- records each migration once, so this matters only for manual recovery.
--
-- LOUD. Each guard checks the assumption it depends on and RAISEs with a
-- named message rather than silently doing nothing, so a database that does
-- not look the way this migration expects stops the deploy instead of
-- shipping a half-applied schema Prisma will then believe is complete.
--
-- Rollback (forward-only preferred; this is the manual undo):
--   ALTER TABLE "tender_clients" DROP COLUMN "bid_status";
--   DROP TYPE "TenderClientBidStatus";
-- Reverting the application code alone leaves the column in place, unread
-- and inert, and preserves anything already recorded for a re-apply.

-- 1. Enum type. Created only if absent; if it already exists it must have
--    exactly the three expected labels, otherwise the schema this migration
--    was written against is not the schema in front of us.
DO $$
DECLARE
  labels TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenderClientBidStatus') THEN
    CREATE TYPE "TenderClientBidStatus" AS ENUM ('PRICED', 'NO_BID', 'WATCHING');
  ELSE
    SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
    INTO labels
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'TenderClientBidStatus';

    IF labels IS DISTINCT FROM 'PRICED,NO_BID,WATCHING' THEN
      RAISE EXCEPTION
        'tender-lifecycle S2a aborted: type "TenderClientBidStatus" already exists with labels [%], expected [PRICED,NO_BID,WATCHING]',
        labels;
    END IF;
  END IF;
END $$;

-- 2. The column. Guarded on the table existing (loud if it does not) and on
--    the column being absent; if it is already present it must already be
--    the expected nullable enum, otherwise stop.
DO $$
DECLARE
  col_type TEXT;
  col_nullable TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'tender_clients'
  ) THEN
    RAISE EXCEPTION
      'tender-lifecycle S2a aborted: table "tender_clients" not found in schema %', current_schema();
  END IF;

  SELECT c.udt_name, c.is_nullable
  INTO col_type, col_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = current_schema()
    AND c.table_name = 'tender_clients'
    AND c.column_name = 'bid_status';

  IF col_type IS NULL THEN
    ALTER TABLE "tender_clients" ADD COLUMN "bid_status" "TenderClientBidStatus";
  ELSIF col_type <> 'TenderClientBidStatus' OR col_nullable <> 'YES' THEN
    RAISE EXCEPTION
      'tender-lifecycle S2a aborted: "tender_clients"."bid_status" already exists as type % (nullable=%), expected nullable TenderClientBidStatus',
      col_type, col_nullable;
  END IF;
END $$;
