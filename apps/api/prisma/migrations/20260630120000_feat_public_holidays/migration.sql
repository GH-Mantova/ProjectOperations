-- GATE-ALLOW: migrations
-- PR-451 — Public holidays lookup.
-- Region-aware, multi-year table consumed by the Scheduler grid (shading) and
-- the Availability report ("skip weekends and public holidays"). Replaces
-- hardcoded QLD maps. Region defaults to "QLD"; Brisbane-only days
-- (Royal Queensland Show) use region = "BRISBANE".

CREATE TABLE "public_holidays" (
  "id"         TEXT NOT NULL,
  "date"       DATE NOT NULL,
  "name"       TEXT NOT NULL,
  "region"     TEXT NOT NULL DEFAULT 'QLD',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_holidays_date_region_key"
  ON "public_holidays"("date", "region");

CREATE INDEX "public_holidays_region_date_idx"
  ON "public_holidays"("region", "date");
