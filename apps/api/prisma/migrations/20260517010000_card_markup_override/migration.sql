-- PR B2 — per-card markup override on ScopeCard.
-- Nullable Decimal(5,2): null = inherit TenderEstimate.markup, any non-null
-- value overrides for that card only. Pure additive; no backfill required.

ALTER TABLE "scope_cards" ADD COLUMN IF NOT EXISTS "markup_override" DECIMAL(5, 2);
