-- CreateTable
CREATE TABLE "estimate_material_density" (
    "id" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "density" DECIMAL(8,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_material_density_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estimate_material_density_material_name_key" ON "estimate_material_density"("material_name");
