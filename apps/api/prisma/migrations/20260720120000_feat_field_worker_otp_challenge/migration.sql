-- FIELD-worker OTP challenge table. See sot/01 §auth: OFFICE staff keep
-- Entra SSO; FIELD workers authenticate by personal email + short-lived
-- numeric code. Codes are HASHED (sha256, hex) at rest.

CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_challenges_email_expires_at_idx"
    ON "otp_challenges"("email", "expires_at");
