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

  /**
   * Get the operations settings singleton. Creates the row on first
   * access with all fields NULL so the UI's GET always resolves.
   * Mirrors getEmailConfig() — same singleton pattern (id = "singleton").
   */
  async getOperationsSettings() {
    const existing = await this.prisma.operationsSettings.findUnique({
      where: { id: SINGLETON_ID }
    });
    if (existing) return existing;
    return this.prisma.operationsSettings.create({
      data: { id: SINGLETON_ID }
    });
  }

  /**
   * Update the operations settings singleton. All fields are optional and
   * nullable — pass `null` to clear a value, omit to leave unchanged. When
   * fuelPricePerLitre is updated, fuelPriceFetchedAt is stamped to `now()`
   * unless the caller supplied one (T-2 will pass the feed timestamp).
   */
  async updateOperationsSettings(
    actorId: string,
    dto: {
      fuelPricePerLitre?: number | null;
      fuelPriceSource?: string | null;
      fuelPriceFetchedAt?: string | null;
      travelRatePerKm?: number | null;
    }
  ) {
    if (dto.fuelPricePerLitre != null && dto.fuelPricePerLitre < 0) {
      throw new BadRequestException("fuelPricePerLitre must be >= 0.");
    }
    if (dto.travelRatePerKm != null && dto.travelRatePerKm < 0) {
      throw new BadRequestException("travelRatePerKm must be >= 0.");
    }
    const data: {
      fuelPricePerLitre?: number | null;
      fuelPriceSource?: string | null;
      fuelPriceFetchedAt?: Date | null;
      travelRatePerKm?: number | null;
      updatedById: string;
    } = { updatedById: actorId };
    if (dto.fuelPricePerLitre !== undefined) {
      data.fuelPricePerLitre = dto.fuelPricePerLitre;
      if (dto.fuelPriceFetchedAt === undefined && dto.fuelPricePerLitre != null) {
        data.fuelPriceFetchedAt = new Date();
      }
    }
    if (dto.fuelPriceSource !== undefined) data.fuelPriceSource = dto.fuelPriceSource?.trim() || null;
    if (dto.fuelPriceFetchedAt !== undefined) {
      data.fuelPriceFetchedAt = dto.fuelPriceFetchedAt ? new Date(dto.fuelPriceFetchedAt) : null;
    }
    if (dto.travelRatePerKm !== undefined) data.travelRatePerKm = dto.travelRatePerKm;

    return this.prisma.operationsSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        ...data
      },
      update: data
    });
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
