import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { PortalAuthService } from "./portal-auth.service";
import { PortalJwtGuard } from "./portal-jwt.guard";
import { PortalUser } from "./portal-user.decorator";
import type { PortalUserPayload } from "./portal-auth.types";
import {
  PortalAcceptInviteDto,
  PortalLoginDto,
  PortalRefreshDto,
  PortalRequestResetDto,
  PortalResetPasswordDto
} from "./dto/portal-login.dto";
import { CreatePortalInviteDto } from "./dto/portal-invite.dto";

@ApiTags("portal-auth")
@Controller("portal")
export class PortalAuthController {
  constructor(private readonly authService: PortalAuthService) {}

  @ApiOperation({ summary: "Portal user login" })
  @Post("auth/login")
  login(@Body() body: PortalLoginDto) {
    return this.authService.login(body);
  }

  @ApiOperation({ summary: "Refresh portal access token" })
  @Post("auth/refresh")
  refresh(@Body() body: PortalRefreshDto) {
    return this.authService.refresh(body);
  }

  @ApiOperation({ summary: "Logout portal session" })
  @Post("auth/logout")
  logout(@Body() body: PortalRefreshDto) {
    return this.authService.logout(body.refreshToken);
  }

  @ApiOperation({ summary: "Accept portal invitation" })
  @Post("auth/accept-invite")
  acceptInvite(@Body() body: PortalAcceptInviteDto) {
    return this.authService.acceptInvite(body);
  }

  @ApiOperation({ summary: "Request portal password reset" })
  @Post("auth/request-reset")
  requestReset(@Body() body: PortalRequestResetDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @ApiOperation({ summary: "Reset portal password" })
  @Post("auth/reset-password")
  resetPassword(@Body() body: PortalResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @ApiOperation({ summary: "Get current portal user" })
  @UseGuards(PortalJwtGuard)
  @Get("auth/me")
  me(@PortalUser() user: PortalUserPayload) {
    return this.authService.me(user.sub);
  }

  @ApiOperation({ summary: "Create portal invitation (staff only)" })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("portal.invite")
  @Post("invites")
  createInvite(@Body() body: CreatePortalInviteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.createInvite(body, user.sub);
  }
}
