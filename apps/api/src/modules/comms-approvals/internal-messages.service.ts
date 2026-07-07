import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { InternalMessage } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { SendInternalMessageDto } from "./dto/send-internal-message.dto";

/**
 * Record-anchored internal messages. Reads are gated on ownership — a
 * caller only ever sees messages they sent or received. Writes on
 * ownership too: only the recipient can mark a message read.
 *
 * This is deliberately narrower than CorrespondenceMessage: no external
 * mirror, no thread wrapper, no attachments. It's the "DMs allowed" side
 * of the mailbox from the Phase 2 spec — later slices will layer the
 * mailbox UI over these + Notification + CorrespondenceThread.
 */
@Injectable()
export class InternalMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async send(input: SendInternalMessageDto, senderId: string): Promise<InternalMessage> {
    const recipient = await this.prisma.user.findUnique({
      where: { id: input.recipientId },
      select: { id: true, isActive: true }
    });
    if (!recipient || !recipient.isActive) {
      throw new NotFoundException("Recipient not found or inactive.");
    }

    const created = await this.prisma.internalMessage.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        senderId,
        recipientId: input.recipientId,
        subject: input.subject ?? null,
        body: input.body
      }
    });

    // Every internal message drops a notification into the recipient's
    // in-app inbox — that's what makes the inbox surface aware of DMs
    // without a separate socket. Fan-out is one row per message.
    await this.prisma.notification.create({
      data: {
        userId: input.recipientId,
        title: input.subject
          ? `Message: ${input.subject}`
          : `New message on ${input.entityType}`,
        body: input.body.slice(0, 240),
        severity: "info",
        metadata: {
          kind: "INTERNAL_MESSAGE",
          messageId: created.id,
          entityType: input.entityType,
          entityId: input.entityId,
          senderId
        }
      }
    });

    return created;
  }

  /**
   * Inbox listing for the caller. When `entityType` + `entityId` are
   * provided, returns the thread on that record involving the caller
   * (either side); otherwise returns the caller's received messages,
   * unread-first, newest-first within each bucket.
   */
  async listForCaller(
    userId: string,
    filter?: { entityType?: string; entityId?: string }
  ): Promise<InternalMessage[]> {
    if (filter?.entityType && filter?.entityId) {
      return this.prisma.internalMessage.findMany({
        where: {
          entityType: filter.entityType,
          entityId: filter.entityId,
          OR: [{ senderId: userId }, { recipientId: userId }]
        },
        orderBy: { createdAt: "asc" }
      });
    }

    // status desc puts "UNREAD" before "READ" alphabetically (U > R),
    // giving the unread-first ordering the inbox surface expects.
    return this.prisma.internalMessage.findMany({
      where: { recipientId: userId },
      orderBy: [{ status: "desc" }, { createdAt: "desc" }]
    });
  }

  async markRead(messageId: string, userId: string): Promise<InternalMessage> {
    const existing = await this.prisma.internalMessage.findUnique({
      where: { id: messageId }
    });
    if (!existing) {
      throw new NotFoundException("Internal message not found.");
    }
    if (existing.recipientId !== userId) {
      throw new ForbiddenException("Only the recipient may mark a message read.");
    }
    if (existing.status === "READ") {
      return existing;
    }
    return this.prisma.internalMessage.update({
      where: { id: messageId },
      data: { status: "READ", readAt: new Date() }
    });
  }
}
