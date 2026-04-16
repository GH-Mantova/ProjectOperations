CREATE TABLE "tender_document_links" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "folder_link_id" TEXT,
    "file_link_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tender_document_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tender_document_links_tender_id_category_idx" ON "tender_document_links"("tender_id", "category");

ALTER TABLE "tender_document_links" ADD CONSTRAINT "tender_document_links_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_document_links" ADD CONSTRAINT "tender_document_links_folder_link_id_fkey" FOREIGN KEY ("folder_link_id") REFERENCES "sharepoint_folder_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tender_document_links" ADD CONSTRAINT "tender_document_links_file_link_id_fkey" FOREIGN KEY ("file_link_id") REFERENCES "sharepoint_file_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
