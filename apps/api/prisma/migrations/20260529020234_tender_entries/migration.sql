-- PR #18 — unified communications panel. Adds TenderEntry table that will
-- replace the three legacy Overview-tab feeds (Activity timeline /
-- Clarifications & Communications / Follow-ups). Legacy tables stay one
-- release cycle for safety; a follow-up PR drops them.

-- CreateTable
CREATE TABLE "tender_entries" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "assignee_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tender_entries_tender_id_created_at_idx" ON "tender_entries"("tender_id", "created_at");

-- CreateIndex
CREATE INDEX "tender_entries_assignee_id_status_idx" ON "tender_entries"("assignee_id", "status");

-- AddForeignKey
ALTER TABLE "tender_entries" ADD CONSTRAINT "tender_entries_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_entries" ADD CONSTRAINT "tender_entries_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_entries" ADD CONSTRAINT "tender_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
