// Unit tests for FieldDefinitionsService.
// Uses the plain-object Prisma stub pattern (no test DB).

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { FieldAppliesTo, FieldSource } from "@prisma/client";
import { FieldDefinitionsService } from "../field-definitions.service";

// ─── Minimal type helpers ────────────────────────────────────────────────────

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

// ─── Prisma mock factory ─────────────────────────────────────────────────────

function buildPrismaMock() {
  const fieldDefinition = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  };

  const prisma = { fieldDefinition } as unknown as never;
  return { prisma, mocks: { fieldDefinition } };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CUSTOM_FIELD = {
  id: "fd-custom-1",
  key: "projectCode",
  label: "Project Code",
  group: "General",
  sortOrder: 0,
  visible: true,
  required: false,
  appliesTo: FieldAppliesTo.CLIENT,
  source: FieldSource.CUSTOM,
  createdAt: new Date(),
  updatedAt: new Date()
};

const BUILTIN_FIELD = {
  id: "fd-builtin-1",
  key: "name",
  label: "Name",
  group: "Identity",
  sortOrder: 10,
  visible: true,
  required: false,
  appliesTo: FieldAppliesTo.BOTH,
  source: FieldSource.BUILTIN,
  createdAt: new Date(),
  updatedAt: new Date()
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("FieldDefinitionsService", () => {
  let service: FieldDefinitionsService;
  let mocks: ReturnType<typeof buildPrismaMock>["mocks"];

  beforeEach(() => {
    const built = buildPrismaMock();
    service = new FieldDefinitionsService(built.prisma);
    mocks = built.mocks;
  });

  // ── createCustom ──────────────────────────────────────────────────────────

  describe("createCustom", () => {
    it("forces source=CUSTOM even when caller passes BUILTIN", async () => {
      mocks.fieldDefinition.create.mockResolvedValue({ ...CUSTOM_FIELD, source: FieldSource.CUSTOM });

      await service.createCustom({
        key: "projectCode",
        label: "Project Code",
        appliesTo: FieldAppliesTo.CLIENT,
        source: FieldSource.BUILTIN // caller attempts BUILTIN
      });

      const createCall = mocks.fieldDefinition.create.mock.calls[0][0] as DeepPartial<{
        data: { source: FieldSource };
      }>;
      expect(createCall.data?.source).toBe(FieldSource.CUSTOM);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    beforeEach(() => {
      mocks.fieldDefinition.findUniqueOrThrow.mockResolvedValue(CUSTOM_FIELD);
      mocks.fieldDefinition.update.mockResolvedValue(CUSTOM_FIELD);
    });

    it("rejects a payload that includes 'key'", async () => {
      await expect(
        service.update("fd-custom-1", { key: "newKey" } as never)
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a payload that includes 'source'", async () => {
      await expect(
        service.update("fd-custom-1", { source: FieldSource.BUILTIN } as never)
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a payload that includes 'appliesTo'", async () => {
      await expect(
        service.update("fd-custom-1", { appliesTo: FieldAppliesTo.VENDOR } as never)
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts mutable fields (label, group, sortOrder, visible, required)", async () => {
      const dto = { label: "New Label", group: "Custom", sortOrder: 5, visible: false, required: true };
      await expect(service.update("fd-custom-1", dto)).resolves.not.toThrow();
      expect(mocks.fieldDefinition.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "fd-custom-1" } })
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("throws BadRequestException when target is BUILTIN", async () => {
      mocks.fieldDefinition.findUnique.mockResolvedValue(BUILTIN_FIELD);

      await expect(service.remove("fd-builtin-1")).rejects.toThrow(BadRequestException);
    });

    it("deletes successfully when target is CUSTOM", async () => {
      mocks.fieldDefinition.findUnique.mockResolvedValue(CUSTOM_FIELD);
      mocks.fieldDefinition.delete.mockResolvedValue(CUSTOM_FIELD);

      await expect(service.remove("fd-custom-1")).resolves.toEqual(CUSTOM_FIELD);
      expect(mocks.fieldDefinition.delete).toHaveBeenCalledWith({ where: { id: "fd-custom-1" } });
    });

    it("throws NotFoundException when row does not exist", async () => {
      mocks.fieldDefinition.findUnique.mockResolvedValue(null);

      await expect(service.remove("no-such-id")).rejects.toThrow(NotFoundException);
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    const BOTH_FIELD = {
      ...BUILTIN_FIELD,
      id: "fd-both-1",
      appliesTo: FieldAppliesTo.BOTH
    };

    it("returns all rows when no filter is passed", async () => {
      mocks.fieldDefinition.findMany.mockResolvedValue([BOTH_FIELD, CUSTOM_FIELD]);

      const result = await service.list();
      expect(mocks.fieldDefinition.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ where: expect.anything() })
      );
      expect(result).toHaveLength(2);
    });

    it("filters by appliesTo=CLIENT and includes BOTH rows via OR clause", async () => {
      mocks.fieldDefinition.findMany.mockResolvedValue([BOTH_FIELD, CUSTOM_FIELD]);

      await service.list(FieldAppliesTo.CLIENT);

      const call = mocks.fieldDefinition.findMany.mock.calls[0][0] as {
        where: { OR: Array<{ appliesTo: FieldAppliesTo }> };
      };
      const orApplies = call.where?.OR?.map((o) => o.appliesTo);
      expect(orApplies).toContain(FieldAppliesTo.CLIENT);
      expect(orApplies).toContain(FieldAppliesTo.BOTH);
    });

    it("filters by appliesTo=VENDOR and includes BOTH rows via OR clause", async () => {
      mocks.fieldDefinition.findMany.mockResolvedValue([BOTH_FIELD]);

      await service.list(FieldAppliesTo.VENDOR);

      const call = mocks.fieldDefinition.findMany.mock.calls[0][0] as {
        where: { OR: Array<{ appliesTo: FieldAppliesTo }> };
      };
      const orApplies = call.where?.OR?.map((o) => o.appliesTo);
      expect(orApplies).toContain(FieldAppliesTo.VENDOR);
      expect(orApplies).toContain(FieldAppliesTo.BOTH);
    });
  });
});
