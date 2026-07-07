-- Per-section markup overrides for waste + cutting sections on each
-- scope card. Mirrors scope_cards.markup_override (B2). Null =
-- inherit tender markup; any non-null value overrides only that
-- section's cost stream. Waste, cutting, and scope are independent
-- cost streams — each is marked up on its own base.

ALTER TABLE "scope_cards"
  ADD COLUMN "waste_markup_override"   DECIMAL(5, 2),
  ADD COLUMN "cutting_markup_override" DECIMAL(5, 2);
