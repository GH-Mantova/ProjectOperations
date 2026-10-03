-- CRM_INTERACTION_CHANNEL_V1: Add channel column to comm_threads.
-- One additive nullable column. No backfill. Existing rows have channel = NULL.
-- Reverting the code leaves this column unused and harmless; a down migration drops it.
ALTER TABLE "comm_threads" ADD COLUMN "channel" TEXT;
