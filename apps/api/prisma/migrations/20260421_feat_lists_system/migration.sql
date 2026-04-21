-- Global Lists system — user-manageable reference data with STATIC and
-- DYNAMIC list types. Items are never hard-deleted (archive on delete) so
-- the stored value string on consuming records remains resolvable.

CREATE TYPE "GlobalListType" AS ENUM ('STATIC', 'DYNAMIC');

CREATE TABLE "global_lists" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "type" "GlobalListType" NOT NULL,
  "source_module" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "global_lists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "global_lists_name_key" ON "global_lists"("name");
CREATE UNIQUE INDEX "global_lists_slug_key" ON "global_lists"("slug");

ALTER TABLE "global_lists"
  ADD CONSTRAINT "global_lists_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "global_list_items" (
  "id" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "metadata" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "global_list_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "global_list_items_list_id_value_key" ON "global_list_items"("list_id", "value");
CREATE INDEX "global_list_items_list_id_is_archived_idx" ON "global_list_items"("list_id", "is_archived");

ALTER TABLE "global_list_items"
  ADD CONSTRAINT "global_list_items_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "global_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "global_list_items"
  ADD CONSTRAINT "global_list_items_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
