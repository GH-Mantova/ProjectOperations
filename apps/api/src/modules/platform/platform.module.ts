import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditModule } from "../audit/audit.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { PlatformController } from "./platform.controller";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { SharePointController } from "./sharepoint.controller";
import { SharePointService } from "./sharepoint.service";
import { GraphSharePointAdapter } from "./graph-sharepoint.adapter";
import { MockSharePointAdapter, SHAREPOINT_ADAPTER } from "./sharepoint.adapter";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { UserDashboardsController } from "./user-dashboards.controller";
import { UserDashboardsService } from "./user-dashboards.service";
import { PlatformConfigController } from "./platform-config.controller";
import { PlatformConfigService } from "./platform-config.service";

@Module({
  imports: [AuditModule],
  controllers: [
    PlatformController,
    SharePointController,
    NotificationsController,
    SearchController,
    DashboardsController,
    UserDashboardsController,
    PlatformConfigController
  ],
  providers: [
    MockSharePointAdapter,
    GraphSharePointAdapter,
    {
      provide: SHAREPOINT_ADAPTER,
      inject: [ConfigService, MockSharePointAdapter, GraphSharePointAdapter],
      useFactory: (
        configService: ConfigService,
        mockAdapter: MockSharePointAdapter,
        graphAdapter: GraphSharePointAdapter
      ) => {
        const mode = configService.get<string>("SHAREPOINT_MODE", "mock");
        return mode === "live" || mode === "graph" ? graphAdapter : mockAdapter;
      }
    },
    SharePointService,
    NotificationsService,
    SearchService,
    DashboardsService,
    UserDashboardsService,
    PlatformConfigService
  ],
  exports: [SharePointService, NotificationsService, SearchService, DashboardsService, UserDashboardsService, PlatformConfigService]
})
export class PlatformModule {}
