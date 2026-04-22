import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { OutlookEmailProvider } from "./providers/outlook.provider";
import { GmailEmailProvider } from "./providers/gmail.provider";
import type { EmailProvider } from "./email-provider.interface";

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
    const record = await this.prisma.emailProviderConfig.findUnique({
      where: { id: CONFIG_SINGLETON_ID }
    });
    const providerName = record?.provider ?? "outlook";
    const senderAddress = record?.senderAddress ?? "marco@initialservices.net";
    if (providerName === "gmail") return new GmailEmailProvider();
    return new OutlookEmailProvider(this.config, senderAddress);
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

  async verifyConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const provider = await this.resolveProvider();
      const res = await provider.verifyConnection();
      return { success: true, message: res.message };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
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
