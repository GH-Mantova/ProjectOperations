import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CORRESPONDENCE_ADAPTER,
  type CorrespondenceAdapter,
  type CorrespondenceInboundRaw
} from "./correspondence-adapter.interface";
import {
  buildReferenceKey,
  cleanSubject,
  embedReference,
  parseInbound
} from "./reply-matcher";

export type OwnerKind = "client" | "tender" | "job";

export type SendMessageInput = {
  ownerKind: OwnerKind;
  ownerId: string;
  /** Optional existing thread to reply within. */
  threadId?: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
};

@Injectable()
export class CorrespondenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CORRESPONDENCE_ADAPTER) private readonly adapter: CorrespondenceAdapter
  ) {}

  async listForOwner(ownerKind: OwnerKind, ownerId: string) {
    await this.requireOwner(ownerKind, ownerId);
    return this.prisma.correspondenceThread.findMany({
      where: this.ownerWhere(ownerKind, ownerId),
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sentBy: { select: { id: true, firstName: true, lastName: true } } }
        }
      },
      orderBy: { lastMessageAt: "desc" }
    });
  }

  async getThread(threadId: string) {
    const thread = await this.prisma.correspondenceThread.findUnique({
      where: { id: threadId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sentBy: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });
    if (!thread) throw new NotFoundException("Correspondence thread not found.");
    return thread;
  }

  async sendMessage(actorId: string, input: SendMessageInput) {
    if (!input.to || input.to.length === 0) {
      throw new BadRequestException("At least one recipient is required.");
    }
    if (!input.subject?.trim()) throw new BadRequestException("Subject is required.");
    if (!input.bodyText?.trim()) throw new BadRequestException("Message body is required.");

    await this.requireOwner(input.ownerKind, input.ownerId);

    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { email: true }
    });
    const fromAddress = actor?.email ?? "noreply@projectops.local";

    const thread = input.threadId
      ? await this.getThread(input.threadId)
      : await this.prisma.correspondenceThread.create({
          data: {
            ...this.ownerData(input.ownerKind, input.ownerId),
            subject: cleanSubject(input.subject),
            referenceKey: buildReferenceKey(),
            participants: input.to
          }
        });

    const subjectWithRef = embedReference(input.subject, thread.referenceKey);
    const sent = await this.adapter.send({
      to: input.to,
      cc: input.cc,
      subject: subjectWithRef,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      referenceKey: thread.referenceKey
    });

    const message = await this.prisma.correspondenceMessage.create({
      data: {
        threadId: thread.id,
        direction: "outbound",
        fromAddress,
        toAddresses: input.to,
        ccAddresses: input.cc ?? [],
        subject: subjectWithRef,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
        externalId: sent.externalId,
        sentAt: sent.sentAt,
        sentById: actorId
      },
      include: { sentBy: { select: { id: true, firstName: true, lastName: true } } }
    });

    await this.prisma.correspondenceThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: sent.sentAt }
    });

    return { thread, message };
  }

  /**
   * Record an inbound reply by matching its subject's reference token back to
   * an existing thread. Called by the mock simulator today and (in the live
   * follow-up) by the Graph webhook handler.
   */
  async recordInbound(raw: CorrespondenceInboundRaw) {
    const parsed = parseInbound(raw);
    if (!parsed.referenceKey) {
      return { matched: false as const, reason: "no_reference_token" };
    }

    const thread = await this.prisma.correspondenceThread.findUnique({
      where: { referenceKey: parsed.referenceKey }
    });
    if (!thread) return { matched: false as const, reason: "no_thread_for_reference" };

    if (parsed.externalId) {
      const existing = await this.prisma.correspondenceMessage.findUnique({
        where: { externalId: parsed.externalId }
      });
      if (existing) return { matched: true as const, threadId: thread.id, messageId: existing.id, deduplicated: true };
    }

    const receivedAt = parsed.receivedAt ?? new Date();
    const message = await this.prisma.correspondenceMessage.create({
      data: {
        threadId: thread.id,
        direction: "inbound",
        fromAddress: parsed.from,
        toAddresses: parsed.to ?? [],
        ccAddresses: parsed.cc ?? [],
        subject: parsed.subject,
        bodyText: parsed.bodyText,
        bodyHtml: parsed.bodyHtml,
        externalId: parsed.externalId,
        receivedAt
      }
    });
    await this.prisma.correspondenceThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: receivedAt }
    });
    return { matched: true as const, threadId: thread.id, messageId: message.id };
  }

  private ownerWhere(kind: OwnerKind, id: string) {
    if (kind === "client") return { clientId: id };
    if (kind === "tender") return { tenderId: id };
    return { jobId: id };
  }

  private ownerData(kind: OwnerKind, id: string) {
    if (kind === "client") return { clientId: id };
    if (kind === "tender") return { tenderId: id };
    return { jobId: id };
  }

  private async requireOwner(kind: OwnerKind, id: string) {
    if (kind === "client") {
      const row = await this.prisma.client.findUnique({ where: { id }, select: { id: true } });
      if (!row) throw new NotFoundException("Client not found.");
    } else if (kind === "tender") {
      const row = await this.prisma.tender.findUnique({ where: { id }, select: { id: true } });
      if (!row) throw new NotFoundException("Tender not found.");
    } else {
      const row = await this.prisma.job.findUnique({ where: { id }, select: { id: true } });
      if (!row) throw new NotFoundException("Job not found.");
    }
  }
}
