import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, ValidateIf } from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ClientVersionsService } from "./client-versions.service";

class RequestUpdateDto {
  @IsOptional() @IsString() userId?: string;
  @ValidateIf((o) => o.userId === undefined) @IsBoolean() all?: boolean;
}

@ApiTags("Admin — Client Versions")
@ApiBearerAuth()
@Controller("admin/client-versions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminClientVersionsController {
  constructor(private readonly service: ClientVersionsService) {}

  @Get()
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List active users with their most-recent client build + last-seen + behind flag." })
  @ApiResponse({ status: 200, description: "Users with client-version telemetry and server SHA." })
  list() {
    return this.service.list();
  }

  @Post("request-update")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Ask one user (userId) or everyone (all: true) to update. Clients pick up the nudge via the X-Update-Requested response header."
  })
  @ApiResponse({ status: 200, description: '{ affected: number }' })
  requestUpdate(@Body() dto: RequestUpdateDto) {
    return this.service.requestUpdate({ userId: dto.userId, all: dto.all === true });
  }
}
