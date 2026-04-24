-- Business Directory (PR #73)
-- Adds extended Client fields, extends Contact with mobile + portal access,
-- creates SubcontractorSupplier / SubcontractorContact / EntityLicence /
-- EntityInsurance / CreditApplication / SubcontractorDocument.

-- ─── Client extensions ─────────────────────────────────────────────────────
ALTER TABLE "clients"
  ADD COLUMN "trading_name"        TEXT,
  ADD COLUMN "business_type"       TEXT DEFAULT 'company',
  ADD COLUMN "abn"                 TEXT,
  ADD COLUMN "acn"                 TEXT,
  ADD COLUMN "gst_registered"      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "industry"            TEXT,
  ADD COLUMN "website"             TEXT,
  ADD COLUMN "physical_address"    TEXT,
  ADD COLUMN "physical_suburb"     TEXT,
  ADD COLUMN "physical_state"      TEXT DEFAULT 'QLD',
  ADD COLUMN "physical_postcode"   TEXT,
  ADD COLUMN "postal_address"      TEXT,
  ADD COLUMN "postal_suburb"       TEXT,
  ADD COLUMN "postal_state"        TEXT,
  ADD COLUMN "postal_postcode"     TEXT,
  ADD COLUMN "postal_same_as"      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "payment_terms_days"  INTEGER DEFAULT 30,
  ADD COLUMN "credit_limit"        NUMERIC(12,2),
  ADD COLUMN "credit_approved"     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "preferred_payment"   TEXT,
  ADD COLUMN "bank_name"           TEXT,
  ADD COLUMN "bank_account_name"   TEXT,
  ADD COLUMN "bank_bsb"            TEXT,
  ADD COLUMN "bank_account_number" TEXT,
  ADD COLUMN "xero_contact_id"     TEXT,
  ADD COLUMN "myob_card_id"        TEXT,
  ADD COLUMN "is_active"           BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "on_hold"             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "on_hold_reason"      TEXT,
  ADD COLUMN "internal_notes"      TEXT;

CREATE INDEX "clients_is_active_idx" ON "clients" ("is_active");
CREATE INDEX "clients_on_hold_idx"   ON "clients" ("on_hold");

-- ─── Contact extensions ────────────────────────────────────────────────────
ALTER TABLE "contacts"
  ADD COLUMN "mobile"              TEXT,
  ADD COLUMN "has_portal_access"   BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── SubcontractorSupplier ─────────────────────────────────────────────────
CREATE TABLE "subcontractor_suppliers" (
  "id"                  TEXT PRIMARY KEY,
  "name"                TEXT NOT NULL,
  "trading_name"        TEXT,
  "business_type"       TEXT NOT NULL DEFAULT 'company',
  "abn"                 TEXT,
  "acn"                 TEXT,
  "gst_registered"      BOOLEAN NOT NULL DEFAULT TRUE,
  "website"             TEXT,
  "entity_type"         TEXT NOT NULL DEFAULT 'subcontractor',
  "categories"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "prequal_status"      TEXT NOT NULL DEFAULT 'pending',
  "prequal_notes"       TEXT,
  "prequal_reviewed_at" TIMESTAMP(3),
  "prequal_reviewed_by" TEXT,
  "swms_on_file"        BOOLEAN NOT NULL DEFAULT FALSE,
  "swms_reviewed_at"    TIMESTAMP(3),
  "email"               TEXT,
  "phone"               TEXT,
  "physical_address"    TEXT,
  "physical_suburb"     TEXT,
  "physical_state"      TEXT DEFAULT 'QLD',
  "physical_postcode"   TEXT,
  "postal_address"      TEXT,
  "postal_suburb"       TEXT,
  "postal_state"        TEXT,
  "postal_postcode"     TEXT,
  "postal_same_as"      BOOLEAN NOT NULL DEFAULT TRUE,
  "payment_terms_days"  INTEGER DEFAULT 30,
  "credit_limit"        NUMERIC(12,2),
  "credit_approved"     BOOLEAN NOT NULL DEFAULT FALSE,
  "preferred_payment"   TEXT,
  "bank_name"           TEXT,
  "bank_account_name"   TEXT,
  "bank_bsb"            TEXT,
  "bank_account_number" TEXT,
  "xero_contact_id"     TEXT,
  "myob_card_id"        TEXT,
  "is_active"           BOOLEAN NOT NULL DEFAULT TRUE,
  "on_hold"             BOOLEAN NOT NULL DEFAULT FALSE,
  "on_hold_reason"      TEXT,
  "internal_notes"      TEXT,
  "performance_rating"  INTEGER,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  "created_by_id"       TEXT NOT NULL,
  CONSTRAINT "subcontractor_suppliers_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "subcontractor_suppliers_entity_type_idx"    ON "subcontractor_suppliers" ("entity_type");
CREATE INDEX "subcontractor_suppliers_prequal_status_idx" ON "subcontractor_suppliers" ("prequal_status");
CREATE INDEX "subcontractor_suppliers_is_active_idx"      ON "subcontractor_suppliers" ("is_active");

-- ─── SubcontractorContact ──────────────────────────────────────────────────
CREATE TABLE "subcontractor_contacts" (
  "id"                TEXT PRIMARY KEY,
  "subcontractor_id"  TEXT NOT NULL,
  "first_name"        TEXT NOT NULL,
  "last_name"         TEXT NOT NULL,
  "role"              TEXT,
  "phone"             TEXT,
  "mobile"            TEXT,
  "email"             TEXT,
  "is_primary"        BOOLEAN NOT NULL DEFAULT FALSE,
  "has_portal_access" BOOLEAN NOT NULL DEFAULT FALSE,
  "notes"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subcontractor_contacts_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id") ON DELETE CASCADE
);

CREATE INDEX "subcontractor_contacts_subcontractor_id_idx" ON "subcontractor_contacts" ("subcontractor_id");

-- ─── EntityLicence ─────────────────────────────────────────────────────────
CREATE TABLE "entity_licences" (
  "id"                TEXT PRIMARY KEY,
  "licence_type"      TEXT NOT NULL,
  "licence_number"    TEXT,
  "issuing_authority" TEXT,
  "issue_date"        TIMESTAMP(3),
  "expiry_date"       TIMESTAMP(3),
  "document_path"     TEXT,
  "notes"             TEXT,
  "status"            TEXT NOT NULL DEFAULT 'active',
  "client_id"         TEXT,
  "subcontractor_id"  TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entity_licences_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE,
  CONSTRAINT "entity_licences_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id") ON DELETE CASCADE
);

CREATE INDEX "entity_licences_expiry_date_idx"      ON "entity_licences" ("expiry_date");
CREATE INDEX "entity_licences_client_id_idx"        ON "entity_licences" ("client_id");
CREATE INDEX "entity_licences_subcontractor_id_idx" ON "entity_licences" ("subcontractor_id");

-- ─── EntityInsurance ───────────────────────────────────────────────────────
CREATE TABLE "entity_insurances" (
  "id"               TEXT PRIMARY KEY,
  "insurance_type"   TEXT NOT NULL,
  "insurer_name"     TEXT,
  "policy_number"    TEXT,
  "coverage_amount"  NUMERIC(14,2),
  "expiry_date"      TIMESTAMP(3),
  "document_path"    TEXT,
  "notes"            TEXT,
  "status"           TEXT NOT NULL DEFAULT 'active',
  "client_id"        TEXT,
  "subcontractor_id" TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entity_insurances_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE,
  CONSTRAINT "entity_insurances_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id") ON DELETE CASCADE
);

CREATE INDEX "entity_insurances_expiry_date_idx"      ON "entity_insurances" ("expiry_date");
CREATE INDEX "entity_insurances_client_id_idx"        ON "entity_insurances" ("client_id");
CREATE INDEX "entity_insurances_subcontractor_id_idx" ON "entity_insurances" ("subcontractor_id");

-- ─── CreditApplication ─────────────────────────────────────────────────────
CREATE TABLE "credit_applications" (
  "id"               TEXT PRIMARY KEY,
  "direction"        TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'draft',
  "credit_limit"     NUMERIC(12,2),
  "payment_terms"    INTEGER,
  "application_date" TIMESTAMP(3),
  "approved_date"    TIMESTAMP(3),
  "rejected_date"    TIMESTAMP(3),
  "reviewed_by_id"   TEXT,
  "notes"            TEXT,
  "document_path"    TEXT,
  "account_number"   TEXT,
  "client_id"        TEXT,
  "subcontractor_id" TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  "created_by_id"    TEXT NOT NULL,
  CONSTRAINT "credit_applications_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE,
  CONSTRAINT "credit_applications_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id") ON DELETE CASCADE,
  CONSTRAINT "credit_applications_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "credit_applications_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "credit_applications_status_idx"          ON "credit_applications" ("status");
CREATE INDEX "credit_applications_client_id_idx"       ON "credit_applications" ("client_id");
CREATE INDEX "credit_applications_subcontractor_id_idx" ON "credit_applications" ("subcontractor_id");

-- ─── SubcontractorDocument ─────────────────────────────────────────────────
CREATE TABLE "subcontractor_documents" (
  "id"               TEXT PRIMARY KEY,
  "subcontractor_id" TEXT NOT NULL,
  "document_type"    TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "file_path"        TEXT,
  "uploaded_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploaded_by_id"   TEXT NOT NULL,
  "notes"            TEXT,
  CONSTRAINT "subcontractor_documents_subcontractor_id_fkey"
    FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id") ON DELETE CASCADE,
  CONSTRAINT "subcontractor_documents_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "subcontractor_documents_subcontractor_id_idx" ON "subcontractor_documents" ("subcontractor_id");
