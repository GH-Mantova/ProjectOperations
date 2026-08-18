-- SoR S8: AR office review lane — price, approve, reject-and-send-back.
-- Additive only. Adds:
--   * Three nullable columns to agreed_records (reviewer_id, review_started_at,
--     approved_by_id, approved_at, total_priced_amount, sent_back_reason).
--   * One new table: agreed_record_pricing_lines (one per agreed_record_line).
--   * Two idempotent upserts into notification_trigger_configs.
--
-- Nothing existing is altered destructively. Down migration:
--   DROP TABLE "agreed_record_pricing_lines";
--   ALTER TABLE "agreed_records"
--     DROP COLUMN "reviewer_id",
--     DROP COLUMN "review_started_at",
--     DROP COLUMN "approved_by_id",
--     DROP COLUMN "approved_at",
--     DROP COLUMN "total_priced_amount",
--     DROP COLUMN "sent_back_reason";

-- -- Add S8 columns to agreed_records ---------------------------------------

ALTER TABLE "agreed_records"
    ADD COLUMN "reviewer_id"         TEXT,
    ADD COLUMN "review_started_at"   TIMESTAMP(3),
    ADD COLUMN "approved_by_id"      TEXT,
    ADD COLUMN "approved_at"         TIMESTAMP(3),
    ADD COLUMN "total_priced_amount" DECIMAL(12,2),
    ADD COLUMN "sent_back_reason"    TEXT;

ALTER TABLE "agreed_records"
    ADD CONSTRAINT "agreed_records_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agreed_records"
    ADD CONSTRAINT "agreed_records_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- -- agreed_record_pricing_lines --------------------------------------------

CREATE TABLE "agreed_record_pricing_lines" (
    "id"                     TEXT NOT NULL,
    "agreed_record_line_id"  TEXT NOT NULL,
    "snapshot_rate_id"       TEXT,
    "tier"                   TEXT NOT NULL DEFAULT 'ORDINARY',
    "rate"                   DECIMAL(12,2) NOT NULL,
    "line_amount"            DECIMAL(12,2) NOT NULL,
    "priced_by_id"           TEXT,
    "priced_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agreed_record_pricing_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agreed_record_pricing_lines_agreed_record_line_id_key"
    ON "agreed_record_pricing_lines"("agreed_record_line_id");

CREATE INDEX "agreed_record_pricing_lines_agreed_record_line_id_idx"
    ON "agreed_record_pricing_lines"("agreed_record_line_id");

ALTER TABLE "agreed_record_pricing_lines"
    ADD CONSTRAINT "agreed_record_pricing_lines_agreed_record_line_id_fkey"
    FOREIGN KEY ("agreed_record_line_id") REFERENCES "agreed_record_lines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agreed_record_pricing_lines"
    ADD CONSTRAINT "agreed_record_pricing_lines_priced_by_id_fkey"
    FOREIGN KEY ("priced_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- -- Notification trigger configs (idempotent upsert via INSERT ... ON CONFLICT) ----
-- These rows configure the notification seam for AR office review.
-- WHS&CC fires when an AR is taken into review; Ops fires when pricing is finalised.
-- id-known inserts so the seed script's upsert is stable across environments.

INSERT INTO "notification_trigger_configs"
    ("id", "trigger", "label", "description", "is_enabled", "delivery_method",
     "recipient_roles", "recipient_user_ids", "created_at", "updated_at")
VALUES
    (
        'ntc-agreed-record-submitted',
        'agreed_record.submitted',
        'AR submitted',
        'Fires when a field worker submits an Agreed Record. Notifies WHS & CC to pick it up for office review.',
        TRUE,
        'both',
        ARRAY['WHS Officer'],
        ARRAY[]::TEXT[],
        NOW(),
        NOW()
    ),
    (
        'ntc-agreed-record-priced-awaiting-ops',
        'agreed_record.priced_awaiting_ops',
        'AR priced — awaiting Ops sign-off',
        'Fires when WHS & CC finalises pricing on an Agreed Record. Notifies the Operations Manager (Admin role) to approve.',
        TRUE,
        'both',
        ARRAY['Admin'],
        ARRAY[]::TEXT[],
        NOW(),
        NOW()
    )
ON CONFLICT ("trigger") DO UPDATE SET
    "label"       = EXCLUDED."label",
    "description" = EXCLUDED."description",
    "updated_at"  = NOW();
