-- CHARGE_STEPS_PRICE_CUTTING_V1 (scopecards-s5)
-- Purely additive. One nullable JSON column on tender_rate_sets stores the
-- formula snapshot captured at lock time. No mutating DML, no drop.

-- charge_steps_snapshot on tender_rate_sets
-- Keyed by rate-table slug; each entry carries the chargeSteps list,
-- lineFields, and column descriptors captured at lock time so a later
-- catalogue edit cannot move a locked price.
ALTER TABLE "tender_rate_sets"
    ADD COLUMN "charge_steps_snapshot" JSONB;
