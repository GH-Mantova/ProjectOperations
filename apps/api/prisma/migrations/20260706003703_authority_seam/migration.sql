-- Authority seam (Phase 0.2). Configurable ceiling for approval / spend-limit
-- decisions. Empty table = open ceiling; AuthorityService.check defaults to
-- allowed when no rule matches.

CREATE TYPE "AuthorityScopeType" AS ENUM ('USER', 'ROLE', 'DEPARTMENT', 'GLOBAL');

CREATE TABLE "authority_rules" (
    "id" TEXT NOT NULL,
    "scope_type" "AuthorityScopeType" NOT NULL,
    "scope_id" TEXT,
    "action" TEXT NOT NULL,
    "limit_amount" DECIMAL(12,2),
    "escalate_to_user_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "authority_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "authority_rules_scope_type_scope_id_action_key"
  ON "authority_rules"("scope_type", "scope_id", "action");

CREATE INDEX "authority_rules_action_idx" ON "authority_rules"("action");

CREATE INDEX "authority_rules_scope_type_scope_id_idx"
  ON "authority_rules"("scope_type", "scope_id");
