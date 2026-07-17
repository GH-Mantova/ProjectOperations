-- Digital delivery / haulage docket capture (feat/erp-haulage-dockets, 2026-07-16)
--
-- Adds three new tables:
--   dockets               — one row per docket (delivery | haulage | disposal)
--   docket_attachments    — photos / signatures / weighbridge slips attached to a docket
--   docket_number_sequences — atomic sequential DKT-XXXXXX numbering
-- and one new Postgres enum:
--   DocketType            — DELIVERY | HAULAGE | DISPOSAL
--
-- Back-relations added on existing tables:
--   jobs.id        → dockets.job_id   (SetNull on job delete)
--   assets.id      → dockets.asset_id (SetNull on asset delete)
--   workers.id     → dockets.worker_id (Restrict — driver required)
--
-- Fully additive. All new columns on new tables only — zero drift on existing tables.
-- Idempotent: guarded by CREATE TABLE IF NOT EXISTS / DO NOT EXISTS checks.

-- ── 1. Enum type ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DocketType" AS ENUM ('DELIVERY', 'HAULAGE', 'DISPOSAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Docket number sequence (mirrors SafetyIncidentNumberSequence) ──────────
CREATE TABLE IF NOT EXISTS "docket_number_sequences" (
  "id"          INTEGER NOT NULL DEFAULT 1,
  "last_number" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "docket_number_sequences_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so the first upsert always hits the UPDATE branch.
INSERT INTO "docket_number_sequences" ("id", "last_number")
VALUES (1, 0)
ON CONFLICT ("id") DO NOTHING;

-- ── 3. Dockets table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dockets" (
  "id"                   TEXT        NOT NULL,
  "docket_number"        TEXT        NOT NULL,
  "type"                 "DocketType" NOT NULL,

  "job_id"               TEXT,
  "asset_id"             TEXT,
  "worker_id"            TEXT        NOT NULL,

  "material_waste_type"  TEXT,
  "quantity"             DECIMAL(10, 3),
  "unit"                 TEXT,

  "from_location"        TEXT,
  "to_location"          TEXT,

  "signed_by_name"       TEXT,
  "gps_lat"              DECIMAL(10, 7),
  "gps_lng"              DECIMAL(10, 7),

  "status"               TEXT        NOT NULL DEFAULT 'CAPTURED',
  "captured_at"          TIMESTAMP(3) NOT NULL,

  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dockets_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "dockets_docket_number_key" UNIQUE ("docket_number"),

  CONSTRAINT "dockets_job_fk"
    FOREIGN KEY ("job_id")    REFERENCES "jobs"("id")    ON DELETE SET NULL    ON UPDATE CASCADE,
  CONSTRAINT "dockets_asset_fk"
    FOREIGN KEY ("asset_id")  REFERENCES "assets"("id")  ON DELETE SET NULL    ON UPDATE CASCADE,
  CONSTRAINT "dockets_worker_fk"
    FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT    ON UPDATE CASCADE
);

-- ── 4. Indexes on dockets ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "dockets_job_id_idx"       ON "dockets" ("job_id");
CREATE INDEX IF NOT EXISTS "dockets_asset_id_idx"     ON "dockets" ("asset_id");
CREATE INDEX IF NOT EXISTS "dockets_worker_id_idx"    ON "dockets" ("worker_id");
CREATE INDEX IF NOT EXISTS "dockets_captured_at_idx"  ON "dockets" ("captured_at");
CREATE INDEX IF NOT EXISTS "dockets_type_status_idx"  ON "dockets" ("type", "status");

-- ── 5. Docket attachments table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "docket_attachments" (
  "id"          TEXT         NOT NULL,
  "docket_id"   TEXT         NOT NULL,
  "kind"        TEXT         NOT NULL,
  "storage_url" TEXT         NOT NULL,
  "mime_type"   TEXT,
  "captured_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "docket_attachments_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "docket_attachments_docket_fk"
    FOREIGN KEY ("docket_id") REFERENCES "dockets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "docket_attachments_docket_id_idx" ON "docket_attachments" ("docket_id");
