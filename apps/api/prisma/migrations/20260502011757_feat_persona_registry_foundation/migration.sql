-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_company_instructions" (
    "id" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_company_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_persona_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "provider_override" TEXT,
    "instruction_override" TEXT,
    "bring_your_own_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_persona_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_ai_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "allow_user_instruction_overrides" BOOLEAN NOT NULL DEFAULT false,
    "enabled_providers" TEXT[] DEFAULT ARRAY['anthropic']::TEXT[],
    "allow_bring_your_own_key" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personas_slug_key" ON "personas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "persona_company_instructions_persona_id_key" ON "persona_company_instructions"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_persona_settings_user_id_persona_id_key" ON "user_persona_settings"("user_id", "persona_id");

-- AddForeignKey
ALTER TABLE "persona_company_instructions" ADD CONSTRAINT "persona_company_instructions_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_company_instructions" ADD CONSTRAINT "persona_company_instructions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_persona_settings" ADD CONSTRAINT "user_persona_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_persona_settings" ADD CONSTRAINT "user_persona_settings_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
