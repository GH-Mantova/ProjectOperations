import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { AccessRequestsService } from "./access-requests.service";
import { ApproveAccessRequestDto } from "./dto/approve-access-request.dto";

@ApiTags("Admin Access Requests")
@ApiBearerAuth()
@Controller("admin/access-requests")
@UseGuards(JwtAuthGuard)
export class AdminAccessRequestsController {
  constructor(private readonly service: AccessRequestsService) {}

  @Get()
  @ApiOperation({ summary: "List PENDING access requests (admin/super only)." })
  @ApiResponse({ status: 403, description: "Caller is not an admin." })
  list(@CurrentUser() actor: { sub: string }) {
    return this.service.listPending(actor.sub);
  }

  @Post(":id/approve")
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
  @ApiOperation({ summary: "Deny a pending access request." })
  @ApiResponse({ status: 200, description: "Access request denied." })
  @ApiResponse({ status: 403, description: "Caller is not an admin." })
  @ApiResponse({ status: 404, description: "Access request not found." })
  @ApiResponse({ status: 409, description: "Access request is not in PENDING state." })
  deny(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deny(actor.sub, id);
  }
}
