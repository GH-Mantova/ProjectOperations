-- Waste transport cost engine R3 T-1 (2026-07-20). Second slice of
-- docs/architecture/drafts/waste-transport-cost-engine-DRAFT.md.
--
-- Follows T-0 (2026-07-15) which added the per-asset fuel/capacity fields
-- and the OperationsSettings singleton. This slice wires the actual cost
-- calculation onto the scope_waste_items rows: each waste line now carries
-- a Transport Fees row reference, an Asset reference, the truck/load/day
-- inputs, and snapshot cost components (transport, fuel, disposal) folded
-- into line_total. Also snapshots the disposal + fuel rates at pricing
-- time so a "rate changed since quoted" variance flag can escalate to
-- the responsible role without auto-repricing.
--
-- Fully additive, every column nullable, no data backfill needed. The
-- legacy truck_days / rate_per_tonne / rate_per_load path stays intact so
-- Sum-from-above aggregator rows keep working unchanged.

-- 1. ScopeWasteItem new columns (T-1 core).
ALTER TABLE "scope_waste_items"
  ADD COLUMN IF NOT EXISTS "transport_rate_id"           TEXT,
  ADD COLUMN IF NOT EXISTS "asset_id"                    TEXT,
  ADD COLUMN IF NOT EXISTS "qty_trucks"                  INTEGER,
  ADD COLUMN IF NOT EXISTS "loads_per_truck_per_day"     DECIMAL(4, 1),
  ADD COLUMN IF NOT EXISTS "capacity_per_load"           DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS "capacity_unit"               TEXT,
  ADD COLUMN IF NOT EXISTS "daily_km"                    DECIMAL(8, 1),
  ADD COLUMN IF NOT EXISTS "transport_cost"              DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "fuel_cost"                   DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "disposal_cost"               DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "quoted_disposal_rate"        DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "quoted_fuel_price_per_litre" DECIMAL(6, 3);

-- 2. Foreign keys - SET NULL on delete so removing a plant rate or asset
--    leaves the waste line intact (with an empty picker on the UI, which
--    the estimator resolves manually).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scope_waste_items_transport_rate_id_fkey'
  ) THEN
    ALTER TABLE "scope_waste_items"
      ADD CONSTRAINT "scope_waste_items_transport_rate_id_fkey"
      FOREIGN KEY ("transport_rate_id") REFERENCES "estimate_plant_rates"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scope_waste_items_asset_id_fkey'
  ) THEN
    ALTER TABLE "scope_waste_items"
      ADD CONSTRAINT "scope_waste_items_asset_id_fkey"
      FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Supporting indexes for the two new lookup paths.
CREATE INDEX IF NOT EXISTS "scope_waste_items_transport_rate_id_idx"
  ON "scope_waste_items"("transport_rate_id");
CREATE INDEX IF NOT EXISTS "scope_waste_items_asset_id_idx"
  ON "scope_waste_items"("asset_id");

-- 4. Notification trigger catalogue entry for the variance escalation.
--    Seeded disabled so a fresh tenant does not fire the notification
--    until Marco selects recipients in Admin Settings. Idempotent via
--    ON CONFLICT (trigger) DO NOTHING - the seed-reference upsert also
--    covers it, but we register it here so a `prisma migrate deploy` on
--    a bare DB has the row before the first escalate click.
INSERT INTO "notification_trigger_configs"
  ("id", "trigger", "label", "description", "is_enabled", "delivery_method",
   "recipient_roles", "recipient_user_ids", "created_at", "updated_at")
VALUES
  ('ntc-waste-rate-variance',
   'waste_line.rate_variance_escalated',
   'Waste line rate variance escalated',
   'Fires when an estimator clicks "Escalate for confirmation" on a waste line whose disposal or fuel rate has moved since the line was priced. Recipient is expected to confirm or reprice the line - the system does NOT auto-reprice (Marco 2026-07-15).',
   false,
   'both',
   ARRAY['Estimator','Project Manager','Operations Manager']::TEXT[],
   ARRAY[]::TEXT[],
   NOW(),
   NOW())
ON CONFLICT ("trigger") DO NOTHING;
