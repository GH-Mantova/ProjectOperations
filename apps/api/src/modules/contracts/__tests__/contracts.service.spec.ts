// Mock-based unit tests for ContractsService (§7 Award/Contract/Job
// Conversion). Mirrors the house pattern from
// apps/api/src/modules/jobs/__tests__/jobs.service.spec.ts: Prisma is a
// plain object of jest.fn()s built per-test by `buildService`, the
// service is instantiated directly with `as never` casts on injected
// dependencies, and `$transaction` either invokes the callback with the
// prisma object or Promise.all's an array input.
//
// Coverage emphasis: variations, progress claims, retention arithmetic,
// and cut-off logic — all $ math is server-side, so calculations are
// asserted numerically. Note: GST is not handled anywhere in this
// service (all figures are treated as supplied), so there is no GST
// math to assert.
//
// Known gap ("contracts silent claim gap") documented with it.failing
// tests below: createClaim only counts APPROVED/PAID prior claims when
// computing `previouslyClaimed` and when excluding already-claimed
// variations, so amounts/variations sitting on a SUBMITTED claim are
// silently invisible to the next claim — see
// contracts.service.ts:249-271.

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ContractsService } from "../contracts.service";

// ─── Shared fixtures ───────────────────────────────────────────────────────

const contractRow = (overrides: Record<string, unknown> = {}) => ({
  id: "contract-1",
  contractNumber: "IS-C001",
  projectId: "project-1",
  status: "ACTIVE",
  contractValue: 100000,
  retentionPct: 5,
  startDate: null,
  endDate: null,
  notes: null,
  ...overrides
});

const claimRow = (overrides: Record<string, unknown> = {}) => ({
  id: "claim-1",
  contractId: "contract-1",
  claimNumber: "IS-PC001",
  claimMonth: new Date(Date.UTC(2026, 5, 1)),
  status: "DRAFT",
  totalClaimed: 0,
  totalApproved: null,
  totalPaid: null,
  lineItems: [],
  contract: contractRow(),
  ...overrides
});

const variationRow = (overrides: Record<string, unknown> = {}) => ({
  id: "var-1",
  contractId: "contract-1",
  variationNumber: "IS-V001",
  description: "Extra works",
  status: "RECEIVED",
  pricedAmount: null,
  approvedAmount: null,
  ...overrides
});

const lineItemRow = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  claimId: "claim-1",
  discipline: "DEM",
  contractValue: 10000,
  previouslyClaimed: 0,
  thisClaimAmount: 0,
  thisClaimPct: null,
  variationId: null,
  claim: { id: "claim-1", contractId: "contract-1" },
  ...overrides
});

const cutoffContract = (clientOverrides: Record<string, unknown> = {}) => ({
  id: "contract-1",
  status: "ACTIVE",
  project: {
    id: "project-1",
    projectNumber: "P-2026-001",
    name: "Demo Project",
    client: {
      id: "client-1",
      name: "Acme Pty Ltd",
      claimCutoffDay: 20,
      claimReminderUserId: "user-1",
      claimReminderUser: { id: "user-1", email: "amy@initialservices.net", firstName: "Amy", lastName: "Accounts" },
      ...clientOverrides
    }
  }
});

// Per-test mock builder. Tests override individual mock methods on the
// returned `prisma` object before driving the service.
function buildService(extraPrisma: Record<string, unknown> = {}) {
  const notificationCreate = jest.fn().mockResolvedValue(undefined);
  const sendNotificationEmail = jest.fn().mockResolvedValue(undefined);

  const prisma: Record<string, unknown> = {
    contract: {
      findUnique: jest.fn().mockResolvedValue(contractRow()),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(contractRow()),
      update: jest.fn().mockResolvedValue(contractRow())
    },
    project: {
      findUnique: jest.fn().mockResolvedValue({ id: "project-1", contract: null })
    },
    variation: {
      findUnique: jest.fn().mockResolvedValue(variationRow()),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(variationRow()),
      update: jest.fn().mockResolvedValue(variationRow())
    },
    progressClaim: {
      findUnique: jest.fn().mockResolvedValue(claimRow()),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(claimRow()),
      update: jest.fn().mockResolvedValue(claimRow())
    },
    claimLineItem: {
      findUnique: jest.fn().mockResolvedValue(lineItemRow()),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(lineItemRow()),
      update: jest.fn().mockResolvedValue(lineItemRow())
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "user-supervisor-002" })
    },
    scopeOfWorksItem: {
      findMany: jest.fn().mockResolvedValue([])
    },
    estimateItem: {
      findMany: jest.fn().mockResolvedValue([])
    },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue(null)
    },
    contractNumberSequence: {
      upsert: jest.fn().mockResolvedValue({ id: 1, lastNumber: 1 })
    },
    variationNumberSequence: {
      upsert: jest.fn().mockResolvedValue({ id: 1, lastNumber: 1 })
    },
    claimNumberSequence: {
      upsert: jest.fn().mockResolvedValue({ id: 1, lastNumber: 1 })
    },
    companyLegalDocument: {
      findFirst: jest.fn().mockResolvedValue(null)
    },
    $transaction: jest.fn().mockImplementation((input: unknown) => {
      if (typeof input === "function") {
        return (input as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    }),
    ...extraPrisma
  };

  const notifications = { create: notificationCreate };
  const email = { sendNotificationEmail };

  const service = new ContractsService(prisma as never, notifications as never, email as never);

  return { service, prisma, notifications, notificationCreate, email, sendNotificationEmail };
}

const actor = (...permissions: string[]) => ({ id: "user-1", permissions: new Set(permissions) });

// ─── listContracts ─────────────────────────────────────────────────────────

describe("ContractsService.listContracts", () => {
  it("returns paginated contracts echoing page/pageSize/limit", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([contractRow()]);
    (prisma.contract as { count: jest.Mock }).count.mockResolvedValueOnce(1);

    const result = await service.listContracts({ page: 2, pageSize: 10 });

    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 10, limit: 10 });
    expect(result.items).toHaveLength(1);
    const findManyArgs = (prisma.contract as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      skip: number;
      take: number;
    };
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
  });

  it("clamps pageSize to 100 and lets limit win over pageSize", async () => {
    const { service, prisma } = buildService();
    const result = await service.listContracts({ page: 1, pageSize: 10, limit: 500 });
    expect(result.pageSize).toBe(100);
    const findManyArgs = (prisma.contract as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      take: number;
    };
    expect(findManyArgs.take).toBe(100);
  });

  it("defaults to page 1 / pageSize 20 when nothing is supplied", async () => {
    const { service } = buildService();
    const result = await service.listContracts({});
    expect(result).toMatchObject({ page: 1, pageSize: 20 });
  });
});

// ─── getContract ───────────────────────────────────────────────────────────

describe("ContractsService.getContract", () => {
  it("returns the contract with project, variations, and claims included", async () => {
    const { service, prisma } = buildService();
    const result = await service.getContract("contract-1");
    expect(result).toMatchObject({ id: "contract-1" });
    expect((prisma.contract as { findUnique: jest.Mock }).findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "contract-1" } })
    );
  });

  it("throws NotFoundException when the contract does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.getContract("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── createContract ────────────────────────────────────────────────────────

describe("ContractsService.createContract", () => {
  it("creates the contract with a sequence-derived number and Decimal money fields", async () => {
    const { service, prisma } = buildService();
    (prisma.contractNumberSequence as { upsert: jest.Mock }).upsert.mockResolvedValueOnce({
      id: 1,
      lastNumber: 7
    });

    await service.createContract("user-1", { projectId: "project-1", contractValue: 250000.5, retentionPct: 10 });

    const createArgs = (prisma.contract as { create: jest.Mock }).create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data.contractNumber).toBe("IS-C007");
    expect(Number(createArgs.data.contractValue)).toBe(250000.5);
    expect(Number(createArgs.data.retentionPct)).toBe(10);
    expect(createArgs.data.createdById).toBe("user-1");
  });

  it("defaults retentionPct to 0 when not supplied", async () => {
    const { service, prisma } = buildService();
    await service.createContract("user-1", { projectId: "project-1", contractValue: 1000 });
    const createArgs = (prisma.contract as { create: jest.Mock }).create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(createArgs.data.retentionPct)).toBe(0);
  });

  it("throws NotFoundException when the project does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.project as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createContract("user-1", { projectId: "missing", contractValue: 1000 })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws ConflictException when the project already has a contract", async () => {
    const { service, prisma } = buildService();
    (prisma.project as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "project-1",
      contract: { id: "contract-existing" }
    });
    await expect(
      service.createContract("user-1", { projectId: "project-1", contractValue: 1000 })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

// ─── updateContract ────────────────────────────────────────────────────────

describe("ContractsService.updateContract", () => {
  it("throws NotFoundException when the contract does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.updateContract("missing", actor(), {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects contractValue changes without the finance.admin permission", async () => {
    const { service } = buildService();
    await expect(
      service.updateContract("contract-1", actor("contracts.write"), { contractValue: 999 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows contractValue changes for finance.admin and converts to Decimal", async () => {
    const { service, prisma } = buildService();
    await service.updateContract("contract-1", actor("finance.admin"), { contractValue: 123456.78, retentionPct: 2.5 });
    const updateArgs = (prisma.contract as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.contractValue)).toBe(123456.78);
    expect(Number(updateArgs.data.retentionPct)).toBe(2.5);
  });

  it("clears startDate when null is sent and leaves endDate untouched when omitted", async () => {
    const { service, prisma } = buildService();
    await service.updateContract("contract-1", actor(), { startDate: null });
    const updateArgs = (prisma.contract as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.startDate).toBeNull();
    expect(updateArgs.data.endDate).toBeUndefined();
  });
});

// ─── listVariations / createVariation ──────────────────────────────────────

describe("ContractsService.listVariations", () => {
  it("throws NotFoundException when the contract does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.listVariations("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists variations ordered by variationNumber", async () => {
    const { service, prisma } = buildService();
    await service.listVariations("contract-1");
    expect((prisma.variation as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      where: { contractId: "contract-1" },
      orderBy: { variationNumber: "asc" }
    });
  });
});

describe("ContractsService.createVariation", () => {
  it("creates a variation with a sequence-derived number and Decimal pricedAmount", async () => {
    const { service, prisma } = buildService();
    (prisma.variationNumberSequence as { upsert: jest.Mock }).upsert.mockResolvedValueOnce({
      id: 1,
      lastNumber: 42
    });

    await service.createVariation("contract-1", "user-1", { description: "Extra fence", pricedAmount: 1500.25 });

    const createArgs = (prisma.variation as { create: jest.Mock }).create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data.variationNumber).toBe("IS-V042");
    expect(Number(createArgs.data.pricedAmount)).toBe(1500.25);
    expect(createArgs.data.createdById).toBe("user-1");
    expect(createArgs.data.receivedDate).toBeInstanceOf(Date);
  });

  it("throws NotFoundException when the contract does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createVariation("missing", "user-1", { description: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── updateVariation — status transitions + approval flow ──────────────────

describe("ContractsService.updateVariation", () => {
  it("throws NotFoundException when the variation belongs to a different contract", async () => {
    const { service, prisma } = buildService();
    (prisma.variation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      variationRow({ contractId: "other-contract" })
    );
    await expect(
      service.updateVariation("contract-1", "var-1", { description: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects an illegal status jump RECEIVED → APPROVED", async () => {
    const { service } = buildService();
    await expect(
      service.updateVariation("contract-1", "var-1", { status: "APPROVED" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects any transition out of APPROVED (terminal state)", async () => {
    const { service, prisma } = buildService();
    (prisma.variation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      variationRow({ status: "APPROVED" })
    );
    await expect(
      service.updateVariation("contract-1", "var-1", { status: "PRICED" })
    ).rejects.toThrow(/can only transition to \(none\)/);
  });

  it("allows the legal transition RECEIVED → PRICED and converts amounts to Decimal", async () => {
    const { service, prisma } = buildService();
    await service.updateVariation("contract-1", "var-1", { status: "PRICED", pricedAmount: 2000 });
    const updateArgs = (prisma.variation as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.status).toBe("PRICED");
    expect(Number(updateArgs.data.pricedAmount)).toBe(2000);
  });

  it("allows resubmitting the same status without a transition check", async () => {
    const { service, prisma } = buildService();
    (prisma.variation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      variationRow({ status: "PRICED" })
    );
    await service.updateVariation("contract-1", "var-1", { status: "PRICED", notes: "repriced" });
    expect((prisma.variation as { update: jest.Mock }).update).toHaveBeenCalled();
  });

  it("on SUBMITTED → APPROVED adds a line item to the active DRAFT claim using the approved amount", async () => {
    const { service, prisma } = buildService();
    (prisma.variation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      variationRow({ status: "SUBMITTED" })
    );
    (prisma.variation as { update: jest.Mock }).update.mockResolvedValueOnce(
      variationRow({ status: "APPROVED", approvedAmount: 3500, variationNumber: "IS-V009" })
    );
    (prisma.progressClaim as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(
      claimRow({ id: "claim-draft", status: "DRAFT" })
    );
    (prisma.claimLineItem as { count: jest.Mock }).count.mockResolvedValueOnce(3);

    await service.updateVariation("contract-1", "var-1", { status: "APPROVED", approvedAmount: 3500 });

    const createArgs = (prisma.claimLineItem as { create: jest.Mock }).create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data.claimId).toBe("claim-draft");
    expect(createArgs.data.discipline).toBe("Variation");
    expect(createArgs.data.description).toBe("VAR IS-V009 — Extra works");
    expect(Number(createArgs.data.contractValue)).toBe(3500);
    expect(Number(createArgs.data.previouslyClaimed)).toBe(0);
    expect(Number(createArgs.data.thisClaimAmount)).toBe(0);
    expect(createArgs.data.sortOrder).toBe(1003);
  });

  it("silently skips the draft-claim line item when approved without an approvedAmount", async () => {
    // Documents current behaviour: approving a variation with no
    // approvedAmount adds nothing to the active DRAFT claim and raises
    // no error — the variation only reaches a claim if a later claim is
    // created from scratch (contracts.service.ts:193).
    const { service, prisma } = buildService();
    (prisma.variation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      variationRow({ status: "SUBMITTED" })
    );
    (prisma.variation as { update: jest.Mock }).update.mockResolvedValueOnce(
      variationRow({ status: "APPROVED", approvedAmount: null })
    );
    (prisma.progressClaim as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(
      claimRow({ id: "claim-draft", status: "DRAFT" })
    );

    await service.updateVariation("contract-1", "var-1", { status: "APPROVED" });

    expect((prisma.claimLineItem as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("does not touch claim line items when there is no DRAFT claim", async () => {
    const { service, prisma } = buildService();
    (prisma.variation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      variationRow({ status: "SUBMITTED" })
    );
    (prisma.variation as { update: jest.Mock }).update.mockResolvedValueOnce(
      variationRow({ status: "APPROVED", approvedAmount: 3500 })
    );

    await service.updateVariation("contract-1", "var-1", { status: "APPROVED", approvedAmount: 3500 });

    expect((prisma.claimLineItem as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });
});

// ─── listClaims / getClaim ─────────────────────────────────────────────────

describe("ContractsService.listClaims", () => {
  it("throws NotFoundException when the contract does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.listClaims("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists claims newest month first", async () => {
    const { service, prisma } = buildService();
    await service.listClaims("contract-1");
    expect((prisma.progressClaim as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      where: { contractId: "contract-1" },
      orderBy: { claimMonth: "desc" }
    });
  });
});

describe("ContractsService.getClaim", () => {
  it("throws NotFoundException when the claim belongs to a different contract", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      claimRow({ contractId: "other-contract" })
    );
    await expect(service.getClaim("contract-1", "claim-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when the claim does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.getClaim("contract-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── createClaim ───────────────────────────────────────────────────────────

describe("ContractsService.createClaim", () => {
  const tenderContract = () =>
    contractRow({ project: { id: "project-1", sourceTenderId: "tender-1" } });

  const scopeMocks = {
    scopeOfWorksItem: {
      findMany: jest.fn().mockResolvedValue([
        { card: { discipline: "DEM" }, estimateItemId: "ei-1", provisionalAmount: null },
        { card: { discipline: "Other" }, estimateItemId: null, provisionalAmount: 5000 }
      ])
    },
    estimateItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "ei-1",
          labourLines: [{ qty: 2, days: 5, rate: 100 }], // 1000
          plantLines: [{ qty: 1, days: 2, rate: 250 }], // 500
          equipLines: [{ qty: 1, duration: 3, rate: 50 }], // 150
          wasteLines: [{ qtyTonnes: 10, tonRate: 20, loads: 2, loadRate: 75 }], // 350
          cuttingLines: [] // 0 → raw 2000
        }
      ])
    },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue({ markup: 20 })
    }
  };

  it("throws NotFoundException when the contract does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createClaim("missing", "user-1", { claimMonth: "2026-06-15" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws ConflictException when a claim already exists for the contract + month", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      contractRow({ project: { id: "project-1", sourceTenderId: null } })
    );
    (prisma.progressClaim as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(claimRow());
    await expect(
      service.createClaim("contract-1", "user-1", { claimMonth: "2026-06-15" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("normalises claimMonth to the UTC start of month and numbers the claim from the sequence", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      contractRow({ project: { id: "project-1", sourceTenderId: null } })
    );
    (prisma.claimNumberSequence as { upsert: jest.Mock }).upsert.mockResolvedValueOnce({
      id: 1,
      lastNumber: 12
    });

    await service.createClaim("contract-1", "user-1", { claimMonth: "2026-06-15" });

    const createArgs = (prisma.progressClaim as { create: jest.Mock }).create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data.claimMonth).toEqual(new Date(Date.UTC(2026, 5, 1)));
    expect(createArgs.data.claimNumber).toBe("IS-PC012");
    expect(createArgs.data.status).toBe("DRAFT");
    expect((createArgs.data.lineItems as { create: unknown[] }).create).toEqual([]);
  });

  it("builds discipline line items from the tender scope with markup, carrying previouslyClaimed from APPROVED claims", async () => {
    const { service, prisma } = buildService(scopeMocks);
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(tenderContract());
    (prisma.progressClaim as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      claimRow({
        id: "claim-prior",
        status: "APPROVED",
        lineItems: [
          { discipline: "DEM", thisClaimAmount: 300, variationId: null },
          { discipline: "Variation", thisClaimAmount: 100, variationId: "var-old" }
        ]
      })
    ]);
    (prisma.variation as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      variationRow({ id: "var-new", variationNumber: "IS-V005", approvedAmount: 2500, status: "APPROVED" })
    ]);

    await service.createClaim("contract-1", "user-1", { claimMonth: "2026-06-01" });

    // Already-claimed variations are excluded from the candidate query.
    const variationWhere = (prisma.variation as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      where: { id: { notIn: string[] } };
    };
    expect(variationWhere.where.id.notIn).toEqual(["var-old"]);

    const createArgs = (prisma.progressClaim as { create: jest.Mock }).create.mock.calls[0]?.[0] as {
      data: { lineItems: { create: Array<Record<string, unknown>> } };
    };
    const items = createArgs.data.lineItems.create;
    expect(items).toHaveLength(3);

    // DEM: raw 2000 (labour 1000 + plant 500 + equip 150 + waste 350) × 1.20 markup = 2400.
    expect(items[0]).toMatchObject({ discipline: "DEM", description: "Demolition", sortOrder: 0 });
    expect(Number(items[0]?.contractValue)).toBe(2400);
    expect(Number(items[0]?.previouslyClaimed)).toBe(300);
    expect(Number(items[0]?.thisClaimAmount)).toBe(0);

    // Other: provisional sum 5000, no markup applied.
    expect(items[1]).toMatchObject({ discipline: "Other", sortOrder: 3 });
    expect(Number(items[1]?.contractValue)).toBe(5000);
    expect(Number(items[1]?.previouslyClaimed)).toBe(0);

    // Variation line at the approved amount, sorted after disciplines.
    expect(items[2]).toMatchObject({
      discipline: "Variation",
      description: "VAR IS-V005 — Extra works",
      sortOrder: 1000
    });
    expect(Number(items[2]?.contractValue)).toBe(2500);
  });

  // ── "Contracts silent claim gap" ─────────────────────────────────────────
  // createClaim only includes ClaimStatus.APPROVED and PAID prior claims
  // (contracts.service.ts:250) when computing previouslyClaimed and when
  // building the already-claimed variation exclusion set. Amounts and
  // variation line items sitting on a SUBMITTED (or DRAFT) claim are
  // therefore silently invisible to the next claim — the same dollars and
  // the same variation can be claimed twice if a new claim is raised
  // before the previous one is approved. Needs-marco: confirm intent.
  const gapPrismaWithSubmittedClaim = () => ({
    ...scopeMocks,
    progressClaim: {
      findUnique: jest.fn().mockResolvedValue(claimRow()),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(claimRow()),
      update: jest.fn().mockResolvedValue(claimRow()),
      findMany: jest.fn().mockImplementation((args: { where?: { status?: { in?: string[] } } }) => {
        const allClaims = [
          claimRow({
            id: "claim-approved",
            status: "APPROVED",
            lineItems: [{ discipline: "DEM", thisClaimAmount: 300, variationId: null }]
          }),
          claimRow({
            id: "claim-submitted",
            status: "SUBMITTED",
            lineItems: [{ discipline: "DEM", thisClaimAmount: 400, variationId: "var-sub" }]
          })
        ];
        const allowed = args?.where?.status?.in;
        return Promise.resolve(allowed ? allClaims.filter((c) => allowed.includes(c.status as string)) : allClaims);
      })
    }
  });

  it.failing("counts amounts on SUBMITTED claims in previouslyClaimed (silent claim gap)", async () => {
    const { service, prisma } = buildService(gapPrismaWithSubmittedClaim());
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(tenderContract());

    await service.createClaim("contract-1", "user-1", { claimMonth: "2026-07-01" });

    const createArgs = (prisma.progressClaim as { create: jest.Mock }).create.mock.calls[0]?.[0] as {
      data: { lineItems: { create: Array<Record<string, unknown>> } };
    };
    const dem = createArgs.data.lineItems.create.find((i) => i.discipline === "DEM");
    // Should be 300 (approved) + 400 (submitted) = 700; currently only 300.
    expect(Number(dem?.previouslyClaimed)).toBe(700);
  });

  it.failing("excludes variations already lined on a SUBMITTED claim (silent claim gap)", async () => {
    const { service, prisma } = buildService(gapPrismaWithSubmittedClaim());
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(tenderContract());

    await service.createClaim("contract-1", "user-1", { claimMonth: "2026-07-01" });

    const variationWhere = (prisma.variation as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      where: { id: { notIn: string[] } };
    };
    // "var-sub" sits on the SUBMITTED claim; it should be excluded from
    // the new claim's candidates but currently is not (notIn is []).
    expect(variationWhere.where.id.notIn).toContain("var-sub");
  });
});

// ─── updateClaimItem — server-side claim math ──────────────────────────────

describe("ContractsService.updateClaimItem", () => {
  it("throws NotFoundException when the line item belongs to a different claim", async () => {
    const { service, prisma } = buildService();
    (prisma.claimLineItem as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      lineItemRow({ claim: { id: "other-claim", contractId: "contract-1" } })
    );
    await expect(
      service.updateClaimItem("contract-1", "claim-1", "item-1", { thisClaimPct: 10 })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("computes thisClaimAmount from pct server-side, rounded to cents", async () => {
    const { service, prisma } = buildService();
    (prisma.claimLineItem as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      lineItemRow({ contractValue: 10000 })
    );

    await service.updateClaimItem("contract-1", "claim-1", "item-1", { thisClaimPct: 12.5 });

    const updateArgs = (prisma.claimLineItem as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.thisClaimPct)).toBe(12.5);
    expect(Number(updateArgs.data.thisClaimAmount)).toBe(1250); // 10000 × 12.5%
  });

  it("rounds awkward pct math to 2 decimal places", async () => {
    const { service, prisma } = buildService();
    (prisma.claimLineItem as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      lineItemRow({ contractValue: 33333.33 })
    );
    await service.updateClaimItem("contract-1", "claim-1", "item-1", { thisClaimPct: 10 });
    const updateArgs = (prisma.claimLineItem as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.thisClaimAmount)).toBe(3333.33); // 3333.333 → 3333.33
  });

  it("lets a direct amount override win over pct and clears the stored pct", async () => {
    const { service, prisma } = buildService();
    await service.updateClaimItem("contract-1", "claim-1", "item-1", {
      thisClaimPct: 50,
      thisClaimAmount: 4321.99
    });
    const updateArgs = (prisma.claimLineItem as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.thisClaimAmount)).toBe(4321.99);
    expect(updateArgs.data.thisClaimPct).toBeNull();
  });

  it("recomputes the claim total from all line items after the edit", async () => {
    const { service, prisma } = buildService();
    (prisma.claimLineItem as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      lineItemRow({ thisClaimAmount: 1250.5 }),
      lineItemRow({ id: "item-2", thisClaimAmount: 749.5 })
    ]);

    await service.updateClaimItem("contract-1", "claim-1", "item-1", { thisClaimAmount: 1250.5 });

    const totalArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(totalArgs.where).toEqual({ id: "claim-1" });
    expect(Number(totalArgs.data.totalClaimed)).toBe(2000);
  });

  it("supports zero-value claims — amount 0 and total 0", async () => {
    const { service, prisma } = buildService();
    (prisma.claimLineItem as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      lineItemRow({ thisClaimAmount: 0 })
    ]);

    await service.updateClaimItem("contract-1", "claim-1", "item-1", { thisClaimAmount: 0 });

    const updateArgs = (prisma.claimLineItem as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.thisClaimAmount)).toBe(0);
    const totalArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(totalArgs.data.totalClaimed)).toBe(0);
  });
});

// ─── submitClaim / approveClaim / payClaim — status flow + retention ───────

describe("ContractsService.submitClaim", () => {
  it("rejects submission when the claim is not DRAFT", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      claimRow({ status: "SUBMITTED" })
    );
    await expect(service.submitClaim("contract-1", "claim-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("marks the claim SUBMITTED, stamps submissionDate, and fires the notification email", async () => {
    const { service, prisma, sendNotificationEmail } = buildService();
    (prisma.progressClaim as { update: jest.Mock }).update.mockResolvedValueOnce(
      claimRow({ status: "SUBMITTED", claimNumber: "IS-PC003" })
    );

    await service.submitClaim("contract-1", "claim-1");

    const updateArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.status).toBe("SUBMITTED");
    expect(updateArgs.data.submissionDate).toBeInstanceOf(Date);
    expect(sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "claim.submitted",
        subject: "Progress claim submitted — IS-PC003"
      })
    );
  });
});

describe("ContractsService.approveClaim — retention arithmetic", () => {
  const submittedClaim = (retentionPct: number) =>
    claimRow({ status: "SUBMITTED", contract: contractRow({ retentionPct }) });

  it("rejects approval when the claim is not SUBMITTED", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      claimRow({ status: "DRAFT" })
    );
    await expect(
      service.approveClaim("contract-1", "claim-1", { totalApproved: 100 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("holds retention at the contract percentage: 5% of 10,000 = 500.00", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(submittedClaim(5));

    await service.approveClaim("contract-1", "claim-1", { totalApproved: 10000 });

    const updateArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.status).toBe("APPROVED");
    expect(Number(updateArgs.data.totalApproved)).toBe(10000);
    expect(Number(updateArgs.data.retentionHeld)).toBe(500);
  });

  it("rounds retention to cents: 10% of 33,333.33 = 3,333.33", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(submittedClaim(10));
    await service.approveClaim("contract-1", "claim-1", { totalApproved: 33333.33 });
    const updateArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.retentionHeld)).toBe(3333.33);
  });

  it("holds zero retention when the contract retentionPct is 0", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(submittedClaim(0));
    await service.approveClaim("contract-1", "claim-1", { totalApproved: 9999.99 });
    const updateArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.retentionHeld)).toBe(0);
  });

  it("holds the full approved amount at the 100% retention boundary", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(submittedClaim(100));
    await service.approveClaim("contract-1", "claim-1", { totalApproved: 1234.56 });
    const updateArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.retentionHeld)).toBe(1234.56);
  });

  it("handles a zero-value approved claim — retention 0 on $0", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(submittedClaim(5));
    await service.approveClaim("contract-1", "claim-1", { totalApproved: 0 });
    const updateArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Number(updateArgs.data.totalApproved)).toBe(0);
    expect(Number(updateArgs.data.retentionHeld)).toBe(0);
  });
});

describe("ContractsService.payClaim", () => {
  it("rejects payment when the claim is not APPROVED", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      claimRow({ status: "SUBMITTED" })
    );
    await expect(
      service.payClaim("contract-1", "claim-1", { totalPaid: 100, paidDate: "2026-06-30" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("marks the claim PAID with the paid amount and date", async () => {
    const { service, prisma } = buildService();
    (prisma.progressClaim as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      claimRow({ status: "APPROVED" })
    );

    await service.payClaim("contract-1", "claim-1", { totalPaid: 9500, paidDate: "2026-06-30" });

    const updateArgs = (prisma.progressClaim as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.status).toBe("PAID");
    expect(Number(updateArgs.data.totalPaid)).toBe(9500);
    expect(updateArgs.data.paidDate).toEqual(new Date("2026-06-30"));
  });
});

// ─── checkClaimCutoffs — cut-off date logic ────────────────────────────────

describe("ContractsService.checkClaimCutoffs", () => {
  it("notifies the assigned reminder user and emails the contact exactly 7 days before the cut-off", async () => {
    const { service, prisma, notificationCreate, sendNotificationEmail } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([cutoffContract()]);

    // 2026-07-20 is a Monday (no adjustment); today = 2026-07-13 → 7 days away.
    await service.checkClaimCutoffs(new Date(Date.UTC(2026, 6, 13)));

    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        title: "Claim due — P-2026-001",
        severity: "LOW"
      })
    );
    expect(sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "claim.cutoff_reminder", subject: "Progress claim due — P-2026-001" })
    );
  });

  it("rolls a weekend cut-off back to the preceding Friday before measuring the 7-day window", async () => {
    const { service, prisma, notificationCreate } = buildService();
    // claimCutoffDay 25 → 2026-07-25 is a Saturday → adjusted to Friday 24th.
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      cutoffContract({ claimCutoffDay: 25 })
    ]);

    // Friday 2026-07-17 is exactly 7 days before the adjusted Friday 24th.
    await service.checkClaimCutoffs(new Date(Date.UTC(2026, 6, 17)));

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    const body = (notificationCreate.mock.calls[0]?.[0] as { body: string }).body;
    // en-AU CLDR keeps "July" as its abbreviated month name.
    expect(body).toContain("24 July 2026");
  });

  it("does nothing when the adjusted cut-off is not exactly 7 days away", async () => {
    const { service, prisma, notificationCreate, sendNotificationEmail } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([cutoffContract()]);

    // today = 2026-07-12 → 8 days before the 20th.
    await service.checkClaimCutoffs(new Date(Date.UTC(2026, 6, 12)));

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("skips contracts whose client has no configured cut-off day", async () => {
    const { service, prisma, notificationCreate } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      cutoffContract({ claimCutoffDay: null })
    ]);
    await service.checkClaimCutoffs(new Date(Date.UTC(2026, 6, 13)));
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it("falls back to the default Accounts owner when no per-client reminder user is set", async () => {
    const { service, prisma, notificationCreate, sendNotificationEmail } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      cutoffContract({ claimReminderUserId: null, claimReminderUser: null })
    ]);

    await service.checkClaimCutoffs(new Date(Date.UTC(2026, 6, 13)));

    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-supervisor-002" })
    );
    // No reminder-user email on file → no email is sent.
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("rolls past a month boundary when this month's cut-off has already passed", async () => {
    const { service, prisma, notificationCreate } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      cutoffContract({ claimCutoffDay: 3 })
    ]);

    // 2026-08-03 is a Monday; today = 2026-07-27 (after July's 3rd) → 7 days away.
    await service.checkClaimCutoffs(new Date(Date.UTC(2026, 6, 27)));

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    const body = (notificationCreate.mock.calls[0]?.[0] as { body: string }).body;
    expect(body).toContain("03 Aug 2026");
  });
});

describe("ContractsService.runClaimCutoffReminders", () => {
  it("swallows errors from the cut-off check so the cron never crashes", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockRejectedValueOnce(new Error("db down"));
    await expect(service.runClaimCutoffReminders()).resolves.toBeUndefined();
  });
});
