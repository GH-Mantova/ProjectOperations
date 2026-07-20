-- CreateTable
CREATE TABLE "prequalification_requests" (
    "id" TEXT NOT NULL,
    "subcontractor_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "risk_rating" TEXT,
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,
    "rejection_reason" TEXT,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "prequalification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prequalification_requests_subcontractor_id_idx" ON "prequalification_requests"("subcontractor_id");

-- CreateIndex
CREATE INDEX "prequalification_requests_status_idx" ON "prequalification_requests"("status");

-- CreateIndex
CREATE INDEX "prequalification_requests_expires_at_idx" ON "prequalification_requests"("expires_at");

-- AddForeignKey
ALTER TABLE "prequalification_requests" ADD CONSTRAINT "prequalification_requests_subcontractor_id_fkey" FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prequalification_requests" ADD CONSTRAINT "prequalification_requests_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prequalification_requests" ADD CONSTRAINT "prequalification_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
