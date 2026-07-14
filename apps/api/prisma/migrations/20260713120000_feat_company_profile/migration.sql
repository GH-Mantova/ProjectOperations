-- Company Profile: singleton identifying who "we" are, plus effective-dated
-- legal documents (T&Cs etc.) and reuse of EntityLicence/EntityInsurance for
-- OUR own licences. See CompanyProfile / CompanyLegalDocument in schema.prisma.

-- ── Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyEntityType') THEN
    CREATE TYPE "CompanyEntityType" AS ENUM ('PTY_LTD', 'SOLE_TRADER', 'PARTNERSHIP', 'TRUST', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyLegalDocumentType') THEN
    CREATE TYPE "CompanyLegalDocumentType" AS ENUM (
      'TERMS_AND_CONDITIONS', 'COVER_LETTER', 'STANDARD_ASSUMPTIONS',
      'STANDARD_EXCLUSIONS', 'PROJECT_ALLOWANCES', 'PRIVACY_NOTICE'
    );
  END IF;
END $$;

-- ── CompanyProfile: SINGLETON ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "company_profile" (
  "id"                          TEXT NOT NULL,
  "legal_name"                  TEXT NOT NULL,
  "trading_name"                TEXT NOT NULL,
  "abn"                         TEXT,
  "acn"                         TEXT,
  "entity_type"                 "CompanyEntityType" NOT NULL DEFAULT 'PTY_LTD',
  "primary_email"               TEXT,
  "primary_phone"               TEXT,
  "website"                     TEXT,
  "reg_address_line1"           TEXT,
  "reg_address_line2"           TEXT,
  "reg_suburb"                  TEXT,
  "reg_state"                   TEXT,
  "reg_postcode"                TEXT,
  "reg_country"                 TEXT NOT NULL DEFAULT 'Australia',
  "post_address_line1"          TEXT,
  "post_address_line2"          TEXT,
  "post_suburb"                 TEXT,
  "post_state"                  TEXT,
  "post_postcode"               TEXT,
  "post_country"                TEXT NOT NULL DEFAULT 'Australia',
  "whs_officer_user_id"         TEXT,
  "emergency_contact_name"      TEXT,
  "emergency_contact_phone"     TEXT,
  "gst_rate"                    DECIMAL(5,2) NOT NULL DEFAULT 10,
  "currency"                    TEXT NOT NULL DEFAULT 'AUD',
  "financial_year_start_month"  INTEGER NOT NULL DEFAULT 7,
  "timezone"                    TEXT NOT NULL DEFAULT 'Australia/Brisbane',
  "default_payment_terms_days"  INTEGER NOT NULL DEFAULT 25,
  "default_quote_validity_days" INTEGER NOT NULL DEFAULT 30,
  "default_markup_percent"      DECIMAL(5,2) NOT NULL DEFAULT 15,
  "tender_number_prefix"        TEXT NOT NULL DEFAULT 'T',
  "quote_number_prefix"         TEXT NOT NULL DEFAULT 'Q',
  "job_number_prefix"           TEXT NOT NULL DEFAULT 'J',
  "project_number_prefix"       TEXT NOT NULL DEFAULT 'IS-P',
  "variation_number_prefix"     TEXT NOT NULL DEFAULT 'V',
  "claim_number_prefix"         TEXT NOT NULL DEFAULT 'PC',
  "incident_number_prefix"      TEXT NOT NULL DEFAULT 'INC',
  "primary_color_hex"           TEXT NOT NULL DEFAULT '#005B61',
  "secondary_color_hex"         TEXT NOT NULL DEFAULT '#FEAA6D',
  "logo_light_url"              TEXT,
  "logo_dark_url"               TEXT,
  "favicon_url"                 TEXT,
  "pdf_letterhead_url"          TEXT,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL,
  "updated_by_id"               TEXT,
  CONSTRAINT "company_profile_pkey" PRIMARY KEY ("id")
);

-- Defense-in-depth singleton: the id MUST be 'singleton'. A second row is
-- a bug, not a feature — enforced here so no INSERT with any other id
-- can succeed even if application code is buggy.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_profile_singleton_check'
  ) THEN
    ALTER TABLE "company_profile"
      ADD CONSTRAINT "company_profile_singleton_check"
      CHECK ("id" = 'singleton');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profile_whs_officer_user_id_fkey') THEN
    ALTER TABLE "company_profile"
      ADD CONSTRAINT "company_profile_whs_officer_user_id_fkey"
      FOREIGN KEY ("whs_officer_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── CompanyLegalDocument: effective-dated versions ───────────────────────
CREATE TABLE IF NOT EXISTS "company_legal_documents" (
  "id"             TEXT NOT NULL,
  "profile_id"     TEXT NOT NULL DEFAULT 'singleton',
  "type"           "CompanyLegalDocumentType" NOT NULL,
  "version"        INTEGER NOT NULL,
  "content"        TEXT NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to"   TIMESTAMP(3),
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_by_id"  TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_legal_documents_type_version_key"
  ON "company_legal_documents"("type", "version");
CREATE INDEX IF NOT EXISTS "company_legal_documents_type_is_active_idx"
  ON "company_legal_documents"("type", "is_active");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_legal_documents_profile_id_fkey') THEN
    ALTER TABLE "company_legal_documents"
      ADD CONSTRAINT "company_legal_documents_profile_id_fkey"
      FOREIGN KEY ("profile_id") REFERENCES "company_profile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_legal_documents_created_by_id_fkey') THEN
    ALTER TABLE "company_legal_documents"
      ADD CONSTRAINT "company_legal_documents_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── EntityLicence / EntityInsurance: company_profile_id FK reuse ─────────
ALTER TABLE "entity_licences"
  ADD COLUMN IF NOT EXISTS "company_profile_id" TEXT;
ALTER TABLE "entity_insurances"
  ADD COLUMN IF NOT EXISTS "company_profile_id" TEXT;

CREATE INDEX IF NOT EXISTS "entity_licences_company_profile_id_idx"
  ON "entity_licences"("company_profile_id");
CREATE INDEX IF NOT EXISTS "entity_insurances_company_profile_id_idx"
  ON "entity_insurances"("company_profile_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entity_licences_company_profile_id_fkey') THEN
    ALTER TABLE "entity_licences"
      ADD CONSTRAINT "entity_licences_company_profile_id_fkey"
      FOREIGN KEY ("company_profile_id") REFERENCES "company_profile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entity_insurances_company_profile_id_fkey') THEN
    ALTER TABLE "entity_insurances"
      ADD CONSTRAINT "entity_insurances_company_profile_id_fkey"
      FOREIGN KEY ("company_profile_id") REFERENCES "company_profile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ClientQuote / Contract: pin issued T&C version ───────────────────────
ALTER TABLE "client_quotes"
  ADD COLUMN IF NOT EXISTS "issued_terms_document_id" TEXT;
ALTER TABLE "contracts"
  ADD COLUMN IF NOT EXISTS "issued_terms_document_id" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_quotes_issued_terms_document_id_fkey') THEN
    ALTER TABLE "client_quotes"
      ADD CONSTRAINT "client_quotes_issued_terms_document_id_fkey"
      FOREIGN KEY ("issued_terms_document_id") REFERENCES "company_legal_documents"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_issued_terms_document_id_fkey') THEN
    ALTER TABLE "contracts"
      ADD CONSTRAINT "contracts_issued_terms_document_id_fkey"
      FOREIGN KEY ("issued_terms_document_id") REFERENCES "company_legal_documents"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
