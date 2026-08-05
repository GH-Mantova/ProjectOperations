-- SLICE 5 (settings-restructure): per-user notification channel preferences.
-- Adds notification_preferences table — purely additive, no existing tables altered.
--
-- Semantics: one row per (user, trigger). A missing row = inherit admin default.
-- channel must be one of: both | email | inapp | off.
-- Effective channel = admin.deliveryMethod INTERSECT user.channel (mute-only rule).
--
-- Rollback: DROP TABLE "notification_preferences";

CREATE TABLE "notification_preferences" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "trigger"    TEXT NOT NULL,
    "channel"    TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_user_id_trigger_key"
    ON "notification_preferences"("user_id", "trigger");

CREATE INDEX "notification_preferences_user_id_idx"
    ON "notification_preferences"("user_id");

ALTER TABLE "notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
