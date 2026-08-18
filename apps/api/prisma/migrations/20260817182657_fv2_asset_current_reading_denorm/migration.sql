-- F-7: denormalised current reading state on the assets table.
-- Three nullable columns only — no backfill required.
-- Updated in-transaction alongside each AssetUsageReading insert.
-- Rollback: ALTER TABLE assets DROP COLUMN current_hours_reading,
--           DROP COLUMN current_km_reading, DROP COLUMN last_reading_at;

ALTER TABLE "assets"
    ADD COLUMN "current_hours_reading" DECIMAL(12,1),
    ADD COLUMN "current_km_reading"    DECIMAL(12,1),
    ADD COLUMN "last_reading_at"       TIMESTAMP(3);
