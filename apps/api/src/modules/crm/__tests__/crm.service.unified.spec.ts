import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CrmService } from "../crm.service";

// Mocking style matches crm.service.drop-reason.spec.ts

type MockPrisma = {
  opportunity: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
  };
  dropReason: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  client: { findUnique: jest.Mock };
  contact: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  site: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    opportunity: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    dropReason: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
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

const INCLUDE_SHAPE = expect.objectContaining({
  client: expect.anything(),
  contact: expect.anything(),
  owner: expect.anything(),
  convertedTender: expect.anything()
});

describe("CrmService — unified entry CRUD (S3)", () => {
  describe("createEntry", () => {
    it("creates an entry with isLead=true and stage='open'", async () => {
      const prisma = makePrisma();
      const created = {
        id: "entry-1",
        title: "Fit-out enquiry",
        stage: "open",
        isLead: true,
        source: "other"
      };
      prisma.opportunity.create.mockResolvedValue(created);

      const service = makeService(prisma);
      const result = await service.createEntry(
        {
          title: "Fit-out enquiry",
          isLead: true
        },
        "actor-1"
      );

      expect(prisma.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Fit-out enquiry",
            stage: "open",
            isLead: true
          }),
          include: INCLUDE_SHAPE
        })
      );
      expect(result.stage).toBe("open");
      expect(result.isLead).toBe(true);
    });

    it("creates an entry with isLead=false and stage='open'", async () => {
      const prisma = makePrisma();
      const created = {
        id: "entry-2",
        title: "Big opportunity",
        stage: "open",
        isLead: false,
        source: "direct"
      };
      prisma.opportunity.create.mockResolvedValue(created);

      const service = makeService(prisma);
      const result = await service.createEntry(
        {
          title: "Big opportunity",
          isLead: false,
          source: "direct"
        },
        "actor-1"
      );

      expect(prisma.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Big opportunity",
            stage: "open",
            isLead: false,
            source: "direct"
          })
        })
      );
      expect(result.stage).toBe("open");
    });

    it("throws BadRequestException when title is blank", async () => {
      const prisma = makePrisma();
      const service = makeService(prisma);
      await expect(
        service.createEntry({ title: "  ", isLead: true }, "actor-1")
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.opportunity.create).not.toHaveBeenCalled();
    });
  });

  describe("updateEntry", () => {
    it("updates the entry when stage is a valid new-model stage", async () => {
      const prisma = makePrisma();
      const existing = { id: "entry-1", stage: "open", isLead: true };
      prisma.opportunity.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, stage: "not_pursued" };
      prisma.opportunity.update.mockResolvedValue(updated);

      const service = makeService(prisma);
      const result = await service.updateEntry(
        "entry-1",
        { stage: "not_pursued" },
        "actor-1"
      );

      expect(prisma.opportunity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "entry-1" },
          data: expect.objectContaining({ stage: "not_pursued" })
        })
      );
      expect(result.stage).toBe("not_pursued");
    });

    it("throws BadRequestException when stage is a legacy value ('new')", async () => {
      const prisma = makePrisma();
      prisma.opportunity.findUnique.mockResolvedValue({ id: "entry-1", stage: "open" });

      const service = makeService(prisma);
      await expect(
        service.updateEntry("entry-1", { stage: "new" }, "actor-1")
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.opportunity.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when stage is legacy value 'qualified'", async () => {
      const prisma = makePrisma();
      prisma.opportunity.findUnique.mockResolvedValue({ id: "entry-1", stage: "open" });

      const service = makeService(prisma);
      await expect(
        service.updateEntry("entry-1", { stage: "qualified" }, "actor-1")
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws NotFoundException when entry does not exist", async () => {
      const prisma = makePrisma();
      prisma.opportunity.findUnique.mockResolvedValue(null);

      const service = makeService(prisma);
      await expect(
        service.updateEntry("missing", { title: "New title" }, "actor-1")
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("dontPursue", () => {
    it("sets stage=not_pursued, dropReasonId, and dropReasonDetail", async () => {
      const prisma = makePrisma();
      const existing = { id: "entry-1", stage: "open", lostAt: null };
      prisma.opportunity.findUnique.mockResolvedValue(existing);
      const updated = {
        id: "entry-1",
        stage: "not_pursued",
        dropReasonId: "dr-1",
        dropReasonDetail: "Too expensive"
      };
      prisma.opportunity.update.mockResolvedValue(updated);

      const service = makeService(prisma);
      const result = await service.dontPursue(
        "entry-1",
        { dropReasonId: "dr-1", detail: "Too expensive" },
        "actor-1"
      );

      expect(prisma.opportunity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "entry-1" },
          data: expect.objectContaining({
            stage: "not_pursued",
            dropReason: { connect: { id: "dr-1" } },
            dropReasonDetail: "Too expensive"
          })
        })
      );
      expect(result.stage).toBe("not_pursued");
      expect(result.dropReasonId).toBe("dr-1");
      expect(result.dropReasonDetail).toBe("Too expensive");
    });

    it("throws BadRequestException when entry is already 'archived'", async () => {
      const prisma = makePrisma();
      prisma.opportunity.findUnique.mockResolvedValue({
        id: "entry-2",
        stage: "archived",
        lostAt: null
      });

      const service = makeService(prisma);
      await expect(
        service.dontPursue("entry-2", { dropReasonId: "dr-1" }, "actor-1")
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.opportunity.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when entry does not exist", async () => {
      const prisma = makePrisma();
      prisma.opportunity.findUnique.mockResolvedValue(null);

      const service = makeService(prisma);
      await expect(
        service.dontPursue("missing", { dropReasonId: "dr-1" }, "actor-1")
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("sets dropReasonDetail to null when detail is omitted", async () => {
      const prisma = makePrisma();
      prisma.opportunity.findUnique.mockResolvedValue({
        id: "entry-3",
        stage: "open",
        lostAt: null
      });
      prisma.opportunity.update.mockResolvedValue({
        id: "entry-3",
        stage: "not_pursued",
        dropReasonId: "dr-2",
        dropReasonDetail: null
      });

      const service = makeService(prisma);
      await service.dontPursue("entry-3", { dropReasonId: "dr-2" }, "actor-1");

      expect(prisma.opportunity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dropReasonDetail: null
          })
        })
      );
    });
  });
});
