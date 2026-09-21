-- QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a)
-- Additive only. One new table (quote_cost_groups), one nullable FK on
-- quote_cost_lines (group_id), source-pointer columns on
-- quote_provisional_lines and quote_cost_options mirroring the ones
-- quote_cost_lines already carries, and three push-stamp columns on
-- client_quotes. No DML, no default that rewrites a row, no drop.

-- 1. QuoteCostGroup table
CREATE TABLE "quote_cost_groups" (
    "id"         TEXT NOT NULL,
    "quote_id"   TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "print_mode" TEXT NOT NULL DEFAULT 'ITEMISED',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_cost_groups_pkey" PRIMARY KEY ("id")
);

-- 2. FK: quote_cost_groups.quote_id -> client_quotes.id (cascade delete)
ALTER TABLE "quote_cost_groups"
    ADD CONSTRAINT "quote_cost_groups_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id") ON DELETE CASCADE;

-- 3. Unique + index on quote_cost_groups
CREATE UNIQUE INDEX "quote_cost_groups_quote_id_code_key"
    ON "quote_cost_groups"("quote_id", "code");
CREATE INDEX "quote_cost_groups_quote_id_idx"
    ON "quote_cost_groups"("quote_id");

-- 4. Nullable group_id on quote_cost_lines
ALTER TABLE "quote_cost_lines"
    ADD COLUMN "group_id" TEXT;

-- 5. FK: quote_cost_lines.group_id -> quote_cost_groups.id (set null on delete)
ALTER TABLE "quote_cost_lines"
    ADD CONSTRAINT "quote_cost_lines_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "quote_cost_groups"("id") ON DELETE SET NULL;

CREATE INDEX "quote_cost_lines_group_id_idx"
    ON "quote_cost_lines"("group_id");

-- 6. Source pointer columns on quote_provisional_lines
ALTER TABLE "quote_provisional_lines"
    ADD COLUMN "source_estimate_line_type" TEXT,
    ADD COLUMN "source_estimate_line_id"   TEXT;

CREATE INDEX "quote_provisional_lines_source_idx"
    ON "quote_provisional_lines"("source_estimate_line_type", "source_estimate_line_id");

-- 7. Source pointer columns on quote_cost_options
ALTER TABLE "quote_cost_options"
    ADD COLUMN "source_estimate_line_type" TEXT,
    ADD COLUMN "source_estimate_line_id"   TEXT;

CREATE INDEX "quote_cost_options_source_idx"
    ON "quote_cost_options"("source_estimate_line_type", "source_estimate_line_id");

-- 8. Push stamp columns on client_quotes
ALTER TABLE "client_quotes"
    ADD COLUMN "pushed_at"          TIMESTAMP(3),
    ADD COLUMN "pushed_by_id"       TEXT,
    ADD COLUMN "pushed_fingerprint" TEXT;

-- 9. FK: client_quotes.pushed_by_id -> users.id (set null on delete)
ALTER TABLE "client_quotes"
    ADD CONSTRAINT "client_quotes_pushed_by_id_fkey"
    FOREIGN KEY ("pushed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
