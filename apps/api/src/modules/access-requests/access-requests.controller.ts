import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AccessRequestsService } from "./access-requests.service";
import { RequestAccessDto } from "./dto/request-access.dto";

/**
 * Public request-access endpoint.
 *
 * Sits under /auth/* alongside /auth/sso so the same ThrottlerGuard (auth
 * module) rate-limits it. No JWT guard — the caller's Entra idToken is
 * the credential; identity is re-derived from it server-side.
 */
@ApiTags("Auth")
@Controller("auth")
export class AccessRequestsPublicController {
  constructor(private readonly service: AccessRequestsService) {}

  @Post("request-access")
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary:
      "Submit an access request from an authenticated-but-unregistered Entra user. Identity is derived from the validated idToken; the client-supplied body only carries the optional message."
  })
  @ApiResponse({ status: 201, description: "Access request received." })
  @ApiResponse({ status: 401, description: "Microsoft identity token is invalid or expired." })
  @ApiResponse({
    status: 429,
    description: "Too many requests from this IP within the configured window."
  })
  async requestAccess(@Body() dto: RequestAccessDto) {
    await this.service.submitFromEntraToken(dto.idToken, dto.message);
    return { ok: true };
  }
}
