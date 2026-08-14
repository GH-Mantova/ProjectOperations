import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { RelationshipsService } from "../relationships.service";
import { PrismaService } from "../../../../prisma/prisma.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    accountId: "acc-1",
    contactId: null,
    authorId: "user-1",
    body: "Test note",
    createdAt: new Date(),
    updatedAt: new Date(),
    author: { id: "user-1", firstName: "Alice", lastName: "Smith" },
    account: { id: "acc-1" },
    contact: null,
    ...overrides
  };
}

// ── Mock PrismaService ────────────────────────────────────────────────────────

const mockPrisma = {
  relationshipNote: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn()
  },
  contact: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  account: {
    findUnique: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  },
  $transaction: jest.fn()
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RelationshipsService", () => {
  let service: RelationshipsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipsService,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    service = module.get<RelationshipsService>(RelationshipsService);
    jest.clearAllMocks();
  });

  // ── createNote ─────────────────────────────────────────────────────────────

  describe("createNote", () => {
    it("creates a note scoped to an account", async () => {
      const note = makeNote();
      mockPrisma.account.findUnique.mockResolvedValue({ id: "acc-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockPrisma.relationshipNote.create.mockResolvedValue(note);

      const result = await service.createNote({
        accountId: "acc-1",
        authorId: "user-1",
        body: "Test note"
      });

      expect(result).toEqual(note);
      expect(mockPrisma.relationshipNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: "acc-1",
            body: "Test note"
          })
        })
      );
    });

    it("creates a note scoped to a contact", async () => {
      const note = makeNote({ accountId: null, contactId: "contact-1" });
      mockPrisma.contact.findUnique.mockResolvedValue({ id: "contact-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockPrisma.relationshipNote.create.mockResolvedValue(note);

      const result = await service.createNote({
        contactId: "contact-1",
        authorId: "user-1",
        body: "Contact note"
      });

      expect(result).toEqual(note);
    });

    it("throws BadRequestException when neither accountId nor contactId is provided", async () => {
      await expect(
        service.createNote({ authorId: "user-1", body: "Orphan note" })
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for empty body", async () => {
      mockPrisma.account.findUnique.mockResolvedValue({ id: "acc-1" });
      await expect(
        service.createNote({ accountId: "acc-1", authorId: "user-1", body: "  " })
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when account does not exist", async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      await expect(
        service.createNote({ accountId: "no-such-acc", authorId: "user-1", body: "Note" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── listNotes ──────────────────────────────────────────────────────────────

  describe("listNotes", () => {
    it("returns paginated notes by account", async () => {
      const notes = [makeNote()];
      mockPrisma.$transaction.mockResolvedValue([notes, 1]);

      const result = await service.listNotes({ accountId: "acc-1" });

      expect(result.items).toEqual(notes);
      expect(result.total).toBe(1);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("returns paginated notes by contact", async () => {
      const notes = [makeNote({ accountId: null, contactId: "contact-1" })];
      mockPrisma.$transaction.mockResolvedValue([notes, 1]);

      const result = await service.listNotes({ contactId: "contact-1" });

      expect(result.items).toEqual(notes);
    });
  });

  // ── deriveGoingCold ────────────────────────────────────────────────────────

  describe("deriveGoingCold", () => {
    beforeEach(() => {
      // Ensure account exists for all going-cold tests
      mockPrisma.account.findUnique.mockResolvedValue({ id: "acc-1" });
    });

    it('returns "never_contacted" when no contacts exist', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);

      const result = await service.deriveGoingCold("acc-1");

      expect(result.status).toBe("never_contacted");
      expect(result.lastContactedAt).toBeNull();
      expect(result.daysSinceLastContact).toBeNull();
    });

    it('returns "never_contacted" when all contacts have null lastContactedAt', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { lastContactedAt: null },
        { lastContactedAt: null }
      ]);

      const result = await service.deriveGoingCold("acc-1");

      expect(result.status).toBe("never_contacted");
    });

    it('returns "warm" when last contact was recent (< 30 days)', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { lastContactedAt: daysAgo(5) },
        { lastContactedAt: daysAgo(10) }
      ]);

      const result = await service.deriveGoingCold("acc-1");

      expect(result.status).toBe("warm");
      expect(result.daysSinceLastContact).toBeLessThan(30);
    });

    it('returns "cooling" when last contact was 30–59 days ago', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { lastContactedAt: daysAgo(45) }
      ]);

      const result = await service.deriveGoingCold("acc-1");

      expect(result.status).toBe("cooling");
      expect(result.daysSinceLastContact).toBeGreaterThanOrEqual(30);
      expect(result.daysSinceLastContact).toBeLessThan(60);
    });

    it('returns "cold" when last contact was 60+ days ago', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { lastContactedAt: daysAgo(90) }
      ]);

      const result = await service.deriveGoingCold("acc-1");

      expect(result.status).toBe("cold");
      expect(result.daysSinceLastContact).toBeGreaterThanOrEqual(60);
    });

    it("uses the most recent contact across multiple contacts", async () => {
      // One recent (5 days), one old (100 days) — should return "warm"
      mockPrisma.contact.findMany.mockResolvedValue([
        { lastContactedAt: daysAgo(100) },
        { lastContactedAt: daysAgo(5) }
      ]);

      const result = await service.deriveGoingCold("acc-1");

      expect(result.status).toBe("warm");
    });

    it("throws NotFoundException when account does not exist", async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(service.deriveGoingCold("no-such-acc")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ── repeatBusinessSignal ───────────────────────────────────────────────────

  describe("repeatBusinessSignal", () => {
    it("returns zero-signal when account has no linked client", async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: "acc-1",
        clientId: null,
        client: null
      });

      const result = await service.repeatBusinessSignal("acc-1");

      expect(result.hasRepeatBusiness).toBe(false);
      expect(result.tenderCount).toBe(0);
      expect(result.winCount).toBe(0);
    });

    it("returns hasRepeatBusiness=false when winCount < 2", async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: "acc-1",
        clientId: "client-1",
        client: {
          winCount: 1,
          tenderCount: 3,
          winRate: { toNumber: () => 0.33 },
          lastTenderAt: new Date("2026-06-01"),
          lastWonAt: new Date("2026-04-01")
        }
      });

      const result = await service.repeatBusinessSignal("acc-1");

      expect(result.hasRepeatBusiness).toBe(false);
      expect(result.winCount).toBe(1);
    });

    it("returns hasRepeatBusiness=true when winCount >= 2", async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: "acc-1",
        clientId: "client-1",
        client: {
          winCount: 3,
          tenderCount: 5,
          winRate: { toNumber: () => 0.6 },
          lastTenderAt: new Date("2026-07-01"),
          lastWonAt: new Date("2026-07-01")
        }
      });

      const result = await service.repeatBusinessSignal("acc-1");

      expect(result.hasRepeatBusiness).toBe(true);
      expect(result.winRate).toBeCloseTo(0.6);
    });

    it("throws NotFoundException when account does not exist", async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.repeatBusinessSignal("no-such-acc")
      ).rejects.toThrow(NotFoundException);
    });
  });
});
