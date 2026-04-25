import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Redirect,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { XeroService } from "./xero.service";
import { XeroCallbackDto } from "./dto/xero.dto";

@ApiTags("Xero")
@ApiBearerAuth()
@Controller("xero")
export class XeroController {
  constructor(private readonly service: XeroService) {}

  @Get("connect")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Get Xero OAuth consent URL (admin opens it in a new tab)." })
  connect() {
    return this.service.getConsentUrl();
  }

  // Xero redirects the browser to this URL with ?code=...&state=...
  // We don't gate this with a JWT guard because Xero won't carry our token —
  // the request is authenticated implicitly by possession of the OAuth code,
  // which Xero only issues to the registered redirect URI. The handler
  // validates the code via xero-node before persisting tokens.
  @Get("callback")
  @ApiOperation({
    summary:
      "OAuth callback target. Xero hits this with ?code=... after the user consents. Stores tokens against id=1."
  })
  @Redirect()
  async callback(@Query("code") code: string, @Query("state") state: string | undefined) {
    if (!code) {
      return { url: "/admin/settings?xero=missing_code", statusCode: 302 };
    }
    const callbackUrl = `${process.env.XERO_REDIRECT_URI ?? "http://localhost:3000/api/v1/xero/callback"}?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
    try {
      // The connectedBy field is best-effort — by the time Xero redirects we
      // don't have the original initiating user in scope. Stamp 'oauth_callback'
      // as a sentinel; the consent flow itself was permission-gated.
      await this.service.handleCallback(callbackUrl, "oauth_callback");
      return { url: "/admin/settings?xero=connected", statusCode: 302 };
    } catch {
      return { url: "/admin/settings?xero=error", statusCode: 302 };
    }
  }

  @Post("callback")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Programmatic callback handler — finishes the OAuth flow with the full callback URL. Use when the frontend captures the redirect."
  })
  postCallback(@Body() body: XeroCallbackDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.handleCallback(body.callbackUrl, user.sub);
  }

  @Get("status")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Current Xero connection status (tenant, scopes, expiry)." })
  status() {
    return this.service.getStatus();
  }

  @Post("disconnect")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Drop the stored Xero connection (forces a re-consent next time)." })
  disconnect() {
    return this.service.disconnect();
  }

  @Post("contacts/:clientId/sync")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("directory.manage")
  @ApiOperation({
    summary:
      "Push a single client to Xero as a contact (creates if no xeroContactId, otherwise updates)."
  })
  syncContact(@Param("clientId") clientId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.syncContact(clientId, user.sub);
  }

  @Post("contacts/sync-all")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("directory.admin")
  @ApiOperation({ summary: "Push every active client to Xero. Returns per-client results." })
  syncAllContacts(@CurrentUser() user: AuthenticatedUser) {
    return this.service.syncAllContacts(user.sub);
  }

  @Post("invoices/from-progress-claim/:claimId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("finance.admin")
  @ApiOperation({
    summary:
      "Push a DRAFT invoice into Xero from a progress claim. Client must already be synced to a Xero contact."
  })
  createInvoice(@Param("claimId") claimId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createInvoiceFromProgressClaim(claimId, user.sub);
  }

  @Get("sync-logs")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Recent Xero sync activity (last 50 by default)." })
  syncLogs(@Query("limit") limit?: string) {
    return this.service.listSyncLogs(limit ? Number(limit) : undefined);
  }
}
