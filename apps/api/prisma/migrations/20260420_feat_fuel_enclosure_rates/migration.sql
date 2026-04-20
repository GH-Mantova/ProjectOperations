-- Fuel rate library (rate library)
CREATE TABLE "estimate_fuel_rates" (
  "id" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "rate" DECIMAL(10,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_fuel_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estimate_fuel_rates_item_key" ON "estimate_fuel_rates"("item");

-- Asbestos enclosure rate library
CREATE TABLE "estimate_enclosure_rates" (
  "id" TEXT NOT NULL,
  "enclosure_type" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "rate" DECIMAL(10,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_enclosure_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estimate_enclosure_rates_enclosure_type_key" ON "estimate_enclosure_rates"("enclosure_type");
