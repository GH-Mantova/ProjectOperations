-- CFX-1: Field registry + customFields JSONB + missing Xero parity columns
-- Purely additive: no UPDATE ... SET, no column drops, all ADDs are nullable.

-- 1. New enums
CREATE TYPE "FieldAppliesTo" AS ENUM ('CLIENT', 'VENDOR', 'BOTH');
CREATE TYPE "FieldSource" AS ENUM ('BUILTIN', 'CUSTOM');

-- 2. field_definitions table
CREATE TABLE "field_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'General',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "applies_to" "FieldAppliesTo" NOT NULL,
    "source" "FieldSource" NOT NULL DEFAULT 'CUSTOM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- 3. Unique constraint on (applies_to, key)
CREATE UNIQUE INDEX "field_definitions_applies_to_key_key" ON "field_definitions"("applies_to", "key");

-- 4. Index on (applies_to, visible)
CREATE INDEX "field_definitions_applies_to_visible_idx" ON "field_definitions"("applies_to", "visible");

-- 5. Xero parity columns on clients
ALTER TABLE "clients" ADD COLUMN "sales_account_code" TEXT;
ALTER TABLE "clients" ADD COLUMN "purchase_account_code" TEXT;
ALTER TABLE "clients" ADD COLUMN "discount" NUMERIC(5,2);
ALTER TABLE "clients" ADD COLUMN "custom_fields" JSONB;

-- 6. Xero parity columns on subcontractor_suppliers
ALTER TABLE "subcontractor_suppliers" ADD COLUMN "sales_account_code" TEXT;
ALTER TABLE "subcontractor_suppliers" ADD COLUMN "purchase_account_code" TEXT;
ALTER TABLE "subcontractor_suppliers" ADD COLUMN "discount" NUMERIC(5,2);
ALTER TABLE "subcontractor_suppliers" ADD COLUMN "custom_fields" JSONB;
