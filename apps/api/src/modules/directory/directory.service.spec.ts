import { BadRequestException } from "@nestjs/common";
import { DirectoryService, computeCreditBalance } from "./directory.service";

type AnyDto = Record<string, unknown>;

function buildPrismaMock(overrides: {
  entityExists?: boolean;
  subCreate?: jest.Mock;
  subUpdate?: jest.Mock;
} = {}) {
  const findUnique = jest.fn(async () =>
    overrides.entityExists === false ? null : ({ id: "sub-1" } as Record<string, unknown>)
  );
  const subCreate =
    overrides.subCreate ??
    jest.fn().mockImplementation(async ({ data }: { data: AnyDto }) => ({ id: "sub-new", ...data }));
  const subUpdate =
    overrides.subUpdate ??
    jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: AnyDto }) => ({
      id: where.id,
      ...data
    }));

  const prisma = {
    subcontractorSupplier: {
      findUnique,
      findMany: jest.fn(async () => []),
      create: subCreate,
      update: subUpdate
    },
    client: { findMany: jest.fn(async () => []) },
    contact: { create: jest.fn() }
  } as never;
  return { prisma, mocks: { subCreate, subUpdate, findUnique } };
}

function makeService(overrides: Parameters<typeof buildPrismaMock>[0] = {}) {
  const { prisma, mocks } = buildPrismaMock(overrides);
  const service = new DirectoryService(prisma);
  return { service, mocks };
}

const VALID_BASE = {
  name: "Acme Subcontractors Pty Ltd",
  businessType: "company",
  entityType: "subcontractor",
  prequalStatus: "pending"
};

describe("DirectoryService — Xero alignment (PR-40)", () => {
  describe("create", () => {
    it("persists all four new fields", async () => {
      const { service, mocks } = makeService();
      await service.create(
        {
          ...VALID_BASE,
          legalName: "Acme Holdings Pty Ltd",
          country: "Australia",
          paymentTermsDay: 30,
          paymentTermsType: "DAYS_AFTER_INVOICE"
        },
        "actor-1",
        true
      );
      expect(mocks.subCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          legalName: "Acme Holdings Pty Ltd",
          country: "Australia",
          paymentTermsDay: 30,
          paymentTermsType: "DAYS_AFTER_INVOICE"
        })
      });
    });

    it("rejects paymentTermsDay without paymentTermsType", async () => {
      const { service } = makeService();
      await expect(
        service.create({ ...VALID_BASE, paymentTermsDay: 20 }, "actor-1", true)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects paymentTermsType without paymentTermsDay", async () => {
      const { service } = makeService();
      await expect(
        service.create(
          { ...VALID_BASE, paymentTermsType: "DAY_OF_FOLLOWING_MONTH" },
          "actor-1",
          true
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("accepts both fields together", async () => {
      const { service, mocks } = makeService();
      await service.create(
        { ...VALID_BASE, paymentTermsDay: 14, paymentTermsType: "DAYS_AFTER_END_OF_MONTH" },
        "actor-1",
        true
      );
      expect(mocks.subCreate).toHaveBeenCalled();
    });

    it("omits country when not provided — Prisma default ('Australia') applies", async () => {
      const { service, mocks } = makeService();
      await service.create({ ...VALID_BASE }, "actor-1", true);
      const passed = (mocks.subCreate.mock.calls[0]?.[0] as { data: AnyDto }).data;
      expect(passed.country).toBeUndefined();
    });
  });

  describe("update", () => {
    it("rejects paymentTermsDay without paymentTermsType on update", async () => {
      const { service } = makeService({ entityExists: true });
      await expect(
        service.update("sub-1", { paymentTermsDay: 20 }, true)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects paymentTermsType without paymentTermsDay on update", async () => {
      const { service } = makeService({ entityExists: true });
      await expect(
        service.update("sub-1", { paymentTermsType: "DAYS_AFTER_INVOICE" }, true)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("updates legalName only — other new fields untouched", async () => {
      const { service, mocks } = makeService({ entityExists: true });
      await service.update("sub-1", { legalName: "New Legal Pty Ltd" }, true);
      const passed = (mocks.subUpdate.mock.calls[0]?.[0] as { data: AnyDto }).data;
      expect(passed.legalName).toBe("New Legal Pty Ltd");
      expect(passed.paymentTermsDay).toBeUndefined();
      expect(passed.paymentTermsType).toBeUndefined();
    });

    it("accepts paymentTermsDay + paymentTermsType together", async () => {
      const { service, mocks } = makeService({ entityExists: true });
      await service.update(
        "sub-1",
        { paymentTermsDay: 20, paymentTermsType: "DAY_OF_FOLLOWING_MONTH" },
        true
      );
      expect(mocks.subUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          paymentTermsDay: 20,
          paymentTermsType: "DAY_OF_FOLLOWING_MONTH"
        })
      });
    });

    // Codex review on PR #277: PATCH with {paymentTermsDay: null} but no
    // paymentTermsType key would previously pass the pair check (null was
    // treated as "omitted") but Prisma still writes the null, leaving the
    // type half of the pair intact — half-cleared state. The fix is to check
    // key presence (`!== undefined`) rather than non-nullness.
    it("rejects PATCH with paymentTermsDay: null and no paymentTermsType (Codex case)", async () => {
      const { service } = makeService({ entityExists: true });
      await expect(
        service.update("sub-1", { paymentTermsDay: null }, true)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects PATCH with paymentTermsType: null and no paymentTermsDay (Codex case)", async () => {
      const { service } = makeService({ entityExists: true });
      await expect(
        service.update("sub-1", { paymentTermsType: null }, true)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects PATCH with paymentTermsDay: null + paymentTermsType: value (half-clear)", async () => {
      const { service } = makeService({ entityExists: true });
      await expect(
        service.update(
          "sub-1",
          { paymentTermsDay: null, paymentTermsType: "DAYS_AFTER_INVOICE" },
          true
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("accepts PATCH with both fields explicitly null — clears the pair", async () => {
      const { service, mocks } = makeService({ entityExists: true });
      await service.update(
        "sub-1",
        { paymentTermsDay: null, paymentTermsType: null },
        true
      );
      expect(mocks.subUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          paymentTermsDay: null,
          paymentTermsType: null
        })
      });
    });
  });

  describe("computeCreditBalance (PR-212b ledger)", () => {
    it("returns 0 for an empty ledger", () => {
      expect(computeCreditBalance([])).toBe(0);
    });

    it("sums charges minus payments and rounds to 2dp", () => {
      const entries = [
        { entryType: "charge", amount: 1000.5 },
        { entryType: "payment", amount: 200 },
        { entryType: "charge", amount: 49.49 },
        { entryType: "payment", amount: 100 }
      ];
      expect(computeCreditBalance(entries)).toBe(749.99);
    });

    it("coerces decimal/string amounts and ignores unknown entryType", () => {
      const entries = [
        { entryType: "charge", amount: "500.00" },
        { entryType: "payment", amount: "150.25" },
        { entryType: "adjustment", amount: 999 }
      ];
      expect(computeCreditBalance(entries)).toBe(349.75);
    });

    it("can go negative when payments exceed charges (overpayment / credit balance)", () => {
      const entries = [
        { entryType: "charge", amount: 100 },
        { entryType: "payment", amount: 250 }
      ];
      expect(computeCreditBalance(entries)).toBe(-150);
    });
  });
});
