-- Estimate rate library (company-wide locked rates)
CREATE TABLE "estimate_labour_rates" (
  "id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "day_rate" DECIMAL(10,2) NOT NULL,
  "night_rate" DECIMAL(10,2) NOT NULL,
  "weekend_rate" DECIMAL(10,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_labour_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estimate_labour_rates_role_key" ON "estimate_labour_rates"("role");

CREATE TABLE "estimate_plant_rates" (
  "id" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'day',
  "rate" DECIMAL(10,2) NOT NULL,
  "fuel_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_plant_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estimate_plant_rates_item_key" ON "estimate_plant_rates"("item");

CREATE TABLE "estimate_waste_rates" (
  "id" TEXT NOT NULL,
  "waste_type" TEXT NOT NULL,
  "facility" TEXT NOT NULL,
  "ton_rate" DECIMAL(10,2) NOT NULL,
  "load_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_waste_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estimate_waste_rates_waste_type_facility_key" ON "estimate_waste_rates"("waste_type", "facility");

CREATE TABLE "estimate_cutting_rates" (
  "id" TEXT NOT NULL,
  "cutting_type" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "rate" DECIMAL(10,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_cutting_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estimate_cutting_rates_cutting_type_key" ON "estimate_cutting_rates"("cutting_type");

-- Tender estimate (one per tender)
CREATE TABLE "tender_estimates" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "markup" DECIMAL(5,2) NOT NULL DEFAULT 30,
  "notes" TEXT,
  "locked_at" TIMESTAMP(3),
  "locked_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tender_estimates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tender_estimates_tender_id_key" ON "tender_estimates"("tender_id");
ALTER TABLE "tender_estimates" ADD CONSTRAINT "tender_estimates_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Estimate items (scope items)
CREATE TABLE "estimate_items" (
  "id" TEXT NOT NULL,
  "estimate_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "item_number" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "markup" DECIMAL(5,2) NOT NULL DEFAULT 30,
  "is_provisional" BOOLEAN NOT NULL DEFAULT false,
  "provisional_amount" DECIMAL(12,2),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "estimate_items_estimate_id_code_item_number_idx" ON "estimate_items"("estimate_id", "code", "item_number");
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "tender_estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Line items
CREATE TABLE "estimate_labour_lines" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "qty" DECIMAL(8,2) NOT NULL,
  "days" DECIMAL(8,2) NOT NULL,
  "shift" TEXT NOT NULL DEFAULT 'Day',
  "rate" DECIMAL(10,2) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "estimate_labour_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "estimate_labour_lines_item_id_idx" ON "estimate_labour_lines"("item_id");
ALTER TABLE "estimate_labour_lines" ADD CONSTRAINT "estimate_labour_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "estimate_plant_lines" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "plant_item" TEXT NOT NULL,
  "qty" DECIMAL(8,2) NOT NULL,
  "days" DECIMAL(8,2) NOT NULL,
  "comment" TEXT,
  "rate" DECIMAL(10,2) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "estimate_plant_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "estimate_plant_lines_item_id_idx" ON "estimate_plant_lines"("item_id");
ALTER TABLE "estimate_plant_lines" ADD CONSTRAINT "estimate_plant_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "estimate_waste_lines" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "waste_group" TEXT,
  "waste_type" TEXT NOT NULL,
  "facility" TEXT NOT NULL,
  "qty_tonnes" DECIMAL(10,3) NOT NULL,
  "ton_rate" DECIMAL(10,2) NOT NULL,
  "loads" INTEGER NOT NULL DEFAULT 0,
  "load_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "estimate_waste_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "estimate_waste_lines_item_id_idx" ON "estimate_waste_lines"("item_id");
ALTER TABLE "estimate_waste_lines" ADD CONSTRAINT "estimate_waste_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "estimate_cutting_lines" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "cutting_type" TEXT NOT NULL,
  "qty" DECIMAL(10,2) NOT NULL,
  "unit" TEXT NOT NULL,
  "comment" TEXT,
  "rate" DECIMAL(10,2) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "estimate_cutting_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "estimate_cutting_lines_item_id_idx" ON "estimate_cutting_lines"("item_id");
ALTER TABLE "estimate_cutting_lines" ADD CONSTRAINT "estimate_cutting_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "estimate_assumptions" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "estimate_assumptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "estimate_assumptions_item_id_idx" ON "estimate_assumptions"("item_id");
ALTER TABLE "estimate_assumptions" ADD CONSTRAINT "estimate_assumptions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
