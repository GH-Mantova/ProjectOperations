-- Xero schema alignment (PR-40)
-- Adds legalName / country / paymentTermsDay / paymentTermsType to clients and
-- subcontractor_suppliers, plus includeInInvoiceEmails on contacts. All
-- additive; existing rows get safe defaults so NOT NULL columns hold.

ALTER TABLE "clients"
  ADD COLUMN "legal_name" text,
  ADD COLUMN "country" text NOT NULL DEFAULT 'Australia',
  ADD COLUMN "payment_terms_day" int,
  ADD COLUMN "payment_terms_type" text;

ALTER TABLE "subcontractor_suppliers"
  ADD COLUMN "legal_name" text,
  ADD COLUMN "country" text NOT NULL DEFAULT 'Australia',
  ADD COLUMN "payment_terms_day" int,
  ADD COLUMN "payment_terms_type" text;

ALTER TABLE "contacts"
  ADD COLUMN "include_in_invoice_emails" boolean NOT NULL DEFAULT false;
