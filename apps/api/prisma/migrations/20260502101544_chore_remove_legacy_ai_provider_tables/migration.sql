-- §5A.1 PR 8: drop legacy AI provider tables. Provider selection is now
-- centralised in persona settings (see ai-providers module + AI Settings
-- page). The user_ai_providers and user_ai_preferences tables are no longer
-- referenced by any service.

-- DropForeignKey
ALTER TABLE "user_ai_preferences" DROP CONSTRAINT "user_ai_preferences_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_ai_providers" DROP CONSTRAINT "user_ai_providers_user_id_fkey";

-- DropTable
DROP TABLE "user_ai_preferences";

-- DropTable
DROP TABLE "user_ai_providers";
