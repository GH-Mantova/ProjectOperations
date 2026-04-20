import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ProjectsService } from "../projects/projects.service";

type RequestUser = { sub: string; permissions: string[] };

@ApiTags("Tender Conversion")
@ApiBearerAuth()
@Controller("tenders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderConvertController {
  constructor(private readonly projects: ProjectsService) {}

  @Post(":id/convert")
  @RequirePermissions("tenderconversion.manage")
  @ApiOperation({
    summary:
      "Convert an AWARDED tender into a Project. Allocates the next IS-P### number under a row lock, snapshots the estimate (rates + line items), flattens scope, moves tender documents, and notifies the assigned PM."
  })
  @ApiResponse({ status: 201, description: "Created project with full detail payload." })
  @ApiResponse({ status: 400, description: "Tender is not AWARDED, or has no linked client." })
  @ApiResponse({
    status: 409,
    description: "Tender already converted. Body includes { existingProjectId, existingProjectNumber }."
  })
  @ApiResponse({ status: 404, description: "Tender not found." })
  convert(@Param("id") id: string, @CurrentUser() actor: RequestUser) {
    return this.projects.convertFromTender(id, {
      userId: actor.sub,
      permissions: new Set(actor.permissions ?? [])
    });
  }
}
