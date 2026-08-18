-- TFM-S2: additive nullable column for human-readable project name.
-- No default value, no row mutation, no non-null constraint.
-- Existing rows remain NULL; the wizard populates it for new tenders.
ALTER TABLE "tenders" ADD COLUMN "project_name" TEXT;
