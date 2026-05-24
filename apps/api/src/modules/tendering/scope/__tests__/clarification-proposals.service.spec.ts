import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ClarificationProposalsService } from "../clarification-proposals.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildPrismaMock(overrides: { rfi?: unknown } = {}) {
  const conversationMessageCreate: AsyncMock = jest.fn(async (args: unknown) => ({
    id: "msg-result",
    ...((args as { data?: Record<string, unknown> })?.data ?? {})
  }));
  const conversationMessageFindUnique: AsyncMock = jest.fn(async () => null);
  const conversationMessageUpdate: AsyncMock = jest.fn(async (args: unknown) => ({
    ...((args as { data?: Record<string, unknown> })?.data ?? {})
  }));
  const conversationUpdate: AsyncMock = jest.fn(async () => ({}));
  const rfi = (overrides.rfi ?? null) as
    | { id: string; tenderId: string; response: string | null }
    | null;
  const tenderClarificationFindUnique: AsyncMock = jest.fn(async () => rfi);
  const tenderClarificationCreate: AsyncMock = jest.fn(async () => ({ id: "rfi-new" }));
  const tenderClarificationUpdate: AsyncMock = jest.fn(async () => ({ id: "rfi-existing" }));
  const tenderClarificationNoteCreate: AsyncMock = jest.fn(async () => ({ id: "note-new" }));
  const $transaction: AsyncMock = jest.fn(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    return [];
  });

  const prisma = {
    conversationMessage: {
      create: conversationMessageCreate,
      findUnique: conversationMessageFindUnique,
      update: conversationMessageUpdate
    },
    conversation: { update: conversationUpdate },
    tenderClarification: {
      findUnique: tenderClarificationFindUnique,
      create: tenderClarificationCreate,
      update: tenderClarificationUpdate
    },
    tenderClarificationNote: { create: tenderClarificationNoteCreate },
    $transaction
  };
  return {
    prisma,
    mocks: {
      conversationMessageCreate,
      conversationMessageFindUnique,
      conversationMessageUpdate,
      conversationUpdate,
      tenderClarificationFindUnique,
      tenderClarificationCreate,
      tenderClarificationUpdate,
      tenderClarificationNoteCreate,
      $transaction
    }
  };
}

describe("ClarificationProposalsService.storeClarificationProposals", () => {
  it("creates tool_call + tool_result rows; metadata.toolName discriminator is set", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const service = new ClarificationProposalsService(prisma as never);
    await service.storeClarificationProposals("conv-1", "toolu_X", {
      proposals: [
        { kind: "new_rfi", subject: "Confirm asbestos register coverage" },
        { kind: "new_note", noteType: "call", direction: "received", text: "Brief call with consultant" }
      ]
    });
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.conversationMessageCreate).toHaveBeenCalledTimes(2);
    const toolResultArgs = (mocks.conversationMessageCreate.mock.calls[1]?.[0] ?? {}) as {
      data?: {
        role?: string;
        metadata?: {
          toolName?: string;
          proposals?: Array<{ status?: string; proposal?: { kind?: string } }>;
        };
      };
    };
    expect(toolResultArgs.data?.role).toBe("tool_result");
    expect(toolResultArgs.data?.metadata?.toolName).toBe("propose_clarifications");
    const proposals = toolResultArgs.data?.metadata?.proposals ?? [];
    expect(proposals).toHaveLength(2);
    expect(proposals.every((p) => p.status === "pending")).toBe(true);
    expect(proposals[0]?.proposal?.kind).toBe("new_rfi");
    expect(proposals[1]?.proposal?.kind).toBe("new_note");
  });
});

describe("ClarificationProposalsService.acceptClarificationProposal", () => {
  function existingMessage(
    overrides: Partial<{
      userId: string;
      tenderId: string | null;
      proposals: unknown[];
    }> = {}
  ) {
    return {
      id: "msg-1",
      role: "tool_result",
      conversation: {
        id: "conv-1",
        userId: overrides.userId ?? "u-1",
        contextKey: overrides.tenderId === undefined ? "tender-1" : overrides.tenderId
      },
      metadata: {
        toolUseId: "toolu_X",
        toolName: "propose_clarifications",
        proposals: overrides.proposals ?? [
          {
            index: 0,
            proposal: { kind: "new_rfi", subject: "Confirm scope of demolition on level 2" },
            status: "pending"
          }
        ]
      }
    };
  }

  describe("new_rfi", () => {
    it("creates a TenderClarification row with OPEN status and the supplied subject", async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
      const service = new ClarificationProposalsService(prisma as never);
      const result = await service.acceptClarificationProposal("u-1", "msg-1", 0);
      expect(result).toEqual({ kind: "new_rfi", rfiId: "rfi-new" });
      expect(mocks.tenderClarificationCreate).toHaveBeenCalledTimes(1);
      const args = (mocks.tenderClarificationCreate.mock.calls[0]?.[0] ?? {}) as {
        data?: { tenderId?: string; subject?: string; status?: string; dueDate?: Date | null };
      };
      expect(args.data?.tenderId).toBe("tender-1");
      expect(args.data?.subject).toBe("Confirm scope of demolition on level 2");
      expect(args.data?.status).toBe("OPEN");
      expect(args.data?.dueDate).toBeNull();
    });

    it("parses an ISO dueDate into a Date when supplied", async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(
        existingMessage({
          proposals: [
            {
              index: 0,
              proposal: {
                kind: "new_rfi",
                subject: "Confirm slab depth",
                dueDate: "2026-06-01T00:00:00Z"
              },
              status: "pending"
            }
          ]
        })
      );
      const service = new ClarificationProposalsService(prisma as never);
      await service.acceptClarificationProposal("u-1", "msg-1", 0);
      const args = (mocks.tenderClarificationCreate.mock.calls[0]?.[0] ?? {}) as {
        data?: { dueDate?: Date };
      };
      expect(args.data?.dueDate).toBeInstanceOf(Date);
      expect(args.data?.dueDate?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    });
  });

  describe("new_note", () => {
    it("creates a TenderClarificationNote with the supplied fields + createdById = userId", async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(
        existingMessage({
          proposals: [
            {
              index: 0,
              proposal: {
                kind: "new_note",
                noteType: "email",
                direction: "sent",
                text: "Forwarded asbestos register to consultant.",
                occurredAt: "2026-05-22T10:00:00Z"
              },
              status: "pending"
            }
          ]
        })
      );
      const service = new ClarificationProposalsService(prisma as never);
      const result = await service.acceptClarificationProposal("u-1", "msg-1", 0);
      expect(result).toEqual({ kind: "new_note", noteId: "note-new" });
      expect(mocks.tenderClarificationNoteCreate).toHaveBeenCalledTimes(1);
      const args = (mocks.tenderClarificationNoteCreate.mock.calls[0]?.[0] ?? {}) as {
        data?: {
          tenderId?: string;
          noteType?: string;
          direction?: string;
          text?: string;
          occurredAt?: Date;
          createdById?: string;
        };
      };
      expect(args.data?.tenderId).toBe("tender-1");
      expect(args.data?.noteType).toBe("email");
      expect(args.data?.direction).toBe("sent");
      expect(args.data?.text).toBe("Forwarded asbestos register to consultant.");
      expect(args.data?.createdById).toBe("u-1");
      expect(args.data?.occurredAt?.toISOString()).toBe("2026-05-22T10:00:00.000Z");
    });

    it("defaults occurredAt to now when the AI omits it", async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(
        existingMessage({
          proposals: [
            {
              index: 0,
              proposal: {
                kind: "new_note",
                noteType: "call",
                direction: "received",
                text: "Brief check-in call from PM."
              },
              status: "pending"
            }
          ]
        })
      );
      const before = Date.now();
      const service = new ClarificationProposalsService(prisma as never);
      await service.acceptClarificationProposal("u-1", "msg-1", 0);
      const args = (mocks.tenderClarificationNoteCreate.mock.calls[0]?.[0] ?? {}) as {
        data?: { occurredAt?: Date };
      };
      const occurredAt = args.data?.occurredAt!;
      expect(occurredAt).toBeInstanceOf(Date);
      expect(occurredAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("rfi_response", () => {
    function rfiResponseMessage() {
      return existingMessage({
        proposals: [
          {
            index: 0,
            proposal: {
              kind: "rfi_response",
              rfiId: "rfi-existing",
              response: "Demolition is limited to non-structural walls on level 2 as per drawing A-101."
            },
            status: "pending"
          }
        ]
      });
    }

    it("updates the RFI with response + status=CLOSED when integrity checks pass", async () => {
      const { prisma, mocks } = buildPrismaMock({
        rfi: { id: "rfi-existing", tenderId: "tender-1", response: null }
      });
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(rfiResponseMessage());
      const service = new ClarificationProposalsService(prisma as never);
      const result = await service.acceptClarificationProposal("u-1", "msg-1", 0);
      expect(result).toEqual({ kind: "rfi_response", rfiId: "rfi-existing" });
      expect(mocks.tenderClarificationUpdate).toHaveBeenCalledTimes(1);
      const args = (mocks.tenderClarificationUpdate.mock.calls[0]?.[0] ?? {}) as {
        where?: { id?: string };
        data?: { response?: string; status?: string };
      };
      expect(args.where?.id).toBe("rfi-existing");
      expect(args.data?.response).toContain("non-structural walls");
      expect(args.data?.status).toBe("CLOSED");
    });

    it("404s when the target RFI does not exist", async () => {
      const { prisma, mocks } = buildPrismaMock({ rfi: null });
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(rfiResponseMessage());
      const service = new ClarificationProposalsService(prisma as never);
      await expect(service.acceptClarificationProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(mocks.tenderClarificationUpdate).not.toHaveBeenCalled();
    });

    it("400s when the target RFI belongs to a different tender", async () => {
      const { prisma, mocks } = buildPrismaMock({
        rfi: { id: "rfi-existing", tenderId: "tender-OTHER", response: null }
      });
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(rfiResponseMessage());
      const service = new ClarificationProposalsService(prisma as never);
      await expect(service.acceptClarificationProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(mocks.tenderClarificationUpdate).not.toHaveBeenCalled();
    });

    it("400s when the target RFI already has a response (no double-answer)", async () => {
      const { prisma, mocks } = buildPrismaMock({
        rfi: { id: "rfi-existing", tenderId: "tender-1", response: "Already answered" }
      });
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(rfiResponseMessage());
      const service = new ClarificationProposalsService(prisma as never);
      await expect(service.acceptClarificationProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(mocks.tenderClarificationUpdate).not.toHaveBeenCalled();
    });
  });

  it("applies edits before persisting (new_rfi)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new ClarificationProposalsService(prisma as never);
    await service.acceptClarificationProposal("u-1", "msg-1", 0, {
      subject: "Edited subject"
    });
    const args = (mocks.tenderClarificationCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { subject?: string };
    };
    expect(args.data?.subject).toBe("Edited subject");
  });

  it("404s when caller is not the conversation owner", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({ userId: "u-other" })
    );
    const service = new ClarificationProposalsService(prisma as never);
    await expect(service.acceptClarificationProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("400s when the proposal is already accepted", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({
        proposals: [
          {
            index: 0,
            proposal: { kind: "new_rfi", subject: "x" },
            status: "accepted",
            acceptedRecord: { kind: "new_rfi", rfiId: "prev" }
          }
        ]
      })
    );
    const service = new ClarificationProposalsService(prisma as never);
    await expect(service.acceptClarificationProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("404s when proposal index is out of range", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new ClarificationProposalsService(prisma as never);
    await expect(service.acceptClarificationProposal("u-1", "msg-1", 99)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("400s when conversation has no contextKey (no tender)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({ tenderId: null })
    );
    const service = new ClarificationProposalsService(prisma as never);
    await expect(service.acceptClarificationProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects metadata from a non-clarifications tool_result (missing toolName)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: {
        toolUseId: "x",
        proposals: [
          {
            index: 0,
            discipline: "DEM",
            title: "x",
            description: "y",
            quantity: 1,
            unit: "ea",
            status: "pending"
          }
        ]
      }
    });
    const service = new ClarificationProposalsService(prisma as never);
    await expect(service.acceptClarificationProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects metadata from a quote-proposal tool_result (wrong toolName)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: {
        toolUseId: "x",
        toolName: "propose_quote_content",
        proposals: [{ index: 0, quoteId: "q-1", status: "pending" }]
      }
    });
    const service = new ClarificationProposalsService(prisma as never);
    await expect(service.acceptClarificationProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe("ClarificationProposalsService.rejectClarificationProposal", () => {
  it("updates status to rejected without writing to clarifications", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: {
        toolUseId: "x",
        toolName: "propose_clarifications",
        proposals: [{ index: 0, proposal: { kind: "new_rfi", subject: "x" }, status: "pending" }]
      }
    });
    const service = new ClarificationProposalsService(prisma as never);
    await service.rejectClarificationProposal("u-1", "msg-1", 0);
    expect(mocks.tenderClarificationCreate).not.toHaveBeenCalled();
    expect(mocks.tenderClarificationNoteCreate).not.toHaveBeenCalled();
    const updateArgs = (mocks.conversationMessageUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { metadata?: { proposals?: Array<{ status?: string }> } };
    };
    expect(updateArgs.data?.metadata?.proposals?.[0]?.status).toBe("rejected");
  });
});

describe("ClarificationProposalsService.rejectAllPending", () => {
  it("rejects all pending and skips already-decided proposals", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: {
        toolUseId: "x",
        toolName: "propose_clarifications",
        proposals: [
          { index: 0, proposal: { kind: "new_rfi", subject: "x" }, status: "pending" },
          {
            index: 1,
            proposal: { kind: "new_note", noteType: "call", direction: "sent", text: "y" },
            status: "accepted",
            acceptedRecord: { kind: "new_note", noteId: "n-prev" }
          }
        ]
      }
    });
    const service = new ClarificationProposalsService(prisma as never);
    const result = await service.rejectAllPending("u-1", "msg-1");
    expect(result.rejected).toBe(1);
  });
});
