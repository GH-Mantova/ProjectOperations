import { NotFoundException } from "@nestjs/common";
import { ConversationsService } from "../conversations.service";

type AnyMock = jest.Mock;

function buildPrismaMock() {
  // Mocks typed as () => Promise<unknown> so mockResolvedValueOnce(any) is
  // accepted at the type level. jest's default inference would lock the
  // return type to whatever the initial async fn returns (e.g. Promise<null>),
  // which then rejects later overrides like mockResolvedValueOnce({id: ...}).
  type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;
  const conversationCreate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return {
      id: "conv-new",
      userId: data.userId,
      personaSlug: data.personaSlug,
      subMode: data.subMode,
      contextKey: data.contextKey ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });
  const conversationFindFirst: AsyncMock = jest.fn(async () => null);
  const conversationFindUnique: AsyncMock = jest.fn(async () => null);
  const conversationFindMany: AsyncMock = jest.fn(async () => [] as unknown[]);
  const conversationUpdate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return { id: "conv-1", ...data };
  });
  const conversationDelete: AsyncMock = jest.fn(async () => ({}));
  const conversationMessageCreate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return { id: "msg-new", ...data, createdAt: new Date() };
  });
  const conversationMessageFindMany: AsyncMock = jest.fn(async () => [] as unknown[]);

  const prisma = {
    conversation: {
      create: conversationCreate,
      findFirst: conversationFindFirst,
      findUnique: conversationFindUnique,
      findMany: conversationFindMany,
      update: conversationUpdate,
      delete: conversationDelete
    },
    conversationMessage: {
      create: conversationMessageCreate,
      findMany: conversationMessageFindMany
    }
  };
  return { prisma, mocks: {
    conversationCreate, conversationFindFirst, conversationFindUnique,
    conversationFindMany, conversationUpdate, conversationDelete,
    conversationMessageCreate, conversationMessageFindMany
  } };
}

describe("ConversationsService", () => {
  describe("findOrCreateActiveConversation", () => {
    it("returns the existing conversation when one exists for the scope", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const existing = { id: "conv-existing", userId: "u-1" };
      mocks.conversationFindFirst.mockResolvedValueOnce(existing);
      const service = new ConversationsService(prisma as never);
      const result = await service.findOrCreateActiveConversation({
        userId: "u-1",
        personaSlug: "tendering",
        subMode: "register",
        contextKey: null
      });
      expect(result).toBe(existing);
      expect(mocks.conversationCreate).not.toHaveBeenCalled();
    });

    it("creates a new conversation when none exists", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new ConversationsService(prisma as never);
      const result = await service.findOrCreateActiveConversation({
        userId: "u-1",
        personaSlug: "tendering",
        subMode: "scope",
        contextKey: "tender-7"
      });
      expect(mocks.conversationCreate).toHaveBeenCalledWith({
        data: {
          userId: "u-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: "tender-7"
        }
      });
      expect(result.id).toBe("conv-new");
    });

    it("isolates by userId — different users get different conversations", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new ConversationsService(prisma as never);
      await service.findOrCreateActiveConversation({
        userId: "u-1",
        personaSlug: "tendering",
        subMode: "register",
        contextKey: null
      });
      const findFirstArgs = mocks.conversationFindFirst.mock.calls[0]?.[0] as {
        where?: Record<string, unknown>;
      };
      expect(findFirstArgs.where?.userId).toBe("u-1");
    });
  });

  describe("startNewConversation", () => {
    it("always creates a new conversation, even if a recent one exists", async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationFindFirst.mockResolvedValueOnce({ id: "conv-existing" });
      const service = new ConversationsService(prisma as never);
      await service.startNewConversation({
        userId: "u-1",
        personaSlug: "tendering",
        subMode: "register",
        contextKey: null
      });
      expect(mocks.conversationCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("listRecentConversations", () => {
    it("orders by updatedAt desc and includes preview from first user message", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const now = new Date();
      mocks.conversationFindMany.mockResolvedValueOnce([
        {
          id: "conv-1",
          userId: "u-1",
          personaSlug: "tendering",
          subMode: "register",
          contextKey: null,
          createdAt: now,
          updatedAt: now,
          messages: [{ content: "What's typical scope for asbestos?" }],
          _count: { messages: 4 }
        }
      ]);
      const service = new ConversationsService(prisma as never);
      const result = await service.listRecentConversations(
        { userId: "u-1", personaSlug: "tendering", subMode: "register", contextKey: null },
        20
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.preview).toBe("What's typical scope for asbestos?");
      expect(result[0]!.messageCount).toBe(4);
      const findManyArgs = mocks.conversationFindMany.mock.calls[0]?.[0] as {
        orderBy?: Record<string, unknown>;
      };
      expect(findManyArgs.orderBy).toEqual({ updatedAt: "desc" });
    });

    it("clamps limit to [1, 100]", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new ConversationsService(prisma as never);
      await service.listRecentConversations(
        { userId: "u-1", personaSlug: "tendering", subMode: "register", contextKey: null },
        500
      );
      const args = mocks.conversationFindMany.mock.calls[0]?.[0] as { take?: number };
      expect(args.take).toBe(100);

      mocks.conversationFindMany.mockClear();
      await service.listRecentConversations(
        { userId: "u-1", personaSlug: "tendering", subMode: "register", contextKey: null },
        0
      );
      const args2 = mocks.conversationFindMany.mock.calls[0]?.[0] as { take?: number };
      expect(args2.take).toBe(1);
    });
  });

  describe("loadConversation", () => {
    it("returns conversation + ordered messages when caller is the owner", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const conv = { id: "conv-1", userId: "u-1" };
      mocks.conversationFindUnique.mockResolvedValueOnce(conv);
      mocks.conversationMessageFindMany.mockResolvedValueOnce([
        { id: "m-1", role: "user", content: "hi" },
        { id: "m-2", role: "assistant", content: "hello" }
      ]);
      const service = new ConversationsService(prisma as never);
      const result = await service.loadConversation("u-1", "conv-1");
      expect(result.conversation).toBe(conv);
      expect(result.messages).toHaveLength(2);
      const args = mocks.conversationMessageFindMany.mock.calls[0]?.[0] as {
        orderBy?: Record<string, unknown>;
      };
      expect(args.orderBy).toEqual({ createdAt: "asc" });
    });

    it("throws NotFoundException when conversation does not exist", async () => {
      const { prisma } = buildPrismaMock();
      const service = new ConversationsService(prisma as never);
      await expect(service.loadConversation("u-1", "missing")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("throws NotFoundException when caller is not the owner (no leakage)", async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationFindUnique.mockResolvedValueOnce({ id: "conv-1", userId: "u-other" });
      const service = new ConversationsService(prisma as never);
      await expect(service.loadConversation("u-1", "conv-1")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe("appendMessage", () => {
    it("creates a message and bumps the parent conversation updatedAt", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new ConversationsService(prisma as never);
      await service.appendMessage("conv-1", "user", "hi", {});
      expect(mocks.conversationMessageCreate).toHaveBeenCalledTimes(1);
      expect(mocks.conversationUpdate).toHaveBeenCalledTimes(1);
      const updateArgs = mocks.conversationUpdate.mock.calls[0]?.[0] as {
        data?: Record<string, unknown>;
      };
      expect(updateArgs.data?.updatedAt).toBeInstanceOf(Date);
    });

    it("persists assistant metadata (model + providerSource)", async () => {
      const { prisma, mocks } = buildPrismaMock();
      const service = new ConversationsService(prisma as never);
      await service.appendMessage("conv-1", "assistant", "ok", {
        model: "claude-sonnet-4-6",
        providerSource: "company"
      });
      const args = mocks.conversationMessageCreate.mock.calls[0]?.[0] as {
        data?: Record<string, unknown>;
      };
      expect(args.data?.model).toBe("claude-sonnet-4-6");
      expect(args.data?.providerSource).toBe("company");
    });
  });

  describe("deleteConversation", () => {
    it("deletes the conversation when caller is the owner (cascade handles messages)", async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationFindUnique.mockResolvedValueOnce({ id: "conv-1", userId: "u-1" });
      const service = new ConversationsService(prisma as never);
      await service.deleteConversation("u-1", "conv-1");
      expect(mocks.conversationDelete).toHaveBeenCalledWith({ where: { id: "conv-1" } });
    });

    it("throws NotFoundException when caller is not the owner", async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationFindUnique.mockResolvedValueOnce({ id: "conv-1", userId: "u-other" });
      const service = new ConversationsService(prisma as never);
      await expect(service.deleteConversation("u-1", "conv-1")).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(mocks.conversationDelete).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when conversation does not exist", async () => {
      const { prisma } = buildPrismaMock();
      const service = new ConversationsService(prisma as never);
      await expect(service.deleteConversation("u-1", "missing")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });
});
