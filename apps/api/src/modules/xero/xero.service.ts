import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Invoice, XeroClient } from "xero-node";
import { PrismaService } from "../../prisma/prisma.service";

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
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
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
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Xero contact sync failed for client ${clientId}: ${message}`);
      await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType: "Client",
          entityId: clientId,
          status: "failed",
          errorText: message.slice(0, 1000),
          triggeredBy: userId
        }
      });
      throw new BadRequestException(`Xero sync failed: ${message}`);
    }
  }

  async syncAllContacts(userId: string) {
    const clients = await this.prisma.client.findMany({
      where: { isActive: true },
      select: { id: true }
    });
    const results: Array<{ clientId: string; status: string; error?: string }> = [];
    for (const c of clients) {
      try {
        await this.syncContact(c.id, userId);
        results.push({ clientId: c.id, status: "success" });
      } catch (err) {
        results.push({
          clientId: c.id,
          status: "failed",
          error: err instanceof Error ? err.message : String(err)
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
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Xero invoice push failed for claim ${progressClaimId}: ${message}`);
      await this.prisma.xeroSyncLog.create({
        data: {
          direction: "push",
          entityType: "ProgressClaim",
          entityId: progressClaimId,
          status: "failed",
          errorText: message.slice(0, 1000),
          triggeredBy: userId
        }
      });
      throw new BadRequestException(`Xero invoice push failed: ${message}`);
    }
  }

  async listSyncLogs(limit = 50) {
    return this.prisma.xeroSyncLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, limit))
    });
  }
}
