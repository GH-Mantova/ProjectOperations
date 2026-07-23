import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { PlatformModule } from "../platform/platform.module";
import { MusterController } from "./muster.controller";
import { MusterService } from "./muster.service";
import { SafetyController } from "./safety.controller";
import { SafetyService } from "./safety.service";

/**
 * Safety module — incident reports, hazard observations, and evacuation
 * muster / roll-call events (Forms & Compliance).
 *
 * Wires {@link SafetyController} over {@link SafetyService} and depends on
 * {@link PlatformModule} (for `PrismaService` + `NotificationsService`) and
 * {@link EmailModule} (for the critical-incident email path). Exports
 * {@link SafetyService} so other modules can react to safety records.
 *
 * Also registers {@link MusterController} and {@link MusterService} for
 * evacuation muster / roll-call event management under `/safety/muster/*`.
 */
@Module({
  imports: [PlatformModule, EmailModule],
  controllers: [SafetyController, MusterController],
  providers: [SafetyService, MusterService],
  exports: [SafetyService, MusterService]
})
export class SafetyModule {}
