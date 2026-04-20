import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { EntraLoginDto } from "./dto/entra-login.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { SsoLoginDto } from "./dto/sso-login.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Login with email and password" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("entra")
  @ApiOperation({ summary: "Exchange a Microsoft Entra ID token for an internal application session" })
  loginWithEntra(@Body() dto: EntraLoginDto) {
    return this.authService.loginWithEntra(dto);
  }

  @Post("sso")
  @ApiOperation({ summary: "Microsoft 365 SSO login with auto-provisioning for first-time users" })
  loginWithSso(@Body() dto: SsoLoginDto) {
    return this.authService.loginWithSso(dto);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh access and refresh tokens" })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Get("config")
  @ApiOperation({ summary: "Get public login configuration for the active authentication mode" })
  getLoginConfiguration() {
    return this.authService.getLoginConfiguration();
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current authenticated user" })
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }
}
