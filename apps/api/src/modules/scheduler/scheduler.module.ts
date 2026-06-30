import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { SchedulerController } from "./scheduler.controller";
import { SchedulerService } from "./scheduler.service";
import { ScheduleAllocationController } from "./schedule-allocation.controller";
import { ScheduleAllocationService } from "./schedule-allocation.service";

/**
 * §9 Scheduler and Work Planning module.
 *
 * Wires {@link SchedulerController} and {@link SchedulerService} for the
 * existing shift workspace, plus {@link ScheduleAllocationController} and
 * {@link ScheduleAllocationService} for the PR-452 day-grain grid.
 */
@Module({
  imports: [PlatformModule],
  controllers: [SchedulerController, ScheduleAllocationController],
  providers: [SchedulerService, ScheduleAllocationService]
})
export class SchedulerModule {}
