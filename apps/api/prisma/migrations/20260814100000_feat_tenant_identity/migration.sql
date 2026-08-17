-- MT-2: Identity carries tenant (JWT + session)
-- Additive nullable FK column: users.home_tenant_id -> tenants.id ON DELETE SET NULL.
-- No existing row is touched, no constraint is tightened, no data is migrated here.
ALTER TABLE "users" ADD COLUMN "home_tenant_id" TEXT NULL REFERENCES "tenants"("id") ON DELETE SET NULL;
