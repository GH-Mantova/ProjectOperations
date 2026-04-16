CREATE TABLE "asset_maintenance_plans" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "interval_days" INTEGER NOT NULL,
    "warning_days" INTEGER NOT NULL DEFAULT 7,
    "block_when_overdue" BOOLEAN NOT NULL DEFAULT true,
    "last_completed_at" TIMESTAMP(3),
    "next_due_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "asset_maintenance_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_maintenance_events" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "maintenance_plan_id" TEXT,
    "event_type" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "asset_maintenance_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_inspections" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "inspection_type" TEXT NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PASS',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "asset_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_breakdowns" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "asset_breakdowns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_status_history" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_maintenance_plans_asset_id_status_idx" ON "asset_maintenance_plans"("asset_id", "status");
CREATE INDEX "asset_maintenance_plans_next_due_at_idx" ON "asset_maintenance_plans"("next_due_at");
CREATE INDEX "asset_maintenance_events_asset_id_status_idx" ON "asset_maintenance_events"("asset_id", "status");
CREATE INDEX "asset_maintenance_events_maintenance_plan_id_idx" ON "asset_maintenance_events"("maintenance_plan_id");
CREATE INDEX "asset_inspections_asset_id_inspected_at_idx" ON "asset_inspections"("asset_id", "inspected_at");
CREATE INDEX "asset_breakdowns_asset_id_status_idx" ON "asset_breakdowns"("asset_id", "status");
CREATE INDEX "asset_status_history_asset_id_changed_at_idx" ON "asset_status_history"("asset_id", "changed_at");

ALTER TABLE "asset_maintenance_plans"
ADD CONSTRAINT "asset_maintenance_plans_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_maintenance_events"
ADD CONSTRAINT "asset_maintenance_events_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_maintenance_events"
ADD CONSTRAINT "asset_maintenance_events_maintenance_plan_id_fkey"
FOREIGN KEY ("maintenance_plan_id") REFERENCES "asset_maintenance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_inspections"
ADD CONSTRAINT "asset_inspections_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_breakdowns"
ADD CONSTRAINT "asset_breakdowns_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_status_history"
ADD CONSTRAINT "asset_status_history_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
