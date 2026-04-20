-- User-owned customisable dashboards
CREATE TABLE "user_dashboards" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_dashboards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_dashboards_user_id_slug_is_system_key" ON "user_dashboards"("user_id", "slug", "is_system");
CREATE INDEX "user_dashboards_user_id_idx" ON "user_dashboards"("user_id");
ALTER TABLE "user_dashboards" ADD CONSTRAINT "user_dashboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
