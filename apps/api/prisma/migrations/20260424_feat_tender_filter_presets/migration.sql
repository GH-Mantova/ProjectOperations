-- ── Tender filter presets (per-user saved filter sets) ──────────────
CREATE TABLE "tender_filter_presets" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "filters"    JSONB NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tender_filter_presets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tender_filter_presets_user_id_name_key"
  ON "tender_filter_presets"("user_id", "name");

CREATE INDEX "tender_filter_presets_user_id_idx"
  ON "tender_filter_presets"("user_id");

ALTER TABLE "tender_filter_presets"
  ADD CONSTRAINT "tender_filter_presets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
