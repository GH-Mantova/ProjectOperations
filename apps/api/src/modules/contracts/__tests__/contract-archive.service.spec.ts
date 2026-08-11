// Unit tests for ContractArchiveService (S1 contract archive/unarchive/hardDelete).
//
// Pattern mirrors contracts.service.spec.ts: Prisma is a plain object of
// jest.fn()s, the service is instantiated directly with `as never` casts,
// and $transaction is not required here (no transactional calls).

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ContractArchiveService } from "../contract-archive.service";

const contractRow = (overrides: Record<string, unknown> = {}) => ({
  id: "contract-1",
  contractNumber: "IS-C001",
  projectId: "project-1",
  status: "ACTIVE",
  contractValue: 100000,
  archivedAt: null,
  archivedById: null,
  ...overrides
});

function buildService(extraPrisma: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    contract: {
      findUnique: jest.fn().mockResolvedValue(contractRow()),
      update: jest.fn().mockResolvedValue(contractRow()),
      delete: jest.fn().mockResolvedValue(contractRow())
    },
    ...extraPrisma
  };

  const audit = { write: jest.fn().mockResolvedValue(undefined) };

  const service = new ContractArchiveService(prisma as never, audit as never);

  return { service, prisma, audit };
}

// ─── archive ───────────────────────────────────────────────────────────────

describe("ContractArchiveService.archive", () => {
  it("sets archivedAt and archivedById on the contract", async () => {
    const { service, prisma } = buildService();
    const archivedRow = contractRow({ archivedAt: new Date(), archivedById: "user-1" });
    (prisma.contract as { update: jest.Mock }).update.mockResolvedValueOnce(archivedRow);

    const result = await service.archive("contract-1", "user-1");

    const updateCall = (prisma.contract as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { archivedAt: Date; archivedById: string };
    };
    expect(updateCall.where).toEqual({ id: "contract-1" });
    expect(updateCall.data.archivedById).toBe("user-1");
    expect(updateCall.data.archivedAt).toBeInstanceOf(Date);
    expect(result).toMatchObject({ id: "contract-1" });
  });

  it("throws NotFoundException when the contract does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.archive("missing", "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("writes an audit log entry", async () => {
    const { service, audit } = buildService();
    await service.archive("contract-1", "user-1");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "contracts.archive", entityId: "contract-1" })
    );
  });
});

// ─── unarchive ─────────────────────────────────────────────────────────────

describe("ContractArchiveService.unarchive", () => {
  it("clears archivedAt and archivedById on the contract", async () => {
    const { service, prisma } = buildService();
    await service.unarchive("contract-1", "user-1");

    const updateCall = (prisma.contract as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { archivedAt: null; archivedById: null };
    };
    expect(updateCall.where).toEqual({ id: "contract-1" });
    expect(updateCall.data.archivedAt).toBeNull();
    expect(updateCall.data.archivedById).toBeNull();
  });

  it("throws NotFoundException when the contract does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.unarchive("missing", "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("writes an audit log entry", async () => {
    const { service, audit } = buildService();
    await service.unarchive("contract-1", "user-1");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "contracts.unarchive", entityId: "contract-1" })
    );
  });
});

// ─── hardDelete ────────────────────────────────────────────────────────────

describe("ContractArchiveService.hardDelete", () => {
  it("deletes the contract row (and cascades to children via Postgres FK)", async () => {
    const { service, prisma } = buildService();
    await service.hardDelete("contract-1", "user-1", true);

    const deleteCall = (prisma.contract as { delete: jest.Mock }).delete.mock.calls[0]?.[0] as {
      where: { id: string };
    };
    expect(deleteCall.where).toEqual({ id: "contract-1" });
  });

  it("throws ForbiddenException when isSuperUser is false", async () => {
    const { service } = buildService();
    await expect(service.hardDelete("contract-1", "user-1", false)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws NotFoundException when the contract does not exist (super-user path)", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.hardDelete("missing", "user-1", true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("writes an audit log entry with permanent=true", async () => {
    const { service, audit } = buildService();
    await service.hardDelete("contract-1", "user-1", true);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "contracts.hardDelete",
        entityId: "contract-1",
        metadata: { permanent: true }
      })
    );
  });
});
