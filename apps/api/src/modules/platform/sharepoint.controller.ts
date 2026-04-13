import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { EnsureSharePointFolderDto } from "./dto/sharepoint-folder.dto";
import { SharePointService } from "./sharepoint.service";

@ApiTags("SharePoint")
@ApiBearerAuth()
@Controller("sharepoint")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SharePointController {
  constructor(private readonly sharePointService: SharePointService) {}

  @Get("folders")
  @RequirePermissions("sharepoint.view")
  @ApiOperation({ summary: "List tracked SharePoint folders" })
  listFolders() {
    return this.sharePointService.listFolders();
  }

  @Post("folders/ensure")
  @RequirePermissions("sharepoint.manage")
  @ApiOperation({ summary: "Ensure a SharePoint folder exists through the configured adapter" })
  ensureFolder(@Body() dto: EnsureSharePointFolderDto, @CurrentUser() actor: { sub: string }) {
    return this.sharePointService.ensureFolder(dto, actor.sub);
  }
}
