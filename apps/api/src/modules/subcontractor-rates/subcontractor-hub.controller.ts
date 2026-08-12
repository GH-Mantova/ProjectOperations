import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { SubcontractorRatesService } from "./subcontractor-rates.service";

/**
 * S1 — Vendor Hub View (rate-hub-sor-integration-plan.md).
 *
 * GET /subcontractors/hub-view
 *   Returns all active vendors grouped by vendorType.label.
 *   Vendors with no vendorTypeId appear in the trailing "Untyped" group.
 *   Pass ?entityType=subcontractor or ?entityType=supplier to filter the hub tab.
 */
@ApiTags("Subcontractor Hub")
@ApiBearerAuth()
@Controller("subcontractors")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubcontractorHubController {
  constructor(private readonly ratesService: SubcontractorRatesService) {}

  @Get("hub-view")
  @RequirePermissions("subcontractors.rates.view")
  @ApiOperation({
    summary: "Hub view — all vendors grouped by vendor type.",
    description:
      "Returns active SubcontractorSupplier records grouped by their vendorType (GlobalListItem from the vendor-types list). " +
      "Each group contains the vendor's SubcontractorRate rows. Vendors without a vendorTypeId appear in a trailing 'Untyped' group."
  })
  @ApiQuery({
    name: "entityType",
    required: false,
    description: "Filter by entityType ('subcontractor' or 'supplier'). Omit for all."
  })
  @ApiResponse({
    status: 200,
    description: "Vendor type groups with nested vendors and their rate rows."
  })
  hubView(@Query("entityType") entityType?: string) {
    return this.ratesService.hubView(entityType);
  }
}
