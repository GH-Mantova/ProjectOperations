CREATE INDEX "dashboards_owner_role_id_idx" ON "dashboards"("owner_role_id");

ALTER TABLE "dashboards"
ADD CONSTRAINT "dashboards_owner_role_id_fkey"
FOREIGN KEY ("owner_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
