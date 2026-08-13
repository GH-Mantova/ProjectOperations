-- SoR S6: Variation Contract (VC) lines priced against a locked Job SoR
-- snapshot. Additive only. Adds one table:
--
--   * variation_sor_lines  -- one row per priced line on a Variation. Every
--                             line freezes its own rate at create time so
--                             historical pricing survives snapshot reissue,
--                             period expiry, or client-card resets.
--
-- No existing table/column is altered. The Variation model gains a back-ref
-- (`sorLines VariationSorLine[]`) but that is a Prisma-only virtual relation
-- and has no schema effect.
--
-- Rollback:
--   DROP TABLE "variation_sor_lines";

-- -- variation_sor_lines --------------------------------------------------
CREATE TABLE "variation_sor_lines" (
    "id"                    TEXT NOT NULL,
    "variation_id"          TEXT NOT NULL,
    "job_sor_snapshot_id"   TEXT NOT NULL,
    "sor_version"           TEXT NOT NULL,
    "snapshot_rate_id"      TEXT,
    "category"              "SorCategory" NOT NULL,
    "name"                  TEXT NOT NULL,
    "class"                 TEXT,
    "unit"                  TEXT,
    "tier"                  TEXT NOT NULL DEFAULT 'ORDINARY',
    "rate"                  DECIMAL(12,2) NOT NULL,
    "quantity"              DECIMAL(12,2) NOT NULL,
    "line_amount"           DECIMAL(12,2) NOT NULL,
    "notes"                 TEXT,
    "sort_order"            INTEGER NOT NULL DEFAULT 0,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "variation_sor_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "variation_sor_lines_variation_id_idx"
    ON "variation_sor_lines"("variation_id");
CREATE INDEX "variation_sor_lines_job_sor_snapshot_id_idx"
    ON "variation_sor_lines"("job_sor_snapshot_id");

ALTER TABLE "variation_sor_lines"
    ADD CONSTRAINT "variation_sor_lines_variation_id_fkey"
    FOREIGN KEY ("variation_id") REFERENCES "variations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
