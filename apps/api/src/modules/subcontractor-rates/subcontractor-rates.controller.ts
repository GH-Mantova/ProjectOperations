import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { CreateSubcontractorRateDto } from "./dto/create-subcontractor-rate.dto";
import { SupersedeSubcontractorRateDto } from "./dto/supersede-subcontractor-rate.dto";
import { SubcontractorRatesService } from "./subcontractor-rates.service";

/**
 * Nested resource: /subcontractors/:subcontractorSupplierId/rates
 *
 * Rate cards for a single subcontractor. Append-only supersede rule applies —
 * there is no in-place update endpoint. To change a rate, POST to /supersede.
 */
@ApiTags("Subcontractor Rates")
@ApiBearerAuth()
@Controller("subcontractors/:subcontractorSupplierId/rates")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubcontractorRatesController {
  constructor(private readonly service: SubcontractorRatesService) {}

  @Get()
  @RequirePermissions("subcontractors.rates.view")
  @ApiOperation({ summary: "List all rate cards for a subcontractor." })
  @ApiParam({ name: "subcontractorSupplierId", description: "SubcontractorSupplier id." })
  @ApiResponse({ status: 200, description: "SubcontractorRate[] ordered by discipline then created date." })
  @ApiResponse({ status: 404, description: "Supplier not found." })
  list(@Param("subcontractorSupplierId") subcontractorSupplierId: string) {
    return this.service.list(subcontractorSupplierId);
  }

  @Get(":id")
  @RequirePermissions("subcontractors.rates.view")
  @ApiOperation({ summary: "Fetch a single rate card." })
  @ApiParam({ name: "subcontractorSupplierId", description: "SubcontractorSupplier id." })
  @ApiParam({ name: "id", description: "SubcontractorRate id." })
  @ApiResponse({ status: 200, description: "SubcontractorRate." })
  @ApiResponse({ status: 404, description: "Rate or supplier not found." })
  get(
    @Param("subcontractorSupplierId") subcontractorSupplierId: string,
    @Param("id") id: string
  ) {
    return this.service.get(subcontractorSupplierId, id);
  }

  @Post()
  @RequirePermissions("subcontractors.rates.manage")
  @ApiOperation({ summary: "Create a new rate card for a subcontractor." })
  @ApiParam({ name: "subcontractorSupplierId", description: "SubcontractorSupplier id." })
  @ApiResponse({ status: 201, description: "Created SubcontractorRate." })
  @ApiResponse({ status: 400, description: "Invalid discipline code or DTO validation failure." })
  @ApiResponse({ status: 404, description: "Supplier not found." })
  create(
    @Param("subcontractorSupplierId") subcontractorSupplierId: string,
    @Body() dto: CreateSubcontractorRateDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.create(subcontractorSupplierId, dto, actor.sub);
  }

  /**
   * Supersede (append-only edit). Creates a new rate row + deactivates the old
   * one in a single transaction. The old row's isActive flips to false.
   * No in-place mutation of rate/unit/discipline is permitted.
   */
  @Post(":id/supersede")
  @RequirePermissions("subcontractors.rates.manage")
  @ApiOperation({
    summary:
      "Supersede an existing rate card. Creates a new row and deactivates the old one (append-only)."
  })
  @ApiParam({ name: "subcontractorSupplierId", description: "SubcontractorSupplier id." })
  @ApiParam({ name: "id", description: "Id of the rate to supersede." })
  @ApiResponse({ status: 201, description: "Newly created SubcontractorRate row." })
  @ApiResponse({ status: 400, description: "DTO validation failure or missing rate." })
  @ApiResponse({ status: 404, description: "Rate or supplier not found." })
  supersede(
    @Param("subcontractorSupplierId") subcontractorSupplierId: string,
    @Param("id") id: string,
    @Body() dto: SupersedeSubcontractorRateDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.supersede(subcontractorSupplierId, id, dto, actor.sub);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("subcontractors.rates.manage")
  @ApiOperation({ summary: "Deactivate a rate card (soft-delete — sets isActive=false)." })
  @ApiParam({ name: "subcontractorSupplierId", description: "SubcontractorSupplier id." })
  @ApiParam({ name: "id", description: "SubcontractorRate id." })
  @ApiResponse({ status: 200, description: "Deactivated SubcontractorRate." })
  @ApiResponse({ status: 404, description: "Rate or supplier not found." })
  deactivate(
    @Param("subcontractorSupplierId") subcontractorSupplierId: string,
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.deactivate(subcontractorSupplierId, id, actor.sub);
  }
}
