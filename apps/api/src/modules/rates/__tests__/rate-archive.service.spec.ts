// Unit tests for RateArchiveService (S2 vendor archive/unarchive/hardDelete).
//
// Pattern mirrors contract-archive.service.spec.ts: Prisma is a plain object
// of jest.fn()s and the service is instantiated directly with `as never` casts.

import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { RateArchiveService } from "../rate-archive.service";

const vendorRow = (overrides: Record<string, unknown> = {}) => ({
  id: "vendor-1",
  name: "Acme Excavators",
  entityType: "subcontractor",
  archivedAt: null,
  archivedById: null,
  ...overrides
});

function buildService(extraPrisma: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    subcontractorSupplier: {
      findUnique: jest.fn().mockResolvedValue(vendorRow()),
      update: jest.fn().mockResolvedValue(vendorRow()),
      delete: jest.fn().mockResolvedValue(vendorRow())
    },
    commitment: {
      count: jest.fn().mockResolvedValue(0)
    },
    ...extraPrisma
  };

  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const service = new RateArchiveService(prisma as never, audit as never);
  return { service, prisma, audit };
}

describe("RateArchiveService.archive", () => {
  it("sets archivedAt and archivedById on the vendor", async () => {
    const { service, prisma } = buildService();
    await service.archive("vendor-1", "user-1");

    const updateCall = (prisma.subcontractorSupplier as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { archivedAt: Date; archivedById: string };
    };
    expect(updateCall.where).toEqual({ id: "vendor-1" });
    expect(updateCall.data.archivedById).toBe("user-1");
    expect(updateCall.data.archivedAt).toBeInstanceOf(Date);
  });

  it("throws NotFoundException when the vendor does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.subcontractorSupplier as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.archive("missing", "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("writes an audit log entry", async () => {
    const { service, audit } = buildService();
    await service.archive("vendor-1", "user-1");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "subcontractors.archive", entityId: "vendor-1" })
    );
  });
});

describe("RateArchiveService.unarchive", () => {
  it("clears archivedAt and archivedById on the vendor", async () => {
    const { service, prisma } = buildService();
    await service.unarchive("vendor-1", "user-1");

    const updateCall = (prisma.subcontractorSupplier as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { archivedAt: null; archivedById: null };
    };
    expect(updateCall.where).toEqual({ id: "vendor-1" });
    expect(updateCall.data.archivedAt).toBeNull();
    expect(updateCall.data.archivedById).toBeNull();
  });

  it("throws NotFoundException when the vendor does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.subcontractorSupplier as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.unarchive("missing", "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("writes an audit log entry", async () => {
    const { service, audit } = buildService();
    await service.unarchive("vendor-1", "user-1");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "subcontractors.unarchive", entityId: "vendor-1" })
    );
  });
});

describe("RateArchiveService.hardDelete", () => {
  it("deletes the vendor row when no live commitments reference it", async () => {
    const { service, prisma } = buildService();
    await service.hardDelete("vendor-1", "user-1", true);

    const deleteCall = (prisma.subcontractorSupplier as { delete: jest.Mock }).delete.mock.calls[0]?.[0] as {
      where: { id: string };
    };
    expect(deleteCall.where).toEqual({ id: "vendor-1" });
  });

  it("throws ForbiddenException when isSuperUser is false", async () => {
    const { service } = buildService();
    await expect(service.hardDelete("vendor-1", "user-1", false)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws NotFoundException when the vendor does not exist (super-user path)", async () => {
    const { service, prisma } = buildService();
    (prisma.subcontractorSupplier as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.hardDelete("missing", "user-1", true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws ConflictException when live commitments still reference the vendor", async () => {
    const { service, prisma } = buildService();
    (prisma.commitment as { count: jest.Mock }).count.mockResolvedValueOnce(3);
    await expect(service.hardDelete("vendor-1", "user-1", true)).rejects.toBeInstanceOf(ConflictException);
    expect((prisma.subcontractorSupplier as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
  });

  it("writes an audit log entry with permanent=true", async () => {
    const { service, audit } = buildService();
    await service.hardDelete("vendor-1", "user-1", true);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "subcontractors.hardDelete",
        entityId: "vendor-1",
        metadata: { permanent: true }
      })
    );
  });
});
