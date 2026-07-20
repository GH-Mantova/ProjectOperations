import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { ProcurementModule } from "../procurement/procurement.module";
import { DailyDiaryController } from "./daily-diary.controller";
import { DailyDiaryService } from "./daily-diary.service";
import { ForecastController } from "./forecast.controller";
import { ForecastService } from "./forecast.service";
import { GanttController } from "./gantt.controller";
import { GanttService } from "./gantt.service";
import { JpmController } from "./jpm.controller";
import { JpmService } from "./jpm.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { ProjectsTimelineController } from "./projects-timeline.controller";
import { PunchItemsController } from "./punch-items.controller";
import { PunchItemsService } from "./punch-items.service";

/**
 * NestJS module for §8 Jobs and Delivery — owns the Projects HTTP surface
 * (CRUD + status transitions + revert-to-tender), the project-scoped Gantt
 * task CRUD, and the cross-project dashboard timeline endpoint.
 *
 * Wires {@link ProjectsController}, {@link GanttController}, and
 * {@link ProjectsTimelineController} to the {@link ProjectsService} and
 * {@link GanttService}, with `AuditModule` (for audit log writes) and
 * `PlatformModule` (for the notifications + email services) as imports.
 * The two services are exported so they can be consumed by adjacent modules
 * (e.g. tender conversion).
 *
 * `ProcurementModule` is imported so that {@link ForecastService} can inject
 * {@link CommitmentService} (which is exported from ProcurementModule).
 */
@Module({
  imports: [AuditModule, PlatformModule, ProcurementModule],
  controllers: [
    ProjectsController,
    GanttController,
    ProjectsTimelineController,
    JpmController,
    PunchItemsController,
    DailyDiaryController,
    ForecastController
  ],
  providers: [ProjectsService, GanttService, JpmService, PunchItemsService, DailyDiaryService, ForecastService],
  exports: [ProjectsService, GanttService, JpmService, PunchItemsService, DailyDiaryService, ForecastService]
})
export class ProjectsModule {}
