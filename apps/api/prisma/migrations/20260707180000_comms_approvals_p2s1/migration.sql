-- Comms + Approvals Phase 2 slice 1
-- Adds record-anchored internal messages and an immutable approval-decision
-- audit that routes through the AuthorityService seam. Existing Notification
-- model is reused for fan-out (no schema change).

-- CreateEnum
CREATE TYPE "ApprovalDecisionKind" AS ENUM ('APPROVED', 'REJECTED', 'OVERRULED');

-- CreateTable
CREATE TABLE "internal_messages" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_messages_recipient_id_status_idx" ON "internal_messages"("recipient_id", "status");
CREATE INDEX "internal_messages_entity_type_entity_id_idx" ON "internal_messages"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "internal_messages"
    ADD CONSTRAINT "internal_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "internal_messages"
    ADD CONSTRAINT "internal_messages_recipient_id_fkey"
    FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "decision" "ApprovalDecisionKind" NOT NULL,
    "reason" TEXT,
    "decided_by_id" TEXT NOT NULL,
    "overrules_id" TEXT,
    "authority_rule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_overrules_id_key" ON "approval_decisions"("overrules_id");
CREATE INDEX "approval_decisions_entity_type_entity_id_idx" ON "approval_decisions"("entity_type", "entity_id");
CREATE INDEX "approval_decisions_decided_by_id_idx" ON "approval_decisions"("decided_by_id");
CREATE INDEX "approval_decisions_action_idx" ON "approval_decisions"("action");

-- AddForeignKey
ALTER TABLE "approval_decisions"
    ADD CONSTRAINT "approval_decisions_decided_by_id_fkey"
    FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_decisions"
    ADD CONSTRAINT "approval_decisions_overrules_id_fkey"
    FOREIGN KEY ("overrules_id") REFERENCES "approval_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
