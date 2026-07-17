-- Automation engine (MVP slice 1)
-- Adds admin-configurable "when X, do Y" rules alongside (not inside) the
-- forms rules engine. Actions are whitelisted in code; the schema itself is
-- generic. A run log records each evaluation for audit + debugging.

-- ── automation_rules ─────────────────────────────────────────────────────
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_entity" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automation_rules_trigger_entity_trigger_event_enabled_idx"
    ON "automation_rules"("trigger_entity", "trigger_event", "enabled");

-- ── automation_rule_runs ─────────────────────────────────────────────────
CREATE TABLE "automation_rule_runs" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "event" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "error" TEXT,
    "actions_run" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rule_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automation_rule_runs_rule_id_created_at_idx"
    ON "automation_rule_runs"("rule_id", "created_at");
CREATE INDEX "automation_rule_runs_entity_entity_id_idx"
    ON "automation_rule_runs"("entity", "entity_id");

ALTER TABLE "automation_rule_runs"
    ADD CONSTRAINT "automation_rule_runs_rule_id_fkey"
    FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
