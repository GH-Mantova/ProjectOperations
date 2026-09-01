import { ConflictException, NotFoundException } from "@nestjs/common";
import { CrmService } from "../crm.service";

type MockDropReason = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

type MockPrisma = {
  dropReason: MockDropReason;
  opportunity: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
  };
  client: { findUnique: jest.Mock };
  contact: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  site: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    dropReason: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    opportunity: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    client: { findUnique: jest.fn() },
    contact: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    site: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (arg) => {
      if (typeof arg === "function") return arg(prisma);
      return Promise.all(arg);
    })
  };
  return prisma;
}

function makeService(prisma: MockPrisma) {
  const tendering = { create: jest.fn() };
  return new CrmService(prisma as never, tendering as never);
}

describe("CrmService — DropReason CRUD", () => {
  describe("listDropReasons", () => {
    it("returns all drop reasons ordered by sortOrder then label", async () => {
      const prisma = makePrisma();
      const rows = [
        { id: "dr-1", label: "Price / budget", sortOrder: 0, isActive: true },
        { id: "dr-2", label: "Went cold", sortOrder: 1, isActive: true }
      ];
      prisma.dropReason.findMany.mockResolvedValue(rows);

      const service = makeService(prisma);
      const result = await service.listDropReasons();

      expect(prisma.dropReason.findMany).toHaveBeenCalledWith({
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
      });
      expect(result).toEqual(rows);
    });
  });

  describe("createDropReason", () => {
    it("creates a drop reason when label is unique", async () => {
      const prisma = makePrisma();
      prisma.dropReason.findUnique.mockResolvedValue(null);
      const created = { id: "dr-new", label: "Out of area", sortOrder: 0, isActive: true };
      prisma.dropReason.create.mockResolvedValue(created);

      const service = makeService(prisma);
      const result = await service.createDropReason({ label: "Out of area" });

      expect(result).toEqual(created);
      expect(prisma.dropReason.create).toHaveBeenCalledWith({
        data: { label: "Out of area", sortOrder: 0 }
      });
    });

    it("throws ConflictException when label already exists", async () => {
      const prisma = makePrisma();
      prisma.dropReason.findUnique.mockResolvedValue({ id: "dr-existing" });

      const service = makeService(prisma);
      await expect(
        service.createDropReason({ label: "Price / budget" })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("updateDropReason", () => {
    it("throws NotFoundException when id does not exist", async () => {
      const prisma = makePrisma();
      prisma.dropReason.findUnique.mockResolvedValue(null);

      const service = makeService(prisma);
      await expect(
        service.updateDropReason("missing-id", { label: "New label" })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("updates the drop reason when found", async () => {
      const prisma = makePrisma();
      const existing = { id: "dr-1", label: "Old label", sortOrder: 0, isActive: true };
      prisma.dropReason.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, label: "New label", isActive: false };
      prisma.dropReason.update.mockResolvedValue(updated);

      const service = makeService(prisma);
      const result = await service.updateDropReason("dr-1", { label: "New label", isActive: false });

      expect(prisma.dropReason.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "dr-1" } })
      );
      expect(result).toEqual(updated);
    });
  });

  describe("deleteDropReason", () => {
    it("throws ConflictException when opportunities reference the reason", async () => {
      const prisma = makePrisma();
      prisma.dropReason.findUnique.mockResolvedValue({
        id: "dr-1",
        label: "Price / budget",
        _count: { opportunities: 3, archivedOpportunities: 0 }
      });

      const service = makeService(prisma);
      await expect(
        service.deleteDropReason("dr-1")
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.dropReason.delete).not.toHaveBeenCalled();
    });

    it("deletes when no opportunities reference the reason", async () => {
      const prisma = makePrisma();
      prisma.dropReason.findUnique.mockResolvedValue({
        id: "dr-2",
        label: "Went cold",
        _count: { opportunities: 0, archivedOpportunities: 0 }
      });
      prisma.dropReason.delete.mockResolvedValue({ id: "dr-2" });

      const service = makeService(prisma);
      await service.deleteDropReason("dr-2");

      expect(prisma.dropReason.delete).toHaveBeenCalledWith({ where: { id: "dr-2" } });
    });

    it("throws ConflictException when only ARCHIVED opportunities reference the reason", async () => {
      // The behaviour crm-s11 introduces: an archived entry holds its DropReason, so a reason
      // used only by archived entries must still refuse to delete. Untested before this.
      const prisma = makePrisma();
      prisma.dropReason.findUnique.mockResolvedValue({
        id: "dr-3",
        label: "Lost on price",
        _count: { opportunities: 0, archivedOpportunities: 2 }
      });

      const service = makeService(prisma);
      await expect(
        service.deleteDropReason("dr-3")
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.dropReason.delete).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when id does not exist", async () => {
      const prisma = makePrisma();
      prisma.dropReason.findUnique.mockResolvedValue(null);

      const service = makeService(prisma);
      await expect(
        service.deleteDropReason("ghost-id")
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
