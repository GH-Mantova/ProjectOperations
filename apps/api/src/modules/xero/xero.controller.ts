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
  @ApiOperation({
    summary:
      "Mint a CSRF-resistant state token and return the Xero consent URL (admin opens it in a new tab)."
  })
  connect(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getConsentUrl(user.sub);
  }

  // Xero redirects the browser to this URL with ?code=...&state=...
  // We can't gate the GET with a JWT guard (Xero strips our cookies/headers),
  // so the security model is: state token bound to the initiating admin's
  // user id is verified inside the service before any token is persisted. A
  // missing or invalid state is rejected with 401, breaking CSRF attempts that
  // try to bind the singleton connection to an attacker-controlled tenant.
  @Get("callback")
  @ApiOperation({
    summary:
      "OAuth callback target. Validates the state token before exchanging the code, then redirects to /admin/settings."
  })
  @Redirect()
  async callback(@Query("code") code: string, @Query("state") state: string | undefined) {
    if (!code) {
      return { url: "/admin/settings?xero=missing_code", statusCode: 302 };
    }
    if (!state) {
      return { url: "/admin/settings?xero=missing_state", statusCode: 302 };
    }
    const callbackUrl = `${process.env.XERO_REDIRECT_URI ?? "http://localhost:3000/api/v1/xero/callback"}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    try {
      await this.service.handleCallback(callbackUrl, "oauth_callback", state);
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
    // Pull the state out of the callback URL so the service can verify it
    // even when the admin posts the URL directly from the SPA.
    const url = new URL(body.callbackUrl);
    const state = url.searchParams.get("state") ?? undefined;
    return this.service.handleCallback(body.callbackUrl, user.sub, state);
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
