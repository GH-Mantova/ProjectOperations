import { BadRequestException } from "@nestjs/common";
import { MasterDataService } from "./master-data.service";

type AnyDto = Record<string, unknown>;

function buildPrismaMock(overrides: {
  clientFindFirst?: jest.Mock;
  clientCreate?: jest.Mock;
  clientUpdate?: jest.Mock;
  contactCreate?: jest.Mock;
  contactUpdate?: jest.Mock;
} = {}) {
  const clientFindFirst = overrides.clientFindFirst ?? jest.fn().mockResolvedValue(null);
  const clientCreate =
    overrides.clientCreate ??
    jest.fn().mockImplementation(async ({ data }: { data: AnyDto }) => ({ id: "client-new", ...data }));
  const clientUpdate =
    overrides.clientUpdate ??
    jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: AnyDto }) => ({
      id: where.id,
      ...data
    }));
  const contactCreate =
    overrides.contactCreate ??
    jest.fn().mockImplementation(async ({ data }: { data: AnyDto }) => ({ id: "contact-new", ...data }));
  const contactUpdate =
    overrides.contactUpdate ??
    jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: AnyDto }) => ({
      id: where.id,
      ...data
    }));

  const prisma = {
    client: { findFirst: clientFindFirst, create: clientCreate, update: clientUpdate },
    contact: { create: contactCreate, update: contactUpdate }
  } as never;
  const audit = { write: jest.fn().mockResolvedValue(undefined) } as never;
  return {
    prisma,
    audit,
    mocks: { clientCreate, clientUpdate, contactCreate, contactUpdate }
  };
}

function makeService(overrides: Parameters<typeof buildPrismaMock>[0] = {}) {
  const { prisma, audit, mocks } = buildPrismaMock(overrides);
  const service = new MasterDataService(prisma, audit);
  return { service, mocks };
}

describe("MasterDataService — Xero alignment (PR-40)", () => {
  describe("upsertClient", () => {
    it("persists all four new fields on create", async () => {
      const { service, mocks } = makeService();
      await service.upsertClient(undefined, {
        name: "Acme Pty Ltd",
        legalName: "Acme Holdings Pty Ltd",
        country: "Australia",
        paymentTermsDay: 20,
        paymentTermsType: "DAY_OF_FOLLOWING_MONTH"
      } as never);
      expect(mocks.clientCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          legalName: "Acme Holdings Pty Ltd",
          country: "Australia",
          paymentTermsDay: 20,
          paymentTermsType: "DAY_OF_FOLLOWING_MONTH"
        })
      });
    });

    it("updates legalName only — other new fields stay unchanged", async () => {
      const { service, mocks } = makeService();
      await service.upsertClient("client-1", {
        name: "Acme Pty Ltd",
        legalName: "Acme Holdings Pty Ltd"
      } as never);
      const passed = (mocks.clientUpdate.mock.calls[0]?.[0] as { data: AnyDto }).data;
      expect(passed.legalName).toBe("Acme Holdings Pty Ltd");
      expect(passed.paymentTermsDay).toBeUndefined();
      expect(passed.paymentTermsType).toBeUndefined();
    });

    it("rejects paymentTermsDay set without paymentTermsType", async () => {
      const { service } = makeService();
      await expect(
        service.upsertClient("client-1", {
          name: "Acme Pty Ltd",
          paymentTermsDay: 20
        } as never)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects paymentTermsType set without paymentTermsDay", async () => {
      const { service } = makeService();
      await expect(
        service.upsertClient("client-1", {
          name: "Acme Pty Ltd",
          paymentTermsType: "DAYS_AFTER_INVOICE"
        } as never)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("accepts paymentTermsDay + paymentTermsType when both are present", async () => {
      const { service, mocks } = makeService();
      await service.upsertClient("client-1", {
        name: "Acme Pty Ltd",
        paymentTermsDay: 20,
        paymentTermsType: "DAY_OF_FOLLOWING_MONTH"
      } as never);
      expect(mocks.clientUpdate).toHaveBeenCalledWith({
        where: { id: "client-1" },
        data: expect.objectContaining({
          paymentTermsDay: 20,
          paymentTermsType: "DAY_OF_FOLLOWING_MONTH"
        })
      });
    });

    it("does not sanitise an unknown paymentTermsType — service layer trusts the DTO validator", async () => {
      // The service forwards the DTO as-is; class-validator at the controller
      // boundary rejects invalid enum values. Here we just confirm the service
      // does not silently drop or rewrite an unrecognised value.
      const { service, mocks } = makeService();
      await service.upsertClient("client-1", {
        name: "Acme Pty Ltd",
        paymentTermsDay: 20,
        paymentTermsType: "INVALID_VALUE"
      } as never);
      const passed = (mocks.clientUpdate.mock.calls[0]?.[0] as { data: AnyDto }).data;
      expect(passed.paymentTermsType).toBe("INVALID_VALUE");
    });

    it("does not force a country value on create — Prisma default ('Australia') applies", async () => {
      const { service, mocks } = makeService();
      await service.upsertClient(undefined, { name: "Acme Pty Ltd" } as never);
      const passed = (mocks.clientCreate.mock.calls[0]?.[0] as { data: AnyDto }).data;
      expect(passed.country).toBeUndefined();
    });

    // Codex review on PR #277: PATCH with {paymentTermsDay: null} but no
    // paymentTermsType key would previously pass the pair check (null was
    // treated as "omitted") but Prisma still writes the null, leaving the
    // type half of the pair intact — half-cleared state. The fix is to check
    // key presence (`!== undefined`) rather than non-nullness.
    it("rejects PATCH with paymentTermsDay: null and no paymentTermsType (Codex case)", async () => {
      const { service } = makeService();
      await expect(
        service.upsertClient("client-1", {
          name: "Acme Pty Ltd",
          paymentTermsDay: null
        } as never)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects PATCH with paymentTermsType: null and no paymentTermsDay (Codex case)", async () => {
      const { service } = makeService();
      await expect(
        service.upsertClient("client-1", {
          name: "Acme Pty Ltd",
          paymentTermsType: null
        } as never)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects PATCH with paymentTermsDay: null + paymentTermsType: value (half-clear)", async () => {
      const { service } = makeService();
      await expect(
        service.upsertClient("client-1", {
          name: "Acme Pty Ltd",
          paymentTermsDay: null,
          paymentTermsType: "DAYS_AFTER_INVOICE"
        } as never)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("accepts PATCH with both fields explicitly null — clears the pair", async () => {
      const { service, mocks } = makeService();
      await service.upsertClient("client-1", {
        name: "Acme Pty Ltd",
        paymentTermsDay: null,
        paymentTermsType: null
      } as never);
      expect(mocks.clientUpdate).toHaveBeenCalledWith({
        where: { id: "client-1" },
        data: expect.objectContaining({
          paymentTermsDay: null,
          paymentTermsType: null
        })
      });
    });

    // AR-1 regression: archive PATCH sends only { status: "ARCHIVED" } —
    // must succeed without requiring `name` and must NOT overwrite `name`
    // with undefined.
    it("status-only PATCH (archive) succeeds without name and does not overwrite name", async () => {
      const { service, mocks } = makeService();
      await service.upsertClient("client-1", { status: "ARCHIVED" } as never);
      expect(mocks.clientUpdate).toHaveBeenCalledWith({
        where: { id: "client-1" },
        data: { status: "ARCHIVED" }
      });
      // name must NOT appear in the update data (would clear the stored value)
      const passedData = (mocks.clientUpdate.mock.calls[0]?.[0] as { data: AnyDto }).data;
      expect("name" in passedData).toBe(false);
    });

    it("status-only PATCH does not call ensureUniqueName (name absent from payload)", async () => {
      // If ensureUniqueName is called with undefined it would error; the
      // client.findFirst mock returns null, so if the guard fires the test
      // would pass for the wrong reason — confirmed by asserting findFirst
      // was NOT called at all.
      const clientFindFirst = jest.fn().mockResolvedValue(null);
      const { service } = makeService({ clientFindFirst });
      await service.upsertClient("client-1", { status: "ARCHIVED" } as never);
      expect(clientFindFirst).not.toHaveBeenCalled();
    });

    // POST without name must still be rejected at the service level when
    // name is explicitly undefined (PartialType makes it optional in TS, but
    // the CREATE branch still casts to UpsertClientDto — Prisma / DB will
    // enforce the NOT NULL, and the controller-level class-validator gate
    // also rejects missing name before reaching the service).
    // This test confirms the service does NOT add a name guard itself
    // (that job belongs to class-validator at the controller boundary), so
    // a plain { status: "ACTIVE" } passed as a CREATE still reaches Prisma
    // (i.e. the service does not throw BadRequestException itself).
    it("CREATE with no name forwards to Prisma.create — validation is the controller's job", async () => {
      const { service, mocks } = makeService();
      // No name in the DTO: service should not throw, just call create
      await service.upsertClient(undefined, { status: "ACTIVE" } as never);
      expect(mocks.clientCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("upsertContact", () => {
    it("forwards includeInInvoiceEmails=true on create", async () => {
      const { service, mocks } = makeService();
      await service.upsertContact(undefined, {
        clientId: "client-1",
        firstName: "Bo",
        lastName: "Brown",
        includeInInvoiceEmails: true
      } as never);
      expect(mocks.contactCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ includeInInvoiceEmails: true })
      });
    });

    it("omits includeInInvoiceEmails when not provided — Prisma default (false) applies", async () => {
      const { service, mocks } = makeService();
      await service.upsertContact(undefined, {
        clientId: "client-1",
        firstName: "Bo",
        lastName: "Brown"
      } as never);
      const passed = (mocks.contactCreate.mock.calls[0]?.[0] as { data: AnyDto }).data;
      expect("includeInInvoiceEmails" in passed).toBe(false);
    });
  });
});
