-- Client portal users
CREATE TABLE "client_portal_users" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "phone" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "force_password_reset" BOOLEAN NOT NULL DEFAULT false,
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_portal_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_portal_users_email_key" ON "client_portal_users"("email");
CREATE INDEX "client_portal_users_client_id_idx" ON "client_portal_users"("client_id");
CREATE INDEX "client_portal_users_email_idx" ON "client_portal_users"("email");

ALTER TABLE "client_portal_users"
  ADD CONSTRAINT "client_portal_users_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Portal sessions
CREATE TABLE "portal_sessions" (
  "id" TEXT NOT NULL,
  "portal_user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portal_sessions_portal_user_id_idx" ON "portal_sessions"("portal_user_id");
CREATE INDEX "portal_sessions_token_hash_idx" ON "portal_sessions"("token_hash");

ALTER TABLE "portal_sessions"
  ADD CONSTRAINT "portal_sessions_portal_user_id_fkey"
  FOREIGN KEY ("portal_user_id") REFERENCES "client_portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Portal invites
CREATE TABLE "portal_invites" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "contact_id" TEXT,
  "email" TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "invited_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portal_invites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portal_invites_client_id_idx" ON "portal_invites"("client_id");
CREATE INDEX "portal_invites_email_idx" ON "portal_invites"("email");
CREATE INDEX "portal_invites_token_hash_idx" ON "portal_invites"("token_hash");

ALTER TABLE "portal_invites"
  ADD CONSTRAINT "portal_invites_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
