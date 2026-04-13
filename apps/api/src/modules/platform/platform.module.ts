import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { PlatformController } from "./platform.controller";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { SharePointController } from "./sharepoint.controller";
import { SharePointService } from "./sharepoint.service";
import { MockSharePointAdapter } from "./sharepoint.adapter";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";

@Module({
  imports: [AuditModule],
  controllers: [
    PlatformController,
    SharePointController,
    NotificationsController,
    SearchController,
    DashboardsController
  ],
  providers: [
    MockSharePointAdapter,
    SharePointService,
    NotificationsService,
    SearchService,
    DashboardsService
  ],
  exports: [SharePointService, NotificationsService, SearchService, DashboardsService]
})
export class PlatformModule {}
