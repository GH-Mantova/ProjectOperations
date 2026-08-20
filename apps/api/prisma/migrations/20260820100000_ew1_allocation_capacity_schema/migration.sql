-- EW-1: Allocation + Capacity Schema (additive migration).
--
-- Adds:
--   1. allocation_state column on tenders (NOT NULL DEFAULT 'UNALLOCATED')
--   2. tender_allocation_candidates  — pool join table
--   3. tender_allocation_rejections  — reject-with-reason log
--   4. estimator_capacity            — per-estimator availability + cap
--   5. allocation_weight_configs     — admin-configurable load weights
--   6. allocator_delegates           — temporary delegate date windows
--
-- All changes are purely additive. No existing column is altered or dropped.
-- Existing tender rows are backfilled to UNALLOCATED by the column DEFAULT.
--
-- Rollback (reverse order):
--   ALTER TABLE "tenders" DROP COLUMN "allocation_state";
--   DROP TABLE "allocator_delegates";
--   DROP TABLE "allocation_weight_configs";
--   DROP TABLE "estimator_capacity";
--   DROP TABLE "tender_allocation_rejections";
--   DROP TABLE "tender_allocation_candidates";

-- 1. allocation_state on tenders
ALTER TABLE "tenders"
    ADD COLUMN "allocation_state" TEXT NOT NULL DEFAULT 'UNALLOCATED';

CREATE INDEX "tenders_allocation_state_idx"
    ON "tenders"("allocation_state");

-- 2. tender_allocation_candidates
CREATE TABLE "tender_allocation_candidates" (
    "id"           TEXT        NOT NULL,
    "tender_id"    TEXT        NOT NULL,
    "estimator_id" TEXT        NOT NULL,
    "offered_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at"   TIMESTAMP(3),

    CONSTRAINT "tender_allocation_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tender_allocation_candidates_tender_id_estimator_id_key"
    ON "tender_allocation_candidates"("tender_id", "estimator_id");

CREATE INDEX "tender_allocation_candidates_tender_id_idx"
    ON "tender_allocation_candidates"("tender_id");

CREATE INDEX "tender_allocation_candidates_estimator_id_idx"
    ON "tender_allocation_candidates"("estimator_id");

ALTER TABLE "tender_allocation_candidates"
    ADD CONSTRAINT "tender_allocation_candidates_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_allocation_candidates"
    ADD CONSTRAINT "tender_allocation_candidates_estimator_id_fkey"
    FOREIGN KEY ("estimator_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. tender_allocation_rejections
CREATE TABLE "tender_allocation_rejections" (
    "id"          TEXT        NOT NULL,
    "tender_id"   TEXT        NOT NULL,
    "rejected_by" TEXT        NOT NULL,
    "reason"      TEXT        NOT NULL,
    "rejected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_allocation_rejections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tender_allocation_rejections_tender_id_idx"
    ON "tender_allocation_rejections"("tender_id");

ALTER TABLE "tender_allocation_rejections"
    ADD CONSTRAINT "tender_allocation_rejections_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_allocation_rejections"
    ADD CONSTRAINT "tender_allocation_rejections_rejected_by_fkey"
    FOREIGN KEY ("rejected_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. estimator_capacity
CREATE TABLE "estimator_capacity" (
    "id"               TEXT        NOT NULL,
    "user_id"          TEXT        NOT NULL,
    "availability_pct" INTEGER     NOT NULL DEFAULT 100,
    "concurrent_cap"   INTEGER     NOT NULL DEFAULT 5,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimator_capacity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "estimator_capacity_user_id_key"
    ON "estimator_capacity"("user_id");

ALTER TABLE "estimator_capacity"
    ADD CONSTRAINT "estimator_capacity_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. allocation_weight_configs
CREATE TABLE "allocation_weight_configs" (
    "id"         TEXT           NOT NULL,
    "dimension"  TEXT           NOT NULL,
    "key"        TEXT           NOT NULL,
    "weight"     DECIMAL(5, 2)  NOT NULL,
    "label"      TEXT           NOT NULL,
    "updated_at" TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "allocation_weight_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "allocation_weight_configs_dimension_key_key"
    ON "allocation_weight_configs"("dimension", "key");

CREATE INDEX "allocation_weight_configs_dimension_idx"
    ON "allocation_weight_configs"("dimension");

-- 6. allocator_delegates
CREATE TABLE "allocator_delegates" (
    "id"             TEXT        NOT NULL,
    "delegate_id"    TEXT        NOT NULL,
    "granted_by_id"  TEXT        NOT NULL,
    "start_date"     TIMESTAMP(3) NOT NULL,
    "end_date"       TIMESTAMP(3) NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocator_delegates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "allocator_delegates_delegate_id_idx"
    ON "allocator_delegates"("delegate_id");

CREATE INDEX "allocator_delegates_end_date_idx"
    ON "allocator_delegates"("end_date");

ALTER TABLE "allocator_delegates"
    ADD CONSTRAINT "allocator_delegates_delegate_id_fkey"
    FOREIGN KEY ("delegate_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "allocator_delegates"
    ADD CONSTRAINT "allocator_delegates_granted_by_id_fkey"
    FOREIGN KEY ("granted_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
