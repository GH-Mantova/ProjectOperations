import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import {
  CreateUserDashboardDto,
  ListUserDashboardsQueryDto,
  UpdateUserDashboardDto
} from "./dto/user-dashboard.dto";
import { UserDashboardsService } from "./user-dashboards.service";

@ApiTags("UserDashboards")
@ApiBearerAuth()
@Controller("user-dashboards")
@UseGuards(JwtAuthGuard)
export class UserDashboardsController {
  constructor(private readonly service: UserDashboardsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's dashboards, optionally filtered by slug" })
  @ApiResponse({ status: 200, description: "List of the current user's dashboards." })
  list(@CurrentUser() actor: { sub: string }, @Query() query: ListUserDashboardsQueryDto) {
    return this.service.list(actor.sub, query.slug);
  }

  @Post()
  @ApiOperation({ summary: "Create a new user dashboard (non-system)" })
  @ApiResponse({ status: 201, description: "Created dashboard." })
  create(@CurrentUser() actor: { sub: string }, @Body() dto: CreateUserDashboardDto) {
    return this.service.create(actor.sub, {
      name: dto.name,
      slug: dto.slug,
      config: dto.config as never
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single user dashboard by id" })
  @ApiResponse({ status: 200, description: "Dashboard with full config." })
  @ApiResponse({ status: 404, description: "Dashboard not found or not owned by current user." })
  getById(@CurrentUser() actor: { sub: string }, @Param("id") id: string) {
    return this.service.getById(actor.sub, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update dashboard name and/or config (widget order, visibility, filters, periods)" })
  update(
    @CurrentUser() actor: { sub: string },
    @Param("id") id: string,
    @Body() dto: UpdateUserDashboardDto
  ) {
    return this.service.update(actor.sub, id, {
      name: dto.name,
      config: dto.config as never
    });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a user dashboard (system dashboards cannot be deleted)" })
  @ApiResponse({ status: 200, description: "Deleted." })
  @ApiResponse({ status: 403, description: "Cannot delete a system dashboard." })
  remove(@CurrentUser() actor: { sub: string }, @Param("id") id: string) {
    return this.service.remove(actor.sub, id);
  }

  @Post(":id/default")
  @ApiOperation({ summary: "Mark this dashboard as the default for its slug for the current user" })
  setDefault(@CurrentUser() actor: { sub: string }, @Param("id") id: string) {
    return this.service.setDefault(actor.sub, id);
  }
}
