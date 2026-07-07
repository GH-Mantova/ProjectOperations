-- PR-486 — Native inventory / stock layer (slice 1).
-- Creates the StockCategory / StockItem / StockMovement / StocktakeSession /
-- StocktakeCount tables plus the StockMovementType enum. Kept fully separate
-- from assets / asset_categories / maintenance to avoid overloading the
-- serialised-plant register with consumable-stock semantics.

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIVE', 'ISSUE', 'ADJUST', 'RETURN');

-- CreateTable
CREATE TABLE "stock_categories" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "code"        TEXT,
    "description" TEXT,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_categories_name_key" ON "stock_categories"("name");

-- CreateTable
CREATE TABLE "stock_items" (
    "id"                TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "sku"               TEXT,
    "category_id"       TEXT,
    "unit"              TEXT NOT NULL,
    "quantity_on_hand"  DECIMAL(14,4) NOT NULL DEFAULT 0,
    "reorder_level"     DECIMAL(14,4),
    "location"          TEXT,
    "is_active"         BOOLEAN NOT NULL DEFAULT true,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_items_name_idx" ON "stock_items"("name");

-- CreateIndex
CREATE INDEX "stock_items_sku_idx" ON "stock_items"("sku");

-- CreateIndex
CREATE INDEX "stock_items_category_id_idx" ON "stock_items"("category_id");

-- CreateTable
CREATE TABLE "stock_movements" (
    "id"                 TEXT NOT NULL,
    "stock_item_id"      TEXT NOT NULL,
    "type"               "StockMovementType" NOT NULL,
    "quantity"           DECIMAL(14,4) NOT NULL,
    "reason"             TEXT,
    "ref_type"           TEXT,
    "ref_id"             TEXT,
    "moved_by_user_id"   TEXT,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_stock_item_id_idx" ON "stock_movements"("stock_item_id");

-- CreateIndex
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements"("created_at");

-- CreateTable
CREATE TABLE "stocktake_sessions" (
    "id"                    TEXT NOT NULL,
    "started_by_user_id"    TEXT,
    "status"                TEXT NOT NULL DEFAULT 'OPEN',
    "notes"                 TEXT,
    "started_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at"          TIMESTAMP(3),
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocktake_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stocktake_sessions_status_idx" ON "stocktake_sessions"("status");

-- CreateTable
CREATE TABLE "stocktake_counts" (
    "id"             TEXT NOT NULL,
    "session_id"     TEXT NOT NULL,
    "stock_item_id"  TEXT NOT NULL,
    "system_qty"     DECIMAL(14,4) NOT NULL,
    "counted_qty"    DECIMAL(14,4) NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stocktake_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stocktake_counts_session_id_stock_item_id_key"
    ON "stocktake_counts"("session_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "stocktake_counts_session_id_idx" ON "stocktake_counts"("session_id");

-- AddForeignKey
ALTER TABLE "stock_items"
    ADD CONSTRAINT "stock_items_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "stock_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_stock_item_id_fkey"
    FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_counts"
    ADD CONSTRAINT "stocktake_counts_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "stocktake_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_counts"
    ADD CONSTRAINT "stocktake_counts_stock_item_id_fkey"
    FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
