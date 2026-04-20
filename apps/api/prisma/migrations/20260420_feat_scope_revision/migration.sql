-- Tender scope revisions — Claude feedback loop history
CREATE TABLE "tender_scope_revisions" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "original_proposal" JSONB NOT NULL,
  "correction" TEXT NOT NULL,
  "revised_proposal" JSONB,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tender_scope_revisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tender_scope_revisions_tender_id_idx" ON "tender_scope_revisions"("tender_id");
ALTER TABLE "tender_scope_revisions" ADD CONSTRAINT "tender_scope_revisions_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_scope_revisions" ADD CONSTRAINT "tender_scope_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-client activity log on a tender (CRM)
CREATE TABLE "tender_client_notes" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "note_type" TEXT NOT NULL DEFAULT 'note',
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tender_client_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tender_client_notes_tender_id_client_id_idx" ON "tender_client_notes"("tender_id", "client_id");
ALTER TABLE "tender_client_notes" ADD CONSTRAINT "tender_client_notes_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_client_notes" ADD CONSTRAINT "tender_client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_client_notes" ADD CONSTRAINT "tender_client_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
