import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import {
  TipRecommendationsService,
  type TipOriginType
} from "./tip-recommendations.service";

type RequestUser = { sub: string; permissions: string[] };

// ---- DTOs ------------------------------------------------------------------

class ComputeRecommendationsDto {
  @IsString()
  wasteTypeCode!: string;

  @IsNumber()
  @Min(0.001)
  loadTonnes!: number;

  @IsEnum(["project", "office", "tender"])
  originType!: TipOriginType;

  @IsOptional()
  @IsString()
  projectId?: string;

  /** Required when originType = "tender" (OPS-M3) */
  @IsOptional()
  @IsString()
  tenderId?: string;
}

class AcceptRecommendationDto {
  @IsString()
  mapLocationId!: string;

  @IsString()
  wasteTypeCode!: string;

  @IsNumber()
  @Min(0.001)
  loadTonnes!: number;

  @IsEnum(["project", "office", "tender"])
  originType!: TipOriginType;

  @IsOptional()
  @IsString()
  projectId?: string;

  /** Required when originType = "tender" (OPS-M3) */
  @IsOptional()
  @IsString()
  tenderId?: string;
}

// ---- Controller ------------------------------------------------------------

@ApiTags("Waste -- Tip Finder")
@ApiBearerAuth()
@Controller("waste/recommendations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TipRecommendationsController {
  constructor(private readonly service: TipRecommendationsService) {}

  /**
   * List accepted tip recommendations for a project.
   *
   * Returns rows where projectId = the project, PLUS rows whose tenderId =
   * the project's sourceTender.id (tender-stage plans), newest first.
   * Each row carries source: "tender" | "job". Totals are summed server-side
   * in Decimal. Requires projects.view.
   */
  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({
    summary: "List accepted tip recommendations for a project (ops-m2b).",
    description:
      "Returns job + tender rows for the project, newest first. " +
      "Totals are summed in Decimal server-side. Requires projects.view."
  })
  @ApiQuery({ name: "projectId", required: true, type: String })
  @ApiResponse({ status: 200, description: "TippingLogSummary" })
  @ApiResponse({ status: 404, description: "Project not found." })
  listForProject(@Query("projectId") projectId: string) {
    return this.service.listForProject(projectId);
  }

  /**
   * Compute ranked tip recommendations for a given waste type, load size,
   * and origin. Returns every active TIP location with full cost working:
   *   disposalFee = loadTonnes x resolvedRate
   *   travelCost  = haversineKm x 2 x travelRatePerKm  (round trip)
   *   totalCost   = disposalFee + travelCost
   *
   * TIPs with no rate row for the chosen waste type are included greyed
   * (accepted=false, costs null) so the UI can render them as "rates needed".
   */
  @Post()
  @RequirePermissions("estimates.view")
  @ApiOperation({
    summary: "Compute ranked tip recommendations (v1 haversine costing).",
    description:
      "Returns all active TIP locations ranked by total cost. " +
      "Disposal fee resolved via RateResolverService (waste slug). " +
      "Travel cost = haversine x 2 x OperationsSettings.travelRatePerKm. " +
      "Requires estimates.view."
  })
  @ApiResponse({ status: 201, description: "Array of TipRecommendationCard ordered by totalCost asc." })
  @ApiResponse({ status: 400, description: "Invalid inputs." })
  compute(@Body() dto: ComputeRecommendationsDto) {
    return this.service.computeRecommendations({
      wasteTypeCode: dto.wasteTypeCode,
      loadTonnes: dto.loadTonnes,
      originType: dto.originType,
      projectId: dto.projectId,
      tenderId: dto.tenderId
    });
  }

  /**
   * Accept a recommendation -- writes a TipRecommendationLog row snapshotting
   * all costs at the moment of acceptance. Prices change; the log does not
   * recompute. ops-m2b: also stores tenderId when originType = "tender".
   * Requires estimates.manage.
   */
  @Post("accept")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Accept a tip recommendation -- writes an immutable cost snapshot log row.",
    description:
      "Validates the tip has a rate for the waste type and that travelRatePerKm is configured, " +
      "then writes a TipRecommendationLog row. ops-m2b: tenderId is stored when originType = tender. " +
      "Requires estimates.manage."
  })
  @ApiResponse({ status: 201, description: "{ logId: string }" })
  @ApiResponse({ status: 400, description: "Missing rate, missing travel rate, or invalid inputs." })
  @ApiResponse({ status: 404, description: "TIP location or project not found." })
  accept(
    @Body() dto: AcceptRecommendationDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.acceptRecommendation(
      {
        mapLocationId: dto.mapLocationId,
        wasteTypeCode: dto.wasteTypeCode,
        loadTonnes: dto.loadTonnes,
        originType: dto.originType,
        projectId: dto.projectId,
        tenderId: dto.tenderId
      },
      actor.sub
    );
  }
}
