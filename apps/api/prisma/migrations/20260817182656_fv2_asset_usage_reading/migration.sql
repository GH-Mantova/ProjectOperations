-- F-7: asset usage readings.
-- Append-only history table: hours/km meter readings per asset.
-- Table name follows the project fv2_ convention (Forms Engine v2 family).
-- No backfill: all existing assets start with no readings recorded.
-- Rollback: DROP TABLE fv2_asset_usage_readings;

-- ─── New table ────────────────────────────────────────────────────────────────
CREATE TABLE "fv2_asset_usage_readings" (
    "id"                   TEXT         NOT NULL,
    "asset_id"             TEXT         NOT NULL,
    "unit"                 TEXT         NOT NULL,
    "reading"              DECIMAL(12,1) NOT NULL,
    "previous_reading"     DECIMAL(12,1),
    "recorded_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id"       TEXT,
    "source_submission_id" TEXT,
    "is_meter_replacement" BOOLEAN      NOT NULL DEFAULT false,
    "note"                 TEXT,

    CONSTRAINT "fv2_asset_usage_readings_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX "fv2_asset_usage_readings_asset_id_unit_recorded_at_idx"
    ON "fv2_asset_usage_readings"("asset_id", "unit", "recorded_at");

-- ─── Foreign keys ─────────────────────────────────────────────────────────────
ALTER TABLE "fv2_asset_usage_readings"
    ADD CONSTRAINT "fv2_asset_usage_readings_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fv2_asset_usage_readings"
    ADD CONSTRAINT "fv2_asset_usage_readings_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fv2_asset_usage_readings"
    ADD CONSTRAINT "fv2_asset_usage_readings_source_submission_id_fkey"
    FOREIGN KEY ("source_submission_id") REFERENCES "form_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
