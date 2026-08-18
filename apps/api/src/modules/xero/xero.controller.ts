import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { XeroContactExportService } from "./xero-contact-export.service";
import { XeroContactImportService } from "./xero-contact-import.service";
import { XeroService } from "./xero.service";
import { XeroCallbackDto } from "./dto/xero.dto";

// CFX-4: coerce the querystring ?includeBankDetails=... flag. Anything other
// than the exact string "true" is false — the export defaults to WITHOUT bank
// details (decision 6 in the plan, and Risk 7.5).
function parseIncludeBankDetails(value: string | undefined): boolean {
  return value === "true";
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

@ApiTags("Xero")
@ApiBearerAuth()
@Controller("xero")
export class XeroController {
  constructor(
    private readonly service: XeroService,
    private readonly exportService: XeroContactExportService,
    private readonly importService: XeroContactImportService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

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

  // ── CFX-4: file-based contact export (parallel to the dormant API push) ──

  @Get("export/clients.csv")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Download active clients as a Xero-format contact-import CSV. Custom fields are never included. " +
      "Bank details (BSB + account) are excluded unless includeBankDetails=true — every export is audited."
  })
  @ApiQuery({
    name: "includeBankDetails",
    required: false,
    type: String,
    description: "Set to 'true' to include BankAccountName and BankAccountNumber columns. Defaults to false."
  })
  @ApiResponse({ status: 200, description: "CSV file attachment." })
  async exportClientsCsv(
    @Query("includeBankDetails") includeBankDetails: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    const withBank = parseIncludeBankDetails(includeBankDetails);
    const clients = await this.prisma.client.findMany({ where: { isActive: true } });
    const csv = this.exportService.buildClientsCsv(clients, { includeBankDetails: withBank });
    await this.audit.write({
      actorId: user.sub,
      action: "XERO_CONTACT_EXPORT",
      entityType: "CLIENT",
      metadata: { rowCount: clients.length, includeBankDetails: withBank }
    });
    const filename = `xero-clients-${todayIsoDate()}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(csv);
  }

  @Get("export/vendors.csv")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Download active subcontractors/suppliers as a Xero-format contact-import CSV. Custom fields are never included. " +
      "Bank details (BSB + account) are excluded unless includeBankDetails=true — every export is audited."
  })
  @ApiQuery({
    name: "includeBankDetails",
    required: false,
    type: String,
    description: "Set to 'true' to include BankAccountName and BankAccountNumber columns. Defaults to false."
  })
  @ApiResponse({ status: 200, description: "CSV file attachment." })
  async exportVendorsCsv(
    @Query("includeBankDetails") includeBankDetails: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    const withBank = parseIncludeBankDetails(includeBankDetails);
    const vendors = await this.prisma.subcontractorSupplier.findMany({ where: { isActive: true } });
    const csv = this.exportService.buildVendorsCsv(vendors, { includeBankDetails: withBank });
    await this.audit.write({
      actorId: user.sub,
      action: "XERO_CONTACT_EXPORT",
      entityType: "VENDOR",
      metadata: { rowCount: vendors.length, includeBankDetails: withBank }
    });
    const filename = `xero-vendors-${todayIsoDate()}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(csv);
  }

  // ── CFX-5: file-based contact import (dry-run preview → confirm) ─────────

  @Post("import/preview")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @HttpCode(200)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description:
      "Multipart upload: file (CSV or TXT), appliesTo (CLIENT|VENDOR), columnMap (JSON object mapping BUILTIN field keys to CSV header names).",
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        appliesTo: { type: "string", enum: ["CLIENT", "VENDOR"] },
        columnMap: { type: "string", description: "JSON-encoded Record<string,string>" }
      },
      required: ["file", "appliesTo", "columnMap"]
    }
  })
  @ApiOperation({
    summary:
      "Dry-run import preview. Parses the uploaded CSV, matches rows to existing records, and returns per-row diffs and bank-overwrite warnings. No writes performed. " +
      "Returns an ImportPreview valid for 5 minutes. Every preview is audited."
  })
  @ApiResponse({ status: 200, description: "ImportPreview with per-row action, diffs, and fileSha256." })
  async importPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ): Promise<unknown> {
    // NestJS multipart handling: when configured with a file interceptor the
    // file buffer lands on req.file; when not using an interceptor (raw
    // multipart) it lands on req.body.file. To avoid a hard dependency on
    // @nestjs/platform-express file interceptors (which require multer wired
    // in the module), we read the raw file from the multipart body via the
    // express `req` object. Both the buffer from multer AND the raw body
    // object are checked so the controller works with either setup.
    const multerFile = (req as unknown as { file?: { buffer: Buffer } }).file;
    const body = req.body as Record<string, unknown>;

    let fileBytes: Buffer;
    if (multerFile?.buffer) {
      fileBytes = multerFile.buffer;
    } else if (Buffer.isBuffer(body["file"])) {
      fileBytes = body["file"];
    } else if (typeof body["file"] === "string") {
      fileBytes = Buffer.from(body["file"], "utf-8");
    } else {
      // Fallback: accept raw CSV posted as text/plain or application/octet-stream.
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (rawBody) {
        fileBytes = rawBody;
      } else {
        fileBytes = Buffer.from("");
      }
    }

    const appliesToRaw = String(body["appliesTo"] ?? "").trim().toUpperCase();
    if (appliesToRaw !== "CLIENT" && appliesToRaw !== "VENDOR") {
      throw new BadRequestException("appliesTo must be CLIENT or VENDOR");
    }
    const appliesTo = appliesToRaw as "CLIENT" | "VENDOR";

    let columnMap: Record<string, string>;
    try {
      const raw = body["columnMap"];
      columnMap =
        typeof raw === "string"
          ? (JSON.parse(raw) as Record<string, string>)
          : (raw as Record<string, string>);
    } catch {
      throw new BadRequestException("columnMap must be valid JSON (Record<string,string>)");
    }

    const preview = await this.importService.previewImport({
      fileBytes,
      appliesTo,
      columnMap,
      actorUserId: user.sub
    });

    await this.audit.write({
      actorId: user.sub,
      action: "XERO_FILE_IMPORT_PREVIEW",
      entityType: appliesTo,
      metadata: {
        rowCount: preview.rows.length,
        fileSha256: preview.fileSha256,
        previewId: preview.previewId
      }
    });

    return preview;
  }

  @Post("import/commit")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Commit a previously-previewed import. Requires a valid previewId returned by POST /xero/import/preview (expires after 5 minutes). " +
      "Optionally accepts confirmedOverwriteBankRecordIds to allow bank-field overwrites for specific records. " +
      "Wraps all upserts in a transaction. Every commit is audited."
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        previewId: { type: "string" },
        confirmedOverwriteBankRecordIds: {
          type: "array",
          items: { type: "string" },
          description: "Record IDs for which the caller has confirmed bank-field overwrite."
        }
      },
      required: ["previewId"]
    }
  })
  @ApiResponse({
    status: 201,
    description: "Commit result: { inserted, updated, skipped }."
  })
  async importCommit(
    @Body() body: { previewId: string; confirmedOverwriteBankRecordIds?: string[] },
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ inserted: number; updated: number; skipped: number }> {
    const result = await this.importService.commitImport({
      previewId: body.previewId,
      actorUserId: user.sub,
      confirmedOverwriteBankRecordIds: body.confirmedOverwriteBankRecordIds
    });

    await this.audit.write({
      actorId: user.sub,
      action: "XERO_FILE_IMPORT_COMMIT",
      entityType: "IMPORT",
      metadata: {
        previewId: body.previewId,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped
      }
    });

    return result;
  }
}
