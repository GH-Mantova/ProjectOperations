import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";

const SINGLETON_ID = "singleton";
const DELIVERY_METHODS = ["both", "email", "inapp"] as const;

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService
  ) {}

  async listTriggers() {
    return this.prisma.notificationTriggerConfig.findMany({
      orderBy: [{ isEnabled: "desc" }, { label: "asc" }]
    });
  }

  async updateTrigger(
    trigger: string,
    dto: {
      isEnabled?: boolean;
      deliveryMethod?: string;
      recipientRoles?: string[];
      recipientUserIds?: string[];
    }
  ) {
    const existing = await this.prisma.notificationTriggerConfig.findUnique({ where: { trigger } });
    if (!existing) throw new NotFoundException(`Trigger "${trigger}" is not in the catalogue.`);
    if (dto.deliveryMethod && !(DELIVERY_METHODS as readonly string[]).includes(dto.deliveryMethod)) {
      throw new BadRequestException(`deliveryMethod must be one of ${DELIVERY_METHODS.join(", ")}.`);
    }
    return this.prisma.notificationTriggerConfig.update({
      where: { trigger },
      data: {
        isEnabled: dto.isEnabled,
        deliveryMethod: dto.deliveryMethod,
        recipientRoles: dto.recipientRoles,
        recipientUserIds: dto.recipientUserIds
      }
    });
  }

  async getEmailConfig() {
    const existing = await this.prisma.emailProviderConfig.findUnique({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    return this.prisma.emailProviderConfig.create({
      data: { id: SINGLETON_ID }
    });
  }

  async updateEmailConfig(
    actorId: string,
    dto: { provider?: string; senderAddress?: string; senderName?: string }
  ) {
    const cleaned = {
      provider: dto.provider?.trim() || undefined,
      senderAddress: dto.senderAddress?.trim() || undefined,
      senderName: dto.senderName?.trim() || undefined
    };
    if (cleaned.provider && !["outlook", "gmail"].includes(cleaned.provider)) {
      throw new BadRequestException('provider must be "outlook" or "gmail".');
    }
    return this.prisma.emailProviderConfig.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        ...cleaned,
        updatedById: actorId
      },
      update: {
        ...cleaned,
        updatedById: actorId
      }
    });
  }

  async testEmailConnection() {
    return this.email.verifyConnection();
  }

  async listUsersForRecipientPicker() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      include: {
        userRoles: { include: { role: { select: { name: true } } } }
      },
      orderBy: { firstName: "asc" }
    });
    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: { name: u.userRoles[0]?.role?.name ?? "Member" }
    }));
  }
}
