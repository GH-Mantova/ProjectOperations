import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateDefaultDashboardDto } from "./dto/update-default-dashboard.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

/**
 * HTTP endpoints for user administration (list, create, update).
 *
 * All routes require a valid JWT and per-route permissions via
 * PermissionsGuard. Mutations record the acting user (JWT `sub`) so the
 * service can stamp created/updated-by fields and write audit entries.
 */
@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * List users.
   *
   * Requires `users.view`. Supports an optional `role` query param that
   * filters to users holding a role whose name equals the value
   * (case-insensitive) — used by the Team panel estimator dropdown.
   *
   * @param query - page / pageSize pagination options
   * @param role - optional role name to filter by (exact match, case-insensitive)
   * @returns paginated `{ items, total, page, pageSize }` of safe user shapes
   */
  @Get()
  @RequirePermissions("users.view")
  @ApiOperation({ summary: "List users" })
  @ApiResponse({ status: 200, description: "List users." })
  @ApiQuery({
    name: "role",
    required: false,
    type: String,
    description:
      "Filter to users whose role name contains this value (case-insensitive). Used by the Team panel dropdown to list estimators."
  })
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query, query.role);
  }

  /**
   * Create a user.
   *
   * Requires `users.create`. The acting user's id is forwarded so the
   * service can stamp createdBy/updatedBy and write an audit entry.
   *
   * @param dto - email, name, password and optional role ids
   * @param actor - JWT payload of the acting user (`sub` = user id)
   * @returns the created user without its password hash
   */
  @Post()
  @RequirePermissions("users.create")
  @ApiOperation({ summary: "Create a user" })
  @ApiResponse({ status: 201, description: "Create a user." })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: { sub: string }) {
    return this.usersService.create(dto, actor.sub);
  }

  /**
   * Get the acting user's effective default dashboard.
   *
   * Returns their per-user override if set and still accessible,
   * otherwise the global "Home" dashboard. No admin permission required
   * — every authenticated user reads their own default.
   */
  @Get("me/default-dashboard")
  @ApiOperation({ summary: "Get the current user's effective default dashboard" })
  @ApiResponse({ status: 200, description: "The current user's effective default dashboard." })
  getMyDefaultDashboard(@CurrentUser() actor: { sub: string }) {
    return this.usersService.resolveDefaultDashboard(actor.sub);
  }

  /**
   * Set the acting user's personal default dashboard.
   *
   * Pass `dashboardId: null` to clear the override and fall back to the
   * global "Home" dashboard. Users may only set their own default
   * (route is scoped to `me`) and only to a dashboard they can access
   * — the service rejects targets they cannot see.
   */
  @Patch("me/default-dashboard")
  @ApiOperation({ summary: "Set the current user's personal default dashboard" })
  @ApiResponse({ status: 200, description: "The effective default dashboard after the update." })
  @ApiResponse({ status: 403, description: "The user does not have access to the target dashboard." })
  @ApiResponse({ status: 404, description: "Target dashboard does not exist." })
  setMyDefaultDashboard(
    @Body() dto: UpdateDefaultDashboardDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.usersService.setDefaultDashboard(actor.sub, dto.dashboardId);
  }

  /**
   * Update a user.
   *
   * Requires `users.update`. Partial update — only fields present in the
   * DTO are changed; supplying `roleIds` replaces the user's role set.
   *
   * @param userId - id of the user to update
   * @param dto - partial user fields (email, name, password, isActive, roleIds)
   * @param actor - JWT payload of the acting user (`sub` = user id)
   * @returns the updated user without its password hash
   */
  @Patch(":id")
  @RequirePermissions("users.update")
  @ApiOperation({ summary: "Update a user" })
  @ApiResponse({ status: 200, description: "Update a user." })
  update(
    @Param("id") userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.usersService.update(userId, dto, actor.sub);
  }
}
