CREATE TABLE "tenders" (
    "id" TEXT NOT NULL,
    "tender_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimator_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "due_date" TIMESTAMP(3),
    "proposed_start_date" TIMESTAMP(3),
    "lead_time_days" INTEGER,
    "probability" INTEGER,
    "estimated_value" DECIMAL(14,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_clients" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "is_awarded" BOOLEAN NOT NULL DEFAULT false,
    "relationship_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tender_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_notes" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tender_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_clarifications" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "response" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tender_clarifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_pricing_snapshots" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "version_label" TEXT NOT NULL,
    "estimated_value" DECIMAL(14,2),
    "margin_percent" DECIMAL(5,2),
    "assumptions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tender_pricing_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_follow_ups" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "details" TEXT NOT NULL,
    "assigned_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tender_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_outcomes" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "outcome_type" TEXT NOT NULL,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tender_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenders_tender_number_key" ON "tenders"("tender_number");
CREATE UNIQUE INDEX "tender_clients_tender_id_client_id_key" ON "tender_clients"("tender_id", "client_id");
CREATE INDEX "tenders_status_idx" ON "tenders"("status");
CREATE INDEX "tenders_estimator_user_id_idx" ON "tenders"("estimator_user_id");
CREATE INDEX "tender_clients_client_id_idx" ON "tender_clients"("client_id");
CREATE INDEX "tender_clients_is_awarded_idx" ON "tender_clients"("is_awarded");
CREATE INDEX "tender_notes_tender_id_idx" ON "tender_notes"("tender_id");
CREATE INDEX "tender_clarifications_tender_id_status_idx" ON "tender_clarifications"("tender_id", "status");
CREATE INDEX "tender_pricing_snapshots_tender_id_idx" ON "tender_pricing_snapshots"("tender_id");
CREATE INDEX "tender_follow_ups_tender_id_status_idx" ON "tender_follow_ups"("tender_id", "status");
CREATE INDEX "tender_outcomes_tender_id_idx" ON "tender_outcomes"("tender_id");

ALTER TABLE "tenders" ADD CONSTRAINT "tenders_estimator_user_id_fkey" FOREIGN KEY ("estimator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tender_clients" ADD CONSTRAINT "tender_clients_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_clients" ADD CONSTRAINT "tender_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tender_clients" ADD CONSTRAINT "tender_clients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tender_notes" ADD CONSTRAINT "tender_notes_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_notes" ADD CONSTRAINT "tender_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tender_clarifications" ADD CONSTRAINT "tender_clarifications_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_pricing_snapshots" ADD CONSTRAINT "tender_pricing_snapshots_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_follow_ups" ADD CONSTRAINT "tender_follow_ups_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_follow_ups" ADD CONSTRAINT "tender_follow_ups_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tender_outcomes" ADD CONSTRAINT "tender_outcomes_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
