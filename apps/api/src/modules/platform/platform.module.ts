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
import { SharePointFolderMappingsController } from "./sharepoint-folder-mappings.controller";
import { SharePointFolderMappingsService } from "./sharepoint-folder-mappings.service";
import { GraphSharePointAdapter } from "./graph-sharepoint.adapter";
import { MockSharePointAdapter, SHAREPOINT_ADAPTER } from "./sharepoint.adapter";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { UserDashboardsController } from "./user-dashboards.controller";
import { UserDashboardsService } from "./user-dashboards.service";
import { AiProvidersController, PlatformConfigController } from "./platform-config.controller";
import { PlatformConfigService } from "./platform-config.service";
import { MyDayController } from "./my-day.controller";
import { MyDayService } from "./my-day.service";
import { WeatherController } from "./weather.controller";
import { WeatherService } from "./weather.service";
import { TenderProcessFlowController } from "./process-flows.controller";
import { ProcessFlowsService } from "./process-flows.service";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";
import { AutomationEngineService } from "./automation-engine.service";
import { SavedViewsController } from "./saved-views.controller";
import { SavedViewsService } from "./saved-views.service";

@Module({
  imports: [AuditModule],
  controllers: [
    PlatformController,
    SharePointController,
    SharePointFolderMappingsController,
    NotificationsController,
    SearchController,
    DashboardsController,
    UserDashboardsController,
    MyDayController,
    WeatherController,
    PlatformConfigController,
    AiProvidersController,
    TenderProcessFlowController,
    AutomationsController,
    SavedViewsController
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
    SharePointFolderMappingsService,
    NotificationsService,
    SearchService,
    DashboardsService,
    UserDashboardsService,
    MyDayService,
    WeatherService,
    PlatformConfigService,
    ProcessFlowsService,
    AutomationEngineService,
    AutomationsService,
    SavedViewsService
  ],
  exports: [
    SharePointService,
    SharePointFolderMappingsService,
    NotificationsService,
    SearchService,
    DashboardsService,
    UserDashboardsService,
    PlatformConfigService,
    ProcessFlowsService,
    AutomationEngineService
  ]
})
export class PlatformModule {}
