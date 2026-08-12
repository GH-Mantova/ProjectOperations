-- CRM-3: unified-entry leads may have no Client yet. Make Opportunity.client_id nullable (additive, reversible). FK preserved. backfill: false.
ALTER TABLE "opportunities" ALTER COLUMN "client_id" DROP NOT NULL;
