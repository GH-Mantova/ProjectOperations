import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SubcontractorRatesService } from "../subcontractor-rates.service";

// ---------------------------------------------------------------------------
// Mock types
// ---------------------------------------------------------------------------

type MockPrisma = {
  subcontractorSupplier: { findUnique: jest.Mock };
  subcontractorRate: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    subcontractorSupplier: {
      findUnique: jest.fn()
    },
    subcontractorRate: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn()
  };
  // Default: $transaction calls the callback with prisma itself as the tx handle.
  prisma.$transaction.mockImplementation(
    async (cb: (tx: MockPrisma) => unknown) => cb(prisma)
  );
  return prisma;
}

function makeService(prisma: MockPrisma) {
  return new SubcontractorRatesService(prisma as never);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUPPLIER_ID = "sup-1";
const RATE_ID = "rate-1";

const EXISTING_RATE = {
  id: RATE_ID,
  subcontractorSupplierId: SUPPLIER_ID,
  discipline: "DEM",
  unit: "hr",
  rate: "100.00",
  validFrom: null,
  validTo: null,
  notes: null,
  isActive: true,
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
  createdById: null,
  updatedById: null
};

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe("SubcontractorRatesService.list", () => {
  test("returns rates for a known supplier", async () => {
    const prisma = makePrisma();
    prisma.subcontractorSupplier.findUnique.mockResolvedValue({ id: SUPPLIER_ID });
    prisma.subcontractorRate.findMany.mockResolvedValue([EXISTING_RATE]);

    const result = await makeService(prisma).list(SUPPLIER_ID);

    expect(prisma.subcontractorSupplier.findUnique).toHaveBeenCalledWith({
      where: { id: SUPPLIER_ID },
      select: { id: true }
    });
    expect(result).toHaveLength(1);
  });

  test("throws NotFoundException when supplier does not exist", async () => {
    const prisma = makePrisma();
    prisma.subcontractorSupplier.findUnique.mockResolvedValue(null);

    await expect(makeService(prisma).list("unknown-sup")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.subcontractorRate.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe("SubcontractorRatesService.get", () => {
  test("returns rate when found", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(EXISTING_RATE);

    const result = await makeService(prisma).get(SUPPLIER_ID, RATE_ID);
    expect(result.id).toBe(RATE_ID);
  });

  test("throws NotFoundException when rate not found", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(null);

    await expect(makeService(prisma).get(SUPPLIER_ID, "missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("SubcontractorRatesService.create", () => {
  test("creates rate with valid discipline", async () => {
    const prisma = makePrisma();
    prisma.subcontractorSupplier.findUnique.mockResolvedValue({ id: SUPPLIER_ID });
    prisma.subcontractorRate.create.mockResolvedValue({ ...EXISTING_RATE, id: "rate-new" });

    const result = await makeService(prisma).create(
      SUPPLIER_ID,
      { discipline: "DEM", unit: "hr", rate: "100.00" },
      "actor-1"
    );

    expect(prisma.subcontractorRate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discipline: "DEM",
          unit: "hr",
          rate: "100.00",
          subcontractorSupplierId: SUPPLIER_ID,
          createdById: "actor-1"
        })
      })
    );
    expect(result.id).toBe("rate-new");
  });

  test("rejects an unknown discipline code", async () => {
    const prisma = makePrisma();
    prisma.subcontractorSupplier.findUnique.mockResolvedValue({ id: SUPPLIER_ID });

    await expect(
      makeService(prisma).create(SUPPLIER_ID, { discipline: "UNKNOWN", unit: "hr", rate: "50.00" })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.subcontractorRate.create).not.toHaveBeenCalled();
  });

  test("rejects when supplier does not exist", async () => {
    const prisma = makePrisma();
    prisma.subcontractorSupplier.findUnique.mockResolvedValue(null);

    await expect(
      makeService(prisma).create(SUPPLIER_ID, { discipline: "CIV", unit: "day", rate: "900.00" })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.subcontractorRate.create).not.toHaveBeenCalled();
  });

  test("accepts all canonical discipline codes", async () => {
    for (const discipline of ["DEM", "CIV", "ASB", "Other"]) {
      const prisma = makePrisma();
      prisma.subcontractorSupplier.findUnique.mockResolvedValue({ id: SUPPLIER_ID });
      prisma.subcontractorRate.create.mockResolvedValue({ ...EXISTING_RATE, discipline });

      await expect(
        makeService(prisma).create(SUPPLIER_ID, { discipline, unit: "hr", rate: "50.00" })
      ).resolves.toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// supersede
// ---------------------------------------------------------------------------

describe("SubcontractorRatesService.supersede", () => {
  test("creates new row and deactivates old row in one transaction", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(EXISTING_RATE);
    const NEW_RATE = { ...EXISTING_RATE, id: "rate-2", rate: "140.00" };
    prisma.subcontractorRate.create.mockResolvedValue(NEW_RATE);
    prisma.subcontractorRate.update.mockResolvedValue({ ...EXISTING_RATE, isActive: false });

    const result = await makeService(prisma).supersede(
      SUPPLIER_ID,
      RATE_ID,
      { rate: "140.00" },
      "actor-1"
    );

    // Assert old row is deactivated.
    expect(prisma.subcontractorRate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RATE_ID },
        data: expect.objectContaining({ isActive: false })
      })
    );

    // Assert new row is created with the new rate.
    expect(prisma.subcontractorRate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rate: "140.00",
          isActive: true,
          createdById: "actor-1"
        })
      })
    );

    expect(result.id).toBe("rate-2");
  });

  test("inherits discipline/unit from old row when not provided", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(EXISTING_RATE);
    prisma.subcontractorRate.update.mockResolvedValue({ ...EXISTING_RATE, isActive: false });
    prisma.subcontractorRate.create.mockResolvedValue({ ...EXISTING_RATE, id: "rate-2", rate: "200.00" });

    await makeService(prisma).supersede(SUPPLIER_ID, RATE_ID, { rate: "200.00" });

    const createCall = prisma.subcontractorRate.create.mock.calls[0][0];
    expect(createCall.data.discipline).toBe(EXISTING_RATE.discipline);
    expect(createCall.data.unit).toBe(EXISTING_RATE.unit);
  });

  test("rejects an unknown discipline code on supersede", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(EXISTING_RATE);

    await expect(
      makeService(prisma).supersede(SUPPLIER_ID, RATE_ID, { rate: "100.00", discipline: "INVALID" })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("closes old validTo when closeOldValidTo is provided", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(EXISTING_RATE);
    prisma.subcontractorRate.update.mockResolvedValue({ ...EXISTING_RATE, isActive: false });
    prisma.subcontractorRate.create.mockResolvedValue({ ...EXISTING_RATE, id: "rate-2" });

    await makeService(prisma).supersede(SUPPLIER_ID, RATE_ID, {
      rate: "150.00",
      closeOldValidTo: "2026-08-31"
    });

    const updateCall = prisma.subcontractorRate.update.mock.calls[0][0];
    expect(updateCall.data.validTo).toEqual(new Date("2026-08-31"));
  });

  test("throws NotFoundException when old rate not found", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(null);

    await expect(
      makeService(prisma).supersede(SUPPLIER_ID, "missing-rate", { rate: "100.00" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// deactivate
// ---------------------------------------------------------------------------

describe("SubcontractorRatesService.deactivate", () => {
  test("sets isActive to false on a known rate", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(EXISTING_RATE);
    prisma.subcontractorRate.update.mockResolvedValue({ ...EXISTING_RATE, isActive: false });

    const result = await makeService(prisma).deactivate(SUPPLIER_ID, RATE_ID, "actor-1");

    expect(prisma.subcontractorRate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RATE_ID },
        data: expect.objectContaining({ isActive: false, updatedById: "actor-1" })
      })
    );
    expect(result.isActive).toBe(false);
  });

  test("throws NotFoundException when rate not found", async () => {
    const prisma = makePrisma();
    prisma.subcontractorRate.findFirst.mockResolvedValue(null);

    await expect(makeService(prisma).deactivate(SUPPLIER_ID, "missing", "actor-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.subcontractorRate.update).not.toHaveBeenCalled();
  });
});
