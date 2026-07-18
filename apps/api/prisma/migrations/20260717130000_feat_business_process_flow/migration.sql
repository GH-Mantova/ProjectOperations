-- Business Process Flow (D365-parity stage bar) — MVP slice 1.
-- Definition (flow + ordered stages) is config, not code, so an admin can
-- reshape a stage bar without a deploy. Instance rows are the per-record
-- position on the flow; the entity FK is intentionally soft because the
-- target table varies by entity_type.

-- ── 1. business_process_flows ────────────────────────────────────────
CREATE TABLE "business_process_flows" (
  "id"          TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_process_flows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_process_flows_entity_type_name_key"
  ON "business_process_flows"("entity_type", "name");

CREATE INDEX "business_process_flows_entity_type_active_idx"
  ON "business_process_flows"("entity_type", "active");

-- ── 2. business_process_stages ───────────────────────────────────────
CREATE TABLE "business_process_stages" (
  "id"                   TEXT NOT NULL,
  "flow_id"              TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "order"                INTEGER NOT NULL,
  "required_fields_json" JSONB NOT NULL DEFAULT '[]',
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_process_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_process_stages_flow_id_order_key"
  ON "business_process_stages"("flow_id", "order");

CREATE INDEX "business_process_stages_flow_id_idx"
  ON "business_process_stages"("flow_id");

ALTER TABLE "business_process_stages"
  ADD CONSTRAINT "business_process_stages_flow_id_fkey"
  FOREIGN KEY ("flow_id") REFERENCES "business_process_flows"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. business_process_instances ────────────────────────────────────
CREATE TABLE "business_process_instances" (
  "id"               TEXT NOT NULL,
  "flow_id"          TEXT NOT NULL,
  "entity_type"      TEXT NOT NULL,
  "entity_id"        TEXT NOT NULL,
  "current_stage_id" TEXT NOT NULL,
  "history_json"     JSONB NOT NULL DEFAULT '[]',
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_process_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_process_instances_entity_type_entity_id_key"
  ON "business_process_instances"("entity_type", "entity_id");

CREATE INDEX "business_process_instances_flow_id_idx"
  ON "business_process_instances"("flow_id");

CREATE INDEX "business_process_instances_current_stage_id_idx"
  ON "business_process_instances"("current_stage_id");

ALTER TABLE "business_process_instances"
  ADD CONSTRAINT "business_process_instances_flow_id_fkey"
  FOREIGN KEY ("flow_id") REFERENCES "business_process_flows"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_process_instances"
  ADD CONSTRAINT "business_process_instances_current_stage_id_fkey"
  FOREIGN KEY ("current_stage_id") REFERENCES "business_process_stages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
