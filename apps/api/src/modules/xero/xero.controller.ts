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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
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
  @ApiResponse({ status: 200, description: "Mint a CSRF-resistant state token and return the Xero consent URL (admin opens it in a new tab)." })
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
  @ApiResponse({ status: 302, description: "Redirect to /admin/settings with a `xero` status query param." })
  @ApiQuery({ name: "code", required: false, type: String, description: "OAuth authorization code; missing code redirects with ?xero=missing_code" })
  @ApiQuery({ name: "state", required: false, type: String, description: "CSRF state token; missing/invalid state redirects with an error param" })
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
  @ApiResponse({ status: 201, description: "Programmatic callback handler — finishes the OAuth flow with the full callback URL. Use when the frontend captures the redirect." })
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
  @ApiResponse({ status: 200, description: "Current Xero connection status (tenant, scopes, expiry)." })
  status() {
    return this.service.getStatus();
  }

  @Post("disconnect")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Drop the stored Xero connection (forces a re-consent next time)." })
  @ApiResponse({ status: 201, description: "Drop the stored Xero connection (forces a re-consent next time)." })
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
  @ApiResponse({ status: 201, description: "Push a single client to Xero as a contact (creates if no xeroContactId, otherwise updates)." })
  syncContact(@Param("clientId") clientId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.syncContact(clientId, user.sub);
  }

  @Post("contacts/sync-all")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("directory.admin")
  @ApiOperation({ summary: "Push every active client to Xero. Returns per-client results." })
  @ApiResponse({ status: 201, description: "Push every active client to Xero. Returns per-client results." })
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
  @ApiResponse({ status: 201, description: "Push a DRAFT invoice into Xero from a progress claim. Client must already be synced to a Xero contact." })
  createInvoice(@Param("claimId") claimId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createInvoiceFromProgressClaim(claimId, user.sub);
  }

  // ── Bill endpoints (ACCPAY) ────────────────────────────────────────────────

  @Post("bills/from-expense/:expenseId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Push an ACCPAY bill to Xero from an approved reimbursable Expense. " +
      "Idempotent: returns the existing Xero bill ID if already pushed. " +
      "On Xero failure the expense is unaffected; the push is queued for automatic retry."
  })
  @ApiResponse({
    status: 201,
    description:
      "Push result: { ok, xeroInvoiceId, queued? }. queued=true means Xero was unavailable and the push will be retried automatically."
  })
  pushExpenseBill(
    @Param("expenseId") expenseId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.pushBill(expenseId, user.sub);
  }

  @Post("bills/from-vendor-invoice/:vendorInvoiceId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Push an ACCPAY bill to Xero from a 3-way-matched VendorInvoice (MATCHED or APPROVED). " +
      "Idempotent: returns the existing Xero bill ID if already pushed. " +
      "On Xero failure the vendor invoice is unaffected; the push is queued for automatic retry."
  })
  @ApiResponse({
    status: 201,
    description: "Push result: { ok, xeroInvoiceId, queued? }."
  })
  pushVendorInvoiceBill(
    @Param("vendorInvoiceId") vendorInvoiceId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.pushVendorInvoiceBill(vendorInvoiceId, user.sub);
  }

  @Post("sync-payment-status")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("finance.admin")
  @ApiOperation({
    summary:
      "Manually trigger the payment-status pull from Xero for all known bills. " +
      "Also runs automatically every 6 hours. " +
      "Records paid/awaiting-payment status in XeroSyncLog (pull direction). " +
      "ProgressClaim.totalPaid and paidDate are also updated when a claim invoice is fully paid."
  })
  @ApiResponse({
    status: 201,
    description: "Sync result: { synced, paid, errors }."
  })
  syncPaymentStatus() {
    return this.service.syncPaymentStatus();
  }

  @Get("payment-status/:entityType/:entityId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Return the latest known Xero payment status for an entity (Expense, VendorInvoice, or ProgressClaim). " +
      "Returns null when no pull log exists (not yet synced or Xero not connected)."
  })
  @ApiResponse({
    status: 200,
    description: "{ status, xeroId, syncedAt } or null."
  })
  getPaymentStatus(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string
  ) {
    return this.service.getPaymentStatus(entityType, entityId);
  }

  @Get("sync-logs")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Recent Xero sync activity (last 50 by default)." })
  @ApiResponse({ status: 200, description: "Recent Xero sync activity (last 50 by default)." })
  @ApiQuery({ name: "limit", required: false, type: String, description: "Max rows to return (default 50)" })
  syncLogs(@Query("limit") limit?: string) {
    return this.service.listSyncLogs(limit ? Number(limit) : undefined);
  }
}
