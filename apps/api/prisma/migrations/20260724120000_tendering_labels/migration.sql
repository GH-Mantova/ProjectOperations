-- Org-wide Tendering display-label overrides — additive.
--
-- Rows exist only for keys that have been RENAMED away from their in-code
-- default. Deleting a row restores the default (the API merges overrides on
-- top of the defaults exported by apps/web/src/tendering-labels.ts).
--
-- `key` is the primary key (one row per key) — the same stable machine
-- identifier the web app uses. It is NEVER a database column, enum value,
-- route, or permission code — labels are display text only.

-- CreateTable
CREATE TABLE "tendering_labels" (
    "key"            TEXT NOT NULL,
    "label"          TEXT NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    "updated_by_id"  TEXT,

    CONSTRAINT "tendering_labels_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "tendering_labels" ADD CONSTRAINT "tendering_labels_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
