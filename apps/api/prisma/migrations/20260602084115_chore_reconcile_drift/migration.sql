-- ============================================================================
-- chore: reconcile migration history with schema.prisma
-- ============================================================================
-- Rolls up accumulated drift from PRs #117/#134/#136/#137/#139/#141 so that:
--   * `prisma migrate diff --from-migrations … --to-schema-datamodel …`
--     reports no diff, and
--   * a clean `migrate reset && migrate deploy` produces a DB that is
--     structurally identical to the current dev DB.
--
-- Every statement is idempotent (IF EXISTS / IF NOT EXISTS / DO-block guards)
-- so this migration is safe to apply both to the drifted dev DB and to a
-- fresh clean replay. See `reconciliation-notes.md` for the categorised
-- drift summary.
-- ============================================================================


-- --------------------------------------------------------------------------
-- (B) Stale objects in the dev DB that schema.prisma does not declare
-- --------------------------------------------------------------------------

ALTER TABLE "workers" DROP COLUMN IF EXISTS "employmentType";

DROP INDEX IF EXISTS "tender_clients_contract_issued_idx";


-- --------------------------------------------------------------------------
-- (A) Column default / type corrections
-- --------------------------------------------------------------------------

ALTER TABLE "document_links" ALTER COLUMN "module" DROP DEFAULT;

ALTER TABLE "notification_trigger_configs"
  ALTER COLUMN "recipient_roles" DROP DEFAULT,
  ALTER COLUMN "recipient_user_ids" DROP DEFAULT;

ALTER TABLE "scope_cards"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "subcontractor_suppliers" ALTER COLUMN "categories" DROP DEFAULT;


-- --------------------------------------------------------------------------
-- (A) Index rename — Postgres-truncated legacy name → Prisma's current name
-- --------------------------------------------------------------------------

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'estimate_cutting_rates_equipment_elevation_material_depth_mm_ke'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'estimate_cutting_rates_equipment_elevation_material_depth_m_key'
  ) THEN
    ALTER INDEX "estimate_cutting_rates_equipment_elevation_material_depth_mm_ke"
      RENAME TO "estimate_cutting_rates_equipment_elevation_material_depth_m_key";
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- (A) Foreign-key cascade reconciliation
--     Drop old constraints (if present) and re-add with the ON DELETE rules
--     declared in schema.prisma. Wrapping each ADD CONSTRAINT in a DO block
--     swallows "duplicate_object" so the migration is idempotent.
-- --------------------------------------------------------------------------

-- clients
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_claim_reminder_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "clients" ADD CONSTRAINT "clients_claim_reminder_user_id_fkey"
    FOREIGN KEY ("claim_reminder_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- contacts
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_created_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- scope_cards
ALTER TABLE "scope_cards" DROP CONSTRAINT IF EXISTS "scope_cards_tender_id_fkey";
DO $$ BEGIN
  ALTER TABLE "scope_cards" ADD CONSTRAINT "scope_cards_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "scope_cards" DROP CONSTRAINT IF EXISTS "scope_cards_created_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "scope_cards" ADD CONSTRAINT "scope_cards_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- scope_of_works_items
ALTER TABLE "scope_of_works_items" DROP CONSTRAINT IF EXISTS "scope_of_works_items_card_id_fkey";
DO $$ BEGIN
  ALTER TABLE "scope_of_works_items" ADD CONSTRAINT "scope_of_works_items_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "scope_cards"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- client_quotes
ALTER TABLE "client_quotes" DROP CONSTRAINT IF EXISTS "client_quotes_tender_id_fkey";
DO $$ BEGIN
  ALTER TABLE "client_quotes" ADD CONSTRAINT "client_quotes_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "client_quotes" DROP CONSTRAINT IF EXISTS "client_quotes_client_id_fkey";
DO $$ BEGIN
  ALTER TABLE "client_quotes" ADD CONSTRAINT "client_quotes_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "client_quotes" DROP CONSTRAINT IF EXISTS "client_quotes_sent_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "client_quotes" ADD CONSTRAINT "client_quotes_sent_by_id_fkey"
    FOREIGN KEY ("sent_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "client_quotes" DROP CONSTRAINT IF EXISTS "client_quotes_created_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "client_quotes" ADD CONSTRAINT "client_quotes_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- quote_cost_lines
ALTER TABLE "quote_cost_lines" DROP CONSTRAINT IF EXISTS "quote_cost_lines_quote_id_fkey";
DO $$ BEGIN
  ALTER TABLE "quote_cost_lines" ADD CONSTRAINT "quote_cost_lines_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- quote_provisional_lines
ALTER TABLE "quote_provisional_lines" DROP CONSTRAINT IF EXISTS "quote_provisional_lines_quote_id_fkey";
DO $$ BEGIN
  ALTER TABLE "quote_provisional_lines" ADD CONSTRAINT "quote_provisional_lines_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- quote_cost_options
ALTER TABLE "quote_cost_options" DROP CONSTRAINT IF EXISTS "quote_cost_options_quote_id_fkey";
DO $$ BEGIN
  ALTER TABLE "quote_cost_options" ADD CONSTRAINT "quote_cost_options_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- quote_assumptions
ALTER TABLE "quote_assumptions" DROP CONSTRAINT IF EXISTS "quote_assumptions_quote_id_fkey";
DO $$ BEGIN
  ALTER TABLE "quote_assumptions" ADD CONSTRAINT "quote_assumptions_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "quote_assumptions" DROP CONSTRAINT IF EXISTS "quote_assumptions_cost_line_id_fkey";
DO $$ BEGIN
  ALTER TABLE "quote_assumptions" ADD CONSTRAINT "quote_assumptions_cost_line_id_fkey"
    FOREIGN KEY ("cost_line_id") REFERENCES "quote_cost_lines"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- quote_exclusions
ALTER TABLE "quote_exclusions" DROP CONSTRAINT IF EXISTS "quote_exclusions_quote_id_fkey";
DO $$ BEGIN
  ALTER TABLE "quote_exclusions" ADD CONSTRAINT "quote_exclusions_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- quote_emails
ALTER TABLE "quote_emails" DROP CONSTRAINT IF EXISTS "quote_emails_quote_id_fkey";
DO $$ BEGIN
  ALTER TABLE "quote_emails" ADD CONSTRAINT "quote_emails_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "quote_emails" DROP CONSTRAINT IF EXISTS "quote_emails_sent_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "quote_emails" ADD CONSTRAINT "quote_emails_sent_by_id_fkey"
    FOREIGN KEY ("sent_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subcontractor_suppliers
ALTER TABLE "subcontractor_suppliers" DROP CONSTRAINT IF EXISTS "subcontractor_suppliers_created_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "subcontractor_suppliers" ADD CONSTRAINT "subcontractor_suppliers_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- entity_licences
ALTER TABLE "entity_licences" DROP CONSTRAINT IF EXISTS "entity_licences_client_id_fkey";
DO $$ BEGIN
  ALTER TABLE "entity_licences" ADD CONSTRAINT "entity_licences_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "entity_licences" DROP CONSTRAINT IF EXISTS "entity_licences_subcontractor_id_fkey";
DO $$ BEGIN
  ALTER TABLE "entity_licences" ADD CONSTRAINT "entity_licences_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- entity_insurances
ALTER TABLE "entity_insurances" DROP CONSTRAINT IF EXISTS "entity_insurances_client_id_fkey";
DO $$ BEGIN
  ALTER TABLE "entity_insurances" ADD CONSTRAINT "entity_insurances_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "entity_insurances" DROP CONSTRAINT IF EXISTS "entity_insurances_subcontractor_id_fkey";
DO $$ BEGIN
  ALTER TABLE "entity_insurances" ADD CONSTRAINT "entity_insurances_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- credit_applications
ALTER TABLE "credit_applications" DROP CONSTRAINT IF EXISTS "credit_applications_reviewed_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "credit_applications" DROP CONSTRAINT IF EXISTS "credit_applications_client_id_fkey";
DO $$ BEGIN
  ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "credit_applications" DROP CONSTRAINT IF EXISTS "credit_applications_subcontractor_id_fkey";
DO $$ BEGIN
  ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "credit_applications" DROP CONSTRAINT IF EXISTS "credit_applications_created_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subcontractor_documents
ALTER TABLE "subcontractor_documents" DROP CONSTRAINT IF EXISTS "subcontractor_documents_subcontractor_id_fkey";
DO $$ BEGIN
  ALTER TABLE "subcontractor_documents" ADD CONSTRAINT "subcontractor_documents_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "subcontractor_documents" DROP CONSTRAINT IF EXISTS "subcontractor_documents_uploaded_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "subcontractor_documents" ADD CONSTRAINT "subcontractor_documents_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- worker_qualifications
ALTER TABLE "worker_qualifications" DROP CONSTRAINT IF EXISTS "worker_qualifications_worker_profile_id_fkey";
DO $$ BEGIN
  ALTER TABLE "worker_qualifications" ADD CONSTRAINT "worker_qualifications_worker_profile_id_fkey"
    FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "worker_qualifications" DROP CONSTRAINT IF EXISTS "worker_qualifications_created_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "worker_qualifications" ADD CONSTRAINT "worker_qualifications_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- compliance_alerts
ALTER TABLE "compliance_alerts" DROP CONSTRAINT IF EXISTS "compliance_alerts_sent_to_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "compliance_alerts" ADD CONSTRAINT "compliance_alerts_sent_to_user_id_fkey"
    FOREIGN KEY ("sent_to_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- safety_incidents
ALTER TABLE "safety_incidents" DROP CONSTRAINT IF EXISTS "safety_incidents_project_id_fkey";
DO $$ BEGIN
  ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "safety_incidents" DROP CONSTRAINT IF EXISTS "safety_incidents_reported_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_reported_by_id_fkey"
    FOREIGN KEY ("reported_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "safety_incidents" DROP CONSTRAINT IF EXISTS "safety_incidents_closed_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_closed_by_id_fkey"
    FOREIGN KEY ("closed_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- hazard_observations
ALTER TABLE "hazard_observations" DROP CONSTRAINT IF EXISTS "hazard_observations_project_id_fkey";
DO $$ BEGIN
  ALTER TABLE "hazard_observations" ADD CONSTRAINT "hazard_observations_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "hazard_observations" DROP CONSTRAINT IF EXISTS "hazard_observations_reported_by_id_fkey";
DO $$ BEGIN
  ALTER TABLE "hazard_observations" ADD CONSTRAINT "hazard_observations_reported_by_id_fkey"
    FOREIGN KEY ("reported_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "hazard_observations" DROP CONSTRAINT IF EXISTS "hazard_observations_assigned_to_id_fkey";
DO $$ BEGIN
  ALTER TABLE "hazard_observations" ADD CONSTRAINT "hazard_observations_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- gantt_tasks
ALTER TABLE "gantt_tasks" DROP CONSTRAINT IF EXISTS "gantt_tasks_project_id_fkey";
DO $$ BEGIN
  ALTER TABLE "gantt_tasks" ADD CONSTRAINT "gantt_tasks_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "gantt_tasks" DROP CONSTRAINT IF EXISTS "gantt_tasks_assigned_to_id_fkey";
DO $$ BEGIN
  ALTER TABLE "gantt_tasks" ADD CONSTRAINT "gantt_tasks_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "worker_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
