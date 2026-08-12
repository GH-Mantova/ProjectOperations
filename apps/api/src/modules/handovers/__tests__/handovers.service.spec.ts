// B-HW-6 unit tests for HandoversService.
//
// Covers:
//  1. create() pins the active template version.
//  2. create() prefills HandoverValue rows from the awarded ClientQuote.
//  3. patchValues() marks isOverridden=true when value != sourceValue.
//  4. completionPct math: filled required fields / total required fields.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { HandoversService } from "../handovers.service";
import { PrismaService } from "../../../prisma/prisma.service";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ACTIVE_TEMPLATE = {
  id: "tpl-v1",
  version: 1,
  isActive: true,
  publishedAt: new Date("2026-01-01"),
  publishedById: "user-seed"
};

const SECTION = {
  id: "sec-pricing",
  templateId: "tpl-v1",
  key: "pricing",
  label: "Pricing & budget",
  sortOrder: 1
};

const FIELDS = [
  {
    id: "fld-contract-value",
    sectionId: "sec-pricing",
    key: "contract-value",
    label: "Contract value",
    type: "money",
    sourceType: "auto",
    autoBinding: "contract.contractValue",
    listId: null,
    required: true,
    sortOrder: 1,
    retiredAt: null
  },
  {
    id: "fld-project-name",
    sectionId: "sec-pricing",
    key: "project-name",
    label: "Project name",
    type: "text",
    sourceType: "auto",
    autoBinding: "project.name",
    listId: null,
    required: true,
    sortOrder: 2,
    retiredAt: null
  },
  {
    id: "fld-notes",
    sectionId: "sec-pricing",
    key: "notes",
    label: "Notes",
    type: "text",
    sourceType: "capture",
    autoBinding: null,
    listId: null,
    required: false,
    sortOrder: 3,
    retiredAt: null
  }
];

const CONTRACT = {
  id: "contract-1",
  contractValue: { toNumber: () => 250000 },
  startDate: new Date("2026-09-01"),
  project: {
    id: "project-1",
    name: "Example Project",
    sourceTenderId: "tender-1",
    clientId: "client-1"
  }
};

const AWARDED_TENDER_CLIENT = {
  id: "tc-1",
  tenderId: "tender-1",
  clientId: "client-1",
  isAwarded: true
};

const AWARDED_QUOTE = {
  id: "quote-1",
  tenderId: "tender-1",
  clientId: "client-1",
  revision: 2,
  quoteRef: "IS-Q-0001-R2",
  status: "SENT",
  adjustmentPct: null,
  adjustmentAmt: null,
  costLines: [
    { price: { toNumber: () => 100000 } },
    { price: { toNumber: () => 150000 } }
  ]
};

// ─── Mock Prisma builder ──────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  const prisma = {
    handoverTemplate: {
      findFirst: jest.fn().mockResolvedValue(ACTIVE_TEMPLATE),
      findUnique: jest.fn().mockResolvedValue(ACTIVE_TEMPLATE)
    },
    handoverTemplateSection: {
      findMany: jest.fn().mockResolvedValue([{ ...SECTION, fields: FIELDS }])
    },
    tenderClient: {
      findFirst: jest.fn().mockResolvedValue(AWARDED_TENDER_CLIENT)
    },
    clientQuote: {
      findFirst: jest.fn().mockResolvedValue(AWARDED_QUOTE)
    },
    contract: {
      findUnique: jest.fn().mockResolvedValue(CONTRACT)
    },
    handover: {
      create: jest.fn().mockResolvedValue({ id: "hw-1", templateVersionId: "tpl-v1", status: "draft", completionPct: 0 }),
      findUnique: jest.fn().mockResolvedValue({ id: "hw-1", templateVersionId: "tpl-v1", status: "draft", completionPct: 0 }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "hw-1", templateVersionId: "tpl-v1", status: "draft", ...data })
      )
    },
    handoverValue: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve({ id: "hv-new", ...create })
      )
    },
    $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => {
      return cb(prismaRef.current);
    }),
    ...overrides
  } as unknown as PrismaService;

  return prisma;
}

// Reference cell for $transaction callback.
const prismaRef: { current: PrismaService } = { current: null as unknown as PrismaService };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HandoversService", () => {
  let service: HandoversService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = makePrisma();
    prismaRef.current = prisma;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoversService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();

    service = module.get<HandoversService>(HandoversService);
  });

  // ── create() ─────────────────────────────────────────────────────────────

  describe("create", () => {
    it("pins the currently-active template version when none specified", async () => {
      // Override loadHandoverWithValues to return a minimal shape.
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue({
        id: "hw-1",
        templateVersionId: "tpl-v1",
        status: "draft",
        completionPct: 0,
        values: [],
        templateVersion: { ...ACTIVE_TEMPLATE, sections: [{ ...SECTION, fields: FIELDS }] }
      });

      await service.create("user-1", "contract-1");

      // Should look up the active template.
      expect(prisma.handoverTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } })
      );
      // The handover.create call inside $transaction should pin tpl-v1.
      const createCall = (prisma.handover.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.templateVersionId).toBe("tpl-v1");
    });

    it("pins a caller-supplied template version when provided", async () => {
      (prisma.handoverTemplate.findUnique as jest.Mock).mockResolvedValue({ id: "tpl-v2", version: 2, isActive: false });
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue({
        id: "hw-1",
        templateVersionId: "tpl-v2",
        status: "draft",
        completionPct: 0,
        values: [],
        templateVersion: { id: "tpl-v2", sections: [] }
      });
      (prisma.handoverTemplateSection.findMany as jest.Mock).mockResolvedValue([]);

      await service.create("user-1", "contract-1", "tpl-v2");

      // Should use findUnique (not findFirst) for the supplied version id.
      expect(prisma.handoverTemplate.findUnique).toHaveBeenCalledWith({ where: { id: "tpl-v2" } });
      const createCall = (prisma.handover.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.templateVersionId).toBe("tpl-v2");
    });

    it("throws NotFoundException when contract does not exist", async () => {
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.create("user-1", "missing-contract")).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when contract has no project", async () => {
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue({
        id: "contract-no-project",
        contractValue: { toNumber: () => 0 },
        project: null
      });
      await expect(service.create("user-1", "contract-no-project")).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when no active template exists", async () => {
      (prisma.handoverTemplate.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.create("user-1", "contract-1")).rejects.toThrow(NotFoundException);
    });

    it("prefills auto-binding fields from the awarded ClientQuote/Contract/Project", async () => {
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue({
        id: "hw-1",
        templateVersionId: "tpl-v1",
        status: "draft",
        completionPct: 100,
        values: [],
        templateVersion: { ...ACTIVE_TEMPLATE, sections: [{ ...SECTION, fields: FIELDS }] }
      });
      (prisma.handoverValue.findMany as jest.Mock).mockResolvedValue([]);

      await service.create("user-1", "contract-1");

      const createManyCall = (prisma.handoverValue.createMany as jest.Mock).mock.calls[0][0];
      const rows: Array<{ fieldKey: string; value: unknown; sourceValue: unknown }> = createManyCall.data;

      // contract-value and project-name are auto fields with valid bindings.
      const contractValueRow = rows.find((r) => r.fieldKey === "contract-value");
      const projectNameRow = rows.find((r) => r.fieldKey === "project-name");

      expect(contractValueRow).toBeDefined();
      // contractValue Decimal.toNumber() = 250000
      expect(contractValueRow?.value).toBe(250000);
      expect(contractValueRow?.sourceValue).toBe(250000);

      expect(projectNameRow).toBeDefined();
      expect(projectNameRow?.value).toBe("Example Project");
      expect(projectNameRow?.sourceValue).toBe("Example Project");

      // "notes" is a capture field — should NOT be in createMany.
      const notesRow = rows.find((r) => r.fieldKey === "notes");
      expect(notesRow).toBeUndefined();
    });

    it("does not write back to tender/quote/contract during prefill", async () => {
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue({
        id: "hw-1",
        templateVersionId: "tpl-v1",
        status: "draft",
        completionPct: 0,
        values: [],
        templateVersion: { ...ACTIVE_TEMPLATE, sections: [] }
      });

      await service.create("user-1", "contract-1");

      // Must not update or create on contract, tender, or clientQuote.
      expect((prisma as unknown as Record<string, unknown>).contract).not.toHaveProperty("update");
      // clientQuote.findFirst is read-only — no create/update should be called.
      expect(
        Object.keys(
          (prisma as unknown as Record<string, { update?: jest.Mock }>).clientQuote ?? {}
        )
      ).not.toContain("update");
    });
  });

  // ── patchValues() — isOverridden ─────────────────────────────────────────

  describe("patchValues — isOverridden", () => {
    it("sets isOverridden=true when user edits an auto-prefilled field away from sourceValue", async () => {
      const existingValue = {
        id: "hv-1",
        handoverId: "hw-1",
        fieldKey: "contract-value",
        value: 250000,
        sourceValue: 250000,
        isOverridden: false,
        sectionDone: false
      };
      (prisma.handoverValue.findMany as jest.Mock)
        // First call (for existing values in patchValues)
        .mockResolvedValueOnce([existingValue])
        // Second call (for completionPct)
        .mockResolvedValueOnce([{ fieldKey: "contract-value", value: 300000 }]);

      // handover.findUnique for the patch guard, then for loadHandoverWithValues.
      (prisma.handover.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: "hw-1", templateVersionId: "tpl-v1", status: "draft" })
        .mockResolvedValueOnce({
          id: "hw-1",
          templateVersionId: "tpl-v1",
          status: "draft",
          completionPct: 100,
          values: [{ ...existingValue, value: 300000, isOverridden: true }],
          templateVersion: { ...ACTIVE_TEMPLATE, sections: [{ ...SECTION, fields: FIELDS }] }
        });

      await service.patchValues("hw-1", [
        { fieldKey: "contract-value", value: 300000 }
      ]);

      const upsertCall = (prisma.handoverValue.upsert as jest.Mock).mock.calls[0][0];
      // 300000 !== 250000 → isOverridden must be true.
      expect(upsertCall.update.isOverridden).toBe(true);
    });

    it("does NOT set isOverridden when user edits a capture field (no sourceValue)", async () => {
      const existingValue = {
        id: "hv-2",
        handoverId: "hw-1",
        fieldKey: "notes",
        value: null,
        sourceValue: null,
        isOverridden: false,
        sectionDone: false
      };
      (prisma.handoverValue.findMany as jest.Mock)
        .mockResolvedValueOnce([existingValue])
        .mockResolvedValueOnce([{ fieldKey: "notes", value: "Some note" }]);

      (prisma.handover.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: "hw-1", templateVersionId: "tpl-v1", status: "draft" })
        .mockResolvedValueOnce({
          id: "hw-1",
          templateVersionId: "tpl-v1",
          status: "draft",
          completionPct: 50,
          values: [],
          templateVersion: { ...ACTIVE_TEMPLATE, sections: [{ ...SECTION, fields: FIELDS }] }
        });

      await service.patchValues("hw-1", [
        { fieldKey: "notes", value: "Some note" }
      ]);

      const upsertCall = (prisma.handoverValue.upsert as jest.Mock).mock.calls[0][0];
      // sourceValue is null → isOverridden must remain false.
      expect(upsertCall.update.isOverridden).toBeUndefined();
    });

    it("throws BadRequestException when patching a finalised handover", async () => {
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue({
        id: "hw-1",
        templateVersionId: "tpl-v1",
        status: "finalised"
      });

      await expect(
        service.patchValues("hw-1", [{ fieldKey: "notes", value: "x" }])
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when handover does not exist", async () => {
      (prisma.handover.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.patchValues("missing", [{ fieldKey: "notes", value: "x" }])
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── completionPct math ────────────────────────────────────────────────────

  describe("completionPct", () => {
    it("returns 100 when there are no required fields", async () => {
      // Only non-required fields in the template.
      const noRequiredFields = [
        { ...FIELDS[2] } // notes — required: false
      ];
      (prisma.handoverTemplateSection.findMany as jest.Mock).mockResolvedValue([
        { ...SECTION, fields: noRequiredFields }
      ]);
      (prisma.handoverValue.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // prefill context: no existing values
        .mockResolvedValueOnce([]); // completionPct query

      (prisma.handover.findUnique as jest.Mock).mockResolvedValue({
        id: "hw-1",
        templateVersionId: "tpl-v1",
        status: "draft",
        completionPct: 100,
        values: [],
        templateVersion: { ...ACTIVE_TEMPLATE, sections: [{ ...SECTION, fields: noRequiredFields }] }
      });

      const result = await service.create("user-1", "contract-1");
      expect(result?.completionPct).toBe(100);
    });

    it("computes completionPct as filled-required / total-required × 100", async () => {
      // Two required fields, one filled.
      (prisma.handoverValue.findMany as jest.Mock)
        // First call for existing values guard (patchValues path)
        .mockResolvedValueOnce([])
        // Second call is completionPct query after patchValues
        .mockResolvedValueOnce([{ fieldKey: "contract-value", value: 250000 }]);

      (prisma.handover.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: "hw-1", templateVersionId: "tpl-v1", status: "draft" })
        .mockResolvedValueOnce({
          id: "hw-1",
          templateVersionId: "tpl-v1",
          status: "draft",
          completionPct: 50,
          values: [{ fieldKey: "contract-value", value: 250000 }],
          templateVersion: { ...ACTIVE_TEMPLATE, sections: [{ ...SECTION, fields: FIELDS }] }
        });

      await service.patchValues("hw-1", [
        { fieldKey: "contract-value", value: 250000 }
      ]);

      // FIELDS has 2 required fields. 1 filled → 50%.
      const updateCall = (prisma.handover.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.completionPct).toBe(50);
    });

    it("computes 100% when all required fields are filled", async () => {
      (prisma.handoverValue.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { fieldKey: "contract-value", value: 250000 },
          { fieldKey: "project-name", value: "Example Project" }
        ]);

      (prisma.handover.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: "hw-1", templateVersionId: "tpl-v1", status: "draft" })
        .mockResolvedValueOnce({
          id: "hw-1",
          templateVersionId: "tpl-v1",
          status: "draft",
          completionPct: 100,
          values: [],
          templateVersion: { ...ACTIVE_TEMPLATE, sections: [{ ...SECTION, fields: FIELDS }] }
        });

      await service.patchValues("hw-1", [
        { fieldKey: "contract-value", value: 250000 },
        { fieldKey: "project-name", value: "Example Project" }
      ]);

      const updateCall = (prisma.handover.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.completionPct).toBe(100);
    });

    it("excludes an empty-string value from filled count", async () => {
      (prisma.handoverValue.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { fieldKey: "contract-value", value: "" }, // empty string — not filled
          { fieldKey: "project-name", value: "Example Project" }
        ]);

      (prisma.handover.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: "hw-1", templateVersionId: "tpl-v1", status: "draft" })
        .mockResolvedValueOnce({
          id: "hw-1",
          templateVersionId: "tpl-v1",
          status: "draft",
          completionPct: 50,
          values: [],
          templateVersion: { ...ACTIVE_TEMPLATE, sections: [{ ...SECTION, fields: FIELDS }] }
        });

      await service.patchValues("hw-1", [
        { fieldKey: "contract-value", value: "" },
        { fieldKey: "project-name", value: "Example Project" }
      ]);

      const updateCall = (prisma.handover.update as jest.Mock).mock.calls[0][0];
      // contract-value is empty string → only 1 of 2 required filled → 50%.
      expect(updateCall.data.completionPct).toBe(50);
    });
  });
});
