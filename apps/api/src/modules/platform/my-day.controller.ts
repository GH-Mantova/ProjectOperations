import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { MyDayService } from "./my-day.service";

/**
 * Per-user "My Day" dashboard aggregate. Guarded by JwtAuthGuard alone —
 * the endpoint is inherently scoped to the caller's own user id, so
 * every authenticated user can hit it without any dashboard permission.
 */
@ApiTags("Dashboards")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dashboards")
export class MyDayController {
  constructor(private readonly service: MyDayService) {}

  @Get("my-day")
  @ApiOperation({
    summary: "Personal today-view: caller's allocations, approvals waiting on them, and forms due."
  })
  @ApiResponse({
    status: 200,
    description: "{ workerProfileId, allocations, approvals, formsDue } — all scoped to the caller."
  })
  myDay(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.getMyDay(actor.sub);
  }
}
