import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import {
  PipelineDashboardService,
  type WinRateGroupBy
} from "./pipeline-dashboard.service";

const GROUP_BYS = ["client", "sector", "source", "estimator"] as const;

class DashboardQueryDto {
  @IsOptional() @Type(() => Number) stalledDays?: number;
  @IsOptional() @IsString() ownerId?: string;
}

class ByStageQueryDto {
  @IsOptional() @IsString() ownerId?: string;
}

class WinRatesQueryDto {
  @IsIn(GROUP_BYS as unknown as string[]) groupBy!: WinRateGroupBy;
}

class StalledQueryDto {
  @IsOptional() @Type(() => Number) thresholdDays?: number;
  @IsOptional() @IsString() ownerId?: string;
}

/**
 * CRM-6: REST surface for the pipeline + win/loss dashboard. Read-only.
 * Uses `crm.view` on every route.
 */
@ApiTags("CRM Pipeline Dashboard")
@ApiBearerAuth()
@Controller("crm/pipeline")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PipelineDashboardController {
  constructor(private readonly service: PipelineDashboardService) {}

  @Get("dashboard")
  @RequirePermissions("crm.view")
  @ApiOperation({
    summary: "Full dashboard: pipeline by stage, win rates, stalled opps, coverage."
  })
  @ApiQuery({ name: "stalledDays", required: false, description: "1-365, default 14." })
  @ApiQuery({ name: "ownerId", required: false })
  @ApiResponse({ status: 200, description: "Dashboard payload." })
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.service.getDashboard(query);
  }

  @Get("by-stage")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Open pipeline bucketed by opportunity stage." })
  @ApiQuery({ name: "ownerId", required: false })
  getByStage(@Query() query: ByStageQueryDto) {
    return this.service.getPipelineByStage(query);
  }

  @Get("win-rates")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Win rate grouped by client, sector, source, or estimator." })
  @ApiQuery({ name: "groupBy", required: true, enum: GROUP_BYS })
  getWinRates(@Query() query: WinRatesQueryDto) {
    return this.service.getWinRates({ groupBy: query.groupBy });
  }

  @Get("stalled")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Open opportunities with overdue next-action or stale updates." })
  @ApiQuery({ name: "thresholdDays", required: false })
  @ApiQuery({ name: "ownerId", required: false })
  getStalled(@Query() query: StalledQueryDto) {
    return this.service.getStalledOpportunities(query);
  }

  @Get("relationship-coverage")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Account primary-contact coverage summary." })
  getRelationshipCoverage() {
    return this.service.getRelationshipCoverage();
  }
}
