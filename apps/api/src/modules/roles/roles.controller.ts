import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { RolesService } from "./roles.service";
import { UpdateRoleDto } from "./dto/update-role.dto";

/**
 * HTTP endpoints for role administration (list, create, update, per-row
 * permission grant/revoke).
 *
 * All routes require a valid JWT and per-route permissions via
 * PermissionsGuard. Mutations forward the acting user (JWT `sub`) so the
 * service can attribute audit entries.
 *
 * The per-row grant/revoke routes are ADDITIONALLY gated to super-users
 * only — role-permission edits are an authorization surface and must not
 * be delegable via a role. Enforced here on the server (not just by
 * hiding the checkbox in the UI); a disabled input is not access control.
 */
@ApiTags("Roles")
@ApiBearerAuth()
@Controller("roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions("roles.view")
  @ApiOperation({ summary: "List roles" })
  @ApiResponse({ status: 200, description: "List roles." })
  list(@Query() query: PaginationQueryDto) {
    return this.rolesService.list(query);
  }

  @Post()
  @RequirePermissions("roles.create")
  @ApiOperation({ summary: "Create a role" })
  @ApiResponse({ status: 201, description: "Create a role." })
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: { sub: string }) {
    return this.rolesService.create(dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("roles.update")
  @ApiOperation({ summary: "Update a role" })
  @ApiResponse({ status: 200, description: "Update a role." })
  update(
    @Param("id") roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.rolesService.update(roleId, dto, actor.sub);
  }

  /**
   * Grant a single permission to a role.
   *
   * Super-user only. Idempotent — granting an already-granted permission
   * returns `{ granted: false, alreadyGranted: true }`. Writes a
   * `role_permissions.grant` audit entry attributing the acting user.
   */
  @Put(":roleId/permissions/:permissionId")
  @HttpCode(200)
  @ApiOperation({ summary: "Grant a permission to a role (super-user only)" })
  @ApiResponse({ status: 200, description: "Grant a permission to a role." })
  @ApiResponse({ status: 403, description: "Super-user access required." })
  grantPermission(
    @Param("roleId") roleId: string,
    @Param("permissionId") permissionId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    this.assertSuperUser(actor);
    return this.rolesService.grantPermission(roleId, permissionId, actor.sub);
  }

  /**
   * Revoke a single permission from a role.
   *
   * Super-user only. Idempotent — revoking an ungranted permission returns
   * `{ revoked: false, alreadyRevoked: true }`. Writes a
   * `role_permissions.revoke` audit entry. The service enforces a
   * defence-in-depth guardrail preventing revocation of `permissions.view`
   * / `roles.view` from the last role granting it.
   */
  @Delete(":roleId/permissions/:permissionId")
  @HttpCode(200)
  @ApiOperation({ summary: "Revoke a permission from a role (super-user only)" })
  @ApiResponse({ status: 200, description: "Revoke a permission from a role." })
  @ApiResponse({ status: 403, description: "Super-user access required." })
  revokePermission(
    @Param("roleId") roleId: string,
    @Param("permissionId") permissionId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    this.assertSuperUser(actor);
    return this.rolesService.revokePermission(roleId, permissionId, actor.sub);
  }

  private assertSuperUser(actor: AuthenticatedUser | undefined) {
    if (!actor?.isSuperUser) {
      throw new ForbiddenException(
        "Super-user access required to edit role permissions."
      );
    }
  }
}
