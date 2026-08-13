-- SoR S4: attach-to-job wizard + Job SoR snapshot / per-record version lock.
--
-- Additive only. Adds two tables:
--   * job_sor_snapshots       — one row per (job|tender) with a locked
--                                rate-book. Idempotent per (target, sorVersion).
--   * job_sor_snapshot_rates  — frozen rate rows copied from the merged
--                                master + client-card view at lock time.
--
-- No existing table/column is altered.
--
-- Rollback:
--   DROP TABLE "job_sor_snapshot_rates";
--   DROP TABLE "job_sor_snapshots";

-- ── job_sor_snapshots ─────────────────────────────────────────────────────
CREATE TABLE "job_sor_snapshots" (
    "id"                       TEXT NOT NULL,
    "job_id"                   TEXT,
    "tender_id"                TEXT,
    "client_id"                TEXT NOT NULL,
    "sor_period_id"            TEXT NOT NULL,
    "sor_client_rate_card_id"  TEXT,
    "sor_period_label"         TEXT NOT NULL,
    "sor_version"              TEXT NOT NULL,
    "locked_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by_id"             TEXT,
    "status"                   TEXT NOT NULL DEFAULT 'ACTIVE',
    "superseded_by_id"         TEXT,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_sor_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_sor_snapshots_superseded_by_id_key"
    ON "job_sor_snapshots"("superseded_by_id");
CREATE UNIQUE INDEX "job_sor_snapshots_job_id_sor_version_key"
    ON "job_sor_snapshots"("job_id", "sor_version");
CREATE UNIQUE INDEX "job_sor_snapshots_tender_id_sor_version_key"
    ON "job_sor_snapshots"("tender_id", "sor_version");
CREATE INDEX "job_sor_snapshots_client_id_idx"
    ON "job_sor_snapshots"("client_id");
CREATE INDEX "job_sor_snapshots_sor_period_id_idx"
    ON "job_sor_snapshots"("sor_period_id");

ALTER TABLE "job_sor_snapshots"
    ADD CONSTRAINT "job_sor_snapshots_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_sor_snapshots"
    ADD CONSTRAINT "job_sor_snapshots_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_sor_snapshots"
    ADD CONSTRAINT "job_sor_snapshots_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_sor_snapshots"
    ADD CONSTRAINT "job_sor_snapshots_sor_period_id_fkey"
    FOREIGN KEY ("sor_period_id") REFERENCES "sor_periods"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_sor_snapshots"
    ADD CONSTRAINT "job_sor_snapshots_sor_client_rate_card_id_fkey"
    FOREIGN KEY ("sor_client_rate_card_id") REFERENCES "sor_client_rate_cards"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_sor_snapshots"
    ADD CONSTRAINT "job_sor_snapshots_locked_by_id_fkey"
    FOREIGN KEY ("locked_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_sor_snapshots"
    ADD CONSTRAINT "job_sor_snapshots_superseded_by_id_fkey"
    FOREIGN KEY ("superseded_by_id") REFERENCES "job_sor_snapshots"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── job_sor_snapshot_rates ────────────────────────────────────────────────
CREATE TABLE "job_sor_snapshot_rates" (
    "id"              TEXT NOT NULL,
    "snapshot_id"     TEXT NOT NULL,
    "source_rate_id"  TEXT,
    "category"        "SorCategory" NOT NULL,
    "name"            TEXT NOT NULL,
    "class"           TEXT,
    "unit"            TEXT,
    "ordinary"        DECIMAL(12,2),
    "one_and_half"    DECIMAL(12,2),
    "double"          DECIMAL(12,2),
    "is_reference"    BOOLEAN NOT NULL DEFAULT false,
    "comments"        TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_sor_snapshot_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_sor_snapshot_rates_snapshot_id_category_idx"
    ON "job_sor_snapshot_rates"("snapshot_id", "category");
CREATE INDEX "job_sor_snapshot_rates_source_rate_id_idx"
    ON "job_sor_snapshot_rates"("source_rate_id");

ALTER TABLE "job_sor_snapshot_rates"
    ADD CONSTRAINT "job_sor_snapshot_rates_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "job_sor_snapshots"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_sor_snapshot_rates"
    ADD CONSTRAINT "job_sor_snapshot_rates_source_rate_id_fkey"
    FOREIGN KEY ("source_rate_id") REFERENCES "sor_rates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
