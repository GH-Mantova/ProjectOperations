import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { GanttController } from "./gantt.controller";
import { GanttService } from "./gantt.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { ProjectsTimelineController } from "./projects-timeline.controller";

@Module({
  imports: [AuditModule, PlatformModule],
  controllers: [ProjectsController, GanttController, ProjectsTimelineController],
  providers: [ProjectsService, GanttService],
  exports: [ProjectsService, GanttService]
})
export class ProjectsModule {}
