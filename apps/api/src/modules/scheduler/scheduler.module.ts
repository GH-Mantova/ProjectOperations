import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { SchedulerController } from "./scheduler.controller";
import { SchedulerService } from "./scheduler.service";
import { ScheduleAllocationController } from "./schedule-allocation.controller";
import { ScheduleAllocationService } from "./schedule-allocation.service";
import { AvailabilityReportController } from "./availability-report.controller";
import { AvailabilityReportService } from "./availability-report.service";
import { SchedulerSuggestionController } from "./suggestion.controller";
import { SchedulerSuggestionService } from "./suggestion.service";

/**
 * §9 Scheduler and Work Planning module.
 *
 * Wires the existing shift workspace, the PR-452 day-grain allocation grid,
 * the PR-454 month availability heatmap report, and the D365 RSO-parity
 * suggest engine (phase 1, assistive).
 */
@Module({
  imports: [PlatformModule],
  controllers: [
    SchedulerController,
    ScheduleAllocationController,
    AvailabilityReportController,
    SchedulerSuggestionController
  ],
  providers: [
    SchedulerService,
    ScheduleAllocationService,
    AvailabilityReportService,
    SchedulerSuggestionService
  ]
})
export class SchedulerModule {}
