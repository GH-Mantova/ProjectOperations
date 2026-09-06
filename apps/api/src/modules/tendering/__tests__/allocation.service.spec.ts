import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { AllocationService } from "../allocation.service";

// ── Prisma mock helpers ───────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    tender: {
      findUnique: jest.fn().mockResolvedValue({
        id: "tender-1",
        tenderNumber: "T260827-ACME-Rev1",
        allocationState: "UNALLOCATED"
      }),
      findMany: jest.fn().mockResolvedValue([]),
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
    tenderAllocationRejection: {
      create: jest.fn().mockResolvedValue({})
    },
    ...overrides
  };

  // Interactive-transaction shim: hand the callback the same mock object, so
  // assertions on prisma.tender.update also see writes made through `tx`.
  prisma.$transaction = jest.fn(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
  );

  return prisma;
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

// ── reject (EW-2c) ────────────────────────────────────────────────────────────

describe("AllocationService.reject", () => {
  function assignedPrisma(
    assignedEstimatorId: string | null,
    extra: Record<string, unknown> = {}
  ) {
    return makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "ALLOCATED",
          assignedEstimatorId
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      ...extra
    });
  }

  it.each([
    ["empty string", ""],
    ["spaces only", "   "],
    ["tab and newline only", "\t\n "]
  ])(
    "throws BadRequestException when the reason is blank (%s)",
    async (_label, reason) => {
      const prisma = assignedPrisma("estimator-1");
      const service = makeService(prisma);

      await expect(
        service.reject("tender-1", "estimator-1", reason, "estimator-1")
      ).rejects.toThrow(BadRequestException);
    }
  );

  it("does not touch the tender or write a rejection row when the reason is blank", async () => {
    const rejectionCreate = jest.fn().mockResolvedValue({});
    const prisma = assignedPrisma("estimator-1", {
      tenderAllocationRejection: { create: rejectionCreate }
    });
    const audit = makeAuditService();
    const service = makeService(prisma, makeCapacityService(), audit);

    await expect(
      service.reject("tender-1", "estimator-1", "  ", "estimator-1")
    ).rejects.toThrow(BadRequestException);

    expect(rejectionCreate).not.toHaveBeenCalled();
    expect(
      (prisma.tender as { update: jest.Mock }).update
    ).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when the rejector is not the assigned estimator", async () => {
    const rejectionCreate = jest.fn().mockResolvedValue({});
    const prisma = assignedPrisma("estimator-1", {
      tenderAllocationRejection: { create: rejectionCreate }
    });
    const service = makeService(prisma);

    await expect(
      service.reject("tender-1", "estimator-2", "Too busy", "estimator-2")
    ).rejects.toThrow(ForbiddenException);
    expect(rejectionCreate).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when nobody is assigned", async () => {
    const prisma = assignedPrisma(null);
    const service = makeService(prisma);

    await expect(
      service.reject("tender-1", "estimator-1", "Too busy", "estimator-1")
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      }
    });
    const service = makeService(prisma);

    await expect(
      service.reject("missing-tender", "estimator-1", "Too busy", "estimator-1")
    ).rejects.toThrow(NotFoundException);
  });

  it("creates the rejection row AND clears assignedEstimatorId", async () => {
    const rejectionCreate = jest.fn().mockResolvedValue({});
    const tenderUpdate = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "ALLOCATED",
          assignedEstimatorId: "estimator-1"
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: tenderUpdate,
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      tenderAllocationRejection: { create: rejectionCreate }
    });
    const audit = makeAuditService();
    const service = makeService(prisma, makeCapacityService(), audit);

    await service.reject(
      "tender-1",
      "estimator-1",
      "  Capacity full this week  ",
      "estimator-1"
    );

    expect(rejectionCreate).toHaveBeenCalledWith({
      data: {
        tenderId: "tender-1",
        rejectedBy: "estimator-1",
        // reason is trimmed before it is persisted
        reason: "Capacity full this week"
      }
    });
    // Exact-object assertion: an `assignedEstimatorId: undefined` would leave
    // the estimator attached in Prisma and must not satisfy this test.
    expect(tenderUpdate).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: {
        allocationState: "REJECTED",
        assignedEstimatorId: null
      }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenders.allocation.reject",
        entityId: "tender-1",
        metadata: expect.objectContaining({
          estimatorId: "estimator-1",
          previousState: "ALLOCATED",
          newState: "REJECTED"
        })
      })
    );
  });

  it("writes the rejection row and the state change in one transaction", async () => {
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "CLAIMED",
          assignedEstimatorId: "estimator-1"
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    });
    const service = makeService(prisma);

    await service.reject("tender-1", "estimator-1", "No time", "estimator-1");

    expect(prisma.$transaction as jest.Mock).toHaveBeenCalledTimes(1);
  });
});

// ── override (EW-2c) ──────────────────────────────────────────────────────────

describe("AllocationService.override", () => {
  it("records the previous estimator in the audit entry", async () => {
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "CLAIMED",
          assignedEstimatorId: "estimator-old"
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: "estimator-new" }) }
    });
    const audit = makeAuditService();
    const service = makeService(prisma, makeCapacityService(), audit);

    await service.override("tender-1", "estimator-new", "allocator-1");

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "allocator-1",
        action: "tenders.allocation.override",
        entityType: "Tender",
        entityId: "tender-1",
        metadata: expect.objectContaining({
          previousEstimatorId: "estimator-old",
          newEstimatorId: "estimator-new",
          previousState: "CLAIMED",
          newState: "ALLOCATED"
        })
      })
    );
  });

  it("assigns the new estimator and clears pool candidates", async () => {
    const tenderUpdate = jest.fn().mockResolvedValue({});
    const candidateDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "POOL",
          assignedEstimatorId: null
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: tenderUpdate,
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: "estimator-new" }) },
      tenderAllocationCandidate: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: candidateDeleteMany,
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    });
    const service = makeService(prisma);

    await service.override("tender-1", "estimator-new", "allocator-1");

    expect(tenderUpdate).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: {
        assignedEstimatorId: "estimator-new",
        allocationState: "ALLOCATED"
      }
    });
    expect(candidateDeleteMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" }
    });
  });

  it("throws NotFoundException when the new estimator does not exist", async () => {
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "ALLOCATED",
          assignedEstimatorId: "estimator-old"
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) }
    });
    const service = makeService(prisma);

    await expect(
      service.override("tender-1", "ghost-estimator", "allocator-1")
    ).rejects.toThrow(NotFoundException);
  });
});

// ── transfer (EW-2c) ──────────────────────────────────────────────────────────

describe("AllocationService.transfer", () => {
  function prismaInState(state: string) {
    return makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          tenderNumber: "T260827-ACME-Rev1",
          allocationState: state,
          assignedEstimatorId: null
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: "estimator-2" }) }
    });
  }

  it.each(["UNALLOCATED", "ALLOCATED", "POOL", "CLAIMED"])(
    "refuses to transfer a tender in state %s",
    async (state) => {
      const prisma = prismaInState(state);
      const service = makeService(prisma);

      await expect(
        service.transfer("tender-1", "estimator-2", "allocator-1")
      ).rejects.toThrow(BadRequestException);

      // and nothing was written
      expect(
        (prisma.tender as { update: jest.Mock }).update
      ).not.toHaveBeenCalled();
    }
  );

  it("reassigns via allocateSingle when the tender is REJECTED", async () => {
    const prisma = prismaInState("REJECTED");
    const service = makeService(prisma);

    await service.transfer("tender-1", "estimator-2", "allocator-1");

    // allocateSingle owns the write — ALLOCATED, new estimator attached
    expect((prisma.tender as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: {
        assignedEstimatorId: "estimator-2",
        allocationState: "ALLOCATED"
      }
    });
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      }
    });
    const service = makeService(prisma);

    await expect(
      service.transfer("missing-tender", "estimator-2", "allocator-1")
    ).rejects.toThrow(NotFoundException);
  });
});

// ── pushBack (EW-2c) ──────────────────────────────────────────────────────────

describe("AllocationService.pushBack", () => {
  it("returns the tender to UNALLOCATED, detaches the estimator and clears candidates", async () => {
    const tenderUpdate = jest.fn().mockResolvedValue({});
    const candidateDeleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tender-1",
          allocationState: "REJECTED",
          assignedEstimatorId: "estimator-1"
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: tenderUpdate,
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      tenderAllocationCandidate: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: candidateDeleteMany,
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    });
    const audit = makeAuditService();
    const service = makeService(prisma, makeCapacityService(), audit);

    await service.pushBack("tender-1", "allocator-1");

    // Exact object: `assignedEstimatorId: undefined` would silently keep the
    // estimator attached and must not pass.
    expect(tenderUpdate).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: {
        allocationState: "UNALLOCATED",
        assignedEstimatorId: null
      }
    });
    expect(candidateDeleteMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "allocator-1",
        action: "tenders.allocation.push-back",
        entityId: "tender-1",
        metadata: expect.objectContaining({
          previousEstimatorId: "estimator-1",
          previousState: "REJECTED",
          newState: "UNALLOCATED"
        })
      })
    );
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      }
    });
    const service = makeService(prisma);

    await expect(
      service.pushBack("missing-tender", "allocator-1")
    ).rejects.toThrow(NotFoundException);
  });
});

// ── detectUnallocated (EW-2c) ─────────────────────────────────────────────────

type FakeTender = {
  id: string;
  allocationState: string;
  updatedAt: Date;
};

/**
 * findMany stub that actually APPLIES the where clause the service builds, so
 * a wrong cut-off, a wrong comparison operator or a wrong state filter makes
 * the assertions fail rather than sail through a canned return value.
 */
function makeFilteringFindMany(rows: FakeTender[]) {
  return jest.fn(
    async (args: {
      where: { allocationState?: string; updatedAt?: { lt?: Date } };
      orderBy?: { updatedAt?: "asc" | "desc" };
    }) => {
      const matched = rows.filter((row) => {
        if (
          args.where.allocationState !== undefined &&
          row.allocationState !== args.where.allocationState
        ) {
          return false;
        }
        const lt = args.where.updatedAt?.lt;
        if (lt !== undefined && !(row.updatedAt.getTime() < lt.getTime())) {
          return false;
        }
        return true;
      });

      if (args.orderBy?.updatedAt === "asc") {
        matched.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
      }

      return matched.map((row) => ({ id: row.id }));
    }
  );
}

describe("AllocationService.detectUnallocated", () => {
  const NOW = new Date("2026-09-06T12:00:00.000Z");

  function minutesAgo(minutes: number) {
    return new Date(NOW.getTime() - minutes * 60_000);
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function serviceOver(rows: FakeTender[]) {
    const findMany = makeFilteringFindMany(rows);
    const prisma = makePrisma({
      tender: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany,
        update: jest.fn(),
        updateMany: jest.fn()
      }
    });
    return { service: makeService(prisma), findMany };
  }

  it("returns only UNALLOCATED tenders older than the threshold", async () => {
    const { service } = serviceOver([
      { id: "stale-90m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(90) },
      { id: "fresh-10m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(10) },
      { id: "allocated-old", allocationState: "ALLOCATED", updatedAt: minutesAgo(600) },
      { id: "rejected-old", allocationState: "REJECTED", updatedAt: minutesAgo(600) }
    ]);

    await expect(service.detectUnallocated(60)).resolves.toEqual(["stale-90m"]);
  });

  it("excludes a tender sitting exactly on the threshold boundary", async () => {
    const { service } = serviceOver([
      { id: "exactly-60m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(60) },
      { id: "just-over-61m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(61) }
    ]);

    const result = await service.detectUnallocated(60);

    expect(result).toEqual(["just-over-61m"]);
    expect(result).not.toContain("exactly-60m");
  });

  it("honours a caller-supplied threshold rather than the default", async () => {
    const rows: FakeTender[] = [
      { id: "t-30m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(30) },
      { id: "t-90m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(90) }
    ];

    const { service: wide } = serviceOver(rows);
    await expect(wide.detectUnallocated(15)).resolves.toEqual(["t-90m", "t-30m"]);

    const { service: narrow } = serviceOver(rows);
    await expect(narrow.detectUnallocated(120)).resolves.toEqual([]);
  });

  it("defaults to a 60 minute threshold when none is supplied", async () => {
    const { service } = serviceOver([
      { id: "t-59m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(59) },
      { id: "t-61m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(61) }
    ]);

    await expect(service.detectUnallocated()).resolves.toEqual(["t-61m"]);
  });

  it("returns the oldest tender first", async () => {
    const { service } = serviceOver([
      { id: "t-120m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(120) },
      { id: "t-300m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(300) },
      { id: "t-200m", allocationState: "UNALLOCATED", updatedAt: minutesAgo(200) }
    ]);

    await expect(service.detectUnallocated(60)).resolves.toEqual([
      "t-300m",
      "t-200m",
      "t-120m"
    ]);
  });

  it("returns an empty array when nothing is stale", async () => {
    const { service } = serviceOver([
      { id: "fresh", allocationState: "UNALLOCATED", updatedAt: minutesAgo(5) }
    ]);

    await expect(service.detectUnallocated(60)).resolves.toEqual([]);
  });
});
