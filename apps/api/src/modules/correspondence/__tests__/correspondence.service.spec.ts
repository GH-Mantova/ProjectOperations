import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CorrespondenceService } from "../correspondence.service";
import { MockCorrespondenceAdapter } from "../adapters/mock-correspondence.adapter";

function threadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "thread-1",
    clientId: null,
    tenderId: "tender-1",
    jobId: null,
    subject: "Quote follow-up",
    referenceKey: "abc123ref",
    participants: ["client@example.com"],
    lastMessageAt: new Date("2026-06-15T00:00:00.000Z"),
    createdAt: new Date("2026-06-15T00:00:00.000Z"),
    updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    ...overrides
  };
}

function buildService(extraPrisma: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
    client: { findUnique: jest.fn().mockResolvedValue({ id: "client-1" }) },
    job: { findUnique: jest.fn().mockResolvedValue({ id: "job-1" }) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: "marco@initialservices.net" })
    },
    correspondenceThread: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(threadRow()),
      update: jest.fn().mockResolvedValue(threadRow())
    },
    correspondenceMessage: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "msg-1", ...data })
      )
    },
    ...extraPrisma
  };
  const adapter = new MockCorrespondenceAdapter();
  const service = new CorrespondenceService(prisma as never, adapter);
  return { service, prisma, adapter };
}

describe("CorrespondenceService", () => {
  describe("sendMessage", () => {
    it("creates a new thread, embeds the reference token in the subject, and persists the outbound message", async () => {
      const { service, prisma } = buildService();
      const result = await service.sendMessage("user-1", {
        ownerKind: "tender",
        ownerId: "tender-1",
        to: ["client@example.com"],
        subject: "Quote follow-up",
        bodyText: "Please find attached..."
      });
      expect(result.message.subject).toMatch(/\[ref:abc123ref\]/);
      expect(result.message.direction).toBe("outbound");
      expect((prisma.correspondenceThread as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
      expect((prisma.correspondenceMessage as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
      expect((prisma.correspondenceThread as { update: jest.Mock }).update).toHaveBeenCalledTimes(1);
    });

    it("rejects an empty recipient list", async () => {
      const { service } = buildService();
      await expect(
        service.sendMessage("user-1", {
          ownerKind: "tender",
          ownerId: "tender-1",
          to: [],
          subject: "s",
          bodyText: "b"
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws NotFoundException when the owner tender does not exist", async () => {
      const { service } = buildService({
        tender: { findUnique: jest.fn().mockResolvedValue(null) }
      });
      await expect(
        service.sendMessage("user-1", {
          ownerKind: "tender",
          ownerId: "missing",
          to: ["x@example.com"],
          subject: "s",
          bodyText: "b"
        })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("when threadId is supplied, reuses that thread's referenceKey rather than creating a new one", async () => {
      const existing = threadRow({ id: "thread-existing", referenceKey: "existingref" });
      const { service, prisma } = buildService({
        correspondenceThread: {
          findMany: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ ...existing, messages: [] }),
          create: jest.fn(),
          update: jest.fn().mockResolvedValue(existing)
        }
      });
      const result = await service.sendMessage("user-1", {
        ownerKind: "tender",
        ownerId: "tender-1",
        threadId: "thread-existing",
        to: ["client@example.com"],
        subject: "Re: Quote follow-up",
        bodyText: "Thanks"
      });
      expect(result.message.subject).toMatch(/\[ref:existingref\]/);
      expect((prisma.correspondenceThread as { create: jest.Mock }).create).not.toHaveBeenCalled();
    });
  });

  describe("recordInbound", () => {
    it("matches an inbound reply by reference token and creates an inbound message", async () => {
      const { service, prisma } = buildService({
        correspondenceThread: {
          findMany: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(threadRow()),
          create: jest.fn(),
          update: jest.fn().mockResolvedValue(threadRow())
        }
      });
      const result = await service.recordInbound({
        from: "client@example.com",
        subject: "Re: Quote follow-up [ref:abc123ref]",
        bodyText: "Sounds good."
      });
      expect(result.matched).toBe(true);
      const createMock = (prisma.correspondenceMessage as { create: jest.Mock }).create;
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock.mock.calls[0][0].data.direction).toBe("inbound");
    });

    it("returns matched=false when no ref token is present in the subject", async () => {
      const { service, prisma } = buildService();
      const result = await service.recordInbound({
        from: "spam@example.com",
        subject: "Unrelated",
        bodyText: "Hi"
      });
      expect(result).toEqual({ matched: false, reason: "no_reference_token" });
      expect((prisma.correspondenceMessage as { create: jest.Mock }).create).not.toHaveBeenCalled();
    });

    it("returns matched=false when ref token doesn't map to a known thread", async () => {
      const { service } = buildService({
        correspondenceThread: {
          findMany: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          update: jest.fn()
        }
      });
      const result = await service.recordInbound({
        from: "client@example.com",
        subject: "Re: stale [ref:unknownref]",
        bodyText: "Hi"
      });
      expect(result).toEqual({ matched: false, reason: "no_thread_for_reference" });
    });

    it("deduplicates an inbound message that re-arrives with the same externalId", async () => {
      const { service, prisma } = buildService({
        correspondenceThread: {
          findMany: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(threadRow()),
          create: jest.fn(),
          update: jest.fn().mockResolvedValue(threadRow())
        },
        correspondenceMessage: {
          findUnique: jest.fn().mockResolvedValue({ id: "msg-existing" }),
          create: jest.fn()
        }
      });
      const result = await service.recordInbound({
        externalId: "graph-id-1",
        from: "client@example.com",
        subject: "Re: thing [ref:abc123ref]",
        bodyText: "Hi"
      });
      expect(result).toMatchObject({ matched: true, deduplicated: true });
      expect((prisma.correspondenceMessage as { create: jest.Mock }).create).not.toHaveBeenCalled();
    });
  });
});
