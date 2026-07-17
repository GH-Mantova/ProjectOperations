-- Saved personal views for list pages (D365-style personal views).
-- Scoped per (ownerId, entityType); one default per (ownerId, entityType).

CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "sort" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_views_owner_id_entity_type_name_key"
    ON "saved_views"("owner_id", "entity_type", "name");

CREATE INDEX "saved_views_owner_id_entity_type_idx"
    ON "saved_views"("owner_id", "entity_type");

ALTER TABLE "saved_views"
    ADD CONSTRAINT "saved_views_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
