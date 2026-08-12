import { Controller, Delete, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { SuperUserGuard } from "../../common/auth/super-user.guard";
import { RateArchiveService } from "./rate-archive.service";

/**
 * S2 vendor delete safeguard endpoints (rate-hub-sor-integration-plan.md).
 *
 * Sits next to the SubcontractorHubController — both share the /subcontractors
 * route namespace but this one owns the archive lifecycle for a single vendor.
 * Archive/unarchive gated `rates.manage`; hard-delete gated SuperUserGuard.
 */
@ApiTags("Subcontractor Archive")
@ApiBearerAuth()
@Controller("subcontractors")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubcontractorArchiveController {
  constructor(private readonly archiveService: RateArchiveService) {}

  @Patch(":id/archive")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Soft-archive a vendor. Sets archivedAt = now; hidden from the default hub." })
  @ApiParam({ name: "id", description: "SubcontractorSupplier id." })
  @ApiResponse({ status: 200, description: "Vendor archived." })
  @ApiResponse({ status: 404, description: "Vendor not found." })
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.archive(id, user.sub);
  }

  @Patch(":id/unarchive")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Unarchive a vendor. Clears archivedAt so it re-appears in the default hub." })
  @ApiParam({ name: "id", description: "SubcontractorSupplier id." })
  @ApiResponse({ status: 200, description: "Vendor unarchived." })
  @ApiResponse({ status: 404, description: "Vendor not found." })
  unarchive(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.unarchive(id, user.sub);
  }

  @Delete(":id")
  @UseGuards(SuperUserGuard)
  @ApiOperation({ summary: "Permanently delete a vendor. Super-user only. Blocked when live commitments still reference it." })
  @ApiParam({ name: "id", description: "SubcontractorSupplier id." })
  @ApiResponse({ status: 200, description: "Vendor permanently deleted." })
  @ApiResponse({ status: 403, description: "Super-user required." })
  @ApiResponse({ status: 404, description: "Vendor not found." })
  @ApiResponse({ status: 409, description: "Live commitments still reference this vendor — archive instead." })
  hardDelete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.hardDelete(id, user.sub, user.isSuperUser ?? false);
  }
}
