-- brandtheme-s7c-1 (APPEARANCE_PREFERENCES_V1)
-- Additive-only migration. Creates one new table; no existing column or row changes.
-- Rollback: the table is unused if the code is reverted and can be dropped later.
-- A user with no row sees exactly today's behaviour (default density, company theme).

CREATE TABLE "user_appearance_preferences" (
    "user_id"          TEXT         NOT NULL,
    "density"          TEXT,
    "colour_scheme_id" TEXT,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_appearance_preferences_pkey" PRIMARY KEY ("user_id")
);

-- FK: user_id -> users.id  (Cascade: removing a user removes their preferences)
ALTER TABLE "user_appearance_preferences"
    ADD CONSTRAINT "user_appearance_preferences_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: colour_scheme_id -> brand_color_scheme.id  (SetNull: deleting a scheme
-- reverts the user to the company theme rather than blocking or orphaning)
ALTER TABLE "user_appearance_preferences"
    ADD CONSTRAINT "user_appearance_preferences_colour_scheme_id_fkey"
    FOREIGN KEY ("colour_scheme_id")
    REFERENCES "brand_color_scheme"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
