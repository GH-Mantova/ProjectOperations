-- Migration: scope_waste_transport_rate_snapshot
-- Date: 2026-08-19
-- Adds quoted_transport_rate_per_day to scope_waste_items.
--
-- Additive, nullable. backfill: false -- existing rows are intentionally
-- left NULL. NULL means the row predates this column or was never priced
-- via the transport engine; it behaves exactly like the live-lookup path
-- that existed before this column (no data is lost on revert).
--
-- Rollback: ALTER TABLE scope_waste_items DROP COLUMN quoted_transport_rate_per_day;
-- (safe -- no data is stored in the column for existing rows)

ALTER TABLE "scope_waste_items" ADD COLUMN "quoted_transport_rate_per_day" DECIMAL(10,2);
