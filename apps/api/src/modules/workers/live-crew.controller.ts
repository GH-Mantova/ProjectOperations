import { BadRequestException, Controller, Get, NotFoundException, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { LiveCrewService } from "./live-crew.service";

type RequestUser = { sub: string; permissions: string[] };

function actorCtx(user: RequestUser) {
  return { userId: user.sub, permissions: new Set(user.permissions ?? []) };
}

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

  // GPS-A2 trail endpoint. No @RequirePermissions — the service enforces
  // "scheduler.view OR self-worker" itself so both dispatchers (using the
  // live crew map) and workers (checking their own recorded trail) can hit
  // the same route.
  @Get(":workerProfileId/trail")
  @ApiOperation({
    summary:
      "Ordered trail (clock-on pin + breadcrumbs) for the given worker's currently-open shift. Dispatchers (scheduler.view) can read any worker; workers can read only their own."
  })
  @ApiResponse({ status: 200, description: "Trail points for the open shift." })
  @ApiResponse({ status: 403, description: "Not allowed to view another worker's trail." })
  @ApiResponse({ status: 404, description: "Worker has no open shift right now." })
  async getTrail(
    @Param("workerProfileId") workerProfileId: string,
    @CurrentUser() user: RequestUser
  ) {
    const trail = await this.service.getTrail(workerProfileId, actorCtx(user));
    if (!trail) {
      throw new NotFoundException("Worker has no open shift right now.");
    }
    return trail;
  }
}
