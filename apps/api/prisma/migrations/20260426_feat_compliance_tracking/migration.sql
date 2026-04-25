-- Compliance tracking (PR #79)
-- Adds WorkerQualification + ComplianceAlert tables and three compliance
-- block fields on subcontractor_suppliers. The ComplianceAlert table is the
-- dedup guard so the daily cron doesn't notify the same user twice for the
-- same item/tier.

-- ─── 1. SubcontractorSupplier compliance block columns ───────────────────
ALTER TABLE "subcontractor_suppliers"
  ADD COLUMN "compliance_blocked"        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN "compliance_block_reason"   TEXT,
  ADD COLUMN "compliance_blocked_at"     TIMESTAMP(3);

-- ─── 2. WorkerQualification ──────────────────────────────────────────────
CREATE TABLE "worker_qualifications" (
  "id"                  TEXT PRIMARY KEY,
  "worker_profile_id"   TEXT NOT NULL,
  "qual_type"           TEXT NOT NULL,
  "licence_number"      TEXT,
  "issuing_authority"   TEXT,
  "issue_date"          TIMESTAMP(3),
  "expiry_date"         TIMESTAMP(3),
  "document_path"       TEXT,
  "notes"               TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  "created_by_id"       TEXT,
  CONSTRAINT "worker_qualifications_worker_profile_id_fkey"
    FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "worker_qualifications_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "worker_qualifications_worker_profile_id_idx"
  ON "worker_qualifications" ("worker_profile_id");
CREATE INDEX "worker_qualifications_expiry_date_idx"
  ON "worker_qualifications" ("expiry_date");

-- ─── 3. ComplianceAlert ──────────────────────────────────────────────────
CREATE TABLE "compliance_alerts" (
  "id"                TEXT PRIMARY KEY,
  "entity_type"       TEXT NOT NULL,
  "entity_id"         TEXT NOT NULL,
  "item_type"         TEXT NOT NULL,
  "item_id"           TEXT NOT NULL,
  "alert_type"        TEXT NOT NULL,
  "sent_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_to_user_id"   TEXT NOT NULL,
  CONSTRAINT "compliance_alerts_sent_to_user_id_fkey"
    FOREIGN KEY ("sent_to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "compliance_alerts_item_id_alert_type_key"
  ON "compliance_alerts" ("item_id", "alert_type");
CREATE INDEX "compliance_alerts_entity_id_idx"
  ON "compliance_alerts" ("entity_id");
