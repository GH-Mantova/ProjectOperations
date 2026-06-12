import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsService } from "./permissions.service";

/**
 * Read-only HTTP endpoints for the permission catalogue.
 *
 * Permissions are code-defined in the permission registry and synced to
 * the database at startup — there are no create/update routes here.
 */
@ApiTags("Permissions")
@ApiBearerAuth()
@Controller("permissions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * List registered permissions.
   *
   * Requires the `permissions.view` permission. Returns the full,
   * unpaginated permission list ordered by module then code.
   *
   * @returns all Permission records
   */
  @Get()
  @RequirePermissions("permissions.view")
  @ApiOperation({ summary: "List registered permissions" })
  @ApiResponse({ status: 200, description: "List registered permissions." })
  list() {
    return this.permissionsService.list();
  }
}
