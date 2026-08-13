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
import { SchedulerRealtimeController } from "./realtime/scheduler-realtime.controller";
import { SchedulerPresenceRegistry } from "./realtime/scheduler-presence.registry";

/**
 * §9 Scheduler and Work Planning module.
 *
 * Wires the existing shift workspace, the PR-452 day-grain allocation grid,
 * the PR-454 month availability heatmap report, the D365 RSO-parity
 * suggest engine (phase 1, assistive), and the RT-3 presence/soft
 * edit-conflict indicator (SSE realtime channel).
 */
@Module({
  imports: [PlatformModule],
  controllers: [
    SchedulerController,
    ScheduleAllocationController,
    AvailabilityReportController,
    SchedulerSuggestionController,
    SchedulerRealtimeController
  ],
  providers: [
    SchedulerService,
    ScheduleAllocationService,
    AvailabilityReportService,
    SchedulerSuggestionService,
    SchedulerPresenceRegistry
  ]
})
export class SchedulerModule {}
