-- Safety forms (PR #81)
-- Adds SafetyIncident + HazardObservation models with row-locked
-- IS-INC###/IS-HAZ### auto-numbering sequences.

-- ─── Sequences ──────────────────────────────────────────────────────────
CREATE TABLE "safety_incident_number_sequences" (
  "id"          INTEGER PRIMARY KEY DEFAULT 1,
  "last_number" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "hazard_number_sequences" (
  "id"          INTEGER PRIMARY KEY DEFAULT 1,
  "last_number" INTEGER NOT NULL DEFAULT 0
);

-- ─── SafetyIncident ─────────────────────────────────────────────────────
CREATE TABLE "safety_incidents" (
  "id"               TEXT PRIMARY KEY,
  "incident_number"  TEXT NOT NULL,
  "tender_id"        TEXT,
  "project_id"       TEXT,
  "reported_by_id"   TEXT NOT NULL,
  "incident_date"    TIMESTAMP(3) NOT NULL,
  "location"         TEXT NOT NULL,
  "incident_type"    TEXT NOT NULL,
  "severity"         TEXT NOT NULL,
  "description"      TEXT NOT NULL,
  "immediate_action" TEXT,
  "root_cause"       TEXT,
  "corrective"       TEXT,
  "witnesses"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"           TEXT NOT NULL DEFAULT 'open',
  "document_paths"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "closed_at"        TIMESTAMP(3),
  "closed_by_id"     TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "safety_incidents_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL,
  CONSTRAINT "safety_incidents_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL,
  CONSTRAINT "safety_incidents_reported_by_id_fkey"
    FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "safety_incidents_closed_by_id_fkey"
    FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "safety_incidents_incident_number_key" ON "safety_incidents" ("incident_number");
CREATE INDEX "safety_incidents_incident_date_idx" ON "safety_incidents" ("incident_date");
CREATE INDEX "safety_incidents_status_idx" ON "safety_incidents" ("status");

-- ─── HazardObservation ──────────────────────────────────────────────────
CREATE TABLE "hazard_observations" (
  "id"               TEXT PRIMARY KEY,
  "hazard_number"    TEXT NOT NULL,
  "tender_id"        TEXT,
  "project_id"       TEXT,
  "reported_by_id"   TEXT NOT NULL,
  "observation_date" TIMESTAMP(3) NOT NULL,
  "location"         TEXT NOT NULL,
  "hazard_type"      TEXT NOT NULL,
  "risk_level"       TEXT NOT NULL,
  "description"      TEXT NOT NULL,
  "immediate_action" TEXT,
  "assigned_to_id"   TEXT,
  "due_date"         TIMESTAMP(3),
  "status"           TEXT NOT NULL DEFAULT 'open',
  "document_paths"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "closed_at"        TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hazard_observations_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL,
  CONSTRAINT "hazard_observations_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL,
  CONSTRAINT "hazard_observations_reported_by_id_fkey"
    FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "hazard_observations_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "hazard_observations_hazard_number_key" ON "hazard_observations" ("hazard_number");
CREATE INDEX "hazard_observations_risk_level_idx" ON "hazard_observations" ("risk_level");
CREATE INDEX "hazard_observations_status_idx" ON "hazard_observations" ("status");
