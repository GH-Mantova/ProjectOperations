import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateDashboardDto, UpdateDashboardDto } from "./dto/create-dashboard.dto";
import { DashboardsService } from "./dashboards.service";

@ApiTags("Dashboards")
@ApiBearerAuth()
@Controller("dashboards")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get()
  @RequirePermissions("dashboards.view")
  @ApiOperation({ summary: "List dashboard definitions and widgets" })
  list(@CurrentUser() actor: { sub: string }) {
    return this.dashboardsService.list(actor.sub);
  }

  @Get(":id/render")
  @RequirePermissions("dashboards.view")
  @ApiOperation({ summary: "Render a dashboard with live widget data" })
  render(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.dashboardsService.render(id, actor.sub);
  }

  @Post()
  @RequirePermissions("dashboards.manage")
  @ApiOperation({ summary: "Create a dashboard" })
  create(@Body() dto: CreateDashboardDto, @CurrentUser() actor: { sub: string }) {
    return this.dashboardsService.create(dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("dashboards.manage")
  @ApiOperation({ summary: "Update a dashboard and its widgets" })
  update(@Param("id") id: string, @Body() dto: UpdateDashboardDto, @CurrentUser() actor: { sub: string }) {
    return this.dashboardsService.update(id, dto, actor.sub);
  }
}
