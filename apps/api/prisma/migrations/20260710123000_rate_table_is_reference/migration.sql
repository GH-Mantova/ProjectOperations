-- Flag flexible RateTables that hold reference / factor data (production
-- rates, densities, bucket capacities…) so the tender rate-set snapshot
-- (RateResolverService.enumerateRateSet) can skip them. Reference tables
-- stay resolvable via the seam but never appear as priced `$` override
-- rows on a locked tender.

-- AlterTable
ALTER TABLE "rate_tables"
  ADD COLUMN "is_reference" BOOLEAN NOT NULL DEFAULT false;

-- Existing rows keep their priced behaviour (default false). New
-- reference tables are opted in explicitly by seed / API.
UPDATE "rate_tables" SET "is_reference" = false WHERE "is_reference" IS NULL;
