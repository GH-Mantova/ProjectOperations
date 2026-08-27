import { ConflictException, NotFoundException } from "@nestjs/common";
import { AllocationService } from "../allocation.service";

// ── Prisma mock helpers ───────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    tender: {
      findUnique: jest.fn().mockResolvedValue({
        id: "tender-1",
        tenderNumber: "T260827-ACME-Rev1",
        allocationState: "UNALLOCATED"
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "estimator-1" })
    },
    tenderAllocationCandidate: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    ...overrides
  };
}

function makeCapacityService(overrides: Partial<{
  getLeastLoaded: (ids: string[]) => Promise<string | null>
}> = {}) {
  return {
    getLeastLoaded: jest.fn().mockResolvedValue(null),
    ...overrides
  };
}

function makeAuditService() {
  return {
    write: jest.fn().mockResolvedValue({})
  };
}

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  capacity = makeCapacityService(),
  audit = makeAuditService()
) {
  return new AllocationService(
    prisma as never,
    capacity as never,
    audit as never
  );
}

// ── selfClaim ─────────────────────────────────────────────────────────────────

describe("AllocationService.selfClaim", () => {
  it("throws ConflictException when updateMany returns count=0 (race lost)", async () => {
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "UNALLOCATED"
        }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    });
    const service = makeService(prisma);

    await expect(service.selfClaim("tender-1", "estimator-1")).rejects.toThrow(
      ConflictException
    );
    await expect(service.selfClaim("tender-1", "estimator-1")).rejects.toThrow(
      "Tender already claimed."
    );
  });

  it("stamps claimedAt on candidate row when it exists", async () => {
    const candidateUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = makePrisma({
      tenderAllocationCandidate: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: candidateUpdateMany
      }
    });
    const service = makeService(prisma);

    await service.selfClaim("tender-1", "estimator-1");

    expect(candidateUpdateMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1", estimatorId: "estimator-1" },
      data: expect.objectContaining({ claimedAt: expect.any(Date) })
    });
  });

  it("sets allocationState to CLAIMED via updateMany conditional where", async () => {
    const tenderUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "POOL"
        }),
        update: jest.fn(),
        updateMany: tenderUpdateMany
      }
    });
    const service = makeService(prisma);

    await service.selfClaim("tender-1", "estimator-1");

    expect(tenderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "tender-1",
        allocationState: { in: ["UNALLOCATED", "POOL"] }
      },
      data: {
        assignedEstimatorId: "estimator-1",
        allocationState: "CLAIMED"
      }
    });
  });
});

// ── allocatePool ──────────────────────────────────────────────────────────────

describe("AllocationService.allocatePool", () => {
  it("calls allocateSingle when getLeastLoaded returns a candidate", async () => {
    const leastLoadedId = "estimator-2";
    const tenderUpdate = jest.fn().mockResolvedValue({});
    const candidateDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = makePrisma({
      tender: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: "tender-1",
            allocationState: "UNALLOCATED"
          })
          // second findUnique call comes from allocateSingle
          .mockResolvedValueOnce({
            id: "tender-1",
            tenderNumber: "T260827-ACME-Rev1",
            allocationState: "POOL"
          }),
        update: tenderUpdate,
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: leastLoadedId })
      },
      tenderAllocationCandidate: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: candidateDeleteMany,
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    });
    const capacity = makeCapacityService({
      getLeastLoaded: jest.fn().mockResolvedValue(leastLoadedId)
    });
    const service = makeService(prisma, capacity);

    await service.allocatePool(
      "tender-1",
      ["estimator-1", "estimator-2"],
      "actor-1"
    );

    // allocateSingle should have been triggered, which calls tender.update with ALLOCATED
    expect(tenderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tender-1" },
        data: expect.objectContaining({
          assignedEstimatorId: leastLoadedId,
          allocationState: "ALLOCATED"
        })
      })
    );
    // and cleared candidates
    expect(candidateDeleteMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" }
    });
  });

  it("leaves state as POOL when getLeastLoaded returns null (all at capacity)", async () => {
    const tenderUpdate = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "UNALLOCATED"
        }),
        update: tenderUpdate,
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    });
    const capacity = makeCapacityService({
      getLeastLoaded: jest.fn().mockResolvedValue(null)
    });
    const audit = makeAuditService();
    const service = makeService(prisma, capacity, audit);

    await service.allocatePool(
      "tender-1",
      ["estimator-1", "estimator-2"],
      "actor-1"
    );

    // tender should have been set to POOL with no direct assignment
    expect(tenderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tender-1" },
        data: expect.objectContaining({
          allocationState: "POOL",
          assignedEstimatorId: null
        })
      })
    );
    // audit entry should record POOL state
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenders.allocation.allocate-pool",
        metadata: expect.objectContaining({ newState: "POOL", autoAssigned: false })
      })
    );
  });
});

// ── allocateSingle ────────────────────────────────────────────────────────────

describe("AllocationService.allocateSingle", () => {
  it("clears TenderAllocationCandidate rows for the tender", async () => {
    const candidateDeleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = makePrisma({
      tenderAllocationCandidate: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: candidateDeleteMany,
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    });
    const service = makeService(prisma);

    await service.allocateSingle("tender-1", "estimator-1", "actor-1");

    expect(candidateDeleteMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" }
    });
  });

  it("throws NotFoundException when tender does not exist", async () => {
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        updateMany: jest.fn()
      }
    });
    const service = makeService(prisma);

    await expect(
      service.allocateSingle("missing-tender", "estimator-1", "actor-1")
    ).rejects.toThrow(NotFoundException);
  });

  it("throws NotFoundException when estimator does not exist", async () => {
    const prisma = makePrisma({
      user: { findUnique: jest.fn().mockResolvedValue(null) }
    });
    const service = makeService(prisma);

    await expect(
      service.allocateSingle("tender-1", "missing-estimator", "actor-1")
    ).rejects.toThrow(NotFoundException);
  });

  it("sets assignedEstimatorId and allocationState=ALLOCATED", async () => {
    const tenderUpdate = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          tenderNumber: "T260827-ACME-Rev1",
          allocationState: "UNALLOCATED"
        }),
        update: tenderUpdate,
        updateMany: jest.fn()
      }
    });
    const service = makeService(prisma);

    await service.allocateSingle("tender-1", "estimator-1", "actor-1");

    expect(tenderUpdate).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: {
        assignedEstimatorId: "estimator-1",
        allocationState: "ALLOCATED"
      }
    });
  });
});
