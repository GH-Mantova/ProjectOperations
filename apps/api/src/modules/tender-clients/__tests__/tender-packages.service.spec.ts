// Mock-based unit tests for TenderPackagesService. Follows the pattern used
// by tender-clients.service.spec.ts: Prisma is mocked per-test via
// `buildService`, no TestingModule, no database.

import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import { TenderPackagesService } from "../tender-packages.service";

const disciplineItem = (overrides: Record<string, unknown> = {}) => ({
  id: "gli-asbestos",
  value: "asbestos",
  label: "Asbestos",
  sortOrder: 0,
  isArchived: false,
  list: { slug: "tender-package-disciplines" },
  ...overrides
});

const tenderPackageRow = (overrides: Record<string, unknown> = {}) => ({
  id: "tp-1",
  tenderId: "tender-1",
  disciplineItemId: "gli-asbestos",
  ...overrides
});

const tenderClientRow = (overrides: Record<string, unknown> = {}) => ({
  id: "tc-1",
  tenderId: "tender-1",
  clientId: "client-1",
  ...overrides
});

const cellRow = (overrides: Record<string, unknown> = {}) => ({
  id: "cell-1",
  tenderClientId: "tc-1",
  tenderPackageId: "tp-1",
  pricingBasis: "DOCUMENTS",
  basisNote: null,
  tenderClient: { tenderId: "tender-1" },
  ...overrides
});

function buildService(extraPrisma: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    tender: {
      findUnique: jest.fn().mockResolvedValue({ id: "tender-1" })
    },
    tenderClient: {
      findUnique: jest.fn().mockResolvedValue(tenderClientRow()),
      update: jest.fn().mockImplementation(({ data }: { data: unknown }) =>
        Promise.resolve({ ...tenderClientRow(), ...(data as object) })
      )
    },
    tenderPackage: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(tenderPackageRow()),
      delete: jest.fn().mockResolvedValue(tenderPackageRow())
    },
    tenderClientPackage: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(cellRow()),
      update: jest.fn().mockResolvedValue(cellRow()),
      delete: jest.fn().mockResolvedValue(cellRow())
    },
    globalListItem: {
      findUnique: jest.fn().mockResolvedValue(disciplineItem())
    },
    ...extraPrisma
  };

  const service = new TenderPackagesService(prisma as never);
  return { service, prisma };
}

// ─── addPackage ────────────────────────────────────────────────────────────

describe("TenderPackagesService.addPackage", () => {
  it("creates a package for the tender+discipline and returns the refreshed list", async () => {
    const { service, prisma } = buildService();
    const listed = [{ ...tenderPackageRow(), disciplineItem: disciplineItem() }];
    (prisma.tenderPackage as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(listed);

    const result = await service.addPackage("tender-1", "gli-asbestos");

    expect((prisma.tenderPackage as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: "tender-1", disciplineItemId: "gli-asbestos" }
    });
    expect(result).toEqual(listed);
  });

  it("throws ConflictException when the same package is added twice (dedup guard)", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      tenderPackageRow()
    );
    await expect(service.addPackage("tender-1", "gli-asbestos")).rejects.toBeInstanceOf(
      ConflictException
    );
    expect((prisma.tenderPackage as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("rejects a GlobalListItem that isn't from the tender-package-disciplines list", async () => {
    const { service, prisma } = buildService();
    (prisma.globalListItem as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      disciplineItem({ list: { slug: "materials" } })
    );
    await expect(service.addPackage("tender-1", "gli-bogus")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects an archived discipline", async () => {
    const { service, prisma } = buildService();
    (prisma.globalListItem as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      disciplineItem({ isArchived: true })
    );
    await expect(service.addPackage("tender-1", "gli-asbestos")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.addPackage("missing", "gli-asbestos")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

// ─── removePackage ─────────────────────────────────────────────────────────

describe("TenderPackagesService.removePackage", () => {
  it("deletes the package when it belongs to the tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      tenderPackageRow()
    );
    await service.removePackage("tender-1", "tp-1");
    expect((prisma.tenderPackage as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
      where: { id: "tp-1" }
    });
  });

  it("throws NotFoundException when the package is on a different tender (cross-tender guard)", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      tenderPackageRow({ tenderId: "tender-other" })
    );
    await expect(service.removePackage("tender-1", "tp-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect((prisma.tenderPackage as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
  });
});

// ─── matrix attach / detach / update ───────────────────────────────────────

describe("TenderPackagesService.attachCell", () => {
  it("creates the join row with basis default DOCUMENTS when omitted", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      tenderPackageRow()
    );
    await service.attachCell("tender-1", "tc-1", "tp-1");
    expect((prisma.tenderClientPackage as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: {
        tenderClientId: "tc-1",
        tenderPackageId: "tp-1",
        pricingBasis: "DOCUMENTS",
        basisNote: null
      }
    });
  });

  it("passes through pricingBasis + basisNote when provided", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      tenderPackageRow()
    );
    await service.attachCell("tender-1", "tc-1", "tp-1", "IDENTIFIED_RISK", "asbestos risk area");
    expect((prisma.tenderClientPackage as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: {
        tenderClientId: "tc-1",
        tenderPackageId: "tp-1",
        pricingBasis: "IDENTIFIED_RISK",
        basisNote: "asbestos risk area"
      }
    });
  });

  it("rejects a cell where the client and package are on different tenders (cross-tender guard)", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "tp-1",
      tenderId: "tender-other"
    });
    await expect(
      service.attachCell("tender-1", "tc-1", "tp-1")
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma.tenderClientPackage as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("throws ConflictException when the cell already exists", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      tenderPackageRow()
    );
    (prisma.tenderClientPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      cellRow()
    );
    await expect(
      service.attachCell("tender-1", "tc-1", "tp-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("TenderPackagesService.updateCell", () => {
  it("updates pricingBasis only when basisNote not provided", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClientPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      cellRow()
    );
    await service.updateCell("tender-1", "cell-1", "CLIENT_REQUEST");
    expect((prisma.tenderClientPackage as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "cell-1" },
      data: { pricingBasis: "CLIENT_REQUEST" }
    });
  });

  it("clears basisNote when explicitly passed null", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClientPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      cellRow()
    );
    await service.updateCell("tender-1", "cell-1", undefined, null);
    expect((prisma.tenderClientPackage as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "cell-1" },
      data: { basisNote: null }
    });
  });

  it("throws NotFoundException when the cell is not on this tender (cross-tender guard)", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClientPackage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      cellRow({ tenderClient: { tenderId: "tender-other" } })
    );
    await expect(
      service.updateCell("tender-1", "cell-1", "DOCUMENTS")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── setSubmissionDate ─────────────────────────────────────────────────────

describe("TenderPackagesService.setSubmissionDate", () => {
  it("updates submissionDate on the tender client when it belongs to the tender", async () => {
    const { service, prisma } = buildService();
    const when = new Date("2026-08-01T00:00:00.000Z");
    await service.setSubmissionDate("tender-1", "tc-1", when);
    expect((prisma.tenderClient as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "tc-1" },
      data: { submissionDate: when }
    });
  });

  it("throws NotFoundException when the tender client is on a different tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      tenderClientRow({ tenderId: "tender-other" })
    );
    await expect(
      service.setSubmissionDate("tender-1", "tc-1", new Date())
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── documentBuckets (derived union) ───────────────────────────────────────

describe("TenderPackagesService.documentBuckets", () => {
  it("returns the union (dedup) of packages selected by any client, ordered by discipline sortOrder", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClientPackage as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      {
        tenderPackage: {
          id: "tp-1",
          disciplineItemId: "gli-asbestos",
          disciplineItem: { id: "gli-asbestos", value: "asbestos", label: "Asbestos", sortOrder: 0 }
        }
      },
      {
        tenderPackage: {
          id: "tp-2",
          disciplineItemId: "gli-demo",
          disciplineItem: { id: "gli-demo", value: "demolition", label: "Demolition", sortOrder: 1 }
        }
      },
      // Same package as first row (client B also prices asbestos) — must dedup.
      {
        tenderPackage: {
          id: "tp-1",
          disciplineItemId: "gli-asbestos",
          disciplineItem: { id: "gli-asbestos", value: "asbestos", label: "Asbestos", sortOrder: 0 }
        }
      }
    ]);

    const result = await service.documentBuckets("tender-1");

    expect(result).toEqual([
      { packageId: "tp-1", disciplineItemId: "gli-asbestos", value: "asbestos", label: "Asbestos", sortOrder: 0 },
      { packageId: "tp-2", disciplineItemId: "gli-demo", value: "demolition", label: "Demolition", sortOrder: 1 }
    ]);
  });

  it("returns [] when no client is pricing any package", async () => {
    const { service } = buildService();
    await expect(service.documentBuckets("tender-1")).resolves.toEqual([]);
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.documentBuckets("missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
