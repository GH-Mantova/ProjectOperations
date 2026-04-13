import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { SharePointService } from "./sharepoint.service";

@ApiTags("Platform")
@ApiBearerAuth()
@Controller("platform")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformController {
  constructor(private readonly sharePointService: SharePointService) {}

  @Get("config")
  @RequirePermissions("sharepoint.view")
  @ApiOperation({ summary: "Get platform foundation configuration" })
  getConfig() {
    return {
      sharePoint: this.sharePointService.getConfiguration()
    };
  }
}
