// Mock-based unit tests for DirectoryService.
// Mirrors PR #283 (ProjectsService), PR #298 (FormsService), PR #311
// (SchedulerService). Drives the service directly with plain-object Prisma
// stubs — no production code is modified, no test database.
//
// The pre-existing spec next to this one (../directory.service.spec.ts)
// focuses narrowly on the Xero `paymentTermsDay` / `paymentTermsType` pair
// invariant for create/update. This file covers the rest of the public
// surface (list, get, softDelete, prequal, contacts, licences, insurances,
// credit applications, documents, expiryAlerts) plus the bank-masking and
// derived-status behaviours that aren't asserted elsewhere.

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { DirectoryService } from "../directory.service";

type AnyDto = Record<string, unknown>;
type AnyData = { data: AnyDto };
type WhereData = { where: { id: string }; data: AnyDto };

// ─── Fixtures ──────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_CREATE_BASE: AnyDto = {
  name: "Acme Subcontractors Pty Ltd",
  businessType: "company",
  entityType: "subcontractor",
  prequalStatus: "pending"
};

function buildPrismaMock(): {
  prisma: never;
  mocks: {
    sub: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    contact: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    licence: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    insurance: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    credit: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    document: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    client: { findUnique: jest.Mock; update: jest.Mock };
    transaction: jest.Mock;
  };
} {
  const sub = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn().mockImplementation(async ({ data }: AnyData) => ({ id: "sub-new", ...data })),
    update: jest
      .fn()
      .mockImplementation(async ({ where, data }: WhereData) => ({ id: where.id, ...data }))
  };
  const contact = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn().mockImplementation(async ({ data }: AnyData) => ({ id: "contact-new", ...data })),
    update: jest
      .fn()
      .mockImplementation(async ({ where, data }: WhereData) => ({ id: where.id, ...data })),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({ id: "contact-1" })
  };
  const licence = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    create: jest.fn().mockImplementation(async ({ data }: AnyData) => ({ id: "lic-new", ...data })),
    update: jest
      .fn()
      .mockImplementation(async ({ where, data }: WhereData) => ({ id: where.id, ...data })),
    delete: jest.fn().mockResolvedValue({ id: "lic-1" })
  };
  const insurance = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    create: jest.fn().mockImplementation(async ({ data }: AnyData) => ({ id: "ins-new", ...data })),
    update: jest
      .fn()
      .mockImplementation(async ({ where, data }: WhereData) => ({ id: where.id, ...data })),
    delete: jest.fn().mockResolvedValue({ id: "ins-1" })
  };
  const credit = {
    findUnique: jest.fn(),
    create: jest.fn().mockImplementation(async ({ data }: AnyData) => ({ id: "credit-new", ...data })),
    update: jest
      .fn()
      .mockImplementation(async ({ where, data }: WhereData) => ({ id: where.id, ...data }))
  };
  const document = {
    findFirst: jest.fn(),
    create: jest.fn().mockImplementation(async ({ data }: AnyData) => ({ id: "doc-new", ...data })),
    update: jest
      .fn()
      .mockImplementation(async ({ where, data }: WhereData) => ({ id: where.id, ...data })),
    delete: jest.fn().mockResolvedValue({ id: "doc-1" })
  };
  const client = {
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({})
  };

  // Default $transaction: run the callback against a tx that mirrors the
  // root mocks so individual tests can swap targeted methods without
  // wiring a separate tx surface every time.
  const transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      contact,
      subcontractorSupplier: sub,
      entityLicence: licence,
      entityInsurance: insurance,
      creditApplication: credit,
      subcontractorDocument: document,
      client
    })
  );

  const prisma = {
    subcontractorSupplier: sub,
    contact,
    entityLicence: licence,
    entityInsurance: insurance,
    creditApplication: credit,
    subcontractorDocument: document,
    client,
    $transaction: transaction
  } as never;

  return {
    prisma,
    mocks: { sub, contact, licence, insurance, credit, document, client, transaction }
  };
}

function makeService() {
  const { prisma, mocks } = buildPrismaMock();
  const service = new DirectoryService(prisma);
  return { service, mocks };
}

// ─── list ─────────────────────────────────────────────────────────────────

describe("DirectoryService.list", () => {
  it("returns rows with computed expiryAlerts count (expired + within 30 days)", async () => {
    const { service, mocks } = makeService();
    const past = new Date(Date.now() - 5 * DAY_MS);
    const soon = new Date(Date.now() + 10 * DAY_MS);
    const farFuture = new Date(Date.now() + 200 * DAY_MS);
    mocks.sub.findMany.mockResolvedValueOnce([
      {
        id: "sub-1",
        name: "A",
        licences: [
          { expiryDate: past, status: "expired" },
          { expiryDate: farFuture, status: "active" }
        ],
        insurances: [{ expiryDate: soon, status: "expiring_soon" }]
      }
    ]);
    const result = await service.list({});
    expect(result).toEqual([
      { id: "sub-1", name: "A", expiryAlerts: 2 }
    ]);
    expect(mocks.sub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" } })
    );
  });

  it("ignores type = 'all' and applies status + prequal + category + q filters", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findMany.mockResolvedValueOnce([]);
    await service.list({
      type: "all",
      category: "electrical",
      status: "inactive",
      prequal: "approved",
      q: "acme"
    });
    const passed = mocks.sub.findMany.mock.calls[0][0].where as AnyDto;
    expect(passed.entityType).toBeUndefined();
    expect(passed.categories).toEqual({ has: "electrical" });
    expect(passed.isActive).toBe(false);
    expect(passed.prequalStatus).toBe("approved");
    expect(passed.OR).toEqual([
      { name: { contains: "acme", mode: "insensitive" } },
      { tradingName: { contains: "acme", mode: "insensitive" } },
      { abn: { contains: "acme" } }
    ]);
  });

  it("applies entityType when type is not 'all' and isActive when status='active'", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findMany.mockResolvedValueOnce([]);
    await service.list({ type: "supplier", status: "active" });
    const where = mocks.sub.findMany.mock.calls[0][0].where as AnyDto;
    expect(where.entityType).toBe("supplier");
    expect(where.isActive).toBe(true);
  });
});

// ─── get ──────────────────────────────────────────────────────────────────

describe("DirectoryService.get", () => {
  it("throws NotFoundException when subcontractor is missing", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce(null);
    await expect(service.get("missing", true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("hydrates contacts via polymorphic Contact lookup and recomputes licence/insurance status", async () => {
    const { service, mocks } = makeService();
    const past = new Date(Date.now() - DAY_MS);
    mocks.sub.findUnique.mockResolvedValueOnce({
      id: "sub-1",
      name: "A",
      bankAccountNumber: "123456789",
      licences: [{ id: "lic-1", expiryDate: past, status: "active" }],
      insurances: [{ id: "ins-1", expiryDate: null, status: "active" }],
      documents: [],
      creditApplications: []
    });
    mocks.contact.findMany.mockResolvedValueOnce([{ id: "c-1", isPrimary: true }]);
    const result = await service.get("sub-1", true);

    expect(mocks.contact.findMany).toHaveBeenCalledWith({
      where: { organisationType: "SUBCONTRACTOR", organisationId: "sub-1" },
      orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }]
    });
    expect(result.contacts).toEqual([{ id: "c-1", isPrimary: true }]);
    // Expired licence reclassified by computeStatus
    expect(result.licences[0].status).toBe("expired");
    // Insurance with null expiry stays active
    expect(result.insurances[0].status).toBe("active");
  });

  it("masks bank fields when canSeeBank is false (account number kept last 3)", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({
      id: "sub-1",
      bankName: "Big Bank",
      bankAccountName: "Acme",
      bankBsb: "123-456",
      bankAccountNumber: "123456789",
      licences: [],
      insurances: [],
      documents: [],
      creditApplications: []
    });
    const result = await service.get("sub-1", false) as AnyDto;
    expect(result.bankName).toBeNull();
    expect(result.bankAccountName).toBeNull();
    expect(result.bankBsb).toBeNull();
    expect(result.bankAccountNumber).toBe("***789");
  });
});

// ─── create ───────────────────────────────────────────────────────────────

describe("DirectoryService.create", () => {
  it("throws BadRequestException when name is missing", async () => {
    const { service } = makeService();
    await expect(
      service.create({ businessType: "company", entityType: "subcontractor", prequalStatus: "pending" }, "actor-1", true)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid enum values", async () => {
    const { service } = makeService();
    await expect(
      service.create({ ...VALID_CREATE_BASE, businessType: "unicorn" }, "actor-1", true)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("strips bank fields from input when canEditBank is false", async () => {
    const { service, mocks } = makeService();
    await service.create(
      { ...VALID_CREATE_BASE, bankName: "Big Bank", bankAccountNumber: "999999999" },
      "actor-1",
      false
    );
    const passed = mocks.sub.create.mock.calls[0][0].data as AnyDto;
    expect(passed.bankName).toBeUndefined();
    expect(passed.bankAccountNumber).toBeUndefined();
    expect(passed.createdById).toBe("actor-1");
  });

  it("auto-creates a primary contact when businessType = 'private_person'", async () => {
    const { service, mocks } = makeService();
    await service.create(
      { ...VALID_CREATE_BASE, businessType: "private_person", name: "Jane Doe", phone: "0400", email: "j@d" },
      "actor-1",
      true
    );
    expect(mocks.contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationType: "SUBCONTRACTOR",
        firstName: "Jane",
        lastName: "Doe",
        isPrimary: true,
        phone: "0400",
        email: "j@d",
        createdById: "actor-1"
      })
    });
  });

  it("defaults prequalStatus to 'pending' and categories to [] when omitted (modal/curl minimal payload)", async () => {
    const { service, mocks } = makeService();
    await service.create(
      { name: "Minimal Co", businessType: "company", entityType: "subcontractor" },
      "actor-1",
      true
    );
    const passed = mocks.sub.create.mock.calls[0][0].data as AnyDto;
    expect(passed.prequalStatus).toBe("pending");
    expect(passed.categories).toEqual([]);
  });

  it("normalizes null categories to [] instead of passing NULL to the non-nullable column", async () => {
    const { service, mocks } = makeService();
    await service.create(
      { ...VALID_CREATE_BASE, categories: null },
      "actor-1",
      true
    );
    const passed = mocks.sub.create.mock.calls[0][0].data as AnyDto;
    expect(passed.categories).toEqual([]);
  });

  it("passes through an explicit valid prequalStatus and categories untouched", async () => {
    const { service, mocks } = makeService();
    await service.create(
      { ...VALID_CREATE_BASE, prequalStatus: "approved", categories: ["electrical"] },
      "actor-1",
      true
    );
    const passed = mocks.sub.create.mock.calls[0][0].data as AnyDto;
    expect(passed.prequalStatus).toBe("approved");
    expect(passed.categories).toEqual(["electrical"]);
  });

  it("still rejects an invalid prequalStatus when one is supplied", async () => {
    const { service } = makeService();
    await expect(
      service.create({ ...VALID_CREATE_BASE, prequalStatus: "bogus" }, "actor-1", true)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("uses '—' as lastName when private_person name has no space", async () => {
    const { service, mocks } = makeService();
    await service.create(
      { ...VALID_CREATE_BASE, businessType: "private_person", name: "Madonna" },
      "actor-1",
      true
    );
    const passed = mocks.contact.create.mock.calls[0][0].data as AnyDto;
    expect(passed.firstName).toBe("Madonna");
    expect(passed.lastName).toBe("—");
  });
});

// ─── update / softDelete / updatePrequal ──────────────────────────────────

describe("DirectoryService.update", () => {
  it("throws NotFoundException when entity is missing", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce(null);
    await expect(service.update("missing", { tradingName: "X" }, true)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("strips bank fields silently when canEditBank is false", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await service.update("sub-1", { tradingName: "T", bankAccountNumber: "999999999" }, false);
    const passed = mocks.sub.update.mock.calls[0][0].data as AnyDto;
    expect(passed.tradingName).toBe("T");
    expect(passed.bankAccountNumber).toBeUndefined();
  });

  it("treats an explicit null categories patch as clear ([]), not a NULL write", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await service.update("sub-1", { categories: null }, true);
    const passed = mocks.sub.update.mock.calls[0][0].data as AnyDto;
    expect(passed.categories).toEqual([]);
  });

  it("leaves categories untouched when omitted from the patch", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await service.update("sub-1", { tradingName: "T" }, true);
    const passed = mocks.sub.update.mock.calls[0][0].data as AnyDto;
    expect(passed.categories).toBeUndefined();
  });
});

describe("DirectoryService.softDelete", () => {
  it("flips isActive to false (does not hard-delete)", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await service.softDelete("sub-1");
    expect(mocks.sub.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { isActive: false }
    });
  });

  it("throws NotFoundException when entity is missing", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce(null);
    await expect(service.softDelete("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("DirectoryService.updatePrequal", () => {
  it("stamps prequalReviewedAt + prequalReviewedBy and saves status + notes", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    const before = Date.now();
    await service.updatePrequal("sub-1", "actor-1", {
      prequalStatus: "approved",
      prequalNotes: "ok"
    });
    const passed = mocks.sub.update.mock.calls[0][0].data as {
      prequalStatus: string;
      prequalNotes: string | null;
      prequalReviewedAt: Date;
      prequalReviewedBy: string;
    };
    expect(passed.prequalStatus).toBe("approved");
    expect(passed.prequalNotes).toBe("ok");
    expect(passed.prequalReviewedBy).toBe("actor-1");
    expect(passed.prequalReviewedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("rejects an invalid prequalStatus", async () => {
    const { service } = makeService();
    await expect(
      service.updatePrequal("sub-1", "actor-1", { prequalStatus: "weird" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ─── contacts ─────────────────────────────────────────────────────────────

describe("DirectoryService.addContact", () => {
  it("requires firstName and lastName", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await expect(
      service.addContact("sub-1", { firstName: "Only" }, "actor-1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when subcontractor does not exist", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.addContact("missing", { firstName: "A", lastName: "B" }, "actor-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("demotes existing primary when isPrimary is set on the new contact", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await service.addContact("sub-1", { firstName: "A", lastName: "B", isPrimary: true }, "actor-1");
    expect(mocks.contact.updateMany).toHaveBeenCalledWith({
      where: { organisationType: "SUBCONTRACTOR", organisationId: "sub-1", isPrimary: true },
      data: { isPrimary: false }
    });
    expect(mocks.contact.create).toHaveBeenCalled();
  });
});

describe("DirectoryService.updateContact", () => {
  it("throws NotFoundException when contact is not attached to the supplied parent", async () => {
    const { service, mocks } = makeService();
    mocks.contact.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.updateContact("sub-1", "c-999", { firstName: "X" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("demotes siblings before patching when isPrimary is set", async () => {
    const { service, mocks } = makeService();
    mocks.contact.findFirst.mockResolvedValueOnce({ id: "c-1" });
    await service.updateContact("sub-1", "c-1", { isPrimary: true });
    expect(mocks.contact.updateMany).toHaveBeenCalledWith({
      where: {
        organisationType: "SUBCONTRACTOR",
        organisationId: "sub-1",
        isPrimary: true,
        id: { not: "c-1" }
      },
      data: { isPrimary: false }
    });
    expect(mocks.contact.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { isPrimary: true }
    });
  });
});

describe("DirectoryService.deleteContact", () => {
  it("throws NotFoundException when contact not on this entity", async () => {
    const { service, mocks } = makeService();
    mocks.contact.findFirst.mockResolvedValueOnce(null);
    await expect(service.deleteContact("sub-1", "c-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("hard-deletes and echoes the id", async () => {
    const { service, mocks } = makeService();
    mocks.contact.findFirst.mockResolvedValueOnce({ id: "c-1" });
    const result = await service.deleteContact("sub-1", "c-1");
    expect(mocks.contact.delete).toHaveBeenCalledWith({ where: { id: "c-1" } });
    expect(result).toEqual({ id: "c-1" });
  });
});

// ─── licences ─────────────────────────────────────────────────────────────

describe("DirectoryService.addLicence", () => {
  it("requires licenceType", async () => {
    const { service } = makeService();
    await expect(
      service.addLicence({ subcontractorId: "sub-1" }, {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires owner discriminator (neither clientId nor subcontractorId)", async () => {
    const { service } = makeService();
    await expect(
      service.addLicence({}, { licenceType: "Builders" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid date strings", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await expect(
      service.addLicence(
        { subcontractorId: "sub-1" },
        { licenceType: "X", expiryDate: "not-a-date" }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("parses dates, stamps owner FK, and returns a row with recomputed status", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    const past = new Date(Date.now() - 10 * DAY_MS);
    mocks.licence.create.mockResolvedValueOnce({
      id: "lic-new",
      subcontractorId: "sub-1",
      expiryDate: past,
      status: "active"
    });
    const result = await service.addLicence(
      { subcontractorId: "sub-1" },
      { licenceType: "Builders", issueDate: "2026-01-01", expiryDate: past.toISOString() }
    );
    const passed = mocks.licence.create.mock.calls[0][0].data as AnyDto;
    expect(passed.subcontractorId).toBe("sub-1");
    expect(passed.issueDate).toBeInstanceOf(Date);
    expect(passed.expiryDate).toBeInstanceOf(Date);
    expect(result.status).toBe("expired");
  });

  it("requires the client when owner.clientId is provided", async () => {
    const { service, mocks } = makeService();
    mocks.client.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.addLicence({ clientId: "c-missing" }, { licenceType: "X" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("DirectoryService.updateLicence", () => {
  it("throws NotFoundException when licence is missing", async () => {
    const { service, mocks } = makeService();
    mocks.licence.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateLicence({ subcontractorId: "sub-1" }, "lic-1", {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when licence belongs to a different owner", async () => {
    const { service, mocks } = makeService();
    mocks.licence.findUnique.mockResolvedValueOnce({ id: "lic-1", subcontractorId: "other" });
    await expect(
      service.updateLicence({ subcontractorId: "sub-1" }, "lic-1", {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("re-parses dates only when supplied", async () => {
    const { service, mocks } = makeService();
    mocks.licence.findUnique.mockResolvedValueOnce({ id: "lic-1", subcontractorId: "sub-1" });
    mocks.licence.update.mockResolvedValueOnce({ id: "lic-1", status: "active", expiryDate: null });
    await service.updateLicence({ subcontractorId: "sub-1" }, "lic-1", { issueDate: "2026-01-01" });
    const passed = mocks.licence.update.mock.calls[0][0].data as AnyDto;
    expect(passed.issueDate).toBeInstanceOf(Date);
    expect(passed.expiryDate).toBeUndefined();
  });
});

describe("DirectoryService.deleteLicence", () => {
  it("throws NotFoundException when licence belongs to a different owner", async () => {
    const { service, mocks } = makeService();
    mocks.licence.findUnique.mockResolvedValueOnce({ id: "lic-1", clientId: "other" });
    await expect(
      service.deleteLicence({ clientId: "c-1" }, "lic-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── insurances ───────────────────────────────────────────────────────────

describe("DirectoryService.addInsurance", () => {
  it("requires insuranceType", async () => {
    const { service } = makeService();
    await expect(
      service.addInsurance({ subcontractorId: "sub-1" }, {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("parses expiryDate and recomputes status as 'expiring_soon' (within 30 days)", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    const soon = new Date(Date.now() + 10 * DAY_MS);
    mocks.insurance.create.mockResolvedValueOnce({
      id: "ins-new",
      subcontractorId: "sub-1",
      expiryDate: soon,
      status: "active"
    });
    const result = await service.addInsurance(
      { subcontractorId: "sub-1" },
      { insuranceType: "Public Liability", expiryDate: soon.toISOString() }
    );
    expect(result.status).toBe("expiring_soon");
    const passed = mocks.insurance.create.mock.calls[0][0].data as AnyDto;
    expect(passed.subcontractorId).toBe("sub-1");
    expect(passed.expiryDate).toBeInstanceOf(Date);
  });
});

describe("DirectoryService.updateInsurance", () => {
  it("throws NotFoundException when insurance belongs to a different owner", async () => {
    const { service, mocks } = makeService();
    mocks.insurance.findUnique.mockResolvedValueOnce({ id: "ins-1", subcontractorId: "other" });
    await expect(
      service.updateInsurance({ subcontractorId: "sub-1" }, "ins-1", {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("DirectoryService.deleteInsurance", () => {
  it("hard-deletes and echoes the id when the insurance exists on this owner", async () => {
    const { service, mocks } = makeService();
    mocks.insurance.findUnique.mockResolvedValueOnce({ id: "ins-1", subcontractorId: "sub-1" });
    const result = await service.deleteInsurance({ subcontractorId: "sub-1" }, "ins-1");
    expect(mocks.insurance.delete).toHaveBeenCalledWith({ where: { id: "ins-1" } });
    expect(result).toEqual({ id: "ins-1" });
  });
});

// ─── credit applications ──────────────────────────────────────────────────

describe("DirectoryService.addCreditApplication", () => {
  it("requires direction and validates against the vocabulary", async () => {
    const { service } = makeService();
    await expect(
      service.addCreditApplication({ subcontractorId: "sub-1" }, "actor-1", {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an invalid optional status value", async () => {
    const { service } = makeService();
    await expect(
      service.addCreditApplication(
        { subcontractorId: "sub-1" },
        "actor-1",
        { direction: "outgoing", status: "weird" }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates with parsed dates and createdById stamped to actorId", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await service.addCreditApplication(
      { subcontractorId: "sub-1" },
      "actor-1",
      { direction: "outgoing", applicationDate: "2026-01-01" }
    );
    const passed = mocks.credit.create.mock.calls[0][0].data as AnyDto;
    expect(passed.subcontractorId).toBe("sub-1");
    expect(passed.createdById).toBe("actor-1");
    expect(passed.applicationDate).toBeInstanceOf(Date);
  });
});

describe("DirectoryService.updateCreditApplication", () => {
  function existingCredit(overrides: AnyDto = {}) {
    return {
      id: "credit-1",
      subcontractorId: "sub-1",
      clientId: null,
      status: "draft",
      creditLimit: null,
      ...overrides
    };
  }

  it("throws NotFoundException when application is missing", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateCreditApplication(
        { subcontractorId: "sub-1" },
        "credit-1",
        "actor-1",
        {},
        true,
        true
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when application belongs to a different owner", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce(existingCredit({ subcontractorId: "other" }));
    await expect(
      service.updateCreditApplication(
        { subcontractorId: "sub-1" },
        "credit-1",
        "actor-1",
        {},
        true,
        true
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows draft -> submitted without elevated perms", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce(existingCredit({ status: "draft" }));
    mocks.credit.update.mockResolvedValueOnce({
      ...existingCredit({ status: "submitted" })
    });
    await expect(
      service.updateCreditApplication(
        { subcontractorId: "sub-1" },
        "credit-1",
        "actor-1",
        { status: "submitted" },
        false,
        false
      )
    ).resolves.toBeDefined();
  });

  it("forbids submitted -> under_review without canAdmin", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce(existingCredit({ status: "submitted" }));
    await expect(
      service.updateCreditApplication(
        { subcontractorId: "sub-1" },
        "credit-1",
        "actor-1",
        { status: "under_review" },
        false,
        false
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("forbids under_review -> approved without both canAdmin and canApprove", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce(existingCredit({ status: "under_review" }));
    await expect(
      service.updateCreditApplication(
        { subcontractorId: "sub-1" },
        "credit-1",
        "actor-1",
        { status: "approved" },
        true,
        false
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("stamps approvedDate + reviewedById on first transition to approved", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce(existingCredit({ status: "under_review" }));
    mocks.credit.update.mockResolvedValueOnce({
      ...existingCredit({ status: "approved", creditLimit: null })
    });
    await service.updateCreditApplication(
      { subcontractorId: "sub-1" },
      "credit-1",
      "actor-1",
      { status: "approved" },
      true,
      true
    );
    const passed = mocks.credit.update.mock.calls[0][0].data as AnyDto;
    expect(passed.approvedDate).toBeInstanceOf(Date);
    expect(passed.reviewedById).toBe("actor-1");
  });

  it("on first approval with a creditLimit, propagates limit + approved flag onto the owning subcontractor", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce(existingCredit({ status: "under_review" }));
    mocks.credit.update.mockResolvedValueOnce({
      id: "credit-1",
      subcontractorId: "sub-1",
      clientId: null,
      status: "approved",
      creditLimit: 5000
    });
    await service.updateCreditApplication(
      { subcontractorId: "sub-1" },
      "credit-1",
      "actor-1",
      { status: "approved" },
      true,
      true
    );
    expect(mocks.sub.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { creditLimit: 5000, creditApproved: true }
    });
  });

  it("on first approval with a creditLimit, propagates onto the owning client when clientId is set", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce({
      id: "credit-1",
      clientId: "c-1",
      subcontractorId: null,
      status: "under_review",
      creditLimit: null
    });
    mocks.credit.update.mockResolvedValueOnce({
      id: "credit-1",
      clientId: "c-1",
      subcontractorId: null,
      status: "approved",
      creditLimit: 9000
    });
    await service.updateCreditApplication(
      { clientId: "c-1" },
      "credit-1",
      "actor-1",
      { status: "approved" },
      true,
      true
    );
    expect(mocks.client.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { creditLimit: 9000, creditApproved: true }
    });
  });

  it("stamps rejectedDate + reviewedById on first transition to rejected", async () => {
    const { service, mocks } = makeService();
    mocks.credit.findUnique.mockResolvedValueOnce(existingCredit({ status: "under_review" }));
    mocks.credit.update.mockResolvedValueOnce({
      ...existingCredit({ status: "rejected" })
    });
    await service.updateCreditApplication(
      { subcontractorId: "sub-1" },
      "credit-1",
      "actor-1",
      { status: "rejected" },
      true,
      false
    );
    const passed = mocks.credit.update.mock.calls[0][0].data as AnyDto;
    expect(passed.rejectedDate).toBeInstanceOf(Date);
    expect(passed.reviewedById).toBe("actor-1");
  });
});

// ─── documents ────────────────────────────────────────────────────────────

describe("DirectoryService.addDocument", () => {
  it("requires documentType and name", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await expect(
      service.addDocument("sub-1", "actor-1", { documentType: "INSURANCE" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stamps subcontractorId + uploadedById", async () => {
    const { service, mocks } = makeService();
    mocks.sub.findUnique.mockResolvedValueOnce({ id: "sub-1" });
    await service.addDocument("sub-1", "actor-1", {
      documentType: "INSURANCE",
      name: "PL Cert"
    });
    const passed = mocks.document.create.mock.calls[0][0].data as AnyDto;
    expect(passed.subcontractorId).toBe("sub-1");
    expect(passed.uploadedById).toBe("actor-1");
  });
});

describe("DirectoryService.updateDocument", () => {
  it("throws NotFoundException when document is not on this entity", async () => {
    const { service, mocks } = makeService();
    mocks.document.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.updateDocument("sub-1", "doc-1", { name: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("DirectoryService.deleteDocument", () => {
  it("hard-deletes the row and echoes the id", async () => {
    const { service, mocks } = makeService();
    mocks.document.findFirst.mockResolvedValueOnce({ id: "doc-1" });
    const result = await service.deleteDocument("sub-1", "doc-1");
    expect(mocks.document.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(result).toEqual({ id: "doc-1" });
  });
});

// ─── expiryAlerts ─────────────────────────────────────────────────────────

describe("DirectoryService.expiryAlerts", () => {
  it("merges licence + insurance rows, computes status, and sorts ascending by expiryDate", async () => {
    const { service, mocks } = makeService();
    const past = new Date(Date.now() - 5 * DAY_MS);
    const soon = new Date(Date.now() + 10 * DAY_MS);
    mocks.licence.findMany.mockResolvedValueOnce([
      {
        id: "lic-1",
        licenceType: "Builders",
        expiryDate: past,
        status: "active",
        client: null,
        subcontractor: { id: "sub-1", name: "Sub A" }
      }
    ]);
    mocks.insurance.findMany.mockResolvedValueOnce([
      {
        id: "ins-1",
        insuranceType: "Public Liability",
        expiryDate: soon,
        status: "active",
        client: { id: "c-1", name: "Client A" },
        subcontractor: null
      }
    ]);
    const result = await service.expiryAlerts();
    expect(result).toHaveLength(2);
    // Past first (lower timestamp)
    expect(result[0]).toMatchObject({
      kind: "licence",
      entityKind: "subcontractor",
      entityId: "sub-1",
      entityName: "Sub A",
      type: "Builders",
      status: "expired"
    });
    expect(result[1]).toMatchObject({
      kind: "insurance",
      entityKind: "client",
      entityId: "c-1",
      entityName: "Client A",
      type: "Public Liability",
      status: "expiring_soon"
    });

    // Filter contract: only rows already expired or expiring within 30 days,
    // with status not "not_required".
    const licWhere = mocks.licence.findMany.mock.calls[0][0].where as AnyDto;
    expect(licWhere.expiryDate).toMatchObject({ not: null });
    expect(licWhere.status).toEqual({ not: "not_required" });
  });
});
