import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { PlatformModule } from "../platform/platform.module";
import { SafetyController } from "./safety.controller";
import { SafetyService } from "./safety.service";

/**
 * Safety module — incident reports and hazard observations under
 * Forms & Compliance.
 *
 * Wires {@link SafetyController} over {@link SafetyService} and depends on
 * {@link PlatformModule} (for `PrismaService` + `NotificationsService`) and
 * {@link EmailModule} (for the critical-incident email path). Exports
 * {@link SafetyService} so other modules can react to safety records.
 */
@Module({
  imports: [PlatformModule, EmailModule],
  controllers: [SafetyController],
  providers: [SafetyService],
  exports: [SafetyService]
})
export class SafetyModule {}
