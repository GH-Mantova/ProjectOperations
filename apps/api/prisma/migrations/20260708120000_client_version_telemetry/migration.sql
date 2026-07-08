-- Additive: client-version telemetry + admin update-nudge.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "update_requested_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "client_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "client_version" TEXT NOT NULL,
  "user_agent" TEXT,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_sessions_user_id_client_version_key"
  ON "client_sessions"("user_id", "client_version");

CREATE INDEX IF NOT EXISTS "client_sessions_user_id_idx"
  ON "client_sessions"("user_id");

CREATE INDEX IF NOT EXISTS "client_sessions_last_seen_at_idx"
  ON "client_sessions"("last_seen_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE "client_sessions"
      ADD CONSTRAINT "client_sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
