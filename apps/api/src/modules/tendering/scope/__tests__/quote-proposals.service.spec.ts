import { BadRequestException, NotFoundException } from "@nestjs/common";
import { QuoteProposalsService } from "../quote-proposals.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildPrismaMock(overrides: { quote?: unknown } = {}) {
  const conversationMessageCreate: AsyncMock = jest.fn(async (args: unknown) => ({
    id: "msg-result",
    ...((args as { data?: Record<string, unknown> })?.data ?? {})
  }));
  const conversationMessageFindUnique: AsyncMock = jest.fn(async () => null);
  const conversationMessageUpdate: AsyncMock = jest.fn(async (args: unknown) => ({
    ...((args as { data?: Record<string, unknown> })?.data ?? {})
  }));
  const conversationUpdate: AsyncMock = jest.fn(async () => ({}));
  const quote = (overrides.quote ?? null) as
    | { id: string; tenderId: string; status: string }
    | null;
  const clientQuoteFindUnique: AsyncMock = jest.fn(async () => quote);
  const quoteCostLineAggregate: AsyncMock = jest.fn(async () => ({ _max: { sortOrder: null } }));
  const quoteExclusionAggregate: AsyncMock = jest.fn(async () => ({ _max: { sortOrder: null } }));
  const quoteAssumptionAggregate: AsyncMock = jest.fn(async () => ({ _max: { sortOrder: null } }));
  const quoteCostLineCreate: AsyncMock = jest.fn(async () => ({ id: "cl-1" }));
  const quoteExclusionCreate: AsyncMock = jest.fn(async () => ({ id: "ex-1" }));
  const quoteAssumptionCreate: AsyncMock = jest.fn(async () => ({ id: "as-1" }));
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
    clientQuote: { findUnique: clientQuoteFindUnique },
    quoteCostLine: { aggregate: quoteCostLineAggregate, create: quoteCostLineCreate },
    quoteExclusion: { aggregate: quoteExclusionAggregate, create: quoteExclusionCreate },
    quoteAssumption: { aggregate: quoteAssumptionAggregate, create: quoteAssumptionCreate },
    $transaction
  };
  return {
    prisma,
    mocks: {
      conversationMessageCreate,
      conversationMessageFindUnique,
      conversationMessageUpdate,
      conversationUpdate,
      clientQuoteFindUnique,
      quoteCostLineAggregate,
      quoteExclusionAggregate,
      quoteAssumptionAggregate,
      quoteCostLineCreate,
      quoteExclusionCreate,
      quoteAssumptionCreate,
      $transaction
    }
  };
}

describe("QuoteProposalsService.storeQuoteProposals", () => {
  it("creates tool_call + tool_result rows; tool_result.metadata.toolName discriminator is set", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const service = new QuoteProposalsService(prisma as never);
    await service.storeQuoteProposals("conv-1", "toolu_X", {
      quoteId: "q-1",
      costLines: [{ label: "Demo L2", description: "Internal demolition" }],
      exclusions: [{ text: "Excludes asbestos not noted in register." }]
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
          proposals?: Array<{ status?: string; quoteId?: string; costLines?: unknown[] }>;
        };
      };
    };
    expect(toolCallArgs.data?.role).toBe("tool_call");
    expect(toolCallArgs.data?.metadata?.name).toBe("propose_quote_content");
    expect(toolResultArgs.data?.role).toBe("tool_result");
    expect(toolResultArgs.data?.metadata?.toolName).toBe("propose_quote_content");
    const proposals = toolResultArgs.data?.metadata?.proposals ?? [];
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.status).toBe("pending");
    expect(proposals[0]?.quoteId).toBe("q-1");
    expect(proposals[0]?.costLines).toHaveLength(1);
  });
});

describe("QuoteProposalsService.acceptQuoteProposal", () => {
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
        toolName: "propose_quote_content",
        proposals: overrides.proposals ?? [
          {
            index: 0,
            quoteId: "q-1",
            costLines: [
              { label: "Demo L2", description: "Internal demolition" },
              { label: "Asbestos", description: "ACM ceiling removal", price: 50000 }
            ],
            exclusions: [{ text: "Excludes asbestos not noted in register." }],
            assumptions: [{ text: "Assumes 24/7 access." }],
            status: "pending"
          }
        ]
      }
    };
  }

  it("validates quote belongs to tender + is DRAFT, then creates cost-line + exclusion + assumption rows", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "DRAFT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    let costSerial = 0;
    mocks.quoteCostLineCreate.mockImplementation(async () => ({ id: `cl-${++costSerial}` }));
    const service = new QuoteProposalsService(prisma as never);
    const result = await service.acceptQuoteProposal("u-1", "msg-1", 0);
    expect(result.acceptedCostLineIds).toEqual(["cl-1", "cl-2"]);
    expect(result.acceptedExclusionIds).toEqual(["ex-1"]);
    expect(result.acceptedAssumptionIds).toEqual(["as-1"]);
    expect(mocks.clientQuoteFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.quoteCostLineCreate).toHaveBeenCalledTimes(2);
    expect(mocks.quoteExclusionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.quoteAssumptionCreate).toHaveBeenCalledTimes(1);

    // cost-line without price defaults to 0; with price uses the value.
    const costCalls = mocks.quoteCostLineCreate.mock.calls;
    expect(String((costCalls[0]?.[0] as { data?: { price?: unknown } }).data?.price)).toBe("0");
    expect(String((costCalls[1]?.[0] as { data?: { price?: unknown } }).data?.price)).toBe("50000");

    const updateArgs = (mocks.conversationMessageUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: {
        metadata?: {
          proposals?: Array<{
            status?: string;
            acceptedCostLineIds?: string[];
            acceptedExclusionIds?: string[];
            acceptedAssumptionIds?: string[];
          }>;
        };
      };
    };
    const proposals = updateArgs.data?.metadata?.proposals ?? [];
    expect(proposals[0]?.status).toBe("accepted");
    expect(proposals[0]?.acceptedCostLineIds).toEqual(["cl-1", "cl-2"]);
  });

  it("starts sortOrder after the existing max for each row type (append, not collide)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "DRAFT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    mocks.quoteCostLineAggregate.mockResolvedValueOnce({ _max: { sortOrder: 4 } });
    mocks.quoteExclusionAggregate.mockResolvedValueOnce({ _max: { sortOrder: 2 } });
    mocks.quoteAssumptionAggregate.mockResolvedValueOnce({ _max: { sortOrder: -1 } });
    const service = new QuoteProposalsService(prisma as never);
    await service.acceptQuoteProposal("u-1", "msg-1", 0);
    // First cost-line should be at sortOrder=5 (max+1), second at 6.
    const firstCostCall = mocks.quoteCostLineCreate.mock.calls[0]?.[0] as {
      data?: { sortOrder?: number };
    };
    const secondCostCall = mocks.quoteCostLineCreate.mock.calls[1]?.[0] as {
      data?: { sortOrder?: number };
    };
    expect(firstCostCall.data?.sortOrder).toBe(5);
    expect(secondCostCall.data?.sortOrder).toBe(6);
    // First exclusion sortOrder=3.
    const exclCall = mocks.quoteExclusionCreate.mock.calls[0]?.[0] as {
      data?: { sortOrder?: number };
    };
    expect(exclCall.data?.sortOrder).toBe(3);
    // First assumption sortOrder=0 (max -1 + 1).
    const assumeCall = mocks.quoteAssumptionCreate.mock.calls[0]?.[0] as {
      data?: { sortOrder?: number };
    };
    expect(assumeCall.data?.sortOrder).toBe(0);
  });

  it("404s when the target ClientQuote does not exist", async () => {
    const { prisma, mocks } = buildPrismaMock({ quote: null });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(mocks.quoteCostLineCreate).not.toHaveBeenCalled();
  });

  it("400s when the target ClientQuote belongs to a different tender", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-OTHER", status: "DRAFT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(mocks.quoteCostLineCreate).not.toHaveBeenCalled();
  });

  it("400s when the target ClientQuote is SENT (not DRAFT)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "SENT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(mocks.quoteCostLineCreate).not.toHaveBeenCalled();
  });

  it("400s when the target ClientQuote is SUPERSEDED (not DRAFT)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "SUPERSEDED" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("applies edits (e.g. an added exclusion) before persisting", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "DRAFT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({
        proposals: [
          {
            index: 0,
            quoteId: "q-1",
            costLines: [],
            exclusions: [],
            assumptions: [],
            status: "pending"
          }
        ]
      })
    );
    const service = new QuoteProposalsService(prisma as never);
    await service.acceptQuoteProposal("u-1", "msg-1", 0, {
      exclusions: [{ text: "Late edit clause" }]
    });
    expect(mocks.quoteExclusionCreate).toHaveBeenCalledTimes(1);
    const exclArgs = mocks.quoteExclusionCreate.mock.calls[0]?.[0] as {
      data?: { text?: string };
    };
    expect(exclArgs.data?.text).toBe("Late edit clause");
  });

  it("404s when the caller is not the conversation owner", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "DRAFT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({ userId: "u-other" })
    );
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("400s when the proposal is already accepted", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "DRAFT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({
        proposals: [
          {
            index: 0,
            quoteId: "q-1",
            costLines: [],
            status: "accepted",
            acceptedCostLineIds: ["prev"]
          }
        ]
      })
    );
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("404s when proposal index is out of range", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "DRAFT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 99)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("400s when conversation has no contextKey (no tender)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      quote: { id: "q-1", tenderId: "tender-1", status: "DRAFT" }
    });
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({ tenderId: null })
    );
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects metadata from a non-quote-proposal tool_result (missing toolName)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      // Legacy scope-proposal shape — no toolName field.
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
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects metadata from an estimate-proposal tool_result (wrong toolName)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: {
        toolUseId: "x",
        toolName: "propose_estimate_items",
        proposals: [{ index: 0, code: "DEM", title: "x", status: "pending" }]
      }
    });
    const service = new QuoteProposalsService(prisma as never);
    await expect(service.acceptQuoteProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe("QuoteProposalsService.rejectQuoteProposal", () => {
  it("updates status to rejected without writing to the quote", async () => {
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
    const service = new QuoteProposalsService(prisma as never);
    await service.rejectQuoteProposal("u-1", "msg-1", 0);
    expect(mocks.quoteCostLineCreate).not.toHaveBeenCalled();
    const updateArgs = (mocks.conversationMessageUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { metadata?: { proposals?: Array<{ status?: string }> } };
    };
    expect(updateArgs.data?.metadata?.proposals?.[0]?.status).toBe("rejected");
  });
});

describe("QuoteProposalsService.rejectAllPending", () => {
  it("rejects all pending and skips already-decided proposals", async () => {
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
    const service = new QuoteProposalsService(prisma as never);
    const result = await service.rejectAllPending("u-1", "msg-1");
    expect(result.rejected).toBe(1);
  });
});
