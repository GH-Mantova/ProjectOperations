import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ClientSecretCredential,
  CredentialUnavailableError,
  ManagedIdentityCredential,
  TokenCredential
} from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { sanitiseProviderError } from "../../ai-providers/error-sanitiser";
import type { EmailProvider, SendMailInput } from "../email-provider.interface";
import {
  MailAuthError,
  MailError,
  MailRateLimitError,
  MailServerError,
  MailValidationError,
  categoriseGraphResponse,
  stripAngleBrackets
} from "../mail-errors";

export type MailCreds = {
  tenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  senderUserId: string | null;
};

/**
 * Resolve mail-sending credentials with AZURE_MAIL_* taking precedence over
 * the legacy SHAREPOINT_* names. Existing deployments that only set the
 * SharePoint creds continue to work; new deployments can isolate the mail-
 * sending app registration via the dedicated AZURE_MAIL_* names.
 */
export function resolveMailCreds(env: NodeJS.ProcessEnv): MailCreds {
  return {
    tenantId: env.AZURE_MAIL_TENANT_ID ?? env.SHAREPOINT_TENANT_ID ?? null,
    clientId: env.AZURE_MAIL_CLIENT_ID ?? env.SHAREPOINT_CLIENT_ID ?? null,
    clientSecret: env.AZURE_MAIL_CLIENT_SECRET ?? env.SHAREPOINT_CLIENT_SECRET ?? null,
    senderUserId: env.AZURE_MAIL_SENDER_USER_ID ?? env.AZURE_MAIL_FROM ?? null
  };
}

export type MailAuthMode = "managed-identity" | "client-secret";

// Explicit selection over DefaultAzureCredential's silent fallback chain,
// mirroring SHAREPOINT_AUTH_MODE in graph-sharepoint.adapter.ts (#547).
// Unset → client-secret so existing deployments, local dev and CI keep working.
export function resolveMailAuthMode(config: {
  get: <T = string>(key: string) => T | undefined;
}): MailAuthMode {
  const raw = (config.get<string>("MAIL_AUTH_MODE") ?? "client-secret").trim().toLowerCase();
  if (raw === "managed-identity") return "managed-identity";
  if (raw === "" || raw === "client-secret") return "client-secret";
  throw new ServiceUnavailableException(
    `MAIL_AUTH_MODE must be "managed-identity" or "client-secret" (got "${raw}").`
  );
}

// Module-level so unit tests can exercise both branches; `logOnce` fires once
// per process — pass a no-op in tests via resetMailAuthModeLoggedForTests().
let mailAuthModeLogged = false;
export function resetMailAuthModeLoggedForTests(): void {
  mailAuthModeLogged = false;
}

// Builds the Graph credential for the chosen mode. managed-identity needs no
// secret (production: the App Service system-assigned identity holds Mail.Send);
// a missing IMDS endpoint surfaces an honest error naming MAIL_AUTH_MODE, and
// the client-secret branch names the EXACT missing env var — per sot/01 §6
// (failure honesty), so a misconfigured mailer can never fail silently again.
export function buildMailCredential(
  mode: MailAuthMode,
  config: { get: <T = string>(key: string) => T | undefined },
  logOnce: (line: string) => void
): TokenCredential {
  if (mode === "managed-identity") {
    const userAssignedClientId = config.get<string>("AZURE_MANAGED_IDENTITY_CLIENT_ID");
    const base = userAssignedClientId
      ? new ManagedIdentityCredential({ clientId: userAssignedClientId })
      : new ManagedIdentityCredential();

    if (!mailAuthModeLogged) {
      logOnce(
        `Outlook mail Graph auth: managed-identity (${userAssignedClientId ? `user-assigned clientId=${userAssignedClientId}` : "system-assigned"})`
      );
      mailAuthModeLogged = true;
    }

    return {
      async getToken(scopes, options) {
        try {
          return await base.getToken(scopes, options);
        } catch (err) {
          if (err instanceof CredentialUnavailableError) {
            throw new ServiceUnavailableException(
              `MAIL_AUTH_MODE=managed-identity but no managed identity is available in this environment. Managed identity only works when the API runs on an Azure host (App Service / Container Apps / VM) with an identity assigned. For local development or CI, set MAIL_AUTH_MODE=client-secret. Underlying error: ${err.message}`
            );
          }
          throw err;
        }
      }
    };
  }

  const creds = resolveMailCreds(process.env);
  const tenantId = creds.tenantId ?? config.get<string>("SHAREPOINT_TENANT_ID") ?? null;
  const clientId = creds.clientId ?? config.get<string>("SHAREPOINT_CLIENT_ID") ?? null;
  const clientSecret = creds.clientSecret ?? config.get<string>("SHAREPOINT_CLIENT_SECRET") ?? null;

  if (!tenantId || !clientId || !clientSecret) {
    const missing: string[] = [];
    if (!tenantId) missing.push("AZURE_MAIL_TENANT_ID (or SHAREPOINT_TENANT_ID)");
    if (!clientId) missing.push("AZURE_MAIL_CLIENT_ID (or SHAREPOINT_CLIENT_ID)");
    if (!clientSecret) missing.push("AZURE_MAIL_CLIENT_SECRET (or SHAREPOINT_CLIENT_SECRET)");
    throw new ServiceUnavailableException(
      `Outlook email (MAIL_AUTH_MODE=client-secret) is missing required env var(s): ${missing.join(", ")}. On Azure set MAIL_AUTH_MODE=managed-identity instead — no secret is needed.`
    );
  }

  if (!mailAuthModeLogged) {
    logOnce(`Outlook mail Graph auth: client-secret (clientId=${clientId})`);
    mailAuthModeLogged = true;
  }

  return new ClientSecretCredential(tenantId, clientId, clientSecret);
}

/**
 * Outlook/Microsoft 365 email provider. Uses the app-only Graph flow to POST
 * /users/{senderAddress}/sendMail. Auth is selected by MAIL_AUTH_MODE
 * (managed-identity | client-secret). The identity must hold the Mail.Send
 * application permission in Entra ID — without it, sendMail raises with a clear
 * message so the admin UI can surface it.
 */
export class OutlookEmailProvider implements EmailProvider {
  readonly name = "outlook" as const;
  private readonly logger = new Logger(OutlookEmailProvider.name);
  private client: Client | null;

  constructor(
    private readonly config: ConfigService,
    private readonly senderAddress: string,
    preBuiltClient?: Client
  ) {
    this.client = preBuiltClient ?? null;
  }

  async sendMail(input: SendMailInput): Promise<void> {
    const client = this.getClient();
    const message: Record<string, unknown> = {
      message: {
        subject: input.subject,
        body: { contentType: "HTML", content: input.html || input.text || "" },
        toRecipients: input.to.map((addr) => ({ emailAddress: { address: addr } })),
        ...(input.cc && input.cc.length > 0
          ? { ccRecipients: input.cc.map((addr) => ({ emailAddress: { address: addr } })) }
          : {}),
        // Microsoft Graph expects each attachment as @odata.type fileAttachment
        // with contentBytes as base64. File size limit on a single sendMail
        // request is 4 MB — we don't check here because the caller controls
        // attachment size and Graph will surface the limit as a 413 directly.
        ...(input.attachments && input.attachments.length > 0
          ? {
              attachments: input.attachments.map((a) => ({
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: a.filename,
                contentType: a.contentType,
                contentBytes: a.content
              }))
            }
          : {})
      },
      saveToSentItems: true
    };
    try {
      await client.api(`/users/${encodeURIComponent(this.senderAddress)}/sendMail`).post(message);
    } catch (err) {
      const wrapped = this.wrapError("sendMail", err);
      this.logger.warn(`Outlook sendMail failed [${wrapped.category}]: ${wrapped.message}`);
      throw wrapped;
    }
  }

  async verifyConnection(): Promise<{ message: string }> {
    const client = this.getClient();
    try {
      // Cheap whoami — GET /users/{sender} confirms both the token and that
      // the mailbox exists. Mail.Send itself is surfaced via the Graph error
      // code if it is missing when we try to send.
      await client.api(`/users/${encodeURIComponent(this.senderAddress)}`).select("id,mail").get();
      return { message: "Email connection verified" };
    } catch (err) {
      throw this.wrapError("verifyConnection", err);
    }
  }

  private getClient(): Client {
    if (this.client) return this.client;
    // Mode selects the credential: managed-identity (prod, no secret) or
    // client-secret (local/CI). Both throw an honest, specific error when
    // unconfigured — see buildMailCredential.
    const mode = resolveMailAuthMode(this.config);
    const credential = buildMailCredential(mode, this.config, (line) => this.logger.log(line));
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["https://graph.microsoft.com/.default"]
    });
    this.client = Client.initWithMiddleware({ authProvider });
    return this.client;
  }

  private wrapError(op: string, err: unknown): MailError {
    // Defence-in-depth: truncate via sanitiseProviderError (cap 1000 chars)
    // then strip angle brackets so an upstream HTML body can't leak through to
    // downstream logs/UIs that render the error message. Character-level
    // stripping (not tag-matching) — see stripAngleBrackets in mail-errors.ts.
    const sanitised = sanitiseProviderError(err);
    const safeText = stripAngleBrackets(sanitised.logMessage).slice(0, 500);
    const rawMessage = err instanceof Error ? err.message : String(err);
    const status = extractStatus(err);

    // Preserve the existing well-known message for the Mail.Send scope gap
    // so admins seeing this error get a clear remediation path.
    if (/Mail\.Send/i.test(rawMessage) || /Authorization_RequestDenied/i.test(rawMessage)) {
      return new MailAuthError(
        "Mail.Send permission required. Ask your M365 administrator to grant the Mail.Send application permission to this app registration.",
        status
      );
    }

    if (status !== undefined) {
      const category = categoriseGraphResponse(status);
      const baseMessage = `Outlook ${op} (${status}): ${safeText}`;
      switch (category) {
        case "auth":
          return new MailAuthError(baseMessage, status);
        case "rate-limit":
          return new MailRateLimitError(baseMessage, status, extractRetryAfter(err));
        case "validation":
          return new MailValidationError(baseMessage, status);
        case "server":
          return new MailServerError(baseMessage, status);
        default:
          return new MailError(baseMessage, "unknown", status);
      }
    }

    if (isNetworkError(err)) {
      return new MailError(`Outlook ${op}: ${safeText}`, "network");
    }
    return new MailError(`Outlook ${op}: ${safeText}`, "unknown");
  }
}

function extractStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const obj = err as { statusCode?: unknown; status?: unknown };
  const raw = obj.statusCode ?? obj.status;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function extractRetryAfter(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const obj = err as {
    retryAfter?: unknown;
    headers?: { get?: (k: string) => string | null } & Record<string, unknown>;
  };
  if (typeof obj.retryAfter === "number" && Number.isFinite(obj.retryAfter)) return obj.retryAfter;
  if (typeof obj.retryAfter === "string") {
    const n = Number.parseInt(obj.retryAfter, 10);
    if (!Number.isNaN(n)) return n;
  }
  const headers = obj.headers;
  if (headers) {
    const fromGetter = typeof headers.get === "function" ? headers.get("retry-after") : null;
    const fromBag = headers["retry-after"] ?? headers["Retry-After"];
    const raw = fromGetter ?? fromBag;
    if (typeof raw === "string") {
      const n = Number.parseInt(raw, 10);
      if (!Number.isNaN(n)) return n;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return undefined;
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /econnrefused|enotfound|etimedout|fetch failed|network/i.test(err.message);
}
