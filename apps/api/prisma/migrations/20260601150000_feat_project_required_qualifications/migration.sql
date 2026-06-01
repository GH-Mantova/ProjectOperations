ALTER TABLE "projects"
  ADD COLUMN "required_qualifications" text[] NOT NULL DEFAULT ARRAY[]::text[];
