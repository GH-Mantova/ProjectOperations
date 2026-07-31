import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AccessRequestsService } from "./access-requests.service";
import { ApproveAccessRequestDto } from "./dto/approve-access-request.dto";

// Declarative permission gates layered on top of the service-side tier check
// (defence-in-depth). Approve creates a user (SSO-only), so it takes
// `users.create`; deny is the matched admin decision on the same workflow and
// takes the same gate. Codes reused from the /users registry — no new codes.
@ApiTags("Admin Access Requests")
@ApiBearerAuth()
@Controller("admin/access-requests")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminAccessRequestsController {
  constructor(private readonly service: AccessRequestsService) {}

  @Get()
  @RequirePermissions("users.view")
  @ApiOperation({ summary: "List PENDING access requests (admin/super only)." })
  @ApiResponse({ status: 403, description: "Caller is not an admin." })
  list(@CurrentUser() actor: { sub: string }) {
    return this.service.listPending(actor.sub);
  }

  @Post(":id/approve")
  @RequirePermissions("users.create")
  @ApiOperation({
    summary:
      "Approve a pending access request — creates the user (SSO-only) with the chosen roles. Idempotent if a user with that email already exists."
  })
  @ApiResponse({ status: 200, description: "Access request approved." })
  @ApiResponse({ status: 403, description: "Caller is not an admin or would exceed tier." })
  @ApiResponse({ status: 404, description: "Access request not found." })
  @ApiResponse({ status: 409, description: "Access request is not in PENDING state." })
  approve(
    @Param("id") id: string,
    @Body() dto: ApproveAccessRequestDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.approve(actor.sub, id, dto.roleIds);
  }

  @Post(":id/deny")
  @RequirePermissions("users.create")
  @ApiOperation({ summary: "Deny a pending access request." })
  @ApiResponse({ status: 200, description: "Access request denied." })
  @ApiResponse({ status: 403, description: "Caller is not an admin." })
  @ApiResponse({ status: 404, description: "Access request not found." })
  @ApiResponse({ status: 409, description: "Access request is not in PENDING state." })
  deny(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deny(actor.sub, id);
  }
}
