import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { AiSettingsController } from "./ai-settings.controller";
import { AiSettingsService } from "./ai-settings.service";

// §5A.1 PR 9 — endpoints for company + per-user AI provider key management.
// SecurityModule (KeyEncryptionService, KeyValidationService) is global so
// no explicit import here.
@Module({
  imports: [AuditModule, PlatformModule],
  controllers: [AiSettingsController],
  providers: [AiSettingsService],
  exports: [AiSettingsService]
})
export class AiSettingsModule {}
