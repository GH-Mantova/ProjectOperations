import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { SchedulerController } from "./scheduler.controller";
import { SchedulerService } from "./scheduler.service";

/**
 * §9 Scheduler and Work Planning module.
 *
 * Wires {@link SchedulerController} and {@link SchedulerService} and pulls
 * in {@link PlatformModule} for the audit and notification services that
 * back shift mutations and live follow-up refreshes.
 */
@Module({
  imports: [PlatformModule],
  controllers: [SchedulerController],
  providers: [SchedulerService]
})
export class SchedulerModule {}
