import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { LiveCrewService } from "./live-crew.service";

/**
 * Live crew map endpoints under /workers/live-crew.
 *
 * Route order matters: these live under WorkersController's segment but as
 * static two-segment paths ("live-crew" + "live-crew/nearest") they are
 * registered ahead of the /:id wildcard by module ordering — mounted
 * before WorkersController in WorkersModule.
 */
@ApiTags("Live crew map")
@ApiBearerAuth()
@Controller("workers/live-crew")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LiveCrewController {
  constructor(private readonly service: LiveCrewService) {}

  @Get()
  @RequirePermissions("scheduler.view")
  @ApiOperation({
    summary: "List workers currently on the clock with their last known GPS point and project."
  })
  @ApiResponse({ status: 200, description: "Workers currently on the clock." })
  whosWorking() {
    return this.service.whosWorking();
  }

  @Get("nearest")
  @RequirePermissions("scheduler.view")
  @ApiOperation({
    summary: "Nearest on-clock workers to a point. Straight-line Haversine distance in km."
  })
  @ApiResponse({ status: 200, description: "Nearest on-clock workers." })
  nearest(@Query("lat") lat: string, @Query("lng") lng: string, @Query("limit") limit?: string) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      throw new BadRequestException("lat and lng query params are required and must be numeric.");
    }
    const limitNum = limit === undefined ? undefined : Number(limit);
    return this.service.nearestWorker(latNum, lngNum, limitNum);
  }
}
