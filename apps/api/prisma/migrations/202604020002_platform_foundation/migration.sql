CREATE TABLE "sharepoint_folder_links" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "drive_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "linked_entity_type" TEXT,
    "linked_entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sharepoint_folder_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sharepoint_file_links" (
    "id" TEXT NOT NULL,
    "folder_link_id" TEXT,
    "site_id" TEXT NOT NULL,
    "drive_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "web_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "linked_entity_type" TEXT,
    "linked_entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sharepoint_file_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_links" (
    "id" TEXT NOT NULL,
    "linked_entity_type" TEXT NOT NULL,
    "linked_entity_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "folder_link_id" TEXT,
    "file_link_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "link_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "search_entries" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT,
    "module" TEXT NOT NULL,
    "url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "search_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "owner_role_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sharepoint_folder_links_site_id_drive_id_item_id_key" ON "sharepoint_folder_links"("site_id", "drive_id", "item_id");
CREATE UNIQUE INDEX "sharepoint_file_links_site_id_drive_id_item_id_key" ON "sharepoint_file_links"("site_id", "drive_id", "item_id");
CREATE INDEX "sharepoint_folder_links_module_idx" ON "sharepoint_folder_links"("module");
CREATE INDEX "sharepoint_folder_links_linked_entity_type_linked_entity_id_idx" ON "sharepoint_folder_links"("linked_entity_type", "linked_entity_id");
CREATE INDEX "sharepoint_file_links_folder_link_id_idx" ON "sharepoint_file_links"("folder_link_id");
CREATE INDEX "sharepoint_file_links_linked_entity_type_linked_entity_id_idx" ON "sharepoint_file_links"("linked_entity_type", "linked_entity_id");
CREATE INDEX "document_links_linked_entity_type_linked_entity_id_idx" ON "document_links"("linked_entity_type", "linked_entity_id");
CREATE INDEX "document_links_category_idx" ON "document_links"("category");
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");
CREATE INDEX "search_entries_module_idx" ON "search_entries"("module");
CREATE INDEX "search_entries_entity_type_entity_id_idx" ON "search_entries"("entity_type", "entity_id");
CREATE INDEX "dashboards_scope_idx" ON "dashboards"("scope");
CREATE INDEX "dashboards_owner_user_id_idx" ON "dashboards"("owner_user_id");
CREATE INDEX "dashboard_widgets_dashboard_id_position_idx" ON "dashboard_widgets"("dashboard_id", "position");

ALTER TABLE "sharepoint_file_links" ADD CONSTRAINT "sharepoint_file_links_folder_link_id_fkey" FOREIGN KEY ("folder_link_id") REFERENCES "sharepoint_folder_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_folder_link_id_fkey" FOREIGN KEY ("folder_link_id") REFERENCES "sharepoint_folder_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_file_link_id_fkey" FOREIGN KEY ("file_link_id") REFERENCES "sharepoint_file_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
