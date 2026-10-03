-- ASB_ENCLOSURE_LINES_V1
-- Additive. Creates one new table. Changes no existing column or row.
-- Rollback: drop the table. No existing line prices differently at any point.

CREATE TABLE "scope_item_enclosure_lines" (
    "id"            TEXT         NOT NULL,
    "scope_item_id" TEXT         NOT NULL,
    "enclosure_type" TEXT        NOT NULL,
    "qty"           DECIMAL(10,3) NOT NULL,
    "unit"          TEXT         NOT NULL,
    "rate"          DECIMAL(10,2) NOT NULL,
    "rate_override" DECIMAL(10,2),
    "sort_order"    INTEGER      NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scope_item_enclosure_lines_pkey" PRIMARY KEY ("id")
);

-- FK to scope_of_works_items; CASCADE so deleting an item removes its lines.
ALTER TABLE "scope_item_enclosure_lines"
    ADD CONSTRAINT "scope_item_enclosure_lines_scope_item_id_fkey"
    FOREIGN KEY ("scope_item_id")
    REFERENCES "scope_of_works_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- List lines for one item in sort order.
CREATE INDEX "scope_item_enclosure_lines_scope_item_id_sort_order_idx"
    ON "scope_item_enclosure_lines"("scope_item_id", "sort_order");
