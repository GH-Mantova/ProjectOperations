import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import type { EmailProvider, SendMailInput } from "../email-provider.interface";

/**
 * Outlook/Microsoft 365 email provider. Uses the app-only (client credentials)
 * Graph flow to POST /users/{senderAddress}/sendMail. The service principal
 * must be granted the Mail.Send application permission in Entra ID — without
 * it, sendMail raises with a clear message so the admin UI can surface it.
 */
export class OutlookEmailProvider implements EmailProvider {
  readonly name = "outlook" as const;
  private readonly logger = new Logger(OutlookEmailProvider.name);
  private client: Client | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly senderAddress: string
  ) {}

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
      this.logger.warn(`Outlook sendMail failed: ${wrapped.message}`);
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
    // Reuses the same SHAREPOINT_* credentials; a follow-up can split these
    // into EMAIL_* if the mail-sending app registration diverges from the
    // SharePoint one.
    const tenantId = this.config.get<string>("SHAREPOINT_TENANT_ID");
    const clientId = this.config.get<string>("SHAREPOINT_CLIENT_ID");
    const clientSecret = this.config.get<string>("SHAREPOINT_CLIENT_SECRET");
    if (!tenantId || !clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        "Outlook email requires SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET."
      );
    }
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["https://graph.microsoft.com/.default"]
    });
    this.client = Client.initWithMiddleware({ authProvider });
    return this.client;
  }

  private wrapError(op: string, err: unknown): Error {
    const msg = err instanceof Error ? err.message : String(err);
    // Graph surfaces missing scopes as 403 ErrorAccessDenied / Authorization_RequestDenied;
    // ErrorAccessDenied text often contains "Mail.Send" when that's the gap.
    if (/Mail\.Send/i.test(msg) || /Authorization_RequestDenied/.test(msg)) {
      return new Error(
        "Mail.Send permission required. Ask your M365 administrator to grant the Mail.Send application permission to this app registration."
      );
    }
    return new Error(`Outlook ${op}: ${msg}`);
  }
}
