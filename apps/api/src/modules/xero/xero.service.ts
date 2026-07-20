import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Invoice, XeroClient } from "xero-node";
import { PrismaService } from "../../prisma/prisma.service";
import { sanitiseProviderError } from "../ai-providers/error-sanitiser";

// In-memory state token registry. Each consent request mints a signed token
// bound to the requesting user; the callback rejects mismatches. Single-instance
// monolith — for multi-instance, persist to a shared store.
const stateTokens = new Map<string, { userId: string; expiresAt: number }>();
const STATE_TTL_MS = 10 * 60_000;

function pruneExpiredStates() {
  const now = Date.now();
  for (const [token, info] of stateTokens.entries()) {
    if (info.expiresAt < now) stateTokens.delete(token);
  }
}

// Wrapper around xero-node 15. We instantiate one XeroClient per request that
// needs it because the SDK keeps a token set on the instance — sharing one
// across concurrent requests during a refresh would race. The connection row
// in xero_connections is the source of truth.

// ── Retry queue (in-memory) ────────────────────────────────────────────────
// We queue failed bill-push attempts and retry on a cron. The queue is backed
// by XeroSyncLog rows (status="pending_retry") so that a server restart does
// not silently drop in-flight retries. On startup the cron immediately replays
// all pending_retry rows. Max 3 retries per item — after that, the row is left
// as "failed" and requires a manual re-push.
const MAX_RETRY_ATTEMPTS = 3;

type RetryEntry = {
  logId: string;
  entityType: string;
  entityId: string;
  attempts: number;
};

// In-memory overlay on top of the DB-backed pending_retry rows. Added here for
// fast access; the DB is the durable store.
const retryQueue = new Map<string, RetryEntry>();

export interface BillPushResult {
  ok: boolean;
  xeroInvoiceId: string | null;
  queued?: boolean;
}

@Injectable()
export class XeroService {
  private readonly logger = new Logger(XeroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private buildClient() {
    const clientId = this.configService.get<string>("xero.clientId", "");
    const clientSecret = this.configService.get<string>("xero.clientSecret", "");
    const redirectUri = this.configService.get<string>("xero.redirectUri", "");
    const scopes = this.configService.get<string[]>("xero.scopes", []);

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        "Xero is not configured — set XERO_CLIENT_ID and XERO_CLIENT_SECRET."
      );
    }

    return new XeroClient({
      clientId,
      clientSecret,
      redirectUris: [redirectUri],
      scopes,
      grantType: "authorization_code"
    });
  }

  async getConsentUrl(userId: string) {
    const client = this.buildClient();
    pruneExpiredStates();

    // Mint a CSRF-resistant state token: server-generated random + HMAC of the
    // userId, stored in-memory keyed by raw token. The callback verifies the
    // token exists and is not expired, then deletes it (one-shot).
    const raw = randomBytes(24).toString("hex");
    const secret = this.configService.get<string>(
      "auth.accessSecret",
      "replace-me-access"
    );
    const signature = createHmac("sha256", secret).update(`${raw}:${userId}`).digest("hex");
    const stateToken = `${raw}.${signature}`;

    stateTokens.set(stateToken, {
      userId,
      expiresAt: Date.now() + STATE_TTL_MS
    });

    const baseUrl = await client.buildConsentUrl();
    const sep = baseUrl.includes("?") ? "&" : "?";
    return { url: `${baseUrl}${sep}state=${encodeURIComponent(stateToken)}` };
  }

  private verifyState(stateToken: string | undefined) {
    if (!stateToken) {
      throw new UnauthorizedException("OAuth state is required.");
    }
    pruneExpiredStates();
    const info = stateTokens.get(stateToken);
    if (!info) {
      throw new UnauthorizedException("OAuth state is invalid or has expired.");
    }
    // Verify HMAC matches — protects against attackers brute-forcing the in-memory
    // map keys via timing.
    const [raw, sig] = stateToken.split(".");
    if (!raw || !sig) {
      throw new UnauthorizedException("OAuth state format is malformed.");
    }
    const secret = this.configService.get<string>(
      "auth.accessSecret",
      "replace-me-access"
    );
    const expected = createHmac("sha256", secret)
      .update(`${raw}:${info.userId}`)
      .digest("hex");
    const aBuffer = Buffer.from(sig, "hex");
    const bBuffer = Buffer.from(expected, "hex");
    if (aBuffer.length !== bBuffer.length || !timingSafeEqual(aBuffer, bBuffer)) {
      throw new UnauthorizedException("OAuth state signature mismatch.");
    }
    stateTokens.delete(stateToken);
    return info.userId;
  }

  async handleCallback(callbackUrl: string, _userId: string, stateToken?: string) {
    // Validate the state before doing ANY Xero work — rejects forged or replayed
    // callback URLs that would otherwise silently bind the singleton connection
    // to an attacker's tenant.
    const verifiedUserId = this.verifyState(stateToken);

    const client = this.buildClient();
    const tokenSet = await client.apiCallback(callbackUrl);
    const tenants = await client.updateTenants(false);
    const primary = tenants[0];
    if (!primary) {
      throw new BadRequestException("Xero returned no tenants for this connection.");
    }

    const expiresAt = tokenSet.expires_at
      ? new Date(tokenSet.expires_at * 1000)
      : new Date(Date.now() + 30 * 60_000);

    await this.prisma.xeroConnection.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        tenantId: primary.tenantId,
        tenantName: primary.tenantName ?? null,
        accessToken: tokenSet.access_token ?? "",
        refreshToken: tokenSet.refresh_token ?? "",
        expiresAt,
        scopes: tokenSet.scope?.split(" ") ?? [],
        connectedBy: verifiedUserId
      },
      update: {
        tenantId: primary.tenantId,
        tenantName: primary.tenantName ?? null,
        accessToken: tokenSet.access_token ?? "",
        refreshToken: tokenSet.refresh_token ?? "",
        expiresAt,
        scopes: tokenSet.scope?.split(" ") ?? [],
        connectedBy: verifiedUserId
      }
    });

    return { tenantId: primary.tenantId, tenantName: primary.tenantName };
  }

  async getStatus() {
    const conn = await this.prisma.xeroConnection.findUnique({ where: { id: 1 } });
    if (!conn) return { connected: false };
    return {
      connected: true,
      tenantId: conn.tenantId,
      tenantName: conn.tenantName,
      expiresAt: conn.expiresAt,
      scopes: conn.scopes,
      connectedAt: conn.connectedAt
    };
  }

  async disconnect() {
    await this.prisma.xeroConnection.deleteMany({});
    return { ok: true };
  }

  // Returns an authenticated XeroClient with tokens loaded and refreshed if
  // they're within 60s of expiry. Refreshes write the new token set back to
  // the singleton row.
  private async getAuthorizedClient() {
    const conn = await this.prisma.xeroConnection.findUnique({ where: { id: 1 } });
    if (!conn) {
      throw new ServiceUnavailableException("Xero is not connected. Run /xero/connect first.");
    }

    const client = this.buildClient();
    client.setTokenSet({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
      expires_at: Math.floor(conn.expiresAt.getTime() / 1000),
      token_type: "Bearer",
      scope: conn.scopes.join(" ")
    });

    if (conn.expiresAt.getTime() - Date.now() < 60_000) {
      // Xero rotates refresh tokens after 60 days of inactivity. If the refresh
      // call fails (token expired/revoked) we surface a clear "reconnect"
      // message instead of a generic 500 — the admin UI prompts for re-consent.
      try {
        const refreshed = await client.refreshWithRefreshToken(
          this.configService.get<string>("xero.clientId", ""),
          this.configService.get<string>("xero.clientSecret", ""),
          conn.refreshToken
        );
        const newExpiry = refreshed.expires_at
          ? new Date(refreshed.expires_at * 1000)
          : new Date(Date.now() + 30 * 60_000);
        await this.prisma.xeroConnection.update({
          where: { id: 1 },
          data: {
            accessToken: refreshed.access_token ?? "",
            refreshToken: refreshed.refresh_token ?? conn.refreshToken,
            expiresAt: newExpiry,
            scopes: refreshed.scope?.split(" ") ?? conn.scopes
          }
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Xero refresh failed — clearing connection: ${message}`);
        await this.prisma.xeroConnection.deleteMany({});
        throw new ServiceUnavailableException(
          "Xero session expired — reconnect via Admin Settings → Platform → Connect Xero."
        );
      }
    }

    return { client, tenantId: conn.tenantId };
  }

  // ── Contact sync ─────────────────────────────────────────────────────────

  async syncContact(clientId: string, userId: string) {
    const localClient = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!localClient) throw new NotFoundException("Client not found.");

    const { client: xero, tenantId } = await this.getAuthorizedClient();

    const contact: Record<string, unknown> = {
      name: localClient.name,
      emailAddress: localClient.email ?? undefined,
      phones: localClient.phone
        ? [{ phoneType: "DEFAULT", phoneNumber: localClient.phone }]
        : undefined,
      taxNumber: localClient.abn ?? undefined,
      isCustomer: true
    };

    try {
      let xeroContactId = localClient.xeroContactId;
      if (xeroContactId) {
        await xero.accountingApi.updateContact(tenantId, xeroContactId, {
          contacts: [{ contactID: xeroContactId, ...contact }]
        });
      } else {
        const result = await xero.accountingApi.createContacts(tenantId, {
          contacts: [contact]
        });
        xeroContactId = result.body.contacts?.[0]?.contactID ?? null;
        if (xeroContactId) {
          await this.prisma.client.update({
            where: { id: clientId },
            data: { xeroContactId }
          });
        }
      }

      await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType: "Client",
          entityId: clientId,
          xeroId: xeroContactId,
          status: "success",
          triggeredBy: userId
        }
      });

      return { ok: true, xeroContactId };
    } catch (err) {
      const sanitised = sanitiseProviderError(err);
      this.logger.error(
        `Xero contact sync error [client=${clientId}, category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType: "Client",
          entityId: clientId,
          status: "failed",
          errorText: sanitised.logMessage.slice(0, 1000),
          triggeredBy: userId
        }
      });
      throw new BadRequestException(`Xero sync: ${sanitised.userMessage}`);
    }
  }

  async syncAllContacts(userId: string) {
    const clients = await this.prisma.client.findMany({
      where: { isActive: true },
      select: { id: true }
    });
    const results: Array<{ clientId: string; status: string; error?: string }> = [];
    for (const clientRow of clients) {
      try {
        await this.syncContact(clientRow.id, userId);
        results.push({ clientId: clientRow.id, status: "success" });
      } catch (err) {
        const sanitised = sanitiseProviderError(err);
        this.logger.warn(
          `Xero contact sync (bulk) error [client=${clientRow.id}, category=${sanitised.category}]: ${sanitised.logMessage}`
        );
        results.push({
          clientId: clientRow.id,
          status: "failed",
          error: sanitised.userMessage
        });
      }
    }
    return { total: results.length, results };
  }

  // ── Invoice creation ─────────────────────────────────────────────────────
  // Pushes a DRAFT invoice into Xero from a progress claim. The contract's
  // client must already be synced to a Xero contact.

  async createInvoiceFromProgressClaim(progressClaimId: string, userId: string) {
    const claim = await this.prisma.progressClaim.findUnique({
      where: { id: progressClaimId },
      include: {
        contract: {
          include: {
            project: { include: { client: true } }
          }
        },
        lineItems: true
      }
    });
    if (!claim) throw new NotFoundException("Progress claim not found.");

    const xeroContactId = claim.contract.project.client.xeroContactId;
    if (!xeroContactId) {
      throw new BadRequestException(
        "Client is not linked to a Xero contact. Run sync-contacts first."
      );
    }

    const { client: xero, tenantId } = await this.getAuthorizedClient();

    const invoice: Invoice = {
      type: Invoice.TypeEnum.ACCREC,
      contact: { contactID: xeroContactId },
      reference: claim.claimNumber,
      date: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: Invoice.StatusEnum.DRAFT,
      lineItems: claim.lineItems.map((li) => ({
        description: li.description,
        quantity: 1,
        unitAmount: Number(li.thisClaimAmount),
        accountCode: "200"
      }))
    };

    try {
      const result = await xero.accountingApi.createInvoices(tenantId, { invoices: [invoice] });
      const invoiceId = result.body.invoices?.[0]?.invoiceID ?? null;

      await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType: "ProgressClaim",
          entityId: progressClaimId,
          xeroId: invoiceId,
          status: "success",
          triggeredBy: userId
        }
      });

      return { ok: true, invoiceId };
    } catch (err) {
      const sanitised = sanitiseProviderError(err);
      this.logger.error(
        `Xero invoice push error [claim=${progressClaimId}, category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType: "ProgressClaim",
          entityId: progressClaimId,
          status: "failed",
          errorText: sanitised.logMessage.slice(0, 1000),
          triggeredBy: userId
        }
      });
      throw new BadRequestException(`Xero invoice push: ${sanitised.userMessage}`);
    }
  }

  // ── Bills (ACCPAY) ────────────────────────────────────────────────────────
  //
  // "Bill" in Xero terminology = ACCPAY invoice (what we owe a supplier /
  // reimburse to an employee). ACCREC = what our clients owe us (used for
  // progress claims above).

  /**
   * Look up the most recent successful push log for a given entity.
   * Used by pushBill callers to check for an existing Xero bill ID before
   * attempting a create — the idempotency guard.
   *
   * Strategy: SKIP if a success row with a non-null xeroId exists.
   * We skip rather than update because Xero's ACCPAY bills are payment-
   * authorised documents — updating a bill that may already be paid risks
   * corrupting the supplier's ledger. If the bill needs correction, the
   * operator edits it directly in Xero (or voids+recreates).
   */
  private async findExistingBillLog(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    const existing = await this.prisma.xeroSyncLog.findFirst({
      where: {
        entityType,
        entityId,
        direction: "push",
        status: "success",
        NOT: { xeroId: null }
      },
      orderBy: { createdAt: "desc" }
    });
    return existing?.xeroId ?? null;
  }

  /**
   * Build a Xero ACCPAY invoice line-item array for a supplier, with optional
   * tracking category when XERO_TRACKING_CATEGORY_NAME is configured.
   */
  private buildBillLineItem(opts: {
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
    trackingCategoryName?: string;
    trackingOptionName?: string;
  }) {
    const lineItem: Record<string, unknown> = {
      description: opts.description,
      quantity: opts.quantity,
      unitAmount: opts.unitAmount,
      accountCode: opts.accountCode
    };

    if (opts.trackingCategoryName && opts.trackingOptionName) {
      lineItem.tracking = [
        {
          name: opts.trackingCategoryName,
          option: opts.trackingOptionName
        }
      ];
    }

    return lineItem;
  }

  /**
   * Resolve or create a Xero contact for a SubcontractorSupplier.
   * If the supplier already has xeroContactId set, use it directly.
   * Otherwise create a new Xero contact and persist the ID back.
   */
  private async resolveOrCreateSupplierContact(
    supplierId: string,
    xero: XeroClient,
    tenantId: string
  ): Promise<string> {
    const supplier = await this.prisma.subcontractorSupplier.findUnique({
      where: { id: supplierId }
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found.`);
    }

    if (supplier.xeroContactId) {
      return supplier.xeroContactId;
    }

    // Create new Xero contact for this supplier (isSupplier=true marks it as ACCPAY)
    const result = await xero.accountingApi.createContacts(tenantId, {
      contacts: [
        {
          name: supplier.name,
          emailAddress: supplier.email ?? undefined,
          taxNumber: supplier.abn ?? undefined,
          isSupplier: true
        }
      ]
    });

    const newXeroId = result.body.contacts?.[0]?.contactID;
    if (!newXeroId) {
      throw new BadRequestException(
        "Xero did not return a contactID for the new supplier contact."
      );
    }

    await this.prisma.subcontractorSupplier.update({
      where: { id: supplierId },
      data: { xeroContactId: newXeroId }
    });

    return newXeroId;
  }

  /**
   * createXeroBill — the canonical internal primitive for pushing an ACCPAY
   * bill to Xero. Called by pushBill (expense) and pushVendorInvoiceBill.
   *
   * Does NOT do idempotency checking — callers must call findExistingBillLog
   * first and short-circuit if an xeroId already exists.
   *
   * Returns the Xero invoiceID on success, throws on failure.
   */
  async createXeroBill(opts: {
    xeroContactId: string;
    reference: string;
    date: string;
    dueDate?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode: string;
      taxType?: string;
      trackingCategoryName?: string;
      trackingOptionName?: string;
    }>;
  }): Promise<string> {
    const { client: xero, tenantId } = await this.getAuthorizedClient();

    const xeroLineItems = opts.lineItems.map((li) =>
      this.buildBillLineItem({
        description: li.description,
        quantity: li.quantity,
        unitAmount: li.unitAmount,
        accountCode: li.accountCode,
        trackingCategoryName: li.trackingCategoryName,
        trackingOptionName: li.trackingOptionName
      })
    );

    const billPayload: Invoice = {
      type: Invoice.TypeEnum.ACCPAY,
      contact: { contactID: opts.xeroContactId },
      reference: opts.reference,
      date: opts.date,
      dueDate: opts.dueDate,
      status: Invoice.StatusEnum.DRAFT,
      lineItems: xeroLineItems as Invoice["lineItems"]
    };

    const result = await xero.accountingApi.createInvoices(tenantId, {
      invoices: [billPayload]
    });

    const invoiceId = result.body.invoices?.[0]?.invoiceID;
    if (!invoiceId) {
      throw new BadRequestException(
        "Xero did not return an invoiceID for the new ACCPAY bill."
      );
    }

    return invoiceId;
  }

  /**
   * pushBill — push an ACCPAY bill to Xero from an approved reimbursable Expense.
   *
   * Idempotency: if a success log with a non-null xeroId exists for this expense,
   * the existing xeroId is returned without a Xero API call. We skip rather than
   * update — see findExistingBillLog for the reasoning.
   *
   * Graceful failure: if the Xero call fails, the expense record is NOT
   * affected (it stays APPROVED). The failure is logged in XeroSyncLog with
   * status="pending_retry" and queued for the retry cron.
   */
  async pushBill(expenseId: string, triggeredBy: string): Promise<BillPushResult> {
    // Idempotency check — never double-post
    const existingXeroId = await this.findExistingBillLog("Expense", expenseId);
    if (existingXeroId) {
      this.logger.log(
        `pushBill: Expense ${expenseId} already has Xero bill ${existingXeroId} — skipping.`
      );
      return { ok: true, xeroInvoiceId: existingXeroId };
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        submittedBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        project: { select: { id: true, projectNumber: true, name: true } },
        job: { select: { id: true, jobNumber: true } }
      }
    });
    if (!expense) throw new NotFoundException("Expense not found.");

    const expenseAccountCode = this.configService.get<string>(
      "xero.expenseAccountCode",
      "420"
    );
    const trackingCategoryName = this.configService.get<string>(
      "xero.trackingCategoryName",
      ""
    );

    // Use project number as tracking option when a tracking category is configured
    const trackingOptionName =
      trackingCategoryName && expense.project
        ? expense.project.projectNumber
        : expense.job
        ? `JOB-${expense.job.jobNumber}`
        : undefined;

    // Reimbursable expenses are paid TO the employee. We use the system user
    // contact if a supplier contact for the employee doesn't exist. For now,
    // we create a one-off Xero contact named after the employee — Xero dedupes
    // by name so repeated approvals for the same person reuse the same contact.
    const submitterName =
      `${expense.submittedBy.firstName} ${expense.submittedBy.lastName}`.trim() ||
      expense.submittedBy.email;

    let xeroContactId: string;
    try {
      const { client: xero, tenantId } = await this.getAuthorizedClient();
      const contactResult = await xero.accountingApi.createContacts(tenantId, {
        contacts: [
          {
            name: submitterName,
            emailAddress: expense.submittedBy.email ?? undefined,
            isSupplier: true
          }
        ]
      });
      // Xero returns the existing contact if the name already exists
      xeroContactId = contactResult.body.contacts?.[0]?.contactID ?? "";
      if (!xeroContactId) {
        throw new Error("Xero returned no contactID for employee contact");
      }
    } catch (err) {
      return this.handleBillPushFailure("Expense", expenseId, triggeredBy, err);
    }

    const gstAmount = expense.gst ? Number(expense.gst) : 0;
    const taxType = gstAmount > 0 ? "INPUT" : "EXEMPTINPUT";

    const lineItem = {
      description: `${expense.description} [${expense.number}]`,
      quantity: 1,
      unitAmount: Number(expense.amount),
      accountCode: expenseAccountCode,
      taxType,
      trackingCategoryName: trackingCategoryName || undefined,
      trackingOptionName: trackingOptionName
    };

    try {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const xeroInvoiceId = await this.createXeroBill({
        xeroContactId,
        reference: expense.number,
        date: expense.spentOn.toISOString().slice(0, 10),
        dueDate,
        lineItems: [lineItem]
      });

      await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType: "Expense",
          entityId: expenseId,
          xeroId: xeroInvoiceId,
          status: "success",
          triggeredBy
        }
      });

      this.logger.log(
        `pushBill: Expense ${expenseId} pushed as Xero ACCPAY bill ${xeroInvoiceId}`
      );
      return { ok: true, xeroInvoiceId };
    } catch (err) {
      return this.handleBillPushFailure("Expense", expenseId, triggeredBy, err);
    }
  }

  /**
   * pushVendorInvoiceBill — push an ACCPAY bill to Xero from a 3-way-matched
   * (MATCHED or APPROVED) VendorInvoice.
   *
   * Idempotency: same skip-if-exists strategy as pushBill.
   */
  async pushVendorInvoiceBill(
    vendorInvoiceId: string,
    triggeredBy: string
  ): Promise<BillPushResult> {
    // Idempotency check — never double-post
    const existingXeroId = await this.findExistingBillLog("VendorInvoice", vendorInvoiceId);
    if (existingXeroId) {
      this.logger.log(
        `pushVendorInvoiceBill: VendorInvoice ${vendorInvoiceId} already has Xero bill ${existingXeroId} — skipping.`
      );
      return { ok: true, xeroInvoiceId: existingXeroId };
    }

    const invoice = await this.prisma.vendorInvoice.findUnique({
      where: { id: vendorInvoiceId },
      include: {
        lines: true,
        purchaseOrder: { include: { request: true } }
      }
    });
    if (!invoice) throw new NotFoundException("Vendor invoice not found.");

    const vendorAccountCode = this.configService.get<string>(
      "xero.vendorInvoiceAccountCode",
      "310"
    );
    const trackingCategoryName = this.configService.get<string>(
      "xero.trackingCategoryName",
      ""
    );

    // Resolve the supplier's Xero contact (creates one if not yet synced)
    let xeroContactId: string;
    try {
      const { client: xero, tenantId } = await this.getAuthorizedClient();
      xeroContactId = await this.resolveOrCreateSupplierContact(
        invoice.supplierId,
        xero,
        tenantId
      );
    } catch (err) {
      return this.handleBillPushFailure("VendorInvoice", vendorInvoiceId, triggeredBy, err);
    }

    const lineItems = invoice.lines.map((line) => ({
      description: line.description,
      quantity: Number(line.billedQty),
      unitAmount: Number(line.billedUnitPrice),
      accountCode: vendorAccountCode,
      taxType: "INPUT" as string,
      trackingCategoryName: trackingCategoryName || undefined,
      trackingOptionName: undefined as string | undefined
    }));

    try {
      const dateStr = invoice.invoiceDate.toISOString().slice(0, 10);
      const dueDateStr = invoice.dueDate
        ? invoice.dueDate.toISOString().slice(0, 10)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const xeroInvoiceId = await this.createXeroBill({
        xeroContactId,
        reference: invoice.invoiceNumber,
        date: dateStr,
        dueDate: dueDateStr,
        lineItems
      });

      await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType: "VendorInvoice",
          entityId: vendorInvoiceId,
          xeroId: xeroInvoiceId,
          status: "success",
          triggeredBy
        }
      });

      this.logger.log(
        `pushVendorInvoiceBill: VendorInvoice ${vendorInvoiceId} pushed as Xero ACCPAY bill ${xeroInvoiceId}`
      );
      return { ok: true, xeroInvoiceId };
    } catch (err) {
      return this.handleBillPushFailure("VendorInvoice", vendorInvoiceId, triggeredBy, err);
    }
  }

  /**
   * Handle a failed bill push by logging to XeroSyncLog with status
   * "pending_retry" and adding to the in-memory retry queue.
   * Returns a result with ok=false and queued=true so the caller knows the
   * operational record was not affected — the bill will retry automatically.
   */
  private async handleBillPushFailure(
    entityType: string,
    entityId: string,
    triggeredBy: string,
    err: unknown
  ): Promise<BillPushResult> {
    const sanitised = sanitiseProviderError(err);
    this.logger.warn(
      `Xero bill push failed [entityType=${entityType}, entityId=${entityId}, ` +
        `category=${sanitised.category}]: ${sanitised.logMessage} — queuing for retry.`
    );

    try {
      const logRow = await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType,
          entityId,
          status: "pending_retry",
          errorText: sanitised.logMessage.slice(0, 1000),
          triggeredBy
        }
      });

      retryQueue.set(logRow.id, {
        logId: logRow.id,
        entityType,
        entityId,
        attempts: 0
      });
    } catch (dbErr) {
      const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      this.logger.error(
        `Failed to persist retry log for ${entityType} ${entityId}: ${dbMsg}`
      );
    }

    return { ok: false, xeroInvoiceId: null, queued: true };
  }

  // ── Payment status pull ────────────────────────────────────────────────────

  /**
   * syncPaymentStatus — pull payment status from Xero for all known bills
   * (Expense, VendorInvoice, ProgressClaim types) and record the payment state
   * in the XeroSyncLog as a "pull" direction entry.
   *
   * Payment status is NOT written back to the Expense/VendorInvoice rows because
   * those models do not have a xeroPaymentStatus column (no-migration constraint).
   * Instead:
   *  - A "pull" log row records the Xero invoice status + the paid/awaiting label.
   *  - Callers that need to know payment status query the latest "pull" log for
   *    the entity via the sync-logs endpoint or the new getPaymentStatus helper.
   *  - ProgressClaim.totalPaid / paidDate ARE written back because those columns
   *    already exist on the model.
   *
   * Run automatically every 6 hours via @Cron. Also callable manually via the
   * POST /xero/sync-payment-status endpoint.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async syncPaymentStatus(): Promise<{
    synced: number;
    paid: number;
    errors: number;
  }> {
    this.logger.log("syncPaymentStatus: starting scheduled pull from Xero.");

    let connected: boolean;
    try {
      const status = await this.getStatus();
      connected = !!status.connected;
    } catch {
      connected = false;
    }

    if (!connected) {
      this.logger.log("syncPaymentStatus: Xero not connected — skipping.");
      return { synced: 0, paid: 0, errors: 0 };
    }

    // Gather all distinct entity/id pairs with a successful push log
    const pushedItems = await this.prisma.xeroSyncLog.findMany({
      where: {
        direction: "push",
        status: "success",
        NOT: { xeroId: null }
      },
      distinct: ["entityType", "entityId"],
      select: {
        entityType: true,
        entityId: true,
        xeroId: true
      }
    });

    let synced = 0;
    let paid = 0;
    let errors = 0;

    for (const item of pushedItems) {
      if (!item.xeroId) continue;

      try {
        const { client: xero, tenantId } = await this.getAuthorizedClient();

        // Fetch the invoice from Xero to read its current status
        const response = await xero.accountingApi.getInvoice(tenantId, item.xeroId);
        const xeroInvoice = response.body.invoices?.[0];
        if (!xeroInvoice) {
          this.logger.warn(
            `syncPaymentStatus: Xero returned no invoice for ID ${item.xeroId} ` +
              `[${item.entityType} ${item.entityId}]`
          );
          errors++;
          continue;
        }

        // xeroInvoice.status is Invoice.StatusEnum (numeric enum in the type
        // declaration, but the Xero SDK returns a string at runtime). Compare
        // using the raw string "PAID" via a cast to avoid the type mismatch.
        const rawStatus: string =
          (xeroInvoice.status as unknown as string | undefined) ?? "UNKNOWN";
        const isPaid = rawStatus === "PAID";
        const amountPaid = Number(xeroInvoice.amountPaid ?? 0);
        const paymentLabel = isPaid ? "paid" : "awaiting-payment";

        await this.prisma.xeroSyncLog.create({
          data: {
            direction: "pull",
            entityType: item.entityType,
            entityId: item.entityId,
            xeroId: item.xeroId,
            status: paymentLabel,
            triggeredBy: "cron:syncPaymentStatus"
          }
        });

        // For ProgressClaim, write paid amount + date back to the record
        // because those columns already exist in the schema.
        if (isPaid && item.entityType === "ProgressClaim" && amountPaid > 0) {
          const xeroPaymentDate = xeroInvoice.fullyPaidOnDate
            ? new Date(xeroInvoice.fullyPaidOnDate)
            : new Date();

          await this.prisma.progressClaim.updateMany({
            where: { id: item.entityId, totalPaid: null },
            data: {
              totalPaid: amountPaid,
              paidDate: xeroPaymentDate
            }
          });
          paid++;
        } else if (isPaid) {
          paid++;
        }

        synced++;
      } catch (err) {
        const sanitised = sanitiseProviderError(err);
        this.logger.error(
          `syncPaymentStatus error [entityType=${item.entityType}, entityId=${item.entityId}, ` +
            `xeroId=${item.xeroId}, category=${sanitised.category}]: ${sanitised.logMessage}`
        );
        errors++;
      }
    }

    this.logger.log(
      `syncPaymentStatus: done. synced=${synced}, paid=${paid}, errors=${errors}`
    );
    return { synced, paid, errors };
  }

  /**
   * getPaymentStatus — returns the latest known payment status for a given
   * entity (Expense, VendorInvoice, or ProgressClaim) by reading the most
   * recent "pull" direction log row.
   *
   * Returns null if no pull log exists (the bill has not been synced yet or
   * Xero is not connected). The calling UI should treat null as "unknown".
   */
  async getPaymentStatus(
    entityType: string,
    entityId: string
  ): Promise<{ status: string; xeroId: string | null; syncedAt: Date } | null> {
    const log = await this.prisma.xeroSyncLog.findFirst({
      where: { entityType, entityId, direction: "pull" },
      orderBy: { createdAt: "desc" }
    });
    if (!log) return null;

    return {
      status: log.status,
      xeroId: log.xeroId ?? null,
      syncedAt: log.createdAt
    };
  }

  // ── Retry queue cron ─────────────────────────────────────────────────────

  /**
   * Replay failed bill-push attempts. Runs every 30 minutes.
   * On startup, also picks up any "pending_retry" rows left from a previous
   * server instance (so restarts don't drop queued retries).
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async replayFailedBillPushes(): Promise<void> {
    // Load any DB-persisted pending_retry rows not already in the in-memory queue
    const dbPending = await this.prisma.xeroSyncLog.findMany({
      where: { direction: "push", status: "pending_retry" },
      orderBy: { createdAt: "asc" }
    });

    for (const row of dbPending) {
      if (!retryQueue.has(row.id)) {
        retryQueue.set(row.id, {
          logId: row.id,
          entityType: row.entityType,
          entityId: row.entityId,
          attempts: 0
        });
      }
    }

    if (retryQueue.size === 0) return;

    this.logger.log(
      `replayFailedBillPushes: ${retryQueue.size} item(s) in retry queue.`
    );

    const toRemove: string[] = [];

    for (const [logId, entry] of retryQueue.entries()) {
      if (entry.attempts >= MAX_RETRY_ATTEMPTS) {
        this.logger.warn(
          `replayFailedBillPushes: ${entry.entityType} ${entry.entityId} ` +
            `exceeded max retries (${MAX_RETRY_ATTEMPTS}) — marking failed.`
        );
        await this.prisma.xeroSyncLog.update({
          where: { id: logId },
          data: {
            status: "failed",
            errorText: `Exceeded max retry attempts (${MAX_RETRY_ATTEMPTS})`
          }
        });
        toRemove.push(logId);
        continue;
      }

      entry.attempts++;
      let result: BillPushResult;

      try {
        if (entry.entityType === "Expense") {
          result = await this.pushBill(entry.entityId, "cron:retry");
        } else if (entry.entityType === "VendorInvoice") {
          result = await this.pushVendorInvoiceBill(entry.entityId, "cron:retry");
        } else {
          this.logger.warn(
            `replayFailedBillPushes: unknown entityType ${entry.entityType} — removing from queue.`
          );
          toRemove.push(logId);
          continue;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `replayFailedBillPushes: retry attempt ${entry.attempts} failed for ` +
            `${entry.entityType} ${entry.entityId}: ${message}`
        );
        continue; // Leave in queue for next cron tick
      }

      if (result.ok) {
        // Update the original pending_retry log to reflect the retry succeeded
        await this.prisma.xeroSyncLog.update({
          where: { id: logId },
          data: { status: "retried_success" }
        });
        toRemove.push(logId);
        this.logger.log(
          `replayFailedBillPushes: ${entry.entityType} ${entry.entityId} ` +
            `succeeded on retry attempt ${entry.attempts}.`
        );
      }
    }

    for (const id of toRemove) {
      retryQueue.delete(id);
    }
  }

  async listSyncLogs(limit = 50) {
    return this.prisma.xeroSyncLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, limit))
    });
  }
}
