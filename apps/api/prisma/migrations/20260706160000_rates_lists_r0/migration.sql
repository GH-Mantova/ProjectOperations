-- Rates & Lists R0 (PR-487) — flexible RateTable + list-binding registry.
-- Additive only. Legacy rate tables (EstimateLabourRate…CuttingOtherRate)
-- remain untouched; the resolver reads them by default.

-- CreateEnum
CREATE TYPE "RateTableCategory" AS ENUM ('INITIAL_SERVICES', 'SUBCONTRACTOR');

-- CreateEnum
CREATE TYPE "RateColumnDataType" AS ENUM ('TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'BOOL', 'LIST_REF');

-- CreateEnum
CREATE TYPE "RateColumnRole" AS ENUM ('KEY', 'VALUE', 'INFO');

-- CreateEnum
CREATE TYPE "ListBindingConsumerType" AS ENUM ('RATE_COLUMN', 'FORM_FIELD', 'MODULE_DROPDOWN');

-- CreateTable
CREATE TABLE "rate_tables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" "RateTableCategory" NOT NULL,
    "subcontractor_type" TEXT,
    "supplier_id" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_columns" (
    "id" TEXT NOT NULL,
    "rate_table_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data_type" "RateColumnDataType" NOT NULL,
    "role" "RateColumnRole" NOT NULL,
    "unit" TEXT,
    "list_slug" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "min" DECIMAL(18,6),
    "max" DECIMAL(18,6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_rows" (
    "id" TEXT NOT NULL,
    "rate_table_id" TEXT NOT NULL,
    "cells" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_bindings" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "consumer_type" "ListBindingConsumerType" NOT NULL,
    "consumer_ref" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_tables_slug_key" ON "rate_tables"("slug");

-- CreateIndex
CREATE INDEX "rate_tables_category_idx" ON "rate_tables"("category");

-- CreateIndex
CREATE INDEX "rate_tables_supplier_id_idx" ON "rate_tables"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_columns_rate_table_id_name_key" ON "rate_columns"("rate_table_id", "name");

-- CreateIndex
CREATE INDEX "rate_rows_rate_table_id_is_active_idx" ON "rate_rows"("rate_table_id", "is_active");

-- CreateIndex
CREATE INDEX "list_bindings_list_id_idx" ON "list_bindings"("list_id");

-- CreateIndex
CREATE INDEX "list_bindings_consumer_type_consumer_ref_idx" ON "list_bindings"("consumer_type", "consumer_ref");

-- CreateIndex
CREATE UNIQUE INDEX "list_bindings_list_id_consumer_type_consumer_ref_key" ON "list_bindings"("list_id", "consumer_type", "consumer_ref");

-- AddForeignKey
ALTER TABLE "rate_tables" ADD CONSTRAINT "rate_tables_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "subcontractor_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_columns" ADD CONSTRAINT "rate_columns_rate_table_id_fkey" FOREIGN KEY ("rate_table_id") REFERENCES "rate_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_rows" ADD CONSTRAINT "rate_rows_rate_table_id_fkey" FOREIGN KEY ("rate_table_id") REFERENCES "rate_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
