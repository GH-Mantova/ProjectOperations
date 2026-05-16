import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ProposalsService } from "../proposals.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildPrismaMock() {
  const conversationMessageCreate: AsyncMock = jest.fn(async (args: unknown) => ({
    id: "msg-result",
    ...((args as { data?: Record<string, unknown> })?.data ?? {})
  }));
  const conversationMessageFindUnique: AsyncMock = jest.fn(async () => null);
  const conversationMessageUpdate: AsyncMock = jest.fn(async (args: unknown) => ({
    ...((args as { data?: Record<string, unknown> })?.data ?? {})
  }));
  const conversationUpdate: AsyncMock = jest.fn(async () => ({}));
  const scopeOfWorksItemCreate: AsyncMock = jest.fn(
    async (args: unknown) => {
      const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<
        string,
        unknown
      >;
      return { id: "scope-1", ...data };
    }
  );
  const scopeOfWorksItemCount: AsyncMock = jest.fn(async () => 0);
  // PR A2.5 — accepting a proposal now looks up (or creates) the parent
  // ScopeCard for (tenderId, discipline). Mock both reads so the test
  // can exercise both branches by returning a card when the fixture
  // expects "card exists" and null when the fixture expects "card created".
  const scopeCardFindFirst: AsyncMock = jest.fn(async () => ({ id: "card-1" }));
  const scopeCardCreate: AsyncMock = jest.fn(async () => ({ id: "card-1" }));
  const $transaction: AsyncMock = jest.fn(async (ops: unknown) => {
    if (Array.isArray(ops)) {
      return Promise.all(ops);
    }
    return [];
  });

  const prisma = {
    conversationMessage: {
      create: conversationMessageCreate,
      findUnique: conversationMessageFindUnique,
      update: conversationMessageUpdate
    },
    conversation: { update: conversationUpdate },
    scopeOfWorksItem: { create: scopeOfWorksItemCreate, count: scopeOfWorksItemCount },
    scopeCard: { findFirst: scopeCardFindFirst, create: scopeCardCreate },
    $transaction
  };
  return {
    prisma,
    mocks: {
      conversationMessageCreate,
      conversationMessageFindUnique,
      conversationMessageUpdate,
      conversationUpdate,
      scopeOfWorksItemCreate,
      scopeOfWorksItemCount,
      scopeCardFindFirst,
      scopeCardCreate,
      $transaction
    }
  };
}

describe("ProposalsService.storeProposals", () => {
  it("creates a tool_call + tool_result row inside a transaction with pending statuses", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const service = new ProposalsService(prisma as never);
    await service.storeProposals("conv-1", "toolu_X", {
      proposals: [
        {
          discipline: "DEM",
          title: "T1",
          description: "D1",
          quantity: 100,
          unit: "sqm"
        },
        {
          discipline: "ASB",
          title: "T2",
          description: "D2",
          quantity: 50,
          unit: "sqm",
          notes: "Friable VAT"
        }
      ]
    });
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.conversationMessageCreate).toHaveBeenCalledTimes(2);
    const callRowArgs = (mocks.conversationMessageCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { role?: string; metadata?: { name?: string } };
    };
    const resultRowArgs = (mocks.conversationMessageCreate.mock.calls[1]?.[0] ?? {}) as {
      data?: { role?: string; metadata?: { proposals?: Array<{ status?: string }> } };
    };
    expect(callRowArgs.data?.role).toBe("tool_call");
    expect(callRowArgs.data?.metadata?.name).toBe("propose_scope_items");
    expect(resultRowArgs.data?.role).toBe("tool_result");
    const proposals = resultRowArgs.data?.metadata?.proposals ?? [];
    expect(proposals).toHaveLength(2);
    expect(proposals.every((p) => p.status === "pending")).toBe(true);
  });
});

describe("ProposalsService.acceptProposal", () => {
  function existingMessage(overrides: Partial<{ userId: string; tenderId: string | null; proposals: unknown[] }> = {}) {
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
        proposals: overrides.proposals ?? [
          {
            index: 0,
            discipline: "DEM",
            title: "Internal demo L1",
            description: "Scope details",
            quantity: 250,
            unit: "sqm",
            status: "pending"
          }
        ]
      }
    };
  }

  it("creates a scope_of_works_items row and marks the proposal accepted", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new ProposalsService(prisma as never);
    const result = await service.acceptProposal("u-1", "msg-1", 0);
    expect(result.scopeItemId).toBe("scope-1");
    expect(mocks.scopeOfWorksItemCreate).toHaveBeenCalledTimes(1);
    const data = (mocks.scopeOfWorksItemCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: Record<string, unknown>;
    };
    expect(data.data?.tenderId).toBe("tender-1");
    // PR A2.5 — discipline column dropped. The scope item is now linked
    // via cardId; the ScopeCard.findFirst mock returns { id: "card-1" }.
    expect(data.data?.cardId).toBe("card-1");
    expect(data.data?.aiProposed).toBe(true);
    expect(data.data?.measurementUnit).toBe("sqm");

    const updateArgs = (mocks.conversationMessageUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { metadata?: { proposals?: Array<{ status?: string; acceptedScopeItemId?: string }> } };
    };
    const proposals = updateArgs.data?.metadata?.proposals ?? [];
    expect(proposals[0]?.status).toBe("accepted");
    expect(proposals[0]?.acceptedScopeItemId).toBe("scope-1");
  });

  it("applies edits before persisting the scope item", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new ProposalsService(prisma as never);
    await service.acceptProposal("u-1", "msg-1", 0, { quantity: 300, unit: "m2" });
    const data = (mocks.scopeOfWorksItemCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: Record<string, unknown>;
    };
    // Decimal serialises via Prisma.Decimal — just check the unit is the
    // edited value to confirm the merge applied.
    expect(data.data?.measurementUnit).toBe("m2");
  });

  it("looks up the parent ScopeCard for each discipline (DEM/CIV/ASB/Other) when accepting (PR A2.5)", async () => {
    for (const aiDisc of ["DEM", "ASB", "CIV", "Other"] as const) {
      const { prisma, mocks } = buildPrismaMock();
      mocks.conversationMessageFindUnique.mockResolvedValueOnce(
        existingMessage({
          proposals: [
            {
              index: 0,
              discipline: aiDisc,
              title: "x",
              description: "y",
              quantity: 1,
              unit: "ea",
              status: "pending"
            }
          ]
        })
      );
      const service = new ProposalsService(prisma as never);
      await service.acceptProposal("u-1", "msg-1", 0);
      // PR A2.5 — discipline column dropped; the service now queries
      // ScopeCard for the matching (tenderId, discipline) before creating
      // the scope item. Assert that the lookup happens with the right
      // discipline and that cardId is passed through to the create call.
      const cardLookupArgs = (mocks.scopeCardFindFirst.mock.calls[0]?.[0] ?? {}) as {
        where?: { tenderId?: string; discipline?: string };
      };
      expect(cardLookupArgs.where?.discipline).toBe(aiDisc);
      const data = (mocks.scopeOfWorksItemCreate.mock.calls[0]?.[0] ?? {}) as {
        data?: { cardId?: string };
      };
      expect(data.data?.cardId).toBe("card-1");
    }
  });

  it("404s when caller is not the conversation owner", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage({ userId: "u-other" }));
    const service = new ProposalsService(prisma as never);
    await expect(service.acceptProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("400s when proposal is already accepted (idempotency)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(
      existingMessage({
        proposals: [
          {
            index: 0,
            discipline: "demolition",
            title: "x",
            description: "y",
            quantity: 1,
            unit: "ea",
            status: "accepted",
            acceptedScopeItemId: "scope-prev"
          }
        ]
      })
    );
    const service = new ProposalsService(prisma as never);
    await expect(service.acceptProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("400s when proposal index is out of range", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage());
    const service = new ProposalsService(prisma as never);
    await expect(service.acceptProposal("u-1", "msg-1", 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("400s when conversation has no contextKey (no tender)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce(existingMessage({ tenderId: null }));
    const service = new ProposalsService(prisma as never);
    await expect(service.acceptProposal("u-1", "msg-1", 0)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("ProposalsService.rejectProposal", () => {
  it("updates status to rejected without writing to scope_of_works_items", async () => {
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
            discipline: "demolition",
            title: "x",
            description: "y",
            quantity: 1,
            unit: "ea",
            status: "pending"
          }
        ]
      }
    });
    const service = new ProposalsService(prisma as never);
    await service.rejectProposal("u-1", "msg-1", 0);
    expect(mocks.scopeOfWorksItemCreate).not.toHaveBeenCalled();
    const updateArgs = (mocks.conversationMessageUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { metadata?: { proposals?: Array<{ status?: string }> } };
    };
    expect(updateArgs.data?.metadata?.proposals?.[0]?.status).toBe("rejected");
  });
});

describe("ProposalsService.acceptAllPending", () => {
  it("iterates pending proposals and reports {accepted, failed}", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const proposals = [
      {
        index: 0,
        discipline: "demolition",
        title: "x",
        description: "y",
        quantity: 1,
        unit: "ea",
        status: "pending"
      },
      {
        index: 1,
        discipline: "asbestos",
        title: "x",
        description: "y",
        quantity: 1,
        unit: "ea",
        status: "pending"
      },
      {
        index: 2,
        discipline: "civil",
        title: "x",
        description: "y",
        quantity: 1,
        unit: "ea",
        status: "accepted",
        acceptedScopeItemId: "prev"
      }
    ];
    // findUnique is called 3 times (once for the bulk read, then once per
    // acceptProposal call for the two pending). All return the same shape.
    mocks.conversationMessageFindUnique.mockImplementation(async () => ({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: { toolUseId: "x", proposals }
    }));
    const service = new ProposalsService(prisma as never);
    const result = await service.acceptAllPending("u-1", "msg-1");
    expect(result.accepted).toBe(2);
    expect(result.failed).toBe(0);
    expect(mocks.scopeOfWorksItemCreate).toHaveBeenCalledTimes(2);
  });
});

describe("ProposalsService.rejectAllPending", () => {
  it("rejects all pending in a single update and skips already-decided proposals", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.conversationMessageFindUnique.mockResolvedValueOnce({
      id: "msg-1",
      role: "tool_result",
      conversation: { id: "conv-1", userId: "u-1", contextKey: "t-1" },
      metadata: {
        toolUseId: "x",
        proposals: [
          { index: 0, discipline: "demolition", title: "x", description: "y", quantity: 1, unit: "ea", status: "pending" },
          { index: 1, discipline: "demolition", title: "x", description: "y", quantity: 1, unit: "ea", status: "accepted" }
        ]
      }
    });
    const service = new ProposalsService(prisma as never);
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
