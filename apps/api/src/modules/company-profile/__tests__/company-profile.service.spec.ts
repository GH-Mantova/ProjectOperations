// Mock-based unit tests for CompanyProfileService. Follows the house
// pattern (compliance.service.spec.ts): Prisma is a plain object of
// jest.fn()s and the service is instantiated directly with `as never`.
//
// Coverage emphasis:
//   1. Legal document versioning: editing content creates a NEW row and
//      closes the previous one. The old row is NEVER mutated.
//   2. Super-user assertion: non-super-user calls throw ForbiddenException.
//   3. Update diffing writes one audit entry per changed field.

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CompanyProfileService, COMPANY_PROFILE_ID } from "../company-profile.service";

function buildService(extraPrisma: Record<string, unknown> = {}) {
  const auditWrite = jest.fn().mockResolvedValue({ id: "audit-1" });
  const prisma: Record<string, unknown> = {
    companyProfile: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    companyLegalDocument: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn()
    },
    entityLicence: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    entityInsurance: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    ...extraPrisma
  };
  const service = new CompanyProfileService(prisma as never, { write: auditWrite } as never);
  return { service, prisma, auditWrite };
}

describe("CompanyProfileService.assertSuperUser", () => {
  it("throws ForbiddenException for a non-super-user", () => {
    const { service } = buildService();
    expect(() => service.assertSuperUser({ isSuperUser: false })).toThrow(ForbiddenException);
    expect(() => service.assertSuperUser(undefined)).toThrow(ForbiddenException);
  });

  it("allows a super-user", () => {
    const { service } = buildService();
    expect(() => service.assertSuperUser({ isSuperUser: true })).not.toThrow();
  });
});

describe("CompanyProfileService.getProfile", () => {
  it("throws NotFoundException when the singleton is missing (seed hasn't run)", async () => {
    const { service, prisma } = buildService();
    (prisma.companyProfile as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.getProfile()).rejects.toThrow(NotFoundException);
  });

  it("computes completeness — flags unset fields and default identity", async () => {
    const { service, prisma } = buildService();
    (prisma.companyProfile as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: COMPANY_PROFILE_ID,
      legalName: "Initial Services Group Pty Ltd",
      tradingName: "Initial Services",
      abn: "75 631 222 556",
      primaryEmail: "admin@initialservices.net",
      primaryPhone: "(07) 3888 0539",
      registeredAddressLine1: "10 Grice St",
      registeredSuburb: "Clontarf",
      registeredState: "QLD",
      registeredPostcode: "4019",
      whsOfficerUserId: null,
      logoLightUrl: null,
      pdfLetterheadUrl: null,
      whsOfficer: null
    });
    const result = await service.getProfile();
    expect(result.completeness.unsetFields).toEqual(
      expect.arrayContaining(["whsOfficerUserId", "logoLightUrl", "pdfLetterheadUrl"])
    );
    expect(result.completeness.usingDefaultIdentity).toBe(true);
  });
});

describe("CompanyProfileService.updateProfile", () => {
  it("writes one audit entry per changed field, with identity-critical prefix for legalName", async () => {
    const before = {
      id: COMPANY_PROFILE_ID,
      legalName: "Initial Services Group Pty Ltd",
      tradingName: "Initial Services",
      abn: "75 631 222 556",
      primaryEmail: "admin@initialservices.net",
      whsOfficer: null
    };
    const after = { ...before, legalName: "Renamed Pty Ltd", primaryEmail: "hello@example.com" };
    const { service, prisma, auditWrite } = buildService();
    const findUniqueMock = (prisma.companyProfile as { findUnique: jest.Mock }).findUnique;
    findUniqueMock
      .mockResolvedValueOnce(before) // read in updateProfile
      .mockResolvedValueOnce(after); // read in getProfile at the end
    (prisma.companyProfile as { update: jest.Mock }).update.mockResolvedValueOnce(after);

    await service.updateProfile("actor-1", {
      legalName: "Renamed Pty Ltd",
      primaryEmail: "hello@example.com"
    });

    // Two audit rows, one per changed field. legalName is identity-critical.
    expect(auditWrite).toHaveBeenCalledTimes(2);
    const actions = auditWrite.mock.calls.map((c) => c[0].action);
    expect(actions).toContain("companyProfile.identity.legalName.update");
    expect(actions).toContain("companyProfile.primaryEmail.update");
  });
});

describe("CompanyProfileService.createLegalDocumentVersion", () => {
  it("closes the previous active version and creates a new one (does NOT mutate the old one)", async () => {
    const { service, prisma, auditWrite } = buildService();
    const previous = {
      id: "doc-v1",
      type: "TERMS_AND_CONDITIONS",
      version: 1,
      content: "v1 content",
      isActive: true
    };
    (prisma.companyLegalDocument as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(previous);
    (prisma.companyLegalDocument as { create: jest.Mock }).create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "doc-v2", ...data })
    );

    const created = await service.createLegalDocumentVersion("actor-1", {
      type: "TERMS_AND_CONDITIONS",
      content: "v2 content"
    });

    // Previous row closed — isActive=false, effectiveTo set. Content NOT touched.
    const updateMock = (prisma.companyLegalDocument as { update: jest.Mock }).update;
    expect(updateMock).toHaveBeenCalledTimes(1);
    const updateArgs = updateMock.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "doc-v1" });
    expect(updateArgs.data.isActive).toBe(false);
    expect(updateArgs.data.effectiveTo).toBeInstanceOf(Date);
    expect(updateArgs.data.content).toBeUndefined(); // OLD CONTENT NOT MUTATED

    // New version created with version=2.
    const createMock = (prisma.companyLegalDocument as { create: jest.Mock }).create;
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].data.version).toBe(2);
    expect(createMock.mock.calls[0][0].data.content).toBe("v2 content");
    expect(created.version).toBe(2);

    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "companyProfile.legalDocument.TERMS_AND_CONDITIONS.newVersion"
      })
    );
  });

  it("starts at version 1 when no previous version exists", async () => {
    const { service, prisma } = buildService();
    (prisma.companyLegalDocument as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(null);
    (prisma.companyLegalDocument as { create: jest.Mock }).create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "doc-v1", ...data })
    );
    const created = await service.createLegalDocumentVersion("actor-1", {
      type: "COVER_LETTER",
      content: "initial content"
    });
    expect(created.version).toBe(1);
    expect((prisma.companyLegalDocument as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });

  it("rejects empty content", async () => {
    const { service } = buildService();
    await expect(
      service.createLegalDocumentVersion("actor-1", {
        type: "TERMS_AND_CONDITIONS",
        content: "   "
      })
    ).rejects.toThrow(/content cannot be empty/i);
  });
});
