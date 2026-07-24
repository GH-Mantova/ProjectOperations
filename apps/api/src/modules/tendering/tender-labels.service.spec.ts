import { BadRequestException } from "@nestjs/common";
import { TenderLabelsService } from "./tender-labels.service";
import { DEFAULT_TENDERING_LABELS } from "./tender-labels.defaults";

type Row = { key: string; label: string; updatedById: string | null };

function buildPrisma(initial: Row[] = []) {
  const store = new Map<string, Row>(initial.map((r) => [r.key, r]));
  return {
    store,
    tenderingLabel: {
      findMany: jest.fn().mockImplementation(async () => Array.from(store.values())),
      deleteMany: jest.fn().mockImplementation(async ({ where }: any) => {
        for (const k of where.key.in as string[]) store.delete(k);
        return { count: where.key.in.length };
      }),
      upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => {
        const existing = store.get(where.key);
        const row: Row = existing
          ? { key: existing.key, label: update.label, updatedById: update.updatedById ?? null }
          : { key: create.key, label: create.label, updatedById: create.updatedById ?? null };
        store.set(row.key, row);
        return row;
      })
    },
    $transaction: jest.fn().mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops))
  };
}

const buildAudit = () => ({ write: jest.fn().mockResolvedValue(undefined) });

const buildService = (prisma = buildPrisma()) => {
  const audit = buildAudit();
  const service = new TenderLabelsService(prisma as never, audit as never);
  return { service, prisma, audit };
};

describe("TenderLabelsService", () => {
  describe("list", () => {
    it("returns full defaults when nothing is overridden", async () => {
      const { service } = buildService();
      const map = await service.list();
      expect(map).toEqual(DEFAULT_TENDERING_LABELS);
    });

    it("merges stored overrides on top of the defaults", async () => {
      const prisma = buildPrisma([
        { key: "field.tenderNumber", label: "RFQ number", updatedById: null }
      ]);
      const { service } = buildService(prisma);
      const map = await service.list();
      expect(map["field.tenderNumber"]).toBe("RFQ number");
      expect(map["field.title"]).toBe(DEFAULT_TENDERING_LABELS["field.title"]);
    });

    it("silently ignores rows for keys that are no longer known", async () => {
      const prisma = buildPrisma([{ key: "nav.retired", label: "Old Nav", updatedById: null }]);
      const { service } = buildService(prisma);
      const map = await service.list();
      expect(map).toEqual(DEFAULT_TENDERING_LABELS);
    });
  });

  describe("updateMany", () => {
    it("upserts a non-default label", async () => {
      const { service, prisma } = buildService();
      const map = await service.updateMany(
        [{ key: "field.tenderNumber", label: "RFQ number" }],
        "user-1"
      );
      expect(map["field.tenderNumber"]).toBe("RFQ number");
      expect(prisma.store.get("field.tenderNumber")).toEqual({
        key: "field.tenderNumber",
        label: "RFQ number",
        updatedById: "user-1"
      });
    });

    it("deletes the override when label is null / blank", async () => {
      const prisma = buildPrisma([
        { key: "field.tenderNumber", label: "RFQ number", updatedById: null }
      ]);
      const { service } = buildService(prisma);
      const map = await service.updateMany([{ key: "field.tenderNumber", label: null }]);
      expect(prisma.store.has("field.tenderNumber")).toBe(false);
      expect(map["field.tenderNumber"]).toBe(DEFAULT_TENDERING_LABELS["field.tenderNumber"]);
    });

    it("deletes the override when the submitted label matches the default", async () => {
      const prisma = buildPrisma([
        { key: "field.title", label: "Job title", updatedById: null }
      ]);
      const { service } = buildService(prisma);
      await service.updateMany([
        { key: "field.title", label: DEFAULT_TENDERING_LABELS["field.title"] }
      ]);
      expect(prisma.store.has("field.title")).toBe(false);
    });

    it("rejects unknown keys and does not mutate the store", async () => {
      const { service, prisma } = buildService();
      await expect(
        service.updateMany([{ key: "nav.retired", label: "Nope" }])
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.store.size).toBe(0);
    });

    it("writes an audit entry tagging overridden vs reset keys", async () => {
      const prisma = buildPrisma([
        { key: "field.title", label: "Job title", updatedById: null }
      ]);
      const { service, audit } = buildService(prisma);
      await service.updateMany(
        [
          { key: "field.tenderNumber", label: "RFQ number" },
          { key: "field.title", label: null }
        ],
        "user-2"
      );
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "tenders.labels.update",
          entityType: "TenderingLabel",
          metadata: {
            overriddenKeys: ["field.tenderNumber"],
            resetKeys: ["field.title"]
          }
        })
      );
    });
  });
});
