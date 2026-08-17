// B-HW-9: Unit tests for HandoverComplianceService.
//
// All Prisma calls are mocked via a factory helper that mirrors the pattern
// used in handovers.service.spec.ts.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { HandoverComplianceService } from "../handover-compliance.service";
import { PrismaService } from "../../../prisma/prisma.service";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DRAFT_HANDOVER = {
  id: "hw-1",
  tenderId: "tender-1",
  status: "draft"
};

const FINALISED_HANDOVER = {
  id: "hw-final",
  tenderId: "tender-1",
  status: "finalised"
};

const COMPLIANCE_ROW = {
  id: "ci-1",
  handoverId: "hw-1",
  type: "SWMS — General site works",
  origin: "suggested",
  responsibleParty: "us",
  status: "pending",
  docRef: null,
  createdAt: new Date("2026-08-17T00:00:00Z"),
  updatedAt: new Date("2026-08-17T00:00:00Z")
};

const SCOPE_ITEM = {
  id: "si-1",
  tenderId: "tender-1",
  rowType: "demolition",
  description: "Strip and remove existing structure",
  cardId: "card-1",
  card: { discipline: "DEM" }
};

// ─── Mock Prisma builder ──────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    handover: {
      findUnique: jest.fn().mockResolvedValue(DRAFT_HANDOVER)
    },
    handoverComplianceItem: {
      findMany: jest.fn().mockResolvedValue([COMPLIANCE_ROW]),
      findUnique: jest.fn().mockResolvedValue(COMPLIANCE_ROW),
      create: jest.fn().mockResolvedValue({ ...COMPLIANCE_ROW, id: "ci-new" }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...COMPLIANCE_ROW, ...data })
      ),
      delete: jest.fn().mockResolvedValue(COMPLIANCE_ROW)
    },
    scopeOfWorksItem: {
      findMany: jest.fn().mockResolvedValue([SCOPE_ITEM])
    },
    ...overrides
  } as unknown as PrismaService;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HandoverComplianceService", () => {
  let service: HandoverComplianceService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoverComplianceService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();

    service = module.get<HandoverComplianceService>(HandoverComplianceService);
  });

  // ── list() ───────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns rows for an existing handover", async () => {
      const result = await service.list("hw-1");
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("SWMS — General site works");
      expect(prisma.handoverComplianceItem.findMany as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { handoverId: "hw-1" } })
      );
    });

    it("throws NotFoundException when handover does not exist", async () => {
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.list("hw-missing")).rejects.toThrow(NotFoundException);
    });
  });

  // ── deriveSuggestions() ───────────────────────────────────────────────────────

  describe("deriveSuggestions", () => {
    it("throws BadRequestException on a finalised handover", async () => {
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue(FINALISED_HANDOVER);
      await expect(service.deriveSuggestions("hw-final")).rejects.toThrow(BadRequestException);
    });

    it("creates rows for new suggestions that do not already exist", async () => {
      // No existing suggested rows.
      (prisma.handoverComplianceItem.findMany as jest.Mock)
        .mockResolvedValueOnce([])  // first call: check existing suggested
        .mockResolvedValueOnce([]); // second call: list after upsert

      await service.deriveSuggestions("hw-1");

      expect(prisma.handoverComplianceItem.createMany as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: "SWMS — General site works", origin: "suggested" })
          ])
        })
      );
    });

    it("does NOT create a row when a suggested row with that type already exists", async () => {
      // Simulate an existing suggested row for demolition SWMS.
      const existingSuggested = [
        { type: "SWMS — General site works" },
        { type: "Form 65 — Demolition" },
        { type: "SWMS — Demolition" },
        { type: "Demolition permit" }
      ];
      (prisma.handoverComplianceItem.findMany as jest.Mock)
        .mockResolvedValueOnce(existingSuggested) // check existing
        .mockResolvedValueOnce([]);               // list call

      await service.deriveSuggestions("hw-1");

      // createMany should not be called (all suggestions already exist).
      expect(prisma.handoverComplianceItem.createMany as jest.Mock).not.toHaveBeenCalled();
    });

    it("does not clobber an existing suggested row's status or docRef", async () => {
      // Existing row has user-edited status and docRef.
      const existingWithEdits = [
        { type: "SWMS — General site works" }
      ];
      (prisma.handoverComplianceItem.findMany as jest.Mock)
        .mockResolvedValueOnce(existingWithEdits) // check existing
        .mockResolvedValueOnce([                  // list call
          {
            ...COMPLIANCE_ROW,
            status: "submitted",
            docRef: "sp://docs/swms-general.pdf"
          }
        ]);

      const result = await service.deriveSuggestions("hw-1");

      // The existing row's status and docRef must remain as-is.
      expect(result[0].status).toBe("submitted");
      expect(result[0].docRef).toBe("sp://docs/swms-general.pdf");

      // update should NOT have been called for the existing row.
      expect(prisma.handoverComplianceItem.update as jest.Mock).not.toHaveBeenCalled();
    });
  });

  // ── addManual() ──────────────────────────────────────────────────────────────

  describe("addManual", () => {
    it("writes a row with origin='manual'", async () => {
      await service.addManual("hw-1", {
        type: "Custom compliance requirement",
        responsibleParty: "client"
      });

      expect(prisma.handoverComplianceItem.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            origin: "manual",
            responsibleParty: "client",
            status: "pending"
          })
        })
      );
    });

    it("uses the supplied status when provided", async () => {
      await service.addManual("hw-1", {
        type: "Something",
        responsibleParty: "us",
        status: "submitted"
      });

      expect(prisma.handoverComplianceItem.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "submitted" })
        })
      );
    });

    it("throws BadRequestException on empty type", async () => {
      await expect(
        service.addManual("hw-1", { type: "   ", responsibleParty: "us" })
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException on a finalised handover", async () => {
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue(FINALISED_HANDOVER);
      await expect(
        service.addManual("hw-final", { type: "Something", responsibleParty: "us" })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("patches only the supplied fields", async () => {
      await service.update("ci-1", { status: "approved" });

      expect(prisma.handoverComplianceItem.update as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ci-1" },
          data: expect.objectContaining({ status: "approved" })
        })
      );
    });

    it("throws BadRequestException on a finalised handover", async () => {
      (prisma.handoverComplianceItem.findUnique as jest.Mock).mockResolvedValue({
        ...COMPLIANCE_ROW,
        handoverId: "hw-final"
      });
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue(FINALISED_HANDOVER);
      await expect(service.update("ci-1", { status: "approved" })).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws NotFoundException when item does not exist", async () => {
      (prisma.handoverComplianceItem.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.update("ci-missing", { status: "approved" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws BadRequestException when type is supplied as empty string", async () => {
      await expect(service.update("ci-1", { type: "" })).rejects.toThrow(BadRequestException);
    });
  });

  // ── remove() ─────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("deletes the row when handover is editable", async () => {
      await service.remove("ci-1");
      expect(prisma.handoverComplianceItem.delete as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "ci-1" } })
      );
    });

    it("throws BadRequestException when handover is finalised", async () => {
      (prisma.handoverComplianceItem.findUnique as jest.Mock).mockResolvedValue({
        ...COMPLIANCE_ROW,
        handoverId: "hw-final"
      });
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue(FINALISED_HANDOVER);
      await expect(service.remove("ci-1")).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when item does not exist", async () => {
      (prisma.handoverComplianceItem.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.remove("ci-missing")).rejects.toThrow(NotFoundException);
    });
  });
});
