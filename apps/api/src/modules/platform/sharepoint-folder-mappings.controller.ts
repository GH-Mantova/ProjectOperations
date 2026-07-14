import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { SuperUserGuard } from "../../common/auth/super-user.guard";
import { UpdateSharePointFolderMappingDto, assertEntityType } from "./dto/sharepoint-folder-mapping.dto";
import { SharePointFolderMappingsService } from "./sharepoint-folder-mappings.service";
import { SharePointService } from "./sharepoint.service";

// Restricted to super-users because it edits the folder tree the whole
// company's documents route into. `SuperUserGuard` (server-side) is the
// authoritative check — the UI hides the panel from non-super-users but
// direct curl calls also 403.
@ApiTags("SharePoint")
@ApiBearerAuth()
@Controller("admin/sharepoint-folder-mappings")
@UseGuards(JwtAuthGuard, SuperUserGuard)
export class SharePointFolderMappingsController {
  constructor(
    private readonly mappings: SharePointFolderMappingsService,
    private readonly sharePoint: SharePointService
  ) {}

  @Get()
  @ApiOperation({ summary: "List SharePoint folder mappings (super-user only)." })
  @ApiResponse({ status: 200, description: "List SharePoint folder mappings." })
  list() {
    return this.mappings.list();
  }

  @Patch(":entityType")
  @ApiOperation({
    summary:
      "Update a SharePoint folder mapping. Validated against Graph on save — a path that doesn't exist in SharePoint is rejected."
  })
  @ApiResponse({ status: 200, description: "Mapping updated." })
  async update(
    @Param("entityType") entityTypeParam: string,
    @Body() dto: UpdateSharePointFolderMappingDto,
    @CurrentUser() actor: { sub: string }
  ) {
    let entityType;
    try {
      entityType = assertEntityType(entityTypeParam);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : String(err));
    }

    const config = await this.sharePoint.getResolvedConfig();
    return this.mappings.updatePath(
      entityType,
      { folderPath: dto.folderPath, siteId: config.siteId, driveId: config.driveId },
      actor.sub
    );
  }
}
