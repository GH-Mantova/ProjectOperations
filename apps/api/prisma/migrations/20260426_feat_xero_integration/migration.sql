-- Xero connection (singleton row, id=1)
CREATE TABLE "xero_connections" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "tenant_id" TEXT NOT NULL,
  "tenant_name" TEXT,
  "access_token" TEXT NOT NULL,
  "refresh_token" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "connected_by" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "xero_connections_pkey" PRIMARY KEY ("id")
);

-- Sync audit log
CREATE TABLE "xero_sync_logs" (
  "id" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "xero_id" TEXT,
  "status" TEXT NOT NULL,
  "error_text" TEXT,
  "triggered_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "xero_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "xero_sync_logs_entity_type_entity_id_idx" ON "xero_sync_logs"("entity_type", "entity_id");
CREATE INDEX "xero_sync_logs_direction_created_at_idx" ON "xero_sync_logs"("direction", "created_at");
