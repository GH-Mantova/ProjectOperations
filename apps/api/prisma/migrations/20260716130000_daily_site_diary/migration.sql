-- ERP gap A — Daily Site Diary. Evidentiary spine for delay / variation /
-- dispute defence. One diary per Project per calendar date.

-- CreateTable
CREATE TABLE "daily_diaries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "site_id" TEXT,
    "date" DATE NOT NULL,
    "author_id" TEXT NOT NULL,
    "weather" TEXT,
    "temperature_c" DECIMAL(4,1),
    "crew_summary" TEXT,
    "plant_on_site" TEXT,
    "deliveries" TEXT,
    "visitors" TEXT,
    "delays" TEXT,
    "notes" TEXT,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_diaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_diaries_project_id_date_key" ON "daily_diaries"("project_id", "date");

-- CreateIndex
CREATE INDEX "daily_diaries_project_id_date_idx" ON "daily_diaries"("project_id", "date");

-- CreateIndex
CREATE INDEX "daily_diaries_site_id_idx" ON "daily_diaries"("site_id");

-- CreateIndex
CREATE INDEX "daily_diaries_author_id_idx" ON "daily_diaries"("author_id");

-- AddForeignKey
ALTER TABLE "daily_diaries" ADD CONSTRAINT "daily_diaries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_diaries" ADD CONSTRAINT "daily_diaries_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_diaries" ADD CONSTRAINT "daily_diaries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
