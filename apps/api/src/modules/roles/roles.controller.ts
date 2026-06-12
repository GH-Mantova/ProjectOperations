import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { RolesService } from "./roles.service";
import { UpdateRoleDto } from "./dto/update-role.dto";

/**
 * HTTP endpoints for role administration (list, create, update).
 *
 * All routes require a valid JWT and per-route permissions via
 * PermissionsGuard. Mutations forward the acting user (JWT `sub`) so the
 * service can attribute audit entries.
 */
@ApiTags("Roles")
@ApiBearerAuth()
@Controller("roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * List roles.
   *
   * Requires `roles.view`. Returns a paginated envelope of roles with
   * their permissions flattened onto each item.
   *
   * @param query - page / pageSize pagination options
   * @returns paginated `{ items, total, page, pageSize }` of roles
   */
  @Get()
  @RequirePermissions("roles.view")
  @ApiOperation({ summary: "List roles" })
  list(@Query() query: PaginationQueryDto) {
    return this.rolesService.list(query);
  }

  /**
   * Create a role.
   *
   * Requires `roles.create`. Optionally links permissions at creation
   * time via `permissionIds`.
   *
   * @param dto - role name, description, isSystem flag and optional permission ids
   * @param actor - JWT payload of the acting user (`sub` = user id)
   * @returns the created role with its rolePermissions included
   */
  @Post()
  @RequirePermissions("roles.create")
  @ApiOperation({ summary: "Create a role" })
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: { sub: string }) {
    return this.rolesService.create(dto, actor.sub);
  }

  /**
   * Update a role.
   *
   * Requires `roles.update`. Supplying `permissionIds` replaces the
   * role's entire permission set.
   *
   * @param roleId - id of the role to update
   * @param dto - partial role fields (name, description, isSystem, permissionIds)
   * @param actor - JWT payload of the acting user (`sub` = user id)
   * @returns the updated role with its rolePermissions included
   */
  @Patch(":id")
  @RequirePermissions("roles.update")
  @ApiOperation({ summary: "Update a role" })
  update(
    @Param("id") roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.rolesService.update(roleId, dto, actor.sub);
  }
}
