import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(input: CreateNotificationDto, actorId?: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        severity: input.severity,
        linkUrl: input.linkUrl
      }
    });

    await this.auditService.write({
      actorId,
      action: "notifications.create",
      entityType: "Notification",
      entityId: notification.id,
      metadata: { userId: input.userId, severity: input.severity }
    });

    return notification;
  }

  async markRead(notificationId: string, actorId?: string) {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "READ",
        readAt: new Date()
      }
    });

    await this.auditService.write({
      actorId,
      action: "notifications.read",
      entityType: "Notification",
      entityId: notification.id
    });

    return notification;
  }
}
