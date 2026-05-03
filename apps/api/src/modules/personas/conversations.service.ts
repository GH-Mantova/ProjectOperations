import { Injectable, NotFoundException } from "@nestjs/common";
import type { Conversation, ConversationMessage } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type ConversationScope = {
  userId: string;
  personaSlug: string;
  subMode: string;
  contextKey: string | null;
};

export type ConversationSummary = {
  id: string;
  personaSlug: string;
  subMode: string;
  contextKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  preview: string | null;
};

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns the most-recent conversation for the scope, creating one if
  // none exists. Used by the chat endpoint when the client doesn't supply
  // a conversationId — auto-resume behaviour.
  async findOrCreateActiveConversation(scope: ConversationScope): Promise<Conversation> {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        userId: scope.userId,
        personaSlug: scope.personaSlug,
        subMode: scope.subMode,
        contextKey: scope.contextKey
      },
      orderBy: { updatedAt: "desc" }
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: {
        userId: scope.userId,
        personaSlug: scope.personaSlug,
        subMode: scope.subMode,
        contextKey: scope.contextKey
      }
    });
  }

  async startNewConversation(scope: ConversationScope): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        userId: scope.userId,
        personaSlug: scope.personaSlug,
        subMode: scope.subMode,
        contextKey: scope.contextKey
      }
    });
  }

  async listRecentConversations(
    scope: ConversationScope,
    limit = 20
  ): Promise<ConversationSummary[]> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        userId: scope.userId,
        personaSlug: scope.personaSlug,
        subMode: scope.subMode,
        contextKey: scope.contextKey
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
      include: {
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "asc" },
          take: 1
        },
        _count: { select: { messages: true } }
      }
    });
    return rows.map((row) => ({
      id: row.id,
      personaSlug: row.personaSlug,
      subMode: row.subMode,
      contextKey: row.contextKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messageCount: row._count.messages,
      preview: row.messages[0]?.content.slice(0, 200) ?? null
    }));
  }

  async loadConversation(
    userId: string,
    conversationId: string
  ): Promise<{ conversation: Conversation; messages: ConversationMessage[] }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId }
    });
    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException("Conversation not found.");
    }
    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" }
    });
    return { conversation, messages };
  }

  async appendMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    metadata: { model?: string | null; providerSource?: string | null } = {}
  ): Promise<ConversationMessage> {
    const message = await this.prisma.conversationMessage.create({
      data: {
        conversationId,
        role,
        content,
        model: metadata.model ?? null,
        providerSource: metadata.providerSource ?? null
      }
    });
    // Bump the parent's updatedAt so listRecentConversations orders by
    // recency-of-activity rather than creation time.
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });
    return message;
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId }
    });
    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException("Conversation not found.");
    }
    // Messages cascade-delete via Prisma relation (onDelete: Cascade).
    await this.prisma.conversation.delete({ where: { id: conversationId } });
  }
}
