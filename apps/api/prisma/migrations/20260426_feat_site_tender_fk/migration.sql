-- PR E FIX 2: optional siteId FK on Tender so the sites detail page can
-- list linked tenders without a soft suburb match. Nullable + ON DELETE
-- SET NULL keeps existing tenders untouched and avoids cascading site
-- deletes into the tender table.
ALTER TABLE "tenders"
  ADD COLUMN "site_id" TEXT;

ALTER TABLE "tenders"
  ADD CONSTRAINT "tenders_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tenders_site_id_idx" ON "tenders" ("site_id");
