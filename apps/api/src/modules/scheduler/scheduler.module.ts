import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { SchedulerController } from "./scheduler.controller";
import { SchedulerService } from "./scheduler.service";
import { ScheduleAllocationController } from "./schedule-allocation.controller";
import { ScheduleAllocationService } from "./schedule-allocation.service";
import { AvailabilityReportController } from "./availability-report.controller";
import { AvailabilityReportService } from "./availability-report.service";

/**
 * §9 Scheduler and Work Planning module.
 *
 * Wires the existing shift workspace, the PR-452 day-grain allocation grid,
 * and the PR-454 month availability heatmap report.
 */
@Module({
  imports: [PlatformModule],
  controllers: [SchedulerController, ScheduleAllocationController, AvailabilityReportController],
  providers: [SchedulerService, ScheduleAllocationService, AvailabilityReportService]
})
export class SchedulerModule {}
