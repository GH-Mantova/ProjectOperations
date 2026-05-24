import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EstimateProposalsService } from "../estimate-proposals.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildPrismaMock(overrides: { estimate?: unknown } = {}) {
  const conversationMessageCreate: AsyncMock = jest.fn(async (args: unknown) => ({
    id: "msg-result",
    ...((args as { data?: Record<string, unknown> })?.data ?? {})
  }));
  const conversationMessageFindUnique: AsyncMock = jest.fn(async () => null);
  const conversationMessageUpdate: AsyncMock = jest.fn(async (args: unknown) => ({
    ...((args as { data?: Record<string, unknown> })?.data ?? {})
  }));
  const conversationUpdate: AsyncMock = jest.fn(async () => ({}));
  const estimate = (overrides.estimate ?? null) as
    | { id: string; lockedAt: Date | null }
    | null;
  const tenderEstimateFindUnique: AsyncMock = jest.fn(async () => estimate);
  const tenderEstimateCreate: AsyncMock = jest.fn(async () => ({
    id: "est-1",
    lockedAt: null
  }));
  const estimateItemCount: AsyncMock = jest.fn(async () => 0);
  const estimateItemCreate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<
      string,
      unknown
    >;
    return { id: "item-1", ...data };
  });
  const estimateLabourLineCreate: AsyncMock = jest.fn(async () => ({}));
  const estimatePlantLineCreate: AsyncMock = jest.fn(async () => ({}));
  const estimateCuttingLineCreate: AsyncMock = jest.fn(async () => ({}));
  const estimateWasteLineCreate: AsyncMock = jest.fn(async () => ({}));
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
    tenderEstimate: {
      findUnique: tenderEstimateFindUnique,
      create: tenderEstimateCreate
    },
    estimateItem: {
      count: estimateItemCount,
      create: estimateItemCreate
    },
    estimateLabourLine: { create: estimateLabourLineCreate },
    estimatePlantLine: { create: estimatePlantLineCreate },
    estimateCuttingLine: { create: estimateCuttingLineCreate },
    estimateWasteLine: { create: estimateWasteLineCreate },
    $transaction
  };
  return {
    prisma,
    mocks: {
      conversationMessageCreate,
      conversationMessageFindUnique,
      conversationMessageUpdate,
      conversationUpdate,
      tenderEstimateFindUnique,
      tenderEstimateCreate,
      estimateItemCount,
      estimateItemCreate,
      estimateLabourLineCreate,
      estimatePlantLineCreate,
      estimateCuttingLineCreate,
      estimateWasteLineCreate,
      $transaction
    }
  };
}

describe("EstimateProposalsService.storeEstimateProposals", () => {
  it("creates tool_call + tool_result rows in a transaction; tool_result.metadata includes toolName discriminator", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const service = new EstimateProposalsService(prisma as never);
    await service.storeEstimateProposals("conv-1", "toolu_X", {
      proposals: [
        {
          code: "DEM",
          title: "Internal demo L2",
          description: "Strip-out + structural",
          labourLines: [
            { role: "Demolition labourer", qty: 4, days: 5, shift: "Day", rate: 72.5 }
          ]
        },
        { code: "ASB", title: "ACM ceiling removal" }
      ]
    });
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.conversationMessageCreate).toHaveBeenCalledTimes(2);
    const toolCallArgs = (mocks.conversationMessageCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { role?: string; metadata?: { name?: string } };
    };
    const toolResultArgs = (mocks.conversationMessageCreate.mock.calls[1]?.[0] ?? {}) as {
      data?: {
        role?: string;
        metadata?: {
          toolName?: string;
          proposals?: Array<{ status?: string; labourLines?: unknown[] }>;
        };
      };
    };
    expect(toolCallArgs.data?.role).toBe("tool_call");
    expect(toolCallArgs.data?.metadata?.name).toBe("propose_estimate_items");
    expect(toolResultArgs.data?.role).toBe("tool_result");
    expect(toolResultArgs.data?.metadata?.toolName).toBe("propose_estimate_items");
    const proposals = toolResultArgs.data?.metadata?.proposals ?? [];
    expect(proposals).toHaveLength(2);
    expect(proposals.every((p) => p.status === "pending")).toBe(true);
    // Cost lines preserved through the store.
    expect(proposals[0]?.labourLines).toHaveLength(1);
  });
});

describe("EstimateProposalsService.acceptEstimateProposal", () => {
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
        toolName: "propose_estimate_items",
        proposals: overrides.proposals ?? [
          {
            index: 0,
            code: "DEM",
            title: "Internal demo L2",
            description: "Strip-out + structural",
            markup: 30,
            isProvisional: false,
            labourLines: [
              { role: "Demolition labourer", qty: 4, days: 5, shift: "Day", rate: 72.5 }
            ],
            plantLines: [
              { plantItem: "13T excavator", qty: 1, days: 5, rate: 950 }
            ],
            cuttingLines: [],
            wasteLines: [],
            status: "pending"
          }
        ]
      }
    };
  }

  it("get-or-creates the TenderEstimate, creates an EstimateItem + cost lines, marks proposal accepted", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new EstimateProposalsService(prisma as never);
    const result = await service.acceptEstimateProposal("u-1", "msg-1", 0);
    expect(result.estimateItemId).toBe("item-1");
    // GET-OR-CREATE — no estimate seeded means create was called.
    expect(mocks.tenderEstimateFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.tenderEstimateCreate).toHaveBeenCalledTimes(1);
    expect(mocks.estimateItemCreate).toHaveBeenCalledTimes(1);
    expect(mocks.estimateLabourLineCreate).toHaveBeenCalledTimes(1);
    expect(mocks.estimatePlantLineCreate).toHaveBeenCalledTimes(1);
    expect(mocks.estimateCuttingLineCreate).not.toHaveBeenCalled();
    expect(mocks.estimateWasteLineCreate).not.toHaveBeenCalled();

    // Proposal flipped to accepted with the new EstimateItem id.
    const updateArgs = (mocks.conversationMessageUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: {
        metadata?: {
          proposals?: Array<{ status?: string; acceptedEstimateItemId?: string }>;
        };
      };
    };
    const proposals = updateArgs.data?.metadata?.proposals ?? [];
    expect(proposals[0]?.status).toBe("accepted");
    expect(proposals[0]?.acceptedEstimateItemId).toBe("item-1");
  });

  it("re-uses an existing TenderEstimate when one exists (idempotent get-or-create)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      estimate: { id: "est-existing", lockedAt: null }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new EstimateProposalsService(prisma as never);
    await service.acceptEstimateProposal("u-1", "msg-1", 0);
    expect(mocks.tenderEstimateFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.tenderEstimateCreate).not.toHaveBeenCalled();
    const createArgs = (mocks.estimateItemCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { estimateId?: string };
    };
    expect(createArgs.data?.estimateId).toBe("est-existing");
  });

  it("400s when the estimate is locked", async () => {
    const { prisma, mocks } = buildPrismaMock({
      estimate: { id: "est-locked", lockedAt: new Date("2026-05-20T00:00:00Z") }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new EstimateProposalsService(prisma as never);
    await expect(service.acceptEstimateProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(mocks.estimateItemCreate).not.toHaveBeenCalled();
  });

  it("applies edits before persisting the estimate item", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new EstimateProposalsService(prisma as never);
    await service.acceptEstimateProposal("u-1", "msg-1", 0, { title: "Edited title", markup: 40 });
    const createArgs = (mocks.estimateItemCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { title?: string; markup?: unknown };
    };
    expect(createArgs.data?.title).toBe("Edited title");
    // markup is a Prisma.Decimal; toString check is the cleanest way.
    expect(String(createArgs.data?.markup)).toBe("40");
  });

  it("404s when caller is not the conversation owner", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({ userId: "u-other" })
    );
    const service = new EstimateProposalsService(prisma as never);
    await expect(service.acceptEstimateProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("400s when proposal index is already accepted (idempotency)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({
        proposals: [
          {
            index: 0,
            code: "DEM",
            title: "x",
            status: "accepted",
            acceptedEstimateItemId: "prev"
          }
        ]
      })
    );
    const service = new EstimateProposalsService(prisma as never);
    await expect(service.acceptEstimateProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("404s when proposal index is out of range", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new EstimateProposalsService(prisma as never);
    await expect(service.acceptEstimateProposal("u-1", "msg-1", 99)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("400s when conversation has no contextKey (no tender)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({ tenderId: null })
    );
    const service = new EstimateProposalsService(prisma as never);
    await expect(service.acceptEstimateProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects metadata from a non-estimate-proposal tool_result (missing toolName)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      // Legacy scope-proposals shape — no toolName field.
      metadata: {
        toolUseId: "x",
        proposals: [
          { index: 0, discipline: "DEM", title: "x", description: "y", quantity: 1, unit: "ea", status: "pending" }
        ]
      }
    });
    const service = new EstimateProposalsService(prisma as never);
    await expect(service.acceptEstimateProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe("EstimateProposalsService.rejectEstimateProposal", () => {
  it("updates status to rejected without writing to estimate_items", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: {
        toolUseId: "x",
        toolName: "propose_estimate_items",
        proposals: [
          { index: 0, code: "DEM", title: "x", status: "pending" }
        ]
      }
    });
    const service = new EstimateProposalsService(prisma as never);
    await service.rejectEstimateProposal("u-1", "msg-1", 0);
    expect(mocks.estimateItemCreate).not.toHaveBeenCalled();
    const updateArgs = (mocks.conversationMessageUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { metadata?: { proposals?: Array<{ status?: string }> } };
    };
    expect(updateArgs.data?.metadata?.proposals?.[0]?.status).toBe("rejected");
  });
});

describe("EstimateProposalsService.acceptAllPending", () => {
  it("iterates pending proposals and reports {accepted, failed}", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const proposals = [
      { index: 0, code: "DEM", title: "x", status: "pending" },
      { index: 1, code: "ASB", title: "x", status: "pending" },
      {
        index: 2,
        code: "CIV",
        title: "x",
        status: "accepted",
        acceptedEstimateItemId: "prev"
      }
    ];
    mocks.conversationMessageFindUnique.mockImplementation(async () => ({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: { toolUseId: "x", toolName: "propose_estimate_items", proposals }
    }));
    const service = new EstimateProposalsService(prisma as never);
    const result = await service.acceptAllPending("u-1", "msg-1");
    expect(result.accepted).toBe(2);
    expect(result.failed).toBe(0);
    expect(mocks.estimateItemCreate).toHaveBeenCalledTimes(2);
  });
});

describe("EstimateProposalsService.rejectAllPending", () => {
  it("rejects all pending in a single update and skips already-decided proposals", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: {
        toolUseId: "x",
        toolName: "propose_estimate_items",
        proposals: [
          { index: 0, code: "DEM", title: "x", status: "pending" },
          { index: 1, code: "DEM", title: "x", status: "accepted" }
        ]
      }
    });
    const service = new EstimateProposalsService(prisma as never);
    const result = await service.rejectAllPending("u-1", "msg-1");
    expect(result.rejected).toBe(1);
    const updateArgs = (mocks.conversationMessageUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { metadata?: { proposals?: Array<{ status?: string }> } };
    };
    const proposals = updateArgs.data?.metadata?.proposals ?? [];
    expect(proposals[0]?.status).toBe("rejected");
    expect(proposals[1]?.status).toBe("accepted");
  });
});
