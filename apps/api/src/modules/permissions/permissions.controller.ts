import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsService } from "./permissions.service";

@ApiTags("Permissions")
@ApiBearerAuth()
@Controller("permissions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions("permissions.view")
  @ApiOperation({ summary: "List registered permissions" })
  list() {
    return this.permissionsService.list();
  }
}
