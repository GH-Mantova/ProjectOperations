import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import {
  OutlookEmailProvider,
  buildMailCredential,
  resolveMailAuthMode,
  type MailAuthMode
} from "./providers/outlook.provider";
import { GmailEmailProvider } from "./providers/gmail.provider";
import type { EmailProvider } from "./email-provider.interface";
import type { EmailConnectionDiagnosis } from "./email-connection-diagnosis";

export type { EmailConnectionDiagnosis } from "./email-connection-diagnosis";

export type NotificationEmailInput = {
  trigger: string;
  subject: string;
  html: string;
  text: string;
};

const CONFIG_SINGLETON_ID = "singleton";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async resolveProvider(): Promise<EmailProvider> {
    const info = await this.resolveProviderInfo();
    if (info.provider === "gmail") return new GmailEmailProvider();
    return new OutlookEmailProvider(this.config, info.senderAddress);
  }

  private async resolveProviderInfo(): Promise<{
    provider: "outlook" | "gmail";
    senderAddress: string;
  }> {
    const record = await this.prisma.emailProviderConfig.findUnique({
      where: { id: CONFIG_SINGLETON_ID }
    });
    const provider: "outlook" | "gmail" = record?.provider === "gmail" ? "gmail" : "outlook";
    // Fallback chain: EmailProviderConfig.senderAddress → CompanyProfile.primaryEmail
    // → hardcoded. The hardcoded value is only reached if the profile row is
    // missing (i.e. seed hasn't run), which never happens in normal
    // operation.
    let senderAddress = record?.senderAddress ?? null;
    if (!senderAddress) {
      const profile = await this.prisma.companyProfile.findUnique({
        where: { id: "singleton" },
        select: { primaryEmail: true }
      });
      senderAddress = profile?.primaryEmail ?? "marco@initialservices.net";
    }
    return { provider, senderAddress };
  }

  /**
   * Send an email notification for a given trigger. Respects the admin's
   * NotificationTriggerConfig: returns early if disabled or if the trigger
   * is in-app only. Never throws — email failures are logged at warn level
   * so primary write paths (tender submit, worker allocate, etc.) never
   * break because the mail server had a hiccup.
   */
  async sendNotificationEmail(input: NotificationEmailInput): Promise<void> {
    try {
      const trigger = await this.prisma.notificationTriggerConfig.findUnique({
        where: { trigger: input.trigger }
      });
      if (!trigger || !trigger.isEnabled) {
        this.logger.debug(`skipping ${input.trigger} — not enabled`);
        return;
      }
      if (trigger.deliveryMethod === "inapp") {
        this.logger.debug(`skipping ${input.trigger} — in-app only`);
        return;
      }

      const recipients = await this.resolveRecipientEmails(trigger.recipientUserIds, trigger.recipientRoles);
      if (recipients.length === 0) {
        this.logger.debug(`no email recipients for ${input.trigger}`);
        return;
      }

      const provider = await this.resolveProvider();
      await provider.sendMail({
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text
      });
      this.logger.log(`email sent: trigger=${input.trigger} recipients=${recipients.length}`);
    } catch (err) {
      // Defensive catch — email is a side-effect that must never propagate.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`email ${input.trigger} failed: ${msg}`);
    }
  }

  /**
   * Verify the configured email provider can actually reach the mail server
   * and return a structured diagnosis alongside the pass/fail flag. The
   * diagnosis names the resolved auth mode, the sender the provider would use,
   * whether the token credential could be built, and (on failure) a
   * secret-free explanation naming the exact missing env var if applicable.
   *
   * This method NEVER throws — the admin UI expects a 200 with a body it can
   * render. See sot/01 §6 (failure honesty).
   */
  async verifyConnection(): Promise<{
    success: boolean;
    message: string;
    diagnosis: EmailConnectionDiagnosis;
  }> {
    const { provider: providerName, senderAddress } = await this.resolveProviderInfo();

    if (providerName === "gmail") {
      const message = "Gmail provider not yet configured. Coming soon.";
      return {
        success: false,
        message,
        diagnosis: {
          provider: "gmail",
          authMode: null,
          senderAddress,
          credentialResolved: false,
          detail: message
        }
      };
    }

    // Outlook path. Resolve MAIL_AUTH_MODE explicitly so an invalid value
    // surfaces as its own diagnosis category (not a generic connection failure).
    let authMode: MailAuthMode;
    try {
      authMode = resolveMailAuthMode(this.config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: msg,
        diagnosis: {
          provider: "outlook",
          authMode: null,
          senderAddress,
          credentialResolved: false,
          detail: `MAIL_AUTH_MODE could not be resolved: ${msg}`
        }
      };
    }

    // Build the credential up-front so we can report credentialResolved
    // independently of whether the Graph RPC ultimately succeeds. Reuses the
    // service logger so buildMailCredential's once-per-process startup log
    // still fires on the diagnostic path.
    try {
      buildMailCredential(authMode, this.config, (line) => this.logger.log(line));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: msg,
        diagnosis: {
          provider: "outlook",
          authMode,
          senderAddress,
          credentialResolved: false,
          detail: msg
        }
      };
    }

    try {
      const provider = new OutlookEmailProvider(this.config, senderAddress);
      const res = await provider.verifyConnection();
      return {
        success: true,
        message: res.message,
        diagnosis: {
          provider: "outlook",
          authMode,
          senderAddress,
          credentialResolved: true,
          detail: `Verified via ${authMode} against sender ${senderAddress}.`
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: msg,
        diagnosis: {
          provider: "outlook",
          authMode,
          senderAddress,
          credentialResolved: true,
          detail: `Credential built (${authMode}) but the Graph verifyConnection call failed: ${msg}`
        }
      };
    }
  }

  private async resolveRecipientEmails(userIds: string[], roleNames: string[]): Promise<string[]> {
    const emails = new Set<string>();
    if (userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { email: true }
      });
      for (const u of users) emails.add(u.email);
    }
    if (roleNames.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          userRoles: { some: { role: { name: { in: roleNames } } } }
        },
        select: { email: true }
      });
      for (const u of users) emails.add(u.email);
    }
    return Array.from(emails);
  }
}
