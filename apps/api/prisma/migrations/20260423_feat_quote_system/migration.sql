-- ── Client scoring columns on clients ────────────────────────────────
ALTER TABLE "clients"
  ADD COLUMN "preference_score" INTEGER,
  ADD COLUMN "win_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tender_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "win_rate" DECIMAL(5,2),
  ADD COLUMN "last_tender_at" TIMESTAMP(3),
  ADD COLUMN "last_won_at" TIMESTAMP(3);

-- ── Tender: prevent double-counting on status transitions ────────────
ALTER TABLE "tenders" ADD COLUMN "tender_score_counted" BOOLEAN NOT NULL DEFAULT FALSE;

-- ── ClientQuoteStatus enum ───────────────────────────────────────────
CREATE TYPE "ClientQuoteStatus" AS ENUM ('DRAFT', 'SENT', 'SUPERSEDED');

-- ── client_quotes ────────────────────────────────────────────────────
CREATE TABLE "client_quotes" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "quote_ref" TEXT NOT NULL,
  "status" "ClientQuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "adjustment_pct" DECIMAL(5,2),
  "adjustment_amt" DECIMAL(12,2),
  "adjustment_note" TEXT,
  "assumption_mode" TEXT NOT NULL DEFAULT 'free',
  "show_provisional" BOOLEAN NOT NULL DEFAULT FALSE,
  "show_cost_options" BOOLEAN NOT NULL DEFAULT FALSE,
  "sent_at" TIMESTAMP(3),
  "sent_by_id" TEXT,
  "generated_pdf_path" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_quotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_quotes_quote_ref_key" ON "client_quotes"("quote_ref");
CREATE UNIQUE INDEX "client_quotes_tender_id_client_id_revision_key" ON "client_quotes"("tender_id", "client_id", "revision");
CREATE INDEX "client_quotes_tender_id_idx" ON "client_quotes"("tender_id");
CREATE INDEX "client_quotes_client_id_idx" ON "client_quotes"("client_id");

ALTER TABLE "client_quotes"
  ADD CONSTRAINT "client_quotes_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "client_quotes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
  ADD CONSTRAINT "client_quotes_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "client_quotes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id");

-- ── quote_cost_lines ─────────────────────────────────────────────────
CREATE TABLE "quote_cost_lines" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quote_cost_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_cost_lines_quote_id_idx" ON "quote_cost_lines"("quote_id");

ALTER TABLE "quote_cost_lines"
  ADD CONSTRAINT "quote_cost_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id") ON DELETE CASCADE;

-- ── quote_provisional_lines ──────────────────────────────────────────
CREATE TABLE "quote_provisional_lines" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quote_provisional_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_provisional_lines_quote_id_idx" ON "quote_provisional_lines"("quote_id");

ALTER TABLE "quote_provisional_lines"
  ADD CONSTRAINT "quote_provisional_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id") ON DELETE CASCADE;

-- ── quote_cost_options ───────────────────────────────────────────────
CREATE TABLE "quote_cost_options" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quote_cost_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_cost_options_quote_id_idx" ON "quote_cost_options"("quote_id");

ALTER TABLE "quote_cost_options"
  ADD CONSTRAINT "quote_cost_options_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id") ON DELETE CASCADE;

-- ── quote_assumptions ────────────────────────────────────────────────
CREATE TABLE "quote_assumptions" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "cost_line_id" TEXT,
  "text" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quote_assumptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_assumptions_quote_id_idx" ON "quote_assumptions"("quote_id");
CREATE INDEX "quote_assumptions_cost_line_id_idx" ON "quote_assumptions"("cost_line_id");

ALTER TABLE "quote_assumptions"
  ADD CONSTRAINT "quote_assumptions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "quote_assumptions_cost_line_id_fkey" FOREIGN KEY ("cost_line_id") REFERENCES "quote_cost_lines"("id") ON DELETE SET NULL;

-- ── quote_exclusions ─────────────────────────────────────────────────
CREATE TABLE "quote_exclusions" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quote_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_exclusions_quote_id_idx" ON "quote_exclusions"("quote_id");

ALTER TABLE "quote_exclusions"
  ADD CONSTRAINT "quote_exclusions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id") ON DELETE CASCADE;

-- ── quote_emails ─────────────────────────────────────────────────────
CREATE TABLE "quote_emails" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "sent_to" TEXT[] NOT NULL,
  "subject" TEXT NOT NULL,
  "body_preview" TEXT,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_by_id" TEXT NOT NULL,
  CONSTRAINT "quote_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_emails_quote_id_idx" ON "quote_emails"("quote_id");

ALTER TABLE "quote_emails"
  ADD CONSTRAINT "quote_emails_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "quote_emails_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id");
