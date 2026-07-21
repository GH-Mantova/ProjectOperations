import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { SignInDto, SignOutDto } from "./dto/site-attendance.dto";
import { SitesService } from "./sites.service";

type RequestUser = { sub: string };

// Attendance endpoints — deliberately not folded into the master-data site
// CRUD (which owns configuration, not the "who is here" fact stream). The
// muster/evacuation view reads currently-on-site from here.
@ApiTags("Sites")
@ApiBearerAuth()
@Controller("sites")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SitesController {
  constructor(private readonly service: SitesService) {}

  @Post("attendance/sign-in")
  @RequirePermissions("sites.manage")
  @ApiOperation({
    summary:
      "Sign the current worker in to a site. Idempotent — if the worker already has an open attendance on this site, the existing row is returned rather than creating a duplicate."
  })
  @ApiResponse({ status: 201, description: "Attendance opened (or existing open attendance returned)." })
  @ApiResponse({ status: 403, description: "No WorkerProfile linked to the caller." })
  @ApiResponse({ status: 404, description: "Site not found." })
  signIn(@Body() dto: SignInDto, @CurrentUser() user: RequestUser) {
    return this.service.signIn(user.sub, dto);
  }

  @Post("attendance/sign-out")
  @RequirePermissions("sites.manage")
  @ApiOperation({
    summary:
      "Sign the current worker out of a site. If they're not currently signed in, this is a no-op (returns null) — the field button double-tap must not surface an error."
  })
  @ApiResponse({ status: 201, description: "Attendance closed, or null if there was no open attendance." })
  signOut(@Body() dto: SignOutDto, @CurrentUser() user: RequestUser) {
    return this.service.signOut(user.sub, dto);
  }

  @Get("attendance/available-sites")
  @RequirePermissions("sites.view")
  @ApiOperation({
    summary:
      "Sites the caller currently has active or upcoming allocations on. Used to seed the field sign-in picker without granting masterdata.view to every worker."
  })
  @ApiResponse({ status: 200, description: "Sites the worker can sign in to." })
  myAvailableSites(@CurrentUser() user: RequestUser) {
    return this.service.myAvailableSites(user.sub);
  }

  @Get("attendance/mine")
  @RequirePermissions("sites.view")
  @ApiOperation({
    summary: "Get the caller's currently-open attendance (if any). Used by the field UI to render sign-in state."
  })
  @ApiResponse({ status: 200, description: "Current open attendance, or null." })
  myCurrentAttendance(@CurrentUser() user: RequestUser) {
    return this.service.myCurrentAttendance(user.sub);
  }

  @Get(":siteId/attendance/current")
  @RequirePermissions("sites.view")
  @ApiOperation({
    summary:
      "List workers currently on the given site (open attendances only). Ordered oldest-first so stale open rows surface at the top for data-quality review."
  })
  @ApiResponse({ status: 200, description: "Currently-on-site workers." })
  @ApiResponse({ status: 404, description: "Site not found." })
  currentlyOnSite(@Param("siteId") siteId: string) {
    return this.service.currentlyOnSite(siteId);
  }
}
